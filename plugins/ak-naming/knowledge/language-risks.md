# Language Risks

Check every finalist against this list. Languages: German, English, Spanish, Portuguese, Italian,
French, plus the source language of the word root and the languages of the target countries.

Check the whole name and every substring of three letters or more. `wk.py` covers the dictionary
part; the sound, reading and brand points need judgement and a web search.

## Meaning

| Risk | What to look for | Example |
| --- | --- | --- |
| Vulgar verb forms | conjugated forms, not only the infinitive; substrings | PT/GL `fodia` is the imperfect of `foder` |
| Slurs | regional slang, Brazilian Portuguese especially | BR `viado` hides in any name starting `viad-` |
| Near words | one letter from a word with a bad meaning | Greek συμμορία ("gang"); German `senil` |
| False friends | a harmless sound with a negative meaning | PT `dano` = damage |
| Hidden words | an English word inside the name | `gun` in a name like `Begunia` |
| Puns | a reading across word borders | IT `levo l'ano` |

## Reading and dictation

- German reading: `ue` reads as `ü`, `v` as `f`, `eu` as `oi`; `c` before `e` is ambiguous.
- Dictation traps: t/d, v/w, ll/nn, i/ie. Say the name on the phone in your head: would the other
  person type it right?

## Associations

- **First names**, rare ones too: people-search sites among the web hits are the sign.
- **Places and countries:** endings `-avia` and `-ania` sound like a country.
- **Pharma sound:** `-ia`, `-is`, `-ol` read like a drug name.
- **Known brands:** a name that echoes NVIDIA, VALORANT or ALMAVIVA invites a dispute even without a
  register conflict.
- **Neighbour apps:** an existing app one letter away from the candidate, or the same name with one
  letter doubled or dropped.

## Cultural appropriation

Avoid words from languages with a living cultural claim, such as Swahili, Māori, Hawaiian or
Sanskrit, even when the meaning fits.

## Vulgar and derogatory substrings

A starting list, not a complete one. `risk_scan.py` reads the table below and reports every
candidate that contains a substring, with language and meaning. A hit is a pre-filter signal:
judge it by how the name is read and stressed, then check the rest of this file by hand. Add the
source language of the word root and the target languages with `--extra`.

Substrings are matched without diacritics and case. Short entries (three letters) give many false
hits; they stay in the list because a name that starts or ends with them is read that way.

| Substring | Lang | Meaning |
| --- | --- | --- |
| pula | RO | penis (vulgar) |
| pizd | RO | vulva (vulgar), also an insult |
| muie | RO | fellatio (vulgar), common insult |
| fut | RO | to fuck (`fut-`, `fute`) |
| coaie | RO | testicles (vulgar) |
| cacat | RO | shit |
| curv | RO | whore |
| fod | PT | to fuck (`foder`: `fode`, `fodia`) |
| viado | PT-BR | homophobic slur |
| porra | PT-BR | cum; strong expletive |
| caralh | PT | dick; strong expletive |
| buceta | PT-BR | vulva (vulgar) |
| piroca | PT-BR | penis (vulgar) |
| bosta | PT | shit |
| puta | ES, PT, IT | whore |
| cono | ES | vulva (vulgar, `coño`) |
| polla | ES | penis (vulgar, Spain) |
| joder | ES | to fuck |
| mierda | ES | shit |
| verga | ES | penis (vulgar, Latin America) |
| pendej | ES | idiot, insult (`pendejo`) |
| cabron | ES | bastard, insult |
| ching | ES | to fuck (Mexico, `chingar`) |
| pinche | ES | damn, vulgar (Mexico) |
| culo | ES, IT | arse |
| cazz | IT | dick; strong expletive (`cazzo`) |
| figa | IT | vulva (vulgar) |
| minchia | IT | dick (vulgar, southern Italy) |
| stronz | IT | turd, insult (`stronzo`) |
| troia | IT | whore (also the city Troy) |
| coglion | IT | testicles; idiot |
| merd | FR, IT, PT | shit |
| putain | FR | whore; strong expletive |
| salope | FR | slut |
| encul | FR | to bugger, insult |
| couill | FR | testicles |
| bite | FR | penis (vulgar) |
| chatte | FR | vulva (vulgar); also female cat |
| conn | FR | idiot (`conne`, `connard`) |
| fuck | EN | to fuck |
| shit | EN | shit |
| cunt | EN | vulva, strong insult |
| dick | EN | penis; insult |
| cock | EN | penis (vulgar) |
| twat | EN | vulva; insult |
| slut | EN | slut |
| wank | EN | to masturbate (UK) |
| piss | EN, DE | urine, to urinate |
| arse | EN | arse (UK) |
| fick | DE | to fuck |
| scheiss | DE | shit (`scheiß`) |
| arsch | DE | arse |
| fotze | DE | vulva, strong insult |
| kack | DE | shit |
| nutte | DE | whore |
| wichs | DE | to masturbate |
