(function(){
	"use strict";
	
	// Abort script if running outside GitHub
	if("github.com" !== document.location.host)
		return alert("This script must be run whilst on github.com");
	
	
	// Don't clobber any existing globals
	if(window.harvest || window.silo) return;


	// URL constants for different search modes
	const BY_MATCH  = "";
	const BY_NEWEST = "&s=indexed&o=desc";
	const BY_OLDEST = "&s=indexed&o=asc";
	
	window.silo     = {};
	window.harvest  = harvest;
	
	// Ensure the silo's reap method can't be reassigned
	Object.defineProperty(window.silo, "reap", {
		value: reap,
		writable: false,
		configurable: false
	});
	
	// An easier method of accessing the last successful search result
	let lastHarvest = null;
	Object.defineProperty(window, "that", {
		get: () => lastHarvest ? reap(lastHarvest) : ""
	});

	// Prevent accidental page navigation from interrupting a harvest
	let harvesting = false;
	window.addEventListener("beforeunload", e => harvesting
		? e.returnValue = "Your harvest hasn't finished. Are you sure you wish to cancel?"
		: undefined);
	
	// Request permission to show desktop notifications, if needed
	Notification.requestPermission();
	
	
	/**
	 * Collate a list of URLs of public search results for a filetype.
	 *
	 * @param {String}  realQuery - What we're really searching for
	 * @param {String} bogusQuery - What GitHub thinks we're searching for
	 * @example harvest("extension:pic")
	 * @return {Promise}
	 * @public
	 */
	function harvest(realQuery, bogusQuery = null){
		harvesting = true;
		
		if(!/^extension:|filename:|in:filename/.test(realQuery))
			realQuery = "extension:" + realQuery;
		
		return new Promise(resolve => {
			
			// Default to the usual "nothack" with a random number attached
			if(!bogusQuery){
				const rand = Math.random(1e6).toString(16).replace(/\./, "").toUpperCase();
				bogusQuery = "NOT nothack" + rand;
			}
			
			const query = encodeURIComponent(`${realQuery} ${bogusQuery}`).replace(/%20/g, "+");
			const url   = `https://github.com/search?q=${query}&type=Code`;
			
			return runSearch(url, BY_MATCH, realQuery).then(numResults => {
				return numResults > 1000
					? runSearch(url, BY_NEWEST, realQuery)
						.then(() => runSearch(url, BY_OLDEST, realQuery))
						.then(() => resolve())
					: resolve();
			}).then(() => {
				const body = "Run `copy(that);` in your console to copy the URLs to your clipboard.";
				new Notification(`Harvest complete for ${realQuery}`, {body});
				lastHarvest = realQuery;
				harvesting = false;
			});
		}).catch(error => {
			harvesting = false;
			throw error;
		});
	}
	
	
	/**
	 * Load each page of results for a file search.
	 *
	 * @param {String}   url - Absolute URL, sans page variable ("?p=1")
	 * @param {String}  vars - Additional search variables, if any
	 * @param {String} query - File-related half of search's query ("extension:pic")
	 * @return {Promise}
	 * @internal
	 */
	function runSearch(url, vars, query){
		const results = silo[query] || (silo[query] = {length: 0});
		
		return new Promise((resolve, reject) => {
			let page = 0;
			let pageCount;
			let resultCount;
			return next().then(() => Promise.resolve(resultCount));
			
			async function next(){
				const response = await grab(url + vars + (page ? "&p=" + (page + 1) : ""));
				const htmlTree = await response.text().then(htmlData => {
					const frag = document.createDocumentFragment();
					const root = frag.appendChild(document.createElement("div"));
					root.insertAdjacentHTML("afterbegin", htmlData);
					frag.root  = root;
					return frag;
				});
				const $  = s => htmlTree.querySelector(s);
				const $$ = s => htmlTree.querySelectorAll(s);
				
				// No results. Reject.
				if($("div.blankslate")){
					const notice = "Must include at least one user, organization, or repository";
					const match  = notice.split(" ").join("\\s+");
					const reason = new RegExp(match, "i").test(html)
						? ["Failed.", "GitHub's doing that weird thing again:", `\t> "${notice}"`].join("\n\n")
						: "No results";
					return reject(reason);
				}
				
				// Extract the result-entry row from this page of results
				const listContainer = $("#code_search_results > .code-list") || die("Search-result list not found");
				const listItems = listContainer.querySelectorAll(".code-list-item");
				if(listItems.length < 1) die("Expected at least one entry to match `.code-list-item`");

				for(const result of results){
					const avatar = result.querySelectorAll("img.avatar[alt^='@']");
					const link   = result.querySelector("a.text-bold + a[href]");
					if(avatar.length && link && !results[link.href]){
						++results.length;
						results[link.href] = link.href.replace(
							/^((?:\/[^/]+){2})\/blob(?=\/)/gmi,
							"https://raw.githubusercontent.com$1"
						);
					}
				}


				// Examine how many pages there are
				if(undefined === pageCount){

					// Get all numeric links in pagination footer, using the last button's
					// number to determine how many result pages in total were found.
					const pageLinks = Array.from($$(".pagination > a")).filter(n => Number.isNaN(+n));
					const lastLink  = pageLinks.pop();

					// Two or more pages: Find out how many results we're lookin' at.
					if(lastLink){
						pageCount = lastLink.textContent;

						// This needs to point to the title that says "Showing 263,443,068 code results"
						const h3 = $(".codesearch-results > .pl-2 h3");
						if(h3 && h3.textContent.match(/\b([0-9.,\s]+)\s.*?code\s+results/i))
							resultCount = +(RegExp.$1.replace(/\D/g, ""));
						else{
							die("Unable to extract result count from page's header.");
							console.error(error);
							throw error;
						}
					}

					// If null, it means there was only one page to load
					else{
						resultCount = results.length;
						pageCount   = 1;
					}
				}

				++page;

				// No more pages to load
				if(page >= pageCount)
					return resolve(resultCount);

				// Throttle the next request so GitHub doesn't bite our head off
				return wait(2000).then(() => next());
			}
		});
	}


	/**
	 * Return a {@link Promise} that resolves after a specified delay.
	 *
	 * @param {Number} ms
	 * @return {Promise}
	 */
	function wait(ms){
		return new Promise(resolve => setTimeout(() => resolve(), ms));
	}
	
	
	/**
	 * Print an error message before throwing an error object.
	 * The provided message is assigned to the thrown Error's
	 * `message` property.
	 *
	 * @param {String} errorMessage
	 * @throws {Error}
	 */
	function die(errorMessage){
		throw Object.assign(new Error(), {
			name: "Unexpected Markup Error",
			message: errorMessage,
			fileName: "harvester.js",
		});
	}
	

	/**
	 * Load a resource by URL.
	 *
	 * @param {String} url
	 * @return {Promise}
	 * @internal
	 */
	function grab(url){
		return new Promise((resolve, reject) => {
			const req = new XMLHttpRequest();
			req.open("GET", url);
			req.addEventListener("readystatechange", () => {
				if(XMLHttpRequest.DONE === req.readyState)
					resolve({ text: () => Promise.resolve(req.response) });
			});
			for(const event of "abort error timeout".split(" "))
				req.addEventListener(event, e => reject(e));
			req.send();
		});
	}



	/**
	 * Retrieve URLs collected for a previously-run query.
	 *
	 * @example silo.reap("foo");
	 * @param {String} query
	 * @return {String} List of URLs, separated by newline
	 * @internal
	 */
	function reap(query){
		
		// No query-type included, figure out what the user meant
		if(!/^extension:|filename:/.test(query)){
			const ex = "extension:" + query in silo;
			const fn = "filename:" + query in silo;
			
			if(ex && fn){
				const msg = `Both extension:${query} and filename:${query} properties exist in silo.`;
				throw new ReferenceError(msg + " Which did you mean?");
			}
			if(ex)      query = "extension:" + query;
			else if(fn) query = "filename:"  + query;
		}
		
		const urls = silo[query] || {};
		
		return Object.keys(urls)
			.filter(a => a !== "length")
			.map(key => urls[key])
			.sort((a, b) => {
				a = a.toLowerCase();
				b = b.toLowerCase();
				if(a < b) return -1;
				if(a > b) return  1;
				return 0;
			})
			.join("\n");
	}
}());
