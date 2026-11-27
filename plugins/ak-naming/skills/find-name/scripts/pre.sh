#!/bin/sh
# DNS pre-filter for .de: prints each name whose .de has no NS record (NXDOMAIN).
# NXDOMAIN means "probably free"; confirm with chk.sh (whois) before reporting it.
# A name dig cannot resolve (SERVFAIL, timeout) goes to stderr as "unresolved":
# check it with chk.sh instead of dropping it.
# Usage: sh pre.sh name1 name2 ...
#        xargs -P 8 -n 1 sh pre.sh < names.txt
command -v dig >/dev/null 2>&1 || { echo "pre.sh: dig not found" >&2; exit 1; }
for n in "$@"; do
  n=$(printf '%s' "$n" | tr '[:upper:]' '[:lower:]')
  case $n in
    *[!a-z0-9-]* | "") echo "pre.sh: skipped invalid name '$n'" >&2; continue ;;
  esac
  s=$(dig NS "$n.de" +time=3 +tries=2 2>/dev/null | grep -oE 'status: [A-Z]+' | head -n 1)
  case $s in
    "status: NXDOMAIN") echo "$n" ;;
    "status: NOERROR") ;;
    *) echo "pre.sh: $n unresolved (${s:-no answer})" >&2 ;;
  esac
done
exit 0
