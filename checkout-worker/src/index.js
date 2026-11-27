/* Mana Hoard checkout — a tiny Cloudflare Worker between the shop and Stripe.
 *
 * POST /checkout  { items:[{id,qty}], ref, note }  ->  { url }  (Stripe-hosted Checkout page)
 *   Prices, names and stock are read from the PUBLISHED stock.json, never from the browser,
 *   so a shopper can't change what they pay. Stripe's hosted page offers cards, Apple Pay and
 *   Google Pay (whichever are switched on in your Stripe Dashboard → Payment methods).
 *
 * POST /webhook   (Stripe calls this after payment)
 *   Verifies Stripe's signature, then — if GITHUB_TOKEN is set — takes the sold cards out of
 *   data/stock.json in your repo. That commit redeploys the shop. Each payment is only applied once.
 *
 * Secrets (wrangler secret put …): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GITHUB_TOKEN (optional)
 * Settings (wrangler.toml [vars]):  SHOP_URL, STOCK_URL, GITHUB_REPO, SHIP_COUNTRIES, SHIPPING, FREE_SHIP_OVER
 */
const UA = 'ManaHoard-Checkout/1.0';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const COND = { MT: 'Mint', NM: 'Near Mint', EX: 'Excellent', GD: 'Good', LP: 'Light Played', PL: 'Played', PO: 'Poor' };

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  let allowed = '';
  try { allowed = new URL(env.SHOP_URL).origin; } catch { /* misconfigured */ }
  const extra = String(env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = origin && (origin === allowed || extra.includes(origin));
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
}

// Stripe's API takes form-encoded nested params: line_items[0][price_data][currency]=gbp
function form(obj, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, path, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, body: body ? form(body) : undefined,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || `Stripe error ${r.status}`);
  return data;
}

async function loadStock(env) {
  const r = await fetch(env.STOCK_URL + (env.STOCK_URL.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'User-Agent': UA }, cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error(`Couldn't load the shop's stock (${r.status})`);
  return r.json();
}

function shippingOptions(env, subtotal) {
  let rates = [];
  try { rates = JSON.parse(env.SHIPPING || '[]'); } catch { rates = []; }
  if (!rates.length) rates = [{ name: 'Royal Mail 2nd Class', amount: 195, min: 2, max: 4 }, { name: 'Royal Mail Tracked 48', amount: 395, min: 2, max: 3 }];
  const free = parseInt(env.FREE_SHIP_OVER || '0', 10);
  // free postage upgrades the cheapest option (2nd Class) to free; tracked stays a paid upgrade
  if (free > 0 && subtotal >= free && rates.length) {
    const cheapest = [...rates].sort((a, b) => a.amount - b.amount)[0];
    rates = [{ ...cheapest, name: 'Free ' + cheapest.name, amount: 0 }, ...rates.filter(r => r !== cheapest)];
  }
  return rates.slice(0, 5).map(r => ({
    shipping_rate_data: {
      type: 'fixed_amount', display_name: String(r.name).slice(0, 100),
      fixed_amount: { amount: Math.max(0, parseInt(r.amount, 10) || 0), currency: 'gbp' },
      ...(r.min && r.max ? { delivery_estimate: { minimum: { unit: 'business_day', value: r.min }, maximum: { unit: 'business_day', value: r.max } } } : {}),
    },
  }));
}

async function createCheckout(req, env) {
  let body;
  try { body = await req.json(); } catch { return { status: 400, data: { error: 'Bad request' } }; }
  const want = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!want.length) return { status: 400, data: { error: 'Your basket is empty.' } };
  const stock = await loadStock(env);
  const byId = new Map((stock.items || []).map(i => [i.id, i]));
  const lines = [], problems = [];
  for (const w of want) {
    const it = byId.get(String(w.id));
    const qty = Math.max(1, Math.min(99, parseInt(w.qty, 10) || 1));
    if (!it || !it.live || !(it.price > 0)) { problems.push({ id: w.id, reason: 'no longer available' }); continue; }
    if (it.qty < qty) { problems.push({ id: w.id, name: it.name, reason: it.qty > 0 ? `only ${it.qty} left` : 'sold out', left: it.qty }); continue; }
    const foil = /^(foil|etched)/i.test(it.finish || '');
    const desc = [it.setName || it.set, it.num ? `#${it.num}` : '', it.cat === 'Sealed' || it.cat === 'Accessories' ? '' : COND[it.cond] || it.cond, foil ? it.finish : '', it.lang && it.lang !== 'en' ? it.lang.toUpperCase() : ''].filter(Boolean).join(' · ');
    lines.push({
      quantity: qty,
      price_data: {
        currency: 'gbp', unit_amount: Math.round(it.price),
        product_data: {
          name: String(it.name).slice(0, 250), description: desc.slice(0, 500) || undefined,
          images: /^https:\/\/[a-z0-9.-]+\.scryfall\.io\//i.test(it.img || '') ? [it.img] : undefined,
          metadata: { listing_id: it.id },
        },
      },
    });
  }
  if (problems.length) return { status: 409, data: { error: 'Some cards in your basket have changed.', problems } };
  const minOrder = parseInt(env.MIN_ORDER || '0', 10);
  const goods = lines.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);
  if (minOrder > 0 && goods < minOrder) return { status: 400, data: { error: `Our minimum order is £${(minOrder / 100).toFixed(2)}.` } };
  const subtotal = lines.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);
  const ref = String(body.ref || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 40);
  const countries = String(env.SHIP_COUNTRIES || 'GB').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const shop = String(env.SHOP_URL).replace(/#.*$/, '');
  const session = await stripe(env, 'checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'payment',
      line_items: lines,
      shipping_address_collection: { allowed_countries: countries },
      allow_promotion_codes: 'true',   // customers can enter codes you create in Stripe → Product catalogue → Coupons
      shipping_options: shippingOptions(env, subtotal),
      phone_number_collection: { enabled: 'false' },
      client_reference_id: ref || undefined,
      metadata: { ref, note: String(body.note || '').slice(0, 450) },
      payment_intent_data: { metadata: { ref }, description: `Mana Hoard order ${ref}`.trim() },
      submit_type: 'pay',
      // from the Android app, the thank-you page offers a jump back into the app
      success_url: `${shop}?paid={CHECKOUT_SESSION_ID}${body.app === true ? '&app=1' : ''}#thanks`,
      cancel_url: `${shop}#order`,
    },
  });
  return { status: 200, data: { url: session.url } };
}

/* ---------- webhook ---------- */
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function verifyStripe(env, payload, header) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header || '').split(',').filter(p => p.trim().startsWith('v1=')).map(p => p.trim().slice(3));
  const t = parseInt(parts.t, 10);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some(s => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
const b64decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
const b64encode = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };

async function reduceStock(env, sessionId, ref, sold) {
  const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/stock.json`;
  const gh = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': UA };
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${api}?ref=${env.GITHUB_BRANCH || 'main'}`, { headers: gh });
    if (!r.ok) throw new Error(`GitHub read failed (${r.status})`);
    const file = await r.json();
    const stock = JSON.parse(b64decode(file.content));
    stock.settings = stock.settings || {};
    const done = Array.isArray(stock.settings.stripeSales) ? stock.settings.stripeSales : [];
    if (done.includes(sessionId)) return 'already applied';
    for (const [id, qty] of sold) { const it = (stock.items || []).find(i => i.id === id); if (it) it.qty = Math.max(0, (it.qty || 0) - qty); }
    stock.settings.stripeSales = [sessionId, ...done].slice(0, 100);
    stock.updated = new Date().toISOString();
    const put = await fetch(api, { method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Stripe sale ${ref || sessionId}: ${[...sold].map(([id, q]) => `${q}x ${id}`).join(', ')}`, content: b64encode(JSON.stringify(stock, null, 1) + '\n'), sha: file.sha, branch: env.GITHUB_BRANCH || 'main' }) });
    if (put.ok) return 'stock updated';
    if (put.status !== 409 && put.status !== 422) throw new Error(`GitHub write failed (${put.status})`);
  }
  throw new Error('GitHub kept changing underneath us');
}

async function webhook(req, env) {
  const payload = await req.text();
  if (!(await verifyStripe(env, payload, req.headers.get('Stripe-Signature')))) return json({ error: 'bad signature' }, 400);
  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return json({ ignored: event.type });
  const s = event.data.object;
  if (s.payment_status !== 'paid') return json({ waiting: s.payment_status });
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ ok: true, stock: 'not configured' });
  const items = await stripe(env, `checkout/sessions/${s.id}/line_items?limit=100&expand[]=data.price.product`);
  const sold = new Map();
  for (const li of items.data || []) { const id = li.price && li.price.product && li.price.product.metadata && li.price.product.metadata.listing_id; if (id) sold.set(id, (sold.get(id) || 0) + (li.quantity || 1)); }
  const result = sold.size ? await reduceStock(env, s.id, s.client_reference_id, sold) : 'no listing ids';
  return json({ ok: true, stock: result });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: h['Access-Control-Allow-Origin'] ? 204 : 403, headers: h });
    try {
      if (url.pathname === '/checkout' && req.method === 'POST') {
        if (!h['Access-Control-Allow-Origin']) return json({ error: 'Not allowed from this site' }, 403);
        const { status, data } = await createCheckout(req, env);
        return json(data, status, h);
      }
      if (url.pathname === '/webhook' && req.method === 'POST') return await webhook(req, env);
      if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, service: 'Mana Hoard checkout', live: String(env.STRIPE_SECRET_KEY || '').startsWith('sk_live_') });
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Checkout is having a moment, please try again or email your order.', detail: String(e.message || e).slice(0, 200) }, 502, h);
    }
  },
};
