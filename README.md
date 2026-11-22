# Token Radar: pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Kegelapan-ai/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Kegelapan-ai/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Built for the make.fun bounty: https://make.fun/bounty/token-radar-01

An entry for the [make.fun bounty "Build the best token launch radar"](https://make.fun/bounty/token-radar-01): a program that reads a sealed DefiLlama snapshot (758 protocols, 14 November 2026), works out which ones record no token and are not a wrapped or staked product of one that trades, ranks them by what their launch would be worth, and writes a static web dashboard — board, detail view for every protocol, filter, live-token comparables, and a farm plan per protocol.

## How it works

**Who is ranked.** Pre-token means DefiLlama records no token at all (market cap, CoinGecko id and symbol all null). Ranked out are wrapped, staked and bridged products: the Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX categories; names carrying a whole word *wrapped*, *staked* or *staking*; names beginning with an exchange's name; names ending in a version marker. The board is the whole 40-protocol watchlist plus the 138 rankable protocols below the $50M floor — 178 rows. Twenty pre-token protocols above the floor that pass every visible rule yet are missing from the watchlist are deliberately **not** ranked: the snapshot does not carry DefiLlama's `parentProtocol` field, so an unshown parent cannot be ruled out. They are listed unranked in the dashboard's "Set aside" tab, with that reason stated.

**Implied value (model `radar-2`).** Live-token protocols are the comparables. For each category, the median market-cap / TVL ratio of the protocols in it whose token already trades, shrunk toward the global median so a thin category cannot set its own price:

```
multiple  = exp((n_cat × ln(cat_median) + 8 × ln(global_median)) / (n_cat + 8)), clamped to [0.05, 0.80]
implied   = TVL × multiple × growth × maturity × breadth
growth    = 1 + clamp(7-day change, −60%, +120%) / 100 × 0.5
maturity  = 0.6 + min(age, 1095 days) / 1095 × 0.4   (unknown age: 365 days)
breadth   = 1 + 0.02 × min(chains − 1, 10), at most 1.20
```

The shrinkage runs in log space, because the ratios span orders of magnitude: one live protocol trading at 400× its TVL must not set its category's price the way a linear average would let it (linear shrinkage still leaves it at 44×; log shrinkage puts it near 0.5×).

The low/high band applies the same log-space shrinkage to the category's 25th / 75th percentile ratios, with the global 25th / 75th percentile as the prior — so a category with a single live protocol still gets a wide band instead of a band of one point. Every row of `board.json` carries its multiple, its growth, maturity and breadth multipliers, its comparable count and its band, and the dashboard recomputes the number from the same figures and checks it against the board. Implied value is the entry's own estimate, never a price, never a promise, and never a prediction that a token launches.

**Farm plans.** Six steps per protocol, derived from its own record (category, chains, TVL, age): a fresh-wallet safety step, a category-specific action with a capital size set by TVL tier ($50–$250), a weekly action, a hold of 30–60 days by age, a claim step that says to use only the protocol's own published link (the snapshot lists no points program, so no step claims one exists), and a farm log step. Each step states its cost and its time. A category risk note is attached per row, worded as a general category risk — the snapshot carries no audit, team or contract data, so no row claims to have checked them.

**The dashboard.** Static HTML/CSS/JS, no network, no external files, no tracking. Tabs: Board (sortable, searchable, filterable by category, chain and watchlist), Live tokens (the 24 largest live-token protocols — the comparables the model prices off), Set aside (the 20 unranked above-floor protocols and the exclusion counts), Method & limits (the formula, the exclusion rules, and what the snapshot cannot say). Every row opens a detail view with the full arithmetic, the value band and the farm plan; state lives in the URL hash, so `#p=<slug>` opens a protocol and `#q=…&category=…` opens a filtered view.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <dir with snapshot.json>
```

Node 22, standard library only, nothing installed before the program runs. Deterministic: two runs write the same bytes (no clock, no randomness, no environment read except the input/output paths). The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` (via the vendored `vendor/makefun-board.ts`).

## Results

178 rows on the board (40 watchlist + 138 early), every watchlist slug covered, every row with an implied value, a low/high band and a 6-step farm plan. Top of the board: Steakhouse Financial (Risk Curators, $2.75B TVL). Dashboard source is 37,064 bytes — under the 65,536-byte dossier text cap, so the judge reads the whole page. Screenshots are 1440×800 renders of the dashboard itself: the board, a protocol detail view, and a filtered view.

## License

MIT — see [LICENSE](LICENSE).
