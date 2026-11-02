#!/bin/sh
# Usage: scripts/set-domain.sh setupfilm.com
# Points the site at a custom domain: CNAME file, canonical/OG URLs, robots, sitemap.
set -e
D="$1"; [ -n "$D" ] || { echo "usage: $0 <domain>"; exit 1; }
cd "$(dirname "$0")/../docs"
OLD="https://eliasmechul.github.io/SetUp"
printf '%s\n' "$D" > CNAME
for f in index.html robots.txt sitemap.xml; do
  sed -i '' "s#$OLD/#https://$D/#g" "$f"
done
echo "done: https://$D/"
grep -c "$D" index.html robots.txt sitemap.xml
