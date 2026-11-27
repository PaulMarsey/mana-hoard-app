#!/usr/bin/env node
// Fills in Scryfall card images for any card in data/stock.json that doesn't have one yet.
// Runs automatically in the GitHub Pages deploy, and you can run it yourself:
//   node scripts/add-scryfall-images.mjs            (updates data/stock.json in place)
// Follows Scryfall's API rules: identifying User-Agent + Accept headers, batches of 75 via
// /cards/collection, and at least 500 ms between requests. Never fails the build.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] || 'data/stock.json';
const API = process.env.SCRYFALL_API || 'https://api.scryfall.com';
const HEADERS = {
  'User-Agent': 'ManaHoard/1.0 (+https://github.com/PaulMarsey/mana-hoard-app)',
  'Accept': 'application/json;q=0.9,*/*;q=0.8',
};
const POST_HEADERS = { ...HEADERS, 'Content-Type': 'application/json' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfImg = u => typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.scryfall\.io\//i.test(u) ? u : '';
const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const sameName = (c, i) => { const n = norm(i.name); return norm(c.name) === n || String(c.name || '').split(' // ').some(f => norm(f) === n) || (c.printed_name && norm(c.printed_name) === n); };
const isCard = i => i.cat !== 'Sealed' && i.cat !== 'Accessories';
const rk = r => { r = String(r || '').toLowerCase(); return r.startsWith('myth') ? 'mythic' : r.startsWith('rare') ? 'rare' : r.startsWith('unc') ? 'uncommon' : r.startsWith('com') ? 'common' : 'special'; };

function primaryIdent(i) {
  if (UUID.test(i.sid || '')) return { id: i.sid };
  if (i.set && i.num) return { set: i.set.toLowerCase(), collector_number: String(i.num) };
  return i.set ? { name: i.name, set: i.set.toLowerCase() } : { name: i.name };
}
function applyCard(i, c) {
  const face = c.card_faces && c.card_faces[0];
  const u = c.image_uris || (face && face.image_uris) || {};
  const img = sfImg(u.normal) || sfImg(u.large) || sfImg(u.small);
  if (!img) return false;
  i.img = img; if (sfImg(u.large)) i.imgL = u.large;
  const bf = c.card_faces && c.card_faces[1] && c.card_faces[1].image_uris;
  const B = bf && (sfImg(bf.normal) || sfImg(bf.large)); if (B) i.imgB = B; else delete i.imgB;
  i.sfv = 2;
  if (UUID.test(c.id || '')) i.sid = c.id;
  if (/^https:\/\/scryfall\.com\//.test(c.scryfall_uri || '')) i.sfUri = c.scryfall_uri;
  const artist = c.artist || (face && face.artist); if (artist) i.artist = String(artist).slice(0, 80);
  const tl = c.type_line || (face && face.type_line); if (tl) i.tline = String(tl).slice(0, 120);
  if (!i.setName && c.set_name) i.setName = String(c.set_name).slice(0, 80);
  if (rk(i.rarity) === 'special' && c.rarity && c.rarity !== 'special') i.rarity = String(c.rarity);
  delete i.imgMiss; return true;
}
async function post(idents) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${API}/cards/collection`, { method: 'POST', headers: POST_HEADERS, body: JSON.stringify({ identifiers: idents }) });
    if (r.status === 429) { console.log('Scryfall asked us to slow down; waiting 31s'); await sleep(31000); continue; }
    if (!r.ok) throw new Error(`Scryfall replied ${r.status}`);
    await sleep(550);
    return r.json();
  }
  throw new Error('Scryfall kept rate-limiting; try again later');
}
async function lookup(batch, mk) {
  const res = await post(batch.map(mk));
  const cards = Array.isArray(res.data) ? res.data : [];
  const left = [];
  for (const i of batch) {
    const id = mk(i);
    const c = cards.find(c => id.id ? c.id === id.id
      : id.collector_number ? (String(c.set).toLowerCase() === id.set && String(c.collector_number).toLowerCase() === id.collector_number.toLowerCase() && sameName(c, i))
      : (sameName(c, i) && (!id.set || String(c.set).toLowerCase() === id.set)));
    if (!(c && applyCard(i, c))) left.push(i);
  }
  return left;
}

const raw = await readFile(FILE, 'utf8');
const stock = JSON.parse(raw);
const items = Array.isArray(stock.items) ? stock.items : [];
// also re-check cards looked up before back faces were saved (sfv < 2), once
const todo = items.filter(i => i && i.name && isCard(i) && (!sfImg(i.img) || (i.sfv || 1) < 2));
if (!todo.length) { console.log('Every card already has a Scryfall image.'); process.exit(0); }
console.log(`Looking up ${todo.length} card(s) on Scryfall…`);
let missed = [];
try {
  // cards synced from TCG PowerTools carry a Cardmarket ID; Scryfall looks those up one at a time
  const cm = todo.filter(i => i.cmid && !UUID.test(i.sid || '') && !(i.set && i.num));
  for (const i of cm) {
    const r = await fetch(`${API}/cards/cardmarket/${encodeURIComponent(i.cmid)}`, { headers: HEADERS });
    await sleep(120);
    if (r.status === 429) { await sleep(31000); }
    const c = r.ok ? await r.json() : null;
    if (!(c && applyCard(i, c))) missed.push(i);
  }
  const rest = todo.filter(i => !cm.includes(i));
  for (let k = 0; k < rest.length; k += 75) {
    const batch = rest.slice(k, k + 75);
    let left = await lookup(batch, primaryIdent);
    const retry = left.filter(i => i.set && !UUID.test(i.sid || ''));
    if (retry.length) {
      const still = await lookup(retry, i => ({ name: i.name, set: i.set.toLowerCase() }));
      left = left.filter(i => !retry.includes(i) || still.includes(i));
    }
    missed.push(...left);
  }
} catch (e) {
  console.log(`::warning::Scryfall lookup stopped early: ${e.message}. The site still deploys; cards without images show the drawn frame.`);
}
const found = todo.filter(i => sfImg(i.img)).length;
for (const i of todo) if (sfImg(i.img)) i.sfv = 2; // don't re-check again next deploy
stock.items = items.map(({ cost, ...r }) => r);
await writeFile(FILE, JSON.stringify(stock, null, 1) + '\n');
console.log(`Added images for ${found} of ${todo.length} card(s).`);
if (missed.length) console.log(`Not found on Scryfall: ${missed.map(i => `${i.name} (${i.set} ${i.num || ''})`).join(', ')}`);
