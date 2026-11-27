// Offline tests: fake Stripe + fake GitHub + fake published stock. Run: node test/worker.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';

const stockFile = JSON.parse(await readFile(new URL('../../data/stock.json', import.meta.url), 'utf8'));
const env = { SHOP_URL: 'https://paulmarsey.github.io/mana-hoard-app/', STOCK_URL: 'https://paulmarsey.github.io/mana-hoard-app/data/stock.json', GITHUB_REPO: 'PaulMarsey/mana-hoard-app', SHIP_COUNTRIES: 'GB', SHIPPING: '', FREE_SHIP_OVER: '3000', MIN_ORDER: '200', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', GITHUB_TOKEN: 'ghp_x' };
let repo = JSON.parse(JSON.stringify(stockFile)), sha = 's1', lastSession = null, puts = 0;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith(env.STOCK_URL)) return new Response(JSON.stringify(stockFile));
  if (url === 'https://api.stripe.com/v1/checkout/sessions') {
    assert.equal(opt.headers.Authorization, 'Bearer sk_test_x');
    lastSession = new URLSearchParams(opt.body); return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
  }
  if (url.startsWith('https://api.stripe.com/v1/checkout/sessions/cs_test_1/line_items')) {
    return new Response(JSON.stringify({ data: [{ quantity: 1, price: { product: { metadata: { listing_id: 'msh-4' } } } }, { quantity: 2, price: { product: { metadata: { listing_id: 'msh-12' } } } }] }));
  }
  if (url.startsWith('https://api.github.com/repos/PaulMarsey/mana-hoard-app/contents/data/stock.json')) {
    if ((opt.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha, content: Buffer.from(JSON.stringify(repo)).toString('base64') }));
    const b = JSON.parse(opt.body); assert.equal(b.sha, sha); repo = JSON.parse(Buffer.from(b.content, 'base64').toString('utf8')); sha = 's' + (++puts + 1); return new Response('{}', { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};
const origin = { Origin: 'https://paulmarsey.github.io', 'Content-Type': 'application/json' };
const call = (path, body, headers = origin, method = 'POST') => worker.fetch(new Request('https://w.example' + path, { method, headers, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env);

// 1. happy path: prices come from stock.json, not the browser
let r = await call('/checkout', { items: [{ id: 'msh-4', qty: 1, price: 1 }, { id: 'msh-12', qty: 2 }], ref: 'MH-ABC123', note: 'hi' });
let d = await r.json(); assert.equal(r.status, 200, JSON.stringify(d)); assert.match(d.url, /^https:\/\/checkout\.stripe\.com/);
assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://paulmarsey.github.io');
const mjol = stockFile.items.find(i => i.id === 'msh-4');
assert.equal(lastSession.get('line_items[0][price_data][unit_amount]'), String(mjol.price), 'server price used');
assert.equal(lastSession.get('line_items[0][price_data][currency]'), 'gbp');
assert.equal(lastSession.get('line_items[0][price_data][product_data][metadata][listing_id]'), 'msh-4');
assert.equal(lastSession.get('shipping_address_collection[allowed_countries][0]'), 'GB');
assert.equal(lastSession.get('client_reference_id'), 'MH-ABC123');
assert.match(lastSession.get('success_url'), /\?paid=\{CHECKOUT_SESSION_ID\}#thanks$/);
assert.equal(lastSession.get('payment_method_types[0]'), null, 'payment methods left to the Dashboard (cards, Apple Pay, Google Pay)');
assert.equal(lastSession.get('allow_promotion_codes'), 'true');
console.log('✓ checkout session uses server prices, GBP, UK shipping, ref, wallets from Dashboard, discount codes on');
// free shipping over £30
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), mjol.price + 2 * stockFile.items.find(i => i.id === 'msh-12').price >= 3000 ? '0' : '195');
// free postage makes 2nd Class free and keeps Tracked as a paid upgrade
r = await call('/checkout', { items: [{ id: 'msh-1', qty: 1 }] }); assert.equal(r.status, 200);
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][display_name]'), 'Free Royal Mail 2nd Class');
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '0');
assert.equal(lastSession.get('shipping_options[1][shipping_rate_data][fixed_amount][amount]'), '395');
assert.equal(lastSession.get('shipping_options[2][shipping_rate_data][fixed_amount][amount]'), '450');
assert.equal(lastSession.get('shipping_options[2][shipping_rate_data][display_name]'), 'Royal Mail Tracked 24');
console.log('✓ over £30: free 2nd Class, Tracked 48 £3.95 and Tracked 24 £4.50 as upgrades');
// letter post: offered for up to 3 singles only, never alongside free postage
const env2 = { ...env, SHIPPING: '[{"name":"Royal Mail Letter (untracked, up to 3 cards)","amount":110,"min":2,"max":4,"maxCards":3},{"name":"Royal Mail 2nd Class","amount":195,"min":2,"max":4},{"name":"Royal Mail Tracked 48","amount":395,"min":2,"max":3}]' };
const saveEnv = { ...env }; Object.assign(env, env2);
r = await call('/checkout', { items: [{ id: 'msh-12', qty: 2 }] }); assert.equal(r.status, 200);
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '110');
r = await call('/checkout', { items: [{ id: 'msh-12', qty: 4 }] }); assert.equal(r.status, 200);
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '195', '4 cards: no letter option');
r = await call('/checkout', { items: [{ id: 'msh-1', qty: 1 }] }); assert.equal(r.status, 200);
assert.equal(lastSession.get('shipping_options[0][shipping_rate_data][display_name]'), 'Free Royal Mail 2nd Class');
assert.equal(lastSession.get('shipping_options[2][shipping_rate_data][fixed_amount][amount]'), null, 'letter dropped when postage is free');
Object.assign(env, saveEnv);
console.log('✓ letter post £1.10 for up to 3 cards; 2nd Class from 4 cards; free 2nd Class over £30');
// minimum order
r = await call('/checkout', { items: [{ id: 'msh-12', qty: 1 }] }); d = await r.json();
assert.equal(r.status, 400); assert.match(d.error, /minimum order is £2.00/);
console.log('✓ refuses baskets under the £2 minimum');
// 2. too many / sold out / unknown
r = await call('/checkout', { items: [{ id: 'msh-1', qty: 5 }, { id: 'nope', qty: 1 }] }); d = await r.json();
assert.equal(r.status, 409); assert.equal(d.problems.length, 2); assert.match(d.problems[0].reason, /only 1 left/);
console.log('✓ rejects more than in stock and unknown cards:', d.problems.map(p => p.reason).join(', '));
// 3. other websites can't start a checkout
r = await call('/checkout', { items: [{ id: 'msh-4', qty: 1 }] }, { Origin: 'https://evil.example', 'Content-Type': 'application/json' });
assert.equal(r.status, 403); console.log('✓ blocks checkouts started from other websites');
// 4. webhook: bad signature rejected
const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', client_reference_id: 'MH-ABC123' } } });
r = await call('/webhook', event, { 'Stripe-Signature': 't=1,v1=deadbeef' }); assert.equal(r.status, 400); console.log('✓ rejects webhooks without a valid Stripe signature');
// 5. webhook: valid signature reduces stock once
const sign = async (payload) => { const t = Math.floor(Date.now() / 1000); const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const s = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))).toString('hex'); return `t=${t},v1=${s}`; };
const before = { a: repo.items.find(i => i.id === 'msh-4').qty, b: repo.items.find(i => i.id === 'msh-12').qty };
r = await call('/webhook', event, { 'Stripe-Signature': await sign(event) }); d = await r.json();
assert.equal(d.stock, 'stock updated', JSON.stringify(d));
assert.equal(repo.items.find(i => i.id === 'msh-4').qty, before.a - 1); assert.equal(repo.items.find(i => i.id === 'msh-12').qty, Math.max(0, before.b - 2));
r = await call('/webhook', event, { 'Stripe-Signature': await sign(event) }); d = await r.json();
assert.equal(d.stock, 'already applied'); assert.equal(repo.items.find(i => i.id === 'msh-4').qty, before.a - 1);
console.log(`✓ paid order reduces stock in the repo (Mjölnir ${before.a}→${before.a - 1}, msh-12 ${before.b}→${Math.max(0, before.b - 2)}) and a retried webhook isn't applied twice`);
r = await call('/checkout', { items: [{ id: 'msh-4', qty: 1 }], ref: 'MH-APP1', app: true }); assert.equal(r.status, 200);
assert.match(lastSession.get('success_url'), /\?paid=\{CHECKOUT_SESSION_ID\}&app=1#thanks$/); console.log('✓ checkout from the Android app returns via the app');
r = await call('/health', null, {}, 'GET'); d = await r.json(); assert.equal(d.live, false); console.log('✓ health check reports test mode');
console.log('All checkout worker tests passed.');
