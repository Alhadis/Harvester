Harvester
=========

This is a script for collecting public search results for filename or file-extension queries on GitHub.
It's used to gauge in-the-wild usage of new languages or extensions to be registered by [GitHub Linguist](https://github.com/github/linguist). For more info on registering new languages, [see their docs](https://github.com/github/linguist/blob/master/CONTRIBUTING.md).


Weirdness and limitations
-------------------------

Due to unusual access restrictions, the script must be run with a GitHub-hosted page open in a browser,
and only when signed-in with a registered GitHub account. Ergo, there's no command-line tool to handle
all this for you.

Also note that attempts to access search-results from headless or unauthorised contexts **will fail**.
You can see this yourself by opening [this url](https://github.com/search?q=extension%3Ajs+NOT+nothack&type=Code)
in an incognito window, and comparing it with what you see while signed in.


Collecting search results
-------------------------

1. Copy the contents of [`harvester.js`][] to your system's clipboard.

2. Open a GitHub page in your browser's console. The URL **must** include the domain `github.com` due to [CORS restrictions][CORS].

3. In your browser's console, paste and enter the contents of [`harvester.js`][] copied from step #1.

4. Wait for the script to finish. This might take a while, but you'll receive a desktop notification after it finishes.

5. Run `copy(that);` in your console. This copies the collected URL list to your clipboard.


Downloading
-----------

The list copied by step #5 above is just a plain-text, newline-delimited URL list.
Simply use whatever utility you'd normally use for downloading files *en masse*.

### Using [`wget(1)`](https://linux.die.net/man/1/wget)
~~~shell
wget -i url.list -nv
~~~

### Using [`curl(1)`](https://linux.die.net/man/1/curl)
~~~shell
sed -e "s/'/%27/g" url.list | xargs -n1 curl -# -O
~~~


Reporting usage
---------------

Some shell commands for reporting in-the-wild usage on GitHub:


### Extract a list of unique repositories
This reads from `urls.log` and writes the output to `unique-repos.log`.

~~~shell
grep < urls.log -iEoe '^https?://raw\.githubusercontent\.com/([^/]+/){2}' \
| sort | uniq | sed -Ee 's,raw\.(github)usercontent,\1,g' > unique-repos.log
~~~


### Extract a list of unique users
This reads from `unique-repos.log` (from the above example) and saves to `unique-users.log`:

~~~shell
grep < unique-repos.log -oE '^https://github\.com\/[^/]+' \
| sort | uniq > unique-users.log
~~~


### Tallying results
This prints a summary of how many unique users and repositories were found in total.

~~~shell
wc -l unique-{repos,users}.log | grep -vE '\stotal$' | grep -oE '^\s*[0-9]+' |\
xargs printf '\
Unique repos: %s
Unique users: %s
'
~~~


[`harvester.js`]: ./harvester.js
[CORS]: https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
