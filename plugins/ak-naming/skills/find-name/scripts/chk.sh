#!/bin/sh
# Core domain check per name: .de (DENIC whois), .com (Verisign whois),
# get<name>.com when .com is taken, .app (Google RDAP).
# Output: name de=<free|connect|redemptionPeriod|?> com=<free|taken|?> get=<...|-> app=<404|200|...>
#   DENIC: free = available, connect = registered, redemptionPeriod = not available
#   RDAP:  404 = available, 200 = registered, anything else = unknown
# Usage: sh chk.sh name1 name2 ...   (sequential on purpose: whois servers rate-limit)
for t in whois curl; do
  command -v "$t" >/dev/null 2>&1 || { echo "chk.sh: $t not found" >&2; exit 1; }
done

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
  de=$(whois -h whois.denic.de "$n.de" 2>/dev/null | grep -i '^Status:' | head -n 1 | awk '{print $2}')
  com=$(com_status "$n.com")
  get=-
  [ "$com" = taken ] && get=$(com_status "get$n.com")
  app=$(rdap "https://pubapi.registry.google/rdap/domain/$n.app")
  echo "$n de=${de:-?} com=$com get=$get app=$app"
  sleep 1.2
done
exit 0
