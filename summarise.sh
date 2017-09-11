#!/bin/sh

#
# USAGE:
# 1. Run `harvester.js` in your browser's console
# 2. Give permission for notifications, then wait for it to finish.
# 3. Run `copy(that);` in your console. This copies collected results
#    to your clipboard.
# 4. Paste it to a file named `urls.log`
# 5. Run this script to report summaries
#

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
