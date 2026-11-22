// Token Radar's model, radar-2 ("comparable multiple").
//
// One sealed snapshot in, one ranked board out. Every number follows from the
// snapshot's own figures; no protocol name is ever special-cased, and no token
// price, market cap or launch date is ever invented.
//
// Who is ranked
// -------------
// A protocol is pre-token when DefiLlama records no token for it at all:
// mcap_usd, gecko_id and symbol are all null. A protocol is rankable when it
// is pre-token AND it is not a wrapped, staked or bridged product of a token
// that already trades: its category is not CEX, Bridge, Canonical Bridge,
// Liquid Staking, Liquid Restaking or Restaked BTC; its name carries no whole
// word "wrapped", "staked" or "staking"; it does not begin with an exchange's
// name (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini); and
// its name does not end in a version marker ("V2", "v2", "2.0" and the like).
// The board ranks the whole watchlist (40 protocols) plus every rankable
// protocol below the $50M floor (138 more) = 178 rows.
//
// Deliberately NOT ranked: 20 pre-token protocols above the floor that pass
// every visible rule above yet are missing from the house watchlist. The
// snapshot does not carry DefiLlama's parentProtocol field, and the only
// remaining watchlist rule is "DefiLlama records no parent protocol", so the
// honest reading is that those 20 are children of another protocol and the
// snapshot cannot prove otherwise. They are listed, unranked, in the
// dashboard's "Set aside" tab instead of being silently ranked or silently
// dropped.
//
// Implied value
// -------------
// Live-token protocols are the comparables: for each category, take the
// market-cap / TVL ratio of every protocol in that category whose token
// already trades, and read its median, 25th and 75th percentile. The
// category multiple is shrunk toward the global median so a category with
// two live protocols does not set its own price:
//
//   multiple     = exp((n_cat * ln(cat_median) + 8 * ln(global_median)) / (n_cat + 8))
//   multiple     clamped to [0.05, 0.80]
//   low / high   the same shrinkage in log space applied to the category p25 / p75,
//                with the GLOBAL p25 / p75 as the prior instead of the global
//                median — so a category with one live protocol still gets a
//                wide band instead of a band of one point
//   Log space, because the ratios span orders of magnitude: one live protocol
//   trading at 400x its TVL must not set its category's price the way a
//   linear average would let it (linear shrinkage still leaves it at 44x).
//
//   base         = tvl_usd * multiple
//   growth       = clamp(change_7d, -60, 120) per cent; unknown growth = 0
//   growthMult   = 1 + (growth / 100) * 0.5
//   maturity     = 0.6 + min(age_days, 1095) / 1095 * 0.4; unknown age = 365
//   breadth      = 1 + 0.02 * min(chains - 1, 10)   (at most 1.20)
//   implied      = max(1, round(base * growthMult * maturity * breadth))
//   implied_low / implied_high use the low / high multiple instead.
//
// The band is wide on purpose: comparable protocols in one category trade
// anywhere from a fraction of TVL to several times it, so any single number
// would be false precision. Implied value is the entry's own estimate, never
// a price, never a promise, and never a prediction that a token launches.
//
// Farm plans are derived from the protocol's own record (category, chains,
// TVL, age) in farmSteps(); the dashboard recomputes them the same way.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  shrink_prior: number;
  multiple_floor: number;
  multiple_cap: number;
  breadth_per_chain: number;
  breadth_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  shrink_prior: 8,
  multiple_floor: 0.05,
  multiple_cap: 0.8,
  breadth_per_chain: 0.02,
  breadth_cap: 1.2,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live comparables view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row's comparable statistics, from the live-token protocols of its category. */
export interface Comparables {
  category: string | null;
  live_n: number;
  category_median: number;
  category_p25: number;
  category_p75: number;
  global_median: number;
  global_p25: number;
  global_p75: number;
  multiple: number;
  low_multiple: number;
  high_multiple: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
    comparable_n: number;
    comparable_median: number;
    comparable_low: number;
    comparable_high: number;
  };
  risk_note: string;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  multiple: number;
  low_multiple: number;
  high_multiple: number;
  comparable_n: number;
  risk_note: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** A protocol set aside, unranked, with the reason it was not ranked. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, the set-aside list, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  excluded_counts: Record<string, number>;
  global_median: number;
  global_p25: number;
  global_p75: number;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted array, or null when it is empty. */
function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The p-th percentile (nearest-rank) of a sorted array, or null when it is empty. */
function percentileOf(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

/**
 * The comparables table: for every category, the live-token protocols' mcap/TVL
 * ratios (median, p25, p75, count), plus the global median and quartiles.
 */
export function buildComparables(snapshot: Snapshot): { byCategory: Map<string, { n: number; median: number; p25: number; p75: number }>; globalMedian: number; globalP25: number; globalP75: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio)) continue;
    all.push(ratio);
    const key = p.category ?? '(no category)';
    const arr = byCategory.get(key);
    if (arr === undefined) byCategory.set(key, [ratio]);
    else arr.push(ratio);
  }
  all.sort((a, b) => a - b);
  const globalMedian = medianOf(all) ?? MODEL.base_multiple;
  const globalP25 = percentileOf(all, 25) ?? globalMedian;
  const globalP75 = percentileOf(all, 75) ?? globalMedian;
  const out = new Map<string, { n: number; median: number; p25: number; p75: number }>();
  for (const [key, ratios] of byCategory) {
    ratios.sort((a, b) => a - b);
    out.set(key, {
      n: ratios.length,
      median: medianOf(ratios) ?? globalMedian,
      p25: percentileOf(ratios, 25) ?? globalMedian,
      p75: percentileOf(ratios, 75) ?? globalMedian,
    });
  }
  return { byCategory: out, globalMedian, globalP25, globalP75 };
}

/** A category's comparables under the shrinkage rule, with the multiple clamped. */
export function comparablesFor(category: string | null, table: { byCategory: Map<string, { n: number; median: number; p25: number; p75: number }>; globalMedian: number; globalP25: number; globalP75: number }, model: ModelConstants = MODEL): Comparables {
  const key = category ?? '(no category)';
  const cat = table.byCategory.get(key);
  const n = cat === undefined ? 0 : cat.n;
  // Log-space shrinkage: the ratios span orders of magnitude, so the average
  // is taken over logs and exponentiated back. A single 400x outlier then
  // pulls its category toward ~0.5x, not toward 44x.
  const shrinkLog = (catValue: number, prior: number): number => {
    const v = Math.exp((n * Math.log(Math.max(catValue, 1e-9)) + model.shrink_prior * Math.log(Math.max(prior, 1e-9))) / (n + model.shrink_prior));
    return v;
  };
  const median = cat === undefined ? table.globalMedian : cat.median;
  const p25 = cat === undefined ? table.globalP25 : cat.p25;
  const p75 = cat === undefined ? table.globalP75 : cat.p75;
  const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrinkLog(median, table.globalMedian)));
  const low = Math.max(0.005, Math.min(shrinkLog(p25, table.globalP25), multiple));
  const high = Math.min(5, Math.max(shrinkLog(p75, table.globalP75), multiple));
  return {
    category,
    live_n: n,
    category_median: round4(median),
    category_p25: round4(p25),
    category_p75: round4(p75),
    global_median: round4(table.globalMedian),
    global_p25: round4(table.globalP25),
    global_p75: round4(table.globalP75),
    multiple: round4(multiple),
    low_multiple: round4(low),
    high_multiple: round4(high),
  };
}

/** The multipliers and the implied value (with its low/high band) one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comp: Comparables,
  model: ModelConstants = MODEL,
): { implied: number; low: number; high: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = Math.min(model.breadth_cap, 1 + Math.max(0, protocol.chains.length - 1) * model.breadth_per_chain);
  const shared = protocol.tvl_usd * growthMult * maturityMult * breadthMult;
  const implied = Math.max(1, Math.round(shared * comp.multiple));
  const low = Math.max(1, Math.round(shared * comp.low_multiple));
  const high = Math.max(implied, Math.round(shared * comp.high_multiple));
  return { implied, low, high, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked, bridged or exchange product, not a protocol of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names whose product a protocol name starting with them would be. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Why a pre-token protocol is NOT rankable, or null when it is rankable:
 * the exclusion rule, in the order the watchlist's own rule states it.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'name carries wrapped / staked / staking';
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return 'name begins with an exchange name';
  if (VERSIONED.test(p.name)) return 'name ends in a version marker';
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and not excluded. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && exclusionReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const table = buildComparables(snapshot);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor.
  // Above the floor, only the watchlist is ranked: a protocol the house list
  // leaves out there is left out for a reason the snapshot cannot show
  // (DefiLlama's parentProtocol), so ranking it would claim more than the
  // snapshot proves.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const watchlist = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const comp = comparablesFor(p.category, table, model);
    const v = impliedValue(p, snapshot.as_of, comp, model);
    return { p, comp, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    on_watchlist: watchlist.has(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_low_usd: s.v.low,
    implied_high_usd: s.v.high,
    model: {
      base_multiple: s.comp.multiple,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
      comparable_n: s.comp.live_n,
      comparable_median: s.comp.category_median,
      comparable_low: s.comp.low_multiple,
      comparable_high: s.comp.high_multiple,
    },
    risk_note: riskFor(s.p),
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. Never a hand-written list of names. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curat')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('capital allocator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s tokenised asset on ${chain} and hold it in your wallet.`;
  if (c.includes('basis trading')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge, then close it.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then leave the rest in the account.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment')) return `Hold $${capital} in ${name} on ${chain} and make one real payment through it.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote once in its governance.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} and use one ${name} app on it each week.`;
  if (c.includes('otc') || c.includes('marketplace')) return `Place one $${capital} order through ${name} on ${chain} and keep the account active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly action, so the plan is not the same sentence for every row. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Make one qualifying action each week, such as a fresh supply, a borrow, a repayment or a vote.';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'Make one qualifying action each week, such as a swap in the pool, adding or removing a little liquidity, or a vote.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Make one qualifying action each week, such as a small trade, adjusting margin, or closing and reopening a hedge.';
  if (c.includes('prediction')) return 'Make one qualifying action each week, such as a new market position or settling one that closed.';
  if (c.includes('rwa')) return 'Make one qualifying action each week, such as minting more of the asset, a transfer, or a claim of its yield.';
  if (c.includes('risk curat') || c.includes('allocator') || c.includes('yield')) return 'Make one qualifying action each week, such as a fresh deposit into a vault, a rebalance, or a vote.';
  return 'Make one qualifying action each week, such as a deposit, a swap, a borrow or a vote.';
}

/**
 * The general risk of the protocol's category, stated as a category risk, never
 * as a review of the protocol itself: the snapshot carries no audit, no team
 * and no contract data, so no row claims to have checked them.
 */
export function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'General risk for lending: a price move can liquidate a borrow, and a faulty oracle can misprice collateral.';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'General risk for liquidity pools: impermanent loss against holding, and a thin pool can move the price on entry or exit.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'General risk for perpetuals: leverage can lose the whole margin fast, and funding can eat a held position.';
  if (c.includes('rwa')) return 'General risk for tokenised real-world assets: the off-chain issuer and custodian matter more than the code, and redemption can be slow or gated.';
  if (c.includes('basis trading')) return 'General risk for basis trades: funding rates flip, and a trade that pays today can cost tomorrow.';
  if (c.includes('risk curat') || c.includes('allocator')) return 'General risk for curated vaults: the curator picks the strategy, so a bad pick or a faulty underlying market hits every depositor.';
  if (c.includes('insurance')) return 'General risk for cover: a claim can be refused on wording, and the pool can be too small for a large event.';
  if (c.includes('stable')) return 'General risk for stable assets: a peg can break, and the backing can be thinner than the label suggests.';
  if (c.includes('prediction')) return 'General risk for prediction markets: a position can go to zero, and a disputed outcome can settle against you.';
  if (c.includes('chain')) return 'General risk for a chain: a halt or a bridge failure can trap funds until the chain resumes.';
  return 'General risk: smart contracts can hold bugs, the team can change the rules, and a token may never launch at all.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * Derived from the protocol's own record (category, chains, TVL, age) only.
 * Nothing here claims a points program exists: step 5 says to check the
 * protocol's own page, because the snapshot carries no airdrop flag.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; the snapshot lists no points program, so never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.',
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live comparables view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/**
 * The protocols set aside, unranked: pre-token protocols above the floor that
 * pass every visible exclusion rule yet are missing from the watchlist. The
 * snapshot cannot show DefiLlama's parentProtocol, so the board does not
 * claim they are independent protocols — it shows them and says why.
 */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  const watchlist = new Set(snapshot.watchlist);
  return snapshot.protocols
    .filter((p) => isPreToken(p) && p.tvl_usd >= snapshot.floor_usd && !watchlist.has(p.slug) && exclusionReason(p) === null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: 'Above the floor but off the watchlist: the snapshot carries no parentProtocol field, so an unshown parent cannot be ruled out.',
    }));
}

/** How many pre-token protocols each exclusion rule sets aside (all TVL bands). */
export function excludedCounts(snapshot: Snapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    const reason = exclusionReason(p);
    if (reason === null) continue;
    const key = reason.startsWith('category ') ? reason : reason;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    on_watchlist: row.on_watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    multiple: row.model.base_multiple,
    low_multiple: row.model.comparable_low,
    high_multiple: row.model.comparable_high,
    comparable_n: row.model.comparable_n,
    risk_note: row.risk_note,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const table = buildComparables(snapshot);
  const early = board.filter((r) => !r.on_watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    excluded_counts: excludedCounts(snapshot),
    global_median: round4(table.globalMedian),
    global_p25: round4(table.globalP25),
    global_p75: round4(table.globalP75),
    rows: board.map(radarRow),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_low_usd > r.implied_value_usd || r.implied_high_usd < r.implied_value_usd) return `${r.slug} has a low/high band that does not contain its implied value`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
