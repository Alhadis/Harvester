Harvester
=========

This is a script for collecting public search results for filename or file-extension queries on GitHub.

It's used by [GitHub Linguist](https://github.com/github/linguist) contributors to gauge real-world usage of languages and file extensions, especially when submitting new languages for [registration on GitHub](https://github.com/github/linguist/blob/master/CONTRIBUTING.md).

Due to weird access restrictions, the script must be run

* from a browser context,
* from a page hosted on `github.com`,
* whilst signed-in with a registered GitHub account.

Attempting to load search results from an unauthorised or headless context **will fail**.
See for yourself by opening [this page](https://github.com/search?q=extension%3Ajs+NOT+nothack&type=Code) while signed in, and compare it with what an incognito browser window sees.


Usage
-----

1. **Copy [`harvester.js`][] to your clipboard.**

2. **Navigate to a GitHub-hosted page in your browser.**  
Remember, the URL's domain *must* be `github.com` due to [CORS restrictions][CORS].

3. **In your browser's console,**

	1. **Paste the contents of [`harvester.js`][]**  
	This defines the commands you'll use in the next step.
	It might request your permission to display desktop notifications.
	This is used to notify you when a harvest has finished.
	
	2. **Run `harvest(" … ")` to begin a search.**  
	To search for entire filenames instead of extensions, prepend the query with `filename:`:
		~~~js
		harvest("filename:.bashrc");
		~~~
	Arguments are optional if Harvester's running from a search results page.
	E.g,, if you have [this page](https://github.com/search?q=extension%3Aasy+NOT+SymbolType&type=Code) open in your browser, `harvest();` is the same as
		~~~js
		harvest("extension:asy", "NOT SymbolType");
		~~~
	For any other page, a query must be specified.

4. **Wait for it to finish.**  
This may take a while, depending on how many results there are.
You'll see a desktop notification when it finishes.

5. **Run [`copy(that)`][that] in the browser console.**  
This copies the collected URLs to your clipboard.


Bookmarklet
-----------

If you find yourself using this script often, consider adding [`bookmarklet.js`][] to your browser's toolbar as a [bookmarklet](https://en.wikipedia.org/wiki/Bookmarklet).

**Note:** This [won't work on Firefox](https://blog.github.com/2013-04-19-content-security-policy/#bookmarklets).

Ideally, this script would load the latest version of `harvester.js` and attach it to the page.
This isn't possible due to [CORS][] restrictions, so the entire script needs to be embedded as a single URL.


JavaScript interface
--------------------
Running [`harvester.js`][] adds three properties to global context:


#### `window.harvest(query[, searchHack])`
The function used for starting a search. It takes two arguments:

*	`query`  
	Your search query: either an extension or a filename.

	~~~js
	harvest("extension:foo"); // Extension
	harvest("filename:foo");  // Filename
	~~~

	Because extensions are more frequently searched for than filenames,
	the `"extension:"` prefix is optional. Ergo, the first line above
	can be shortened to just this:

	~~~js
	harvest("foo"); // Extension
	~~~
	
	This is the format used throughout the rest of this documentation.

*	`searchHack`  
	An optional legitimate search query to include.
	The default is `"NOT nothack"` followed by random hex digits:

	~~~js
	"NOT nothack" + Math.random(1e6).toString(16).replace(/\./, "").toUpperCase();
	~~~
	
	However, sometimes you want to narrow searches down to files which contain a
	certain substring. In those cases, you include the second parameter:
	
	~~~js
	// Match `*.foo` files which contain the word "bar".
	harvest("foo", "bar");
	~~~
	
	**Sidenote:** The `"nothack"` above is necessitated by the requirement that
	[advanced searches](https://github.com/search/advanced) include specific search
	criteria. This makes site-wide searching of extensions impossible, so this hacky
	workaround is used instead.



#### `window.silo`
An [`Object`][] where successful searches are cached, keyed by query. Its contents look like this:

~~~js
window.silo = {
	"extension:foo": {
		length: 6528,
		
		"/user/repo/blob/6eb5537/path/file.foo": "https://raw.githubusercontent.com/…",
		… 6527 more results
	},
};
~~~

The `silo` contains a helper method called `reap` which extracts, sorts, and joins a list of results as a string.
It's called internally when accessing [`window.that`][that] to extract a sorted URL list.

The `silo` exists to provide some way of resuming an interrupted harvest, such as in the case of a lost connection.
It isn't some persistent storage mechanism: navigating to another page causes its contents to be lost.


#### `window.that`
Reference to the results of the last successful harvest.
Meant for use with the console's `copy` command:

~~~js
copy(that);
~~~

Which is essentially a shortcut for

~~~js
copy(silo.reap("extension:foo"));
~~~



Downloading files
-----------------

The list copied by running `copy(that);` is a plain-text list of URLs that can be passed to
[`wget(1)`](https://linux.die.net/man/1/wget),
[`curl(1)`](https://linux.die.net/man/1/curl),
or a similar utility to download files *en masse*:

~~~shell
# Using `wget` (recommended)
wget -nv -i /path/to/url.list

# Using `curl`
sed -e "s/'/%27/g" /path/to/url.list | xargs -n1 curl -# -O
~~~

Alternatively, to preserve the directory hierarchy while downloading files, you can the following command:
~~~shell
wget -nv -x -i /path/to/url.list
~~~

Helpful scripts
---------------

Some useful shell commands to help with reporting in-the-wild usage on GitHub:


#### Listing unique repositories
This reads from `urls.log` and writes the output to `unique-repos.log`.

~~~shell
grep < urls.log -iEoe '^https?://raw\.githubusercontent\.com/([^/]+/){2}' \
| sort | uniq | sed -Ee 's,raw\.(github)usercontent,\1,g' > unique-repos.log
~~~


#### Listing unique users
This reads from `unique-repos.log` and saves to `unique-users.log`:

~~~shell
grep < unique-repos.log -oE '^https://github\.com\/[^/]+' \
| sort | uniq > unique-users.log
~~~


#### Tallying results
This prints a summary of how many unique users and repositories were found in total.

~~~shell
wc -l unique-{repos,users}.log | grep -vE '\stotal$' | grep -oE '^\s*[0-9]+' |\
xargs printf '\
Unique repos: %s
Unique users: %s
'
~~~


The following utilities are also of interest:

*	[`gh-search`](https://github.com/Alhadis/.files/blob/master/bin/gh-search)  
	Opens the URL of an extension/filename search using the system's default browser.
	
	~~~shell
	gh-search -e foo; # Search by extension
	gh-search -f foo; # Search by filename
	~~~

*	[`fixext`](https://github.com/Alhadis/.files/blob/master/bin/fixext)  
	Fixes the suffixes added by `wget(1)` when downloading files with the same name.
	
	~~~console
	$ fixext foo *
	Renamed: saved.foo.1 -> saved.1.foo
	~~~


[`harvester.js`]: https://raw.githubusercontent.com/Alhadis/Harvester/master/harvester.js
[`bookmarklet.js`]: https://raw.githubusercontent.com/Alhadis/Harvester/master/bookmarklet.js
[CORS]: https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
[that]: #windowthat
[`Object`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object
