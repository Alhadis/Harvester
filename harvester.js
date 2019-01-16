/* globals silo */
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
	Object.defineProperties(window.silo, {
		badApples: {
			value: [],
			writable: false,
			configurable: false,
		},
		reap: {
			value: reap,
			writable: false,
			configurable: false,
		},
	});
	
	// An easier method of accessing the last successful search result
	let lastHarvest = null;
	Object.defineProperty(window, "that", {
		get: () => lastHarvest ? reap(lastHarvest) : "",
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
	async function harvest(realQuery, bogusQuery = null){
		if(!realQuery){
			const {pathname, search} = window.location;
			if("/search" === pathname && /[?&]q=[^?%\s]/.test(search)){
				bogusQuery = new URL(window.location)
					.searchParams.get("q")
					.replace(/\s+NOT\s+nothack\s*$/, "")
					.replace(/(?:^|\s+)(filename|extension):(\S+)/, (_, key, value) => {
						realQuery = key + ":" + value;
						return "";
					}).trim();
				
				// Check if we still need a hothack (such as if bogusQuery only contains modifier keywords)
				if(!bogusQuery.split(/(?<!(?:^|\s)NOT)(?<=\S+)(?=\s+)/).some(chunk => /(?:\s|^)NOT\s+/.test(chunk)))
					bogusQuery += " " + nothack();
				
				if(realQuery)
					return harvest(realQuery, bogusQuery || null);
			}
			throw new TypeError("Missing query parameter");
		}
		
		harvesting = true;
		
		if(!/extension:|filename:|in:file|in:path/.test(realQuery))
			realQuery = `extension:${realQuery}`;
		
		// Default to the usual "nothack" with a random number attached
		if(null == bogusQuery)
			bogusQuery = nothack();
		
		
		const query = encodeURIComponent(`${realQuery} ${bogusQuery}`).replace(/%20/g, "+");
		const url   = `https://github.com/search?q=${query}&type=Code`;
		
		try{
			const numResults = await runSearch(url, BY_MATCH, realQuery);
			if(numResults > 1000){
				await runSearch(url, BY_NEWEST, realQuery);
				await runSearch(url, BY_OLDEST, realQuery);
			}
			const body = "Run `copy(that);` in your console to copy the URLs to your clipboard.";
			new Notification(`Harvest complete for ${realQuery}`, {body});
			lastHarvest = realQuery;
			harvesting = false;
		}
		catch(error){
			harvesting = false;
			console.error(error);
			if(parseHTML.lastResult)
				console.log({lastPageSnapshot: parseHTML.lastResult});
			throw error;
		}
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
	async function runSearch(url, vars, query){
		const results = silo[query] || (silo[query] = {length: 0});
		let page = 0;
		let pageCount;
		let resultCount;
		return resultCount = await next();


		async function loadNextPage(){
			++page;

			// No more pages to load
			if(page >= pageCount)
				return resultCount;

			// Throttle the next request so GitHub doesn't bite our head off
			await wait(2000);
			return next();
		}
		
		
		async function next(){
			const pageURL  = url + vars + (page ? `&p=${page+1}` : "");
			const response = await grab(pageURL);
			const htmlTree = await response.text().then(html => {
				html = html.replace(/<img(?=\s)/gi, "<hr");
				return parseHTML(html);
			});
			const $  = s => htmlTree.querySelector(s);
			const $$ = s => htmlTree.querySelectorAll(s);
			
			// No results. Reject.
			if($("div.blankslate")){
				const notice = "Must include at least one user, organization, or repository";
				const match  = notice.split(" ").join("\\s+");
				new RegExp(match, "i").test(htmlTree.textContent)
					? ["Failed.", "GitHub's doing that weird thing again:", `\t> "${notice}"`].join("\n\n")
					: "No results";
				console.error(`Skipping this one: ${pageURL}\n`);
				console.error("Find it in window.silo.badApples");
				window.silo.badApples.push(pageURL);
				loadNextPage();
			}
			
			// Extract the result-entry row from this page of results
			const listContainer = $("#code_search_results > .code-list") || die("Search-result list not found");
			const listItems = listContainer.querySelectorAll(".code-list-item");
			if(listItems.length < 1) die("Expected at least one entry to match `.code-list-item`");

			for(const item of listItems){
				const avatar = item.querySelectorAll("hr.avatar[alt^='@']");
				const link   = item.querySelector("a.text-bold + a[href]");
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

				// Get all numeric links in pagination footer
				const pageLinks = $$(".pagination > a[href]");

				// Two or more pages: Find out how many results we're lookin' at.
				if(pageLinks.length){
					const pageIndexes = Array.from(pageLinks)
						.filter(a => /^\s*[0-9]+\s*$/.test(a.textContent))
						.map(a => parseInt(a.textContent.trim()));
					pageCount = Math.max(...pageIndexes);

					// Title that says "Showing 263,443,068 code results"
					const h3 = $(".codesearch-results h3");
					if(h3 && h3.textContent.match(/\b([0-9.,\s]+)\s/)){
						resultCount = +(RegExp.$1.replace(/\D/g, ""));

						// If the matched text doesn't include "code results", then it's too
						// high a risk we've extracted a number from a different heading.
						if(!/\b(code\s+results?)\b/.test(h3.textContent)){
							let message = `Missing text found where "${resultCount} code results" expected. `;
							message    += "Please double-check <h3> contains correct number of search results";
							return die(message);
						}
					}
					else die("Unable to extract total number of results from header");
				}

				// If null, it means there was only one page to load
				else{
					resultCount = results.length;
					pageCount   = 1;
				}
			}

			return loadNextPage();
		}
	}
	
	
	


	/**
	 * Safely parse a block of HTML source as a detached DOM tree.
	 *
	 * @param {String} source - Raw HTML source
	 * @return {DocumentFragment}
	 * @internal
	 */
	function parseHTML(source){
		const frag = document.createDocumentFragment();
		const root = frag.appendChild(document.createElement("div"));
		root.insertAdjacentHTML("afterbegin", source);
		frag.root = root;
		parseHTML.lastResult = frag;
		return frag;
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
	 *
	 * @param {String} message
	 * @throws {Error}
	 */
	function die(message){
		const error    = new SyntaxError(message);
		error.title    = "Unexpected Markup Error";
		error.fileName = "harvester.js";
		error.message  = message;
		console.trace(message);
		throw error;
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
	 * Get the "raw" version of a GitHub-hosted file,
	 *
	 * @param  {String} input
	 * @return {String}
	 * @throws {TypeError} If input is not a conformant blob-view URL. 
	 */
	function convertToRawURL(input){
		const match = input.match(/^https?:\/\/github.com\/([^/#]+)\/([^/#]+)\/blob\/(\w+)((?:\/[^/]+)+)/);
		if(!match)
			throw new TypeError(`Invalid GitHub permalink: ${input}`);
		const [, user, repo, hash, path] = match;
		return `https://raw.githubusercontent.com/${user}/${repo}/${hash}${path}`;
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
			const ex = `extension:${query}` in silo;
			const fn = `filename:${query}` in silo;
			
			if(ex && fn){
				const msg = `Both extension:${query} and filename:${query} properties exist in silo.`;
				throw new ReferenceError(`${msg} Which did you mean?`);
			}
			if(ex)      query = `extension:${query}`;
			else if(fn) query = `filename:${query}`;
		}
		
		const urls = silo[query] || {};
		
		return Object.keys(urls)
			.filter(a => a !== "length")
			.map(key => convertToRawURL(urls[key]))
			.sort((a, b) => {
				a = a.toLowerCase();
				b = b.toLowerCase();
				if(a < b) return -1;
				if(a > b) return  1;
				return 0;
			})
			.join("\n");
	}
	
	
	/**
	 * Generate a randomised, inverted query-string to ensure searches aren't actually filtered.
	 *
	 * @example nothack() == "NOT nothack0D5443272F3447";
	 * @return {String}
	 * @internal
	 */
	function nothack(){
		const rand = Math.random(1e6).toString(16).replace(/\./, "").toUpperCase();
		return `NOT nothack${rand}`;
	}
}());
