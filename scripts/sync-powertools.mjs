#!/usr/bin/env node
// Merges a TCG PowerTools stock export into data/stock.json (used by the daily GitHub job).
// Source, in order of preference:
//   1. POWERTOOLS_EXPORT_URL (a repository secret): a link that downloads your latest PowerTools CSV
//   2. the newest .csv file in data/powertools/ (upload it on GitHub; it's deleted once merged)
// Uses the sync settings saved from the Hoard Manager (stock.json → settings.pt).
// Never fails the deploy: problems are reported as warnings.
import { readFile, writeFile, readdir, unlink, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { readPowerTools, mergeStock } = require('../lib/powertools.js');
const STOCK = 'data/stock.json';
const DIR = 'data/powertools';
const summary = async md => { if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n'); };
const warn = m => console.log(`::warning::${m}`);

async function getExport() {
  const url = process.env.POWERTOOLS_EXPORT_URL;
  if (url) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'ManaHoard/1.0 (+https://github.com/PaulMarsey/mana-hoard-app)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { text: await r.text(), from: 'your PowerTools export link' };
    } catch (e) { warn(`Couldn't download the PowerTools export link (${e.message}). Trying data/powertools/ instead.`); }
  }
  let files = [];
  try { files = (await readdir(DIR)).filter(f => /\.(csv|txt)$/i.test(f)).sort(); } catch { /* folder absent */ }
  if (!files.length) return null;
  const newest = files[files.length - 1];
  const text = await readFile(path.join(DIR, newest), 'utf8');
  return { text, from: `data/powertools/${newest}`, cleanup: files.map(f => path.join(DIR, f)) };
}

const src = await getExport();
if (!src) { console.log('No PowerTools export to sync (no link set and nothing in data/powertools/).'); process.exit(0); }

const parsed = readPowerTools(src.text);
if (parsed.error) { warn(`PowerTools export from ${src.from} wasn't read: ${parsed.error}`); process.exit(0); }
if (!parsed.rows.length) { warn(`PowerTools export from ${src.from} had no cards; stock left unchanged.`); process.exit(0); }

const stock = JSON.parse(await readFile(STOCK, 'utf8'));
const s = stock.settings || {};
const o = Object.assign({ rate: 0.85, priceMode: 'keep', zeroMissing: true, newLive: true }, s.pt || {});
// same starting-price rules as the manager, for new cards without a PowerTools price
const rk = r => { r = String(r || '').toLowerCase(); return r.startsWith('myth') ? 'mythic' : r.startsWith('rare') ? 'rare' : r.startsWith('unc') ? 'uncommon' : r.startsWith('com') ? 'common' : 'special'; };
const priceFor = l => {
  const floor = (s.floor || {})[rk(l.rarity)] || s.min || 10;
  let p = l.cost > 0 ? l.cost * (1 + (s.markup ?? 30) / 100) : floor;
  if (/^(foil|etched)/i.test(l.finish || '')) p *= s.foil ?? 1.5;
  p *= ((s.cond || {})[l.cond] ?? 1);
  return Math.ceil(Math.max(p, s.min || 10) / 5) * 5;
};
// guard: an export that would wipe out most of the shop is probably partial or the wrong file
const before = (stock.items || []).filter(i => i.cat !== 'Sealed' && i.cat !== 'Accessories' && i.qty > 0).length;
const { items, report } = mergeStock(stock.items || [], parsed.rows, { ...o, priceFor, now: Date.now() });
if (o.zeroMissing && before >= 20 && report.soldOut.length > before * 0.8) {
  warn(`This export would mark ${report.soldOut.length} of ${before} cards sold out, which looks like a partial or wrong file. Nothing was changed. Sync it from the Hoard Manager if it's right.`);
  process.exit(0);
}
stock.items = items.map(({ cost, ...r }) => r); // purchase prices stay private
stock.settings = { ...s, pt: { ...o, last: new Date().toISOString() } };
stock.updated = new Date().toISOString();
await writeFile(STOCK, JSON.stringify(stock, null, 1) + '\n');
for (const f of src.cleanup || []) await unlink(f).catch(() => {});

const line = `TCG PowerTools sync from ${src.from}: ${report.changed.length} updated, ${report.added.length} new, ${report.soldOut.length} sold out, ${report.unchanged} unchanged.`;
console.log(line);
const rows = (list, f) => list.slice(0, 50).map(f).join('\n') + (list.length > 50 ? `\n| …and ${list.length - 50} more | |` : '');
await summary(`## ${line}\n` +
  (report.changed.length ? `\n### Updated\n| Card | Quantity |\n|---|---|\n${rows(report.changed, c => `| ${c.name} | ${c.fromQty} → ${c.toQty} |`)}\n` : '') +
  (report.added.length ? `\n### New\n| Card | Qty |\n|---|---|\n${rows(report.added, c => `| ${c.name} | ${c.qty} |`)}\n` : '') +
  (report.soldOut.length ? `\n### Sold out\n| Card | Was |\n|---|---|\n${rows(report.soldOut, c => `| ${c.name} | ${c.fromQty} |`)}\n` : ''));
