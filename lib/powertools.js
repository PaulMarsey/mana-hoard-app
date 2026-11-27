/* TCG PowerTools → Mana Hoard stock sync.
 * Shared by the shop's Hoard Manager (browser) and scripts/sync-powertools.mjs (GitHub Actions).
 * PowerTools is treated as the source of truth for WHAT you have and HOW MANY:
 *   - cards in the export get their quantity updated (sales on Cardmarket/CardTrader/etc. show up here),
 *   - cards missing from the export can be marked sold out,
 *   - new cards are added (as drafts or live).
 * Column names are matched loosely, so both PowerTools stock exports and its import-format files work.
 */
(function (root) {
  'use strict';
  const LANG = { english: 'en', en: 'en', german: 'de', deutsch: 'de', de: 'de', french: 'fr', fr: 'fr', italian: 'it', it: 'it', spanish: 'es', es: 'es', portuguese: 'pt', pt: 'pt', japanese: 'ja', ja: 'ja', jp: 'ja', korean: 'ko', ko: 'ko', russian: 'ru', ru: 'ru', 'simplified chinese': 'zhs', 's-chinese': 'zhs', zhs: 'zhs', 'traditional chinese': 'zht', 't-chinese': 'zht', zht: 'zht' };
  const COND = { m: 'MT', mt: 'MT', mint: 'MT', nm: 'NM', 'near mint': 'NM', ex: 'EX', excellent: 'EX', gd: 'GD', good: 'GD', lp: 'LP', 'light played': 'LP', 'lightly played': 'LP', pl: 'PL', played: 'PL', po: 'PO', poor: 'PO' };
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

  function parseCSV(t) {
    t = String(t || '').replace(/^﻿/, '');
    const first = t.split(/\r?\n/)[0] || '';
    const D = first.includes('\t') ? '\t' : (!first.includes(',') && first.includes(';')) ? ';' : (first.split(';').length > first.split(',').length ? ';' : ',');
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === D) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); if (row.some(x => x.trim())) rows.push(row); row = []; f = ''; }
      else f += c;
    }
    row.push(f); if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }
  const truthy = v => /^(1|true|yes|y|foil|x)$/i.test(String(v || '').trim());
  const num = v => { const n = parseFloat(String(v || '').replace(/[^0-9.,-]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };

  /** Read a PowerTools CSV into normalised rows. Returns {rows, skipped, columns} or {error}. */
  function readPowerTools(text) {
    const all = parseCSV(text);
    if (all.length < 2) return { error: 'That file has no rows under the header.' };
    const h = all[0].map(x => x.trim().toLowerCase().replace(/[\s_-]+/g, ''));
    const col = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
    const C = {
      cmid: col('cardmarketid', 'idproduct', 'productid', 'cmid', 'mkmid'),
      qty: col('quantity', 'amount', 'count', 'qty', 'stock'),
      name: col('name', 'cardname', 'englishname', 'product', 'productname', 'localname'),
      setName: col('set', 'expansion', 'expansionname', 'edition', 'setname'),
      set: col('setcode', 'expansioncode', 'editioncode'),
      num: col('collectornumber', 'number', 'cardnumber', 'cn'),
      cond: col('condition', 'cond'),
      lang: col('language', 'lang', 'idlanguage'),
      foil: col('isfoil', 'foil', 'isreverseholo'),
      finish: col('finishtype', 'finish', 'printing'),
      price: col('price', 'listingprice', 'sellprice', 'myprice'),
      buy: col('buyprice', 'purchaseprice', 'cost'),
      signed: col('issigned', 'signed'),
    };
    if (C.qty < 0) return { error: 'No quantity column found — is this a TCG PowerTools stock export?' };
    if (C.cmid < 0 && C.name < 0) return { error: 'No Cardmarket ID or card name column found.' };
    const g = (r, i) => i >= 0 ? String(r[i] ?? '').trim() : '';
    const rows = []; let skipped = 0;
    for (const r of all.slice(1)) {
      const qty = parseInt(g(r, C.qty), 10);
      const cmid = g(r, C.cmid).replace(/\D/g, '');
      const name = g(r, C.name);
      if (!(qty >= 0) || (!cmid && !name)) { skipped++; continue; }
      const fin = g(r, C.finish).toLowerCase();
      const finish = fin.includes('etch') ? 'Etched' : (fin.includes('foil') && !fin.includes('non')) || truthy(g(r, C.foil)) ? 'Foil' : 'Non-foil';
      const lc = g(r, C.lang).toLowerCase();
      rows.push({
        cmid, name, setName: g(r, C.setName), set: g(r, C.set).toUpperCase(), num: g(r, C.num),
        cond: COND[g(r, C.cond).toLowerCase()] || 'NM', lang: LANG[lc] || (lc.length === 2 ? lc : 'en'),
        finish, qty, priceEur: num(g(r, C.price)), buyEur: num(g(r, C.buy)), signed: truthy(g(r, C.signed)),
      });
    }
    // merge duplicate rows (same article listed twice)
    const map = new Map();
    for (const r of rows) { const k = rowKey(r); if (map.has(k)) map.get(k).qty += r.qty; else map.set(k, r); }
    return { rows: [...map.values()], skipped, columns: Object.keys(C).filter(k => C[k] >= 0) };
  }
  const variant = x => [x.finish === 'Non-foil' ? 'n' : 'f', x.cond, x.lang || 'en'].join('|');
  const rowKey = r => (r.cmid ? 'cm:' + r.cmid : 'nm:' + norm(r.name) + '|' + norm(r.setName || r.set)) + '|' + variant(r);

  /**
   * Merge PowerTools rows into shop items.
   * opts: {rate (EUR→GBP), priceMode: 'keep'|'powertools', zeroMissing, newLive, priceFor(item)->pence, uid(), now}
   * Returns {items, report:{changed, added, soldOut, unchanged, unmatchedSkipped}}.
   */
  function mergeStock(items, rows, opts) {
    const o = Object.assign({ rate: 0.85, priceMode: 'keep', zeroMissing: true, newLive: true, now: Date.now() }, opts || {});
    const out = items.map(i => Object.assign({}, i));
    const isCard = i => i.cat !== 'Sealed' && i.cat !== 'Accessories';
    // index existing items by Cardmarket ID and by name+set
    const byCm = new Map(), byName = new Map();
    for (const i of out) {
      if (i.cmid) byCm.set('cm:' + i.cmid + '|' + variant(i), i);
      for (const s of [i.setName, i.set]) if (s) byName.set('nm:' + norm(i.name) + '|' + norm(s) + '|' + variant(i), i);
    }
    const toPence = eur => Math.max(0, Math.round(eur * o.rate * 100));
    const report = { changed: [], added: [], soldOut: [], unchanged: 0 };
    const seen = new Set();
    for (const r of rows) {
      let it = r.cmid ? byCm.get('cm:' + r.cmid + '|' + variant(r)) : null;
      if (!it && r.name) it = byName.get('nm:' + norm(r.name) + '|' + norm(r.setName || r.set) + '|' + variant(r)) || (r.set ? byName.get('nm:' + norm(r.name) + '|' + norm(r.set) + '|' + variant(r)) : null);
      if (it) {
        seen.add(it);
        const before = { qty: it.qty, price: it.price };
        it.qty = r.qty;
        if (r.cmid) it.cmid = r.cmid;
        if (o.priceMode === 'powertools' && r.priceEur > 0) it.price = toPence(r.priceEur);
        if (r.buyEur > 0) it.cost = toPence(r.buyEur);
        it.src = 'powertools';
        if (before.qty !== it.qty || before.price !== it.price) report.changed.push({ id: it.id, name: it.name, set: it.set || it.setName, fromQty: before.qty, toQty: it.qty, fromPrice: before.price, toPrice: it.price });
        else report.unchanged++;
      } else if (r.qty > 0) {
        if (!r.name) { report.unchanged++; continue; } // can't list a card with no name; skip quietly
        const item = {
          id: (o.uid ? o.uid() : 'pt' + Math.random().toString(36).slice(2, 10)), name: r.name, set: r.set || '', setName: r.setName || '', num: r.num || '',
          finish: r.finish, rarity: '', cond: r.cond, lang: r.lang, qty: r.qty, cost: r.buyEur > 0 ? toPence(r.buyEur) : 0,
          cat: 'Singles', live: !!o.newLive, added: o.now + report.added.length, src: 'powertools',
        };
        if (r.cmid) item.cmid = r.cmid;
        item.price = r.priceEur > 0 ? toPence(r.priceEur) : (o.priceFor ? o.priceFor(item) : 0);
        out.push(item); seen.add(item);
        report.added.push({ id: item.id, name: item.name, set: item.set || item.setName, qty: item.qty, price: item.price });
      }
    }
    if (o.zeroMissing) {
      for (const i of out) {
        if (!seen.has(i) && isCard(i) && i.qty > 0) { report.soldOut.push({ id: i.id, name: i.name, set: i.set || i.setName, fromQty: i.qty }); i.qty = 0; }
      }
    }
    return { items: out, report };
  }

  const api = { parseCSV, readPowerTools, mergeStock };
  root.PowerToolsSync = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
