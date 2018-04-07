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

1. **Copy [`harvester.js`][] to your clipboard**

2. **Navigate to a GitHub-hosted page in your browser.**  
Remember, the URL's domain *must* be `github.com` due to [CORS restrictions][CORS].

3. In your browser's console,

	1. **Paste the contents of [`harvester.js`][]**  
	This defines the commands you'll use in the next step.
	
	It might request your permission to display desktop notifications – this is used to notify you when it finishes.
	
	2. **Run `harvest(" … ")` to begin a search.**  
	To search for entire filenames instead of extensions, prepend the argument with `filename:`. For example:
	
	~~~js
	harvest("filename:.bashrc");
	~~~

4. **Wait for the script to finish.**  
Depending on how many results there are, this may take a while.
The script will display a desktop notification once it finishes.

5. **Run `copy(that)` in the browser console.**  
This copies the collected URLs to your clipboard.


Downloading
-----------

The list copied by step #5 above is just a plain-text, newline-delimited URL list.
Use a tool like [`wget(1)`](https://linux.die.net/man/1/wget) or [`curl(1)`](https://linux.die.net/man/1/curl) to download files *en masse*:

~~~shell
# Using `wget` (recommended)
wget -i url.list -nv

# Or by using `curl`
sed -e "s/'/%27/g" url.list | xargs -n1 curl -# -O
~~~


Reporting usage
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


[`harvester.js`]: https://raw.githubusercontent.com/Alhadis/Harvester/master/harvester.js
[CORS]: https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
