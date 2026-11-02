#!/bin/sh
# Usage: scripts/check-dns.sh setupfilm.com  - shows whether DNS already points at GitHub Pages.
D="$1"; [ -n "$D" ] || { echo "usage: $0 <domain>"; exit 1; }
echo "A records:";   dig +short A "$D"
echo "www CNAME:";   dig +short CNAME "www.$D"
echo "HTTPS status:"; curl -sI "https://$D/" | head -1
