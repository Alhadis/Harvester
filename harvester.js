(function(){
	"use strict";
	
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
		
		if(!/^extension:|filename:/.test(realQuery))
			realQuery = "extension:" + realQuery;
		
		return new Promise(resolve => {
			
			// Default to the usual "nothack" with a random number attached
			if(!bogusQuery){
				const rand = Math.random(1e6).toString(16).replace(/\./, "").toUpperCase();
				bogusQuery = "NOT nothack" + rand;
			};
			
			const query = encodeURIComponent(`${realQuery} ${bogusQuery}`).replace(/%20/g, "+");
			const url   = `https://github.com/search?q=${query}&type=Code`;
			
			return runSearch(url, BY_MATCH, realQuery).then(numResults => {
				return numResults > 1000
					? runSearch(url, BY_NEWEST, realQuery)
						.then(() => runSearch(url, BY_OLDEST, realQuery))
						.then(() => resolve())
					: resolve()
			}).then(() => {
				const body = "Run `copy(that);` in your console to copy the URLs to your clipboard.";
				new Notification(`Harvest complete for ${realQuery}`, {body});
				lastHarvest = realQuery;
			});
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
			next().then(() => Promise.resolve(resultCount));
			
			function next(){
				return grab(url + vars + (page ? "&p=" + (page + 1) : ""))
					.catch(error   => reject(error))
					.then(response => response.text().then(html => {
						
						// No results. Reject.
						if(/<div[^>]+class="blankslate">/.test(html)){
							const notice = "Must include at least one user, organization, or repository";
							const match  = notice.split(" ").join("\\s+")
							const reason = new RegExp(match, "i").test(html)
								? ["Failed.", "GitHub's doing that weird thing again:", `\t> "${notice}"`].join("\n\n")
								: "No results";
							return reject(reason);
						}
						
						extract(html, results);
						
						// Examine how many pages there are
						if(undefined === pageCount){
							const match = html.match(/">(\d+)<\/a>\s*<a[^>]+?class="next_page"[^>]+?rel="next"/i);
							
							// Two or more pages
							if(match){
								resultCount = +html.match(/<h3>\s*(?:We.ve\s+found\s+)?([,\d]+)\s+code\s+results/i)[1].replace(/\D/g, "");
								pageCount   = match[1];
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
					}));
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
	 * Parse a chunk of HTML source for search results.
	 *
	 * @param {String} html
	 * @param {Object} results
	 * @internal
	 */
	function extract(html, results){
		
		// Play it safe and guillotine everything outside the result-list
		const start = html.match(/<div[^>]+id="code_search_results"[^>]*>/i);
		const end   = html.match(/<div[^>]+id="search_cheatsheet_pane"/i);
		html        = html.substring(start.index, end.index);
		
		// Isolate the list, then examine each chunk one-by-one
		const items = html.split(/<div[^>]+class="[^"]*code-list-item[^"]+code-list-item-public[^"]*"[^>]*>/ig);
		for(const i of items){
			const user = i.match(/<img[^>]+alt="@([^"@]+)"[^>]+class="avatar[\s"]/i);
			if(!user) continue;
			const path = i.match(/^(?:.|\n)*?(?:&#8211;|–)\s*<a[^>]+href="([^"]+)"/i)[1];
			if(!results[path]){
				results[path] = path.replace(/^((?:\/[^\/]+){2})\/blob(?=\/)/gmi, "https://raw.githubusercontent.com$1");
				++results.length;
			}
		}
	}
	

	/**
	 * Load a resource by URL.
	 *
	 * We'd use window.fetch, but GitHub isn't returning anything.
	 * Oddly, an old-school AJAX request seems to be fine.
	 * 
	 * @param {String} url
	 * @return {Promise}
	 * @internal
	 */
	function grab(url){
		return new Promise((resolve, reject) => {
			const req = new XMLHttpRequest();
			req.open("GET", url);
			req.addEventListener("readystatechange", e => {
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
			.join("\n")
	}
}());

Notification.requestPermission();
