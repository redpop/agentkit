#!/bin/sh
# Extra TLDs for finalists only: .eu .at .it (whois), .ch .io .org (RDAP).
# Output per name: name eu=<free|taken|?> at=... it=... ch=... io=... org=...
# nic.at enforces a query quota: run this for a handful of finalists, not for long lists.
# Usage: sh tlds.sh name1 name2 ...
for t in whois curl; do
  command -v "$t" >/dev/null 2>&1 || { echo "tlds.sh: $t not found" >&2; exit 1; }
done

# whois_free <server> <domain> <pattern meaning available>
# "taken" only on a domain record; empty, quota or error replies give "?".
whois_free() {
  out=$(whois -h "$1" "$2" 2>/dev/null)
  if printf '%s' "$out" | grep -qi "$3"; then echo "free"
  elif printf '%s' "$out" | grep -qiE "^ *domain( name)?: *$2"; then echo "taken"
  else echo "?"; fi
}

# rdap_free <url>: 404 = available, 200 = registered
rdap_free() {
  code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$1")
  [ "$code" = 429 ] && { sleep 8; code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$1"); }
  case $code in
    404) echo "free" ;;
    200) echo "taken" ;;
    *) echo "?($code)" ;;
  esac
}

for n in "$@"; do
  n=$(printf '%s' "$n" | tr '[:upper:]' '[:lower:]')
  case $n in
    *[!a-z0-9-]* | "") echo "tlds.sh: skipped invalid name '$n'" >&2; continue ;;
  esac
  eu=$(whois_free whois.eu "$n.eu" "Status: AVAILABLE")
  at=$(whois_free whois.nic.at "$n.at" "nothing found")
  it=$(whois_free whois.nic.it "$n.it" "AVAILABLE")
  ch=$(rdap_free "https://rdap.nic.ch/domain/$n.ch")
  io=$(rdap_free "https://rdap.identitydigital.services/rdap/domain/$n.io")
  org=$(rdap_free "https://rdap.publicinterestregistry.org/rdap/domain/$n.org")
  echo "$n eu=$eu at=$at it=$it ch=$ch io=$io org=$org"
  sleep 1.5
done
exit 0
