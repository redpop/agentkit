#!/bin/sh
# Core domain check per name: the main-market TLD (default .de: DENIC whois;
# any other: the registry's whois, found through IANA), .com (Verisign whois),
# get<name>.com when .com is taken, .app (Google RDAP).
# Output: name <tld>=<...> com=<free|taken|?> get=<...|-> app=<404|200|...>
#   .de:   free = available, connect = registered, redemptionPeriod = not available
#   other: free, taken, or ? (no answer, quota, unknown reply format)
#   RDAP:  404 = available, 200 = registered, anything else = unknown
# Usage: sh chk.sh [-t tld] name1 name2 ...   (sequential on purpose: whois servers rate-limit)
for t in whois curl; do
  command -v "$t" >/dev/null 2>&1 || { echo "chk.sh: $t not found" >&2; exit 1; }
done

tld=de
if [ "${1:-}" = -t ]; then tld=${2:?chk.sh: -t needs a TLD}; shift 2; fi
tld=$(printf '%s' "$tld" | tr '[:upper:]' '[:lower:]' | sed 's/^\.//')
server=
if [ "$tld" != de ]; then
  server=$(whois -h whois.iana.org "$tld" 2>/dev/null | awk 'tolower($1)=="whois:" {print $2; exit}')
  [ -n "$server" ] || echo "chk.sh: no whois server for .$tld at IANA, main TLD shows ?" >&2
fi

# main_status <domain>: DENIC status for .de; free/taken/? for any other TLD.
# "taken" only on a domain record; empty, quota or unknown replies give "?".
main_status() {
  if [ "$tld" = de ]; then
    s=$(whois -h whois.denic.de "$1" 2>/dev/null | grep -i '^Status:' | head -n 1 | awk '{print $2}')
    echo "${s:-?}"
    return
  fi
  [ -n "$server" ] || { echo "?"; return; }
  out=$(whois -h "$server" "$1" 2>/dev/null)
  if printf '%s' "$out" | grep -qiE 'no match|not found|no entries found|no data found|no object found|is (free|available)|status: *(free|available)'; then
    echo "free"
  elif printf '%s' "$out" | grep -qiE "^ *domain( name)?: *$1"; then
    echo "taken"
  else
    echo "?"
  fi
}

com_status() {
  out=$(whois -h whois.verisign-grs.com "$1" 2>/dev/null)
  if printf '%s' "$out" | grep -q "No match for"; then echo "free"
  elif printf '%s' "$out" | grep -qiE "^ *Domain Name: *$1"; then echo "taken"
  else echo "?"; fi  # empty, rate limit or service error: unknown, never "taken"
}

rdap() {
  code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$1")
  if [ "$code" = 429 ]; then
    sleep 8
    code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$1")
  fi
  echo "$code"
}

for n in "$@"; do
  n=$(printf '%s' "$n" | tr '[:upper:]' '[:lower:]')
  case $n in
    *[!a-z0-9-]* | "") echo "chk.sh: skipped invalid name '$n'" >&2; continue ;;
  esac
  main=$(main_status "$n.$tld")
  com=$(com_status "$n.com")
  get=-
  [ "$com" = taken ] && get=$(com_status "get$n.com")
  app=$(rdap "https://pubapi.registry.google/rdap/domain/$n.app")
  echo "$n $tld=$main com=$com get=$get app=$app"
  sleep 1.2
done
exit 0
