#!/usr/bin/env bash
# fetch_font.sh "<Google Fonts family>" <weight> <out.ttf>   e.g. fetch_font.sh "Inter" 900 font.ttf
# Gets a static TTF from Google Fonts (fonts.googleapis.com + fonts.gstatic.com), so it can be embedded
# and parsed by opentype.js. Works even when JS CDNs are blocked.
set -euo pipefail
fam="${1// /+}"; w="$2"; out="$3"
url=$(curl -sS -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=${fam}:wght@${w}" | grep -o 'https://fonts.gstatic.com/[^)]*\.ttf' | head -1)
[ -n "$url" ] || { echo "no TTF found for $1 $w" >&2; exit 1; }
curl -sS -o "$out" "$url" && echo "$out <- $url"
