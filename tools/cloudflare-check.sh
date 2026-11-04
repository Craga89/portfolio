#!/usr/bin/env bash
# Checks that a Cloudflare deployment of the site serves it: tools/cloudflare-check.sh <url> <kind>
#
#   preview  a Cloudflare Preview: kept out of search engines (X-Robots-Tag, robots.txt)
#   live     the live site: open to search engines, with live.json and no preview bar
#
# Used by .github/workflows/cloudflare.yml (Previews) and ci.yml's deploy job (the live site).
set -uo pipefail

url="${1:?usage: cloudflare-check.sh <url> <preview|live>}"
kind="${2:?usage: cloudflare-check.sh <url> <preview|live>}"
url="${url%/}"

# A new address can take a few seconds to answer everywhere.
for _ in 1 2 3 4 5 6; do curl -fsS -o /dev/null "$url/" && break; sleep 5; done

status() { curl -sS -o /dev/null -w '%{http_code}' "$url$1"; }
count() { grep -ci -- "$1" || true; }
fail=0
check() {
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "::error title=Cloudflare::$url: $1: expected $3, got $2"
    fail=1
  fi
}

home="$(curl -sS "$url/")"
check "home page" "$(status /)" 200
check "CV page" "$(status /cv/)" 200
check "/cv redirects to /cv/" "$(status /cv | cut -c1-2)" 30
check "unknown page" "$(status /no-such-page/)" 404
check "home page title" "$(count '<title>' <<< "$home")" 1

robots="$(curl -sS "$url/robots.txt")"
noindex="$(curl -sSI "$url/" | count '^x-robots-tag: noindex')"
case "$kind" in
  preview)
    check "noindex header" "$noindex" 1
    check "robots.txt keeps crawlers out" "$(count '^Disallow: /$' <<< "$robots")" 1
    ;;
  live)
    check "no noindex header" "$noindex" 0
    check "robots.txt lets crawlers in" "$(count '^Allow: /$' <<< "$robots")" 1
    check "no preview bar" "$(count 'class="preview-bar' <<< "$home")" 0
    check "live.json" "$(status /live.json)" 200
    ;;
  *)
    echo "unknown kind: $kind" >&2
    exit 2
    ;;
esac
exit "$fail"
