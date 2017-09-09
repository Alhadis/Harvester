#!/bin/sh

#
# USAGE:
# 1. Run `harvester.js` in your browser's console
# 2. Give permission for notifications, then wait for it to finish.
# 3. Run `copy(that);` in your console. This copies collected results
#    to your clipboard.
# 4. Paste it to a file named `urls.log`. On macOS, this script
#    does this automatically; Linux/BSD users must do so manually.
# 5. Run `summary.sh`
#
# TODO:
# - Remove step #4. Stop being lazy.
#

# Darwin/macOS: Dump contents of system clipboard
(command -v >/dev/null 2>&1 pbpaste) && pbpaste > urls.log;

# Filter unique repositories
grep < urls.log -iEoe '^https?://raw\.githubusercontent\.com/([^/]+/){2}' |\
	uniq | sed -Ee 's,raw\.(github)usercontent,\1,i' > unique-repos.log

# Filter unique users
grep < unique-repos.log -oE '^https://github\.com\/[^/]+' |\
	uniq | sort > unique-users.log

# Display how many of each were found
wc -l unique-{repos,users}.log | grep -vE '\stotal$' | grep -oE '^\s*[0-9]+' |\
xargs printf "\
Unique repos: %s
Unique users: %s
"
