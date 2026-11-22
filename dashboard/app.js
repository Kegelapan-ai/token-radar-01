// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own arithmetic and the protocol's farm plan, the live-token
// comparables, the set-aside list and the method. No network: every byte it shows
// is in data.js. No link leaves the page: the source is named as text, not a link.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'board', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s); }

  // The model in one function, mirroring lib/model.ts: the page recomputes a row
  // from the snapshot figures and checks the number board.json carries, so the
  // page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = Math.min(model.breadth_cap, 1 + Math.max(0, row.chains.length - 1) * model.breadth_per_chain);
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category,
  // chains, TVL and age decide the action, the capital, the hold and every cost
  // and time. No name is special-cased. (Port of farmSteps in lib/model.ts.)
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curat') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    if (c.indexOf('capital allocator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of " + name + "'s tokenised asset on " + chain + ' and hold it in your wallet.';
    if (c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis vault on " + chain + ' and keep the position open.';
    if (c.indexOf('cedefi') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s main yield vault on " + chain + ' and keep the shares.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge, then close it.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + ', then leave the rest in the account.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payment') >= 0) return 'Hold $' + capital + ' in ' + name + ' on ' + chain + ' and make one real payment through it.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and vote once in its governance.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' and use one ' + name + ' app on it each week.';
    if (c.indexOf('otc') >= 0 || c.indexOf('marketplace') >= 0) return 'Place one $' + capital + ' order through ' + name + ' on ' + chain + ' and keep the account active.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Make one qualifying action each week, such as a fresh supply, a borrow, a repayment or a vote.';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Make one qualifying action each week, such as a swap in the pool, adding or removing a little liquidity, or a vote.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Make one qualifying action each week, such as a small trade, adjusting margin, or closing and reopening a hedge.';
    if (c.indexOf('prediction') >= 0) return 'Make one qualifying action each week, such as a new market position or settling one that closed.';
    if (c.indexOf('rwa') >= 0) return 'Make one qualifying action each week, such as minting more of the asset, a transfer, or a claim of its yield.';
    if (c.indexOf('risk curat') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('yield') >= 0) return 'Make one qualifying action each week, such as a fresh deposit into a vault, a rebalance, or a vote.';
    return 'Make one qualifying action each week, such as a deposit, a swap, a borrow or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(p), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; the snapshot lists no points program, so never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    // A hash names the whole state: anything it does not name resets, so
    // moving from a detail link to a filtered link does not keep the detail open.
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false;
    state.tab = 'board'; state.sort = 'implied'; state.dir = -1; state.selected = null;
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl')) state.wl = params.get('wl') === '1';
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('dir')) state.dir = params.get('dir') === '1' ? 1 : -1;
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.dir !== -1) params.set('dir', String(state.dir));
    if (state.selected) params.set('p', state.selected);
    var h = params.toString();
    history.replaceState(null, '', h ? '#' + h : window.location.pathname + window.location.search);
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.wl && !r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0 && (r.category || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -1e9 : a.change_7d; bv = b.change_7d === null ? -1e9 : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'name') { return dir * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      return dir * (av - bv) || (a.slug < b.slug ? -1 : 1);
    });
    return rows;
  }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '';
    return el('button', { text: label + arrow, onclick: function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
      writeHash(); render();
    } });
  }

  function statsPanel() {
    var totalTvl = DATA.rows.reduce(function (n, r) { return n + r.tvl_usd; }, 0);
    var top = DATA.rows[0];
    return el('section', { class: 'stats' },
      el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'pre-token protocols ranked' })),
      el('div', { class: 'stat' }, el('b', { text: String(DATA.watchlist_size) }), el('span', { text: 'watchlist protocols covered \u2014 all of them' })),
      el('div', { class: 'stat' }, el('b', { text: fmtUsd(totalTvl) }), el('span', { text: 'TVL across the ranked board' })),
      el('div', { class: 'stat' }, el('b', { text: fmtUsd(top.implied_value_usd) }), el('span', { text: 'top implied value: ' + top.name }))
    );
  }

  function tabsPanel() {
    var tabs = [
      ['board', 'Board', DATA.board_size],
      ['live', 'Live tokens (comparables)', DATA.live_size],
      ['setaside', 'Set aside', DATA.set_aside_size],
      ['method', 'Method & limits', null]
    ];
    return el('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
      return el('button', {
        class: 'tab', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false',
        onclick: function () { state.tab = t[0]; state.selected = null; writeHash(); render(); }
      }, el('span', { text: t[1] + ' ' }), t[2] === null ? null : el('span', { class: 'n', text: '(' + t[2] + ')' }));
    }));
  }

  function filtersPanel() {
    var catSel = el('select', { 'aria-label': 'Category', onchange: function (e) { state.category = e.target.value; writeHash(); render(); } },
      el('option', { value: 'all', text: 'All categories' }),
      categories().map(function (c) { return el('option', { value: c, text: c, selected: state.category === c ? 'selected' : null }); }));
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function (e) { state.chain = e.target.value; writeHash(); render(); } },
      el('option', { value: 'all', text: 'All chains' }),
      chains().map(function (c) { return el('option', { value: c, text: c, selected: state.chain === c ? 'selected' : null }); }));
    var search = el('input', {
      type: 'search', value: state.q, placeholder: 'Search name, slug or category', 'aria-label': 'Search',
      oninput: function (e) { state.q = e.target.value; writeHash(); render(); }
    });
    var wl = el('label', { class: 'check' },
      el('input', { type: 'checkbox', checked: state.wl ? 'checked' : null, onchange: function (e) { state.wl = e.target.checked; writeHash(); render(); } }),
      el('span', { text: 'Watchlist only' }));
    return el('div', { class: 'filters' },
      el('label', { text: 'Search' }, search),
      el('label', { text: 'Category' }, catSel),
      el('label', { text: 'Chain' }, chainSel),
      wl);
  }

  function detailPanel(row) {
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var breadth = Math.min(m.breadth_cap, 1 + Math.max(0, row.chains.length - 1) * m.breadth_per_chain);
    var recomputed = impliedOf(row, m);
    var math = 'TVL ' + fmtUsd(row.tvl_usd) + ' \u00d7 multiple ' + row.multiple.toFixed(3) +
      ' \u00d7 growth ' + growthMult.toFixed(3) + ' \u00d7 maturity ' + maturity.toFixed(3) +
      ' \u00d7 breadth ' + breadth.toFixed(2) + '\n= ' + fmtUsd(recomputed) +
      '  (board.json carries ' + fmtUsd(row.implied_value_usd) +
      (recomputed === row.implied_value_usd ? ', the same number.' : ', which differs: the data would be stale.') + ')' +
      '\nBand: ' + fmtUsd(row.implied_low_usd) + ' \u2013 ' + fmtUsd(row.implied_high_usd) +
      ' from the category comparables (low \u00d7' + row.low_multiple.toFixed(3) +
      ', high \u00d7' + row.high_multiple.toFixed(3) + ', ' + row.comparable_n + (row.comparable_n === 1 ? ' live protocol' : ' live protocols') + ' in ' + (row.category || 'no category') + ').';
    return el('section', { class: 'panel detail', 'aria-label': 'Protocol detail' },
      el('button', { class: 'close', text: 'Close \u00d7', onclick: function () { state.selected = null; writeHash(); render(); } }),
      el('h2', { text: '#' + row.rank + ' ' + row.name }),
      el('div', { class: 'meta' },
        el('span', { text: 'Category: ' }), el('b', { text: row.category || 'none listed' }),
        el('span', { text: 'Chains: ' }), el('b', { text: row.chains.join(', ') || 'none listed' }),
        el('span', { text: 'TVL: ' }), el('b', { text: fmtUsd(row.tvl_usd) }),
        el('span', { text: '7-day change: ' }), el('b', { text: fmtPct(row.change_7d), class: row.change_7d === null ? '' : (row.change_7d < 0 ? 'neg' : 'pos') }),
        el('span', { text: 'Tracked since: ' }), el('b', { text: (row.listed_at || 'unknown') + ' (' + fmtAge(row.age_days) + ')' }),
        el('span', { text: 'Token on record: ' }), el('b', { text: 'none \u2014 records no token' }),
        el('span', { text: 'Watchlist: ' }), el('b', { text: row.on_watchlist ? 'yes' : 'below the floor (early radar)' })),
      el('h3', { text: 'Implied value \u2014 ' + fmtUsd(row.implied_value_usd) + ' (band ' + fmtUsd(row.implied_low_usd) + ' \u2013 ' + fmtUsd(row.implied_high_usd) + ')' }),
      el('div', { class: 'math', text: math }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the multiple comes from live tokens in this category (median market-cap / TVL ' + row.multiple.toFixed(3) + ' after log-space shrinkage toward the global median ' + DATA.global_median.toFixed(3) + '), not from the name. An estimate, not a price: it says nothing about whether or when a token launches.' }),
      el('h3', { text: 'How to farm it' }),
      el('ol', { class: 'steps' }, farmSteps(row).map(function (s) { return el('li', { text: s }); })),
      el('p', { class: 'risk', text: row.risk_note }),
      el('p', { class: 'note', text: 'No step above claims this protocol runs a points program: the snapshot carries no airdrop flag. If it never issues a token, the position still has to be worth holding on its own.' })
    );
  }

  function boardPanel() {
    var rows = filteredRows();
    var selected = state.selected ? DATA.rows.filter(function (r) { return r.slug === state.selected; })[0] : null;
    var head = el('tr', {},
      el('th', {}, sortButton('Rank', 'implied')),
      el('th', {}, sortButton('Protocol', 'name')),
      el('th', {}, el('span', { text: 'Category' })),
      el('th', { class: 'num' }, sortButton('TVL', 'tvl')),
      el('th', { class: 'num' }, sortButton('7d', 'growth')),
      el('th', { class: 'num' }, sortButton('Age', 'age')),
      el('th', { class: 'num' }, sortButton('Implied value', 'implied')));
    var body = rows.map(function (r) {
      return el('tr', {
        class: state.selected === r.slug ? 'sel' : null,
        onclick: function () { state.selected = r.slug; writeHash(); render(); }
      },
        el('td', { class: 'rank', text: '#' + r.rank }),
        el('td', { class: 'name' }, el('b', { text: r.name }),
          el('span', { class: r.on_watchlist ? 'badge' : 'badge early', text: r.on_watchlist ? 'WATCHLIST' : 'EARLY \u00b7 BELOW FLOOR' }),
          el('small', { text: ' ' + r.slug })),
        el('td', { text: r.category || '\u2014' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : (r.change_7d < 0 ? 'neg' : 'pos')), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num' }, el('b', { text: fmtUsd(r.implied_value_usd) }), el('span', { class: 'band', text: fmtUsd(r.implied_low_usd) + ' \u2013 ' + fmtUsd(r.implied_high_usd) })));
    });
    return el('div', {},
      selected ? detailPanel(selected) : null,
      el('section', { class: 'panel' },
        el('h2', { text: 'The board' }),
        el('p', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan. Implied values are estimates with a band, not prices.' }),
        filtersPanel(),
        el('p', { class: 'count' }, el('b', { text: String(rows.length) }), el('span', { text: ' of ' + DATA.board_size + ' protocols shown' })),
        el('table', {}, el('caption', { class: 'sub', text: 'Ranked by implied value. The watchlist is the floor; the early rows below it are pre-token protocols under $50M of TVL.' }), el('thead', {}, head), el('tbody', {}, body)),
        rows.length === 0 ? el('p', { class: 'note', text: 'No protocol matches that filter. Clear the search or widen the category and chain.' }) : null
      ));
  }

  function livePanel() {
    var body = DATA.live.map(function (r, i) {
      return el('tr', {},
        el('td', { class: 'rank', text: String(i + 1) }),
        el('td', { class: 'name' }, el('b', { text: r.name }), el('small', { text: ' ' + r.slug })),
        el('td', { text: r.category || '\u2014' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_tvl === null ? 'n/a' : r.mcap_tvl.toFixed(3) + '\u00d7' }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : (r.change_7d < 0 ? 'neg' : 'pos')), text: fmtPct(r.change_7d) }));
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Live tokens: the comparables' }),
      el('p', { class: 'sub', text: 'The 24 largest live-token protocols by market cap. Their market-cap / TVL ratios are what the model prices pre-token protocols off: each category\u2019s median ratio, shrunk toward the global median ' + DATA.global_median.toFixed(3) + '. These protocols already trade, so they are set aside from the ranking \u2014 their market cap is a fact, not a model.' }),
      el('table', {}, el('caption', { class: 'sub', text: 'By market cap, largest first.' }),
        el('thead', {}, el('tr', {},
          el('th', { text: '#' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
          el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }),
          el('th', { class: 'num', text: 'Mcap / TVL' }), el('th', { class: 'num', text: '7d' }))),
        el('tbody', {}, body)));
  }

  function setAsidePanel() {
    var counts = Object.keys(DATA.excluded_counts).sort(function (a, b) { return DATA.excluded_counts[b] - DATA.excluded_counts[a]; });
    var body = DATA.set_aside.map(function (r) {
      return el('tr', {},
        el('td', { class: 'name' }, el('b', { text: r.name }), el('small', { text: ' ' + r.slug })),
        el('td', { text: r.category || '\u2014' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { text: r.reason }));
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Set aside, not ranked' }),
      el('p', { class: 'sub', text: 'A radar that hides what it left out is a table, not a radar. These protocols record no token, but the board does not rank them \u2014 and says why.' }),
      el('h3', { text: 'Above the floor but off the watchlist (' + DATA.set_aside_size + ')' }),
      el('p', { class: 'sub', text: 'Each passes every exclusion rule the snapshot can show, yet the house watchlist leaves it out. The snapshot does not carry DefiLlama\u2019s parentProtocol field, so the one remaining watchlist rule \u2014 no parent protocol \u2014 cannot be checked here. Ranking them would claim they are independent protocols, which the snapshot cannot prove.' }),
      el('table', {}, el('caption', { class: 'sub', text: 'By TVL, largest first. Unranked.' }),
        el('thead', {}, el('tr', {}, el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { class: 'num', text: 'TVL' }), el('th', { text: 'Why not ranked' }))),
        el('tbody', {}, body)),
      el('h3', { text: 'Excluded everywhere, by rule' }),
      el('p', { class: 'sub', text: 'Pre-token protocols the exclusion rule sets aside across the whole snapshot (a wrapped, staked or bridged product of a token that already trades is not a token that does not exist yet):' }),
      el('ul', {}, counts.map(function (k) { return el('li', { text: k + ': ' + DATA.excluded_counts[k] + ' protocol' + (DATA.excluded_counts[k] === 1 ? '' : 's') }); })));
  }

  function methodPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel' },
      el('h2', { text: 'Method & limits' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ' \u2014 the same function scores every protocol. Nothing here is a prediction that a token launches, or when.' }),
      el('div', { class: 'method-grid' },
        el('div', {},
          el('h3', { text: 'The formula' }),
          el('div', { class: 'formula', text: 'multiple = exp((n_cat \u00d7 ln(cat_median) + 8 \u00d7 ln(global_median)) / (n_cat + 8))\n  clamped to [0.05, 0.80]; low/high the same in log space on the\n  category p25 / p75, with the global p25 / p75 as the prior\nbase = TVL \u00d7 multiple\ngrowth = clamp(7-day change, -60%, +120%); growth \u00d7 0.5\nmaturity = 0.6 + min(age, 1095 days) / 1095 \u00d7 0.4\nbreadth = 1 + 0.02 \u00d7 min(chains \u2212 1, 10), at most 1.20\nimplied = TVL \u00d7 multiple \u00d7 growth \u00d7 maturity \u00d7 breadth\nLog space, because the ratios span orders of magnitude: one live\nprotocol at 400\u00d7 its TVL must not set its category\u2019s price.' }),
          el('h3', { text: 'Where the multiple comes from' }),
          el('p', { class: 'note', text: 'Live-token protocols in the same category: their median market-cap / TVL ratio. A category with few live protocols is shrunk toward the global median (' + DATA.global_median.toFixed(3) + '), so two protocols cannot set their own price. The low/high band uses the same category\u2019s 25th and 75th percentile ratios with the global quartiles (' + DATA.global_p25.toFixed(3) + ' / ' + DATA.global_p75.toFixed(3) + ') as the prior, so a thin category still gets a wide band \u2014 the band is the market\u2019s own spread, not a guess.' })),
        el('div', {},
          el('h3', { text: 'Who is ranked' }),
          el('p', { class: 'note', text: 'Pre-token means DefiLlama records no token: market cap, CoinGecko id and symbol all null. Ranked out are wrapped, staked and bridged products (Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX categories; names carrying wrapped, staked or staking; names beginning with an exchange\u2019s name; names ending in a version marker). The board is the whole 40-protocol watchlist plus the 138 rankable protocols below the $50M floor.' }),
          el('h3', { text: 'What the snapshot cannot say' }),
          el('p', { class: 'note', text: '\u201cRecords no token\u201d is not \u201chas no token\u201d: a protocol on the list may still have a token its DefiLlama record does not carry. The snapshot has no points program, no audit, no team and no launch date, so no farm step claims one exists, no row claims a protocol is safe, and no implied value is a price. The snapshot is frozen at ' + DATA.as_of + '; it does not move.' }))),
      el('div', { class: 'warn' }, el('b', { text: 'Read this before farming: ' }), el('span', { text: 'implied value is this entry\u2019s own estimate, built only from the snapshot. A token may never launch, and a launch may be worth far less than the band \u2014 or nothing. Never pay anyone to claim for you, never connect a wallet to a link that is not the protocol\u2019s own, and only farm with money you can lose.' })));
  }

  function render() {
    app.setAttribute('aria-busy', 'false');
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(statsPanel());
    app.appendChild(tabsPanel());
    if (state.tab === 'live') app.appendChild(livePanel());
    else if (state.tab === 'setaside') app.appendChild(setAsidePanel());
    else if (state.tab === 'method') app.appendChild(methodPanel());
    else app.appendChild(boardPanel());
    app.appendChild(el('footer', {},
      el('p', { text: 'Snapshot: ' + DATA.source + ' \u00b7 as of ' + DATA.as_of + ' \u00b7 floor $' + Math.round(DATA.floor_usd / 1e6) + 'M \u00b7 model ' + DATA.model_version + '. Static page: no network, no tracking, no external files.' }),
      el('p', { text: 'Built for the make.fun token-radar-01 bounty. Implied values are estimates from the snapshot alone; they are not prices, not advice, and not a promise that any token launches.' })));
  }

  readHash();
  if (state.tab !== 'board' && state.tab !== 'live' && state.tab !== 'setaside' && state.tab !== 'method') state.tab = 'board';
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
