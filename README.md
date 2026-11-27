# Mana Hoard — shop and stock manager

The Mana Hoard storefront for an independent UK Magic: The Gathering shop, plus a **Hoard Manager** that turns a ManaBox collection export into priced shop listings.

It's a plain static site: HTML, CSS and JavaScript with no build step, no server and no database. You can host it free on GitHub Pages, Netlify, Cloudflare Pages or any web host.

## What's in here

| File | What it does |
| --- | --- |
| `index.html` | Page shell: header, footer, basket drawer |
| `styles.css` | All styling. Brand colours are the variables at the top (`--deep`, `--goldf`, `--bg` …) |
| `app.js` | Shop pages, basket, Hoard Manager, CSV import and pricing |
| `assets/` | Your Mana Hoard logo (hero, header, footer), favicons and the link-preview image |
| `lib/art.js` | The illustrated burrow scene and the glowing browsing jars, drawn as SVG |
| `data/stock.json` | **Your published stock.** This is what customers see. It ships with example stock from *Marvel Super Heroes* (MSH): real card names and collector numbers, with example prices. Replace it with your own |
| `data/sample-manabox-export.csv` | Example ManaBox export of Marvel Super Heroes cards to practise importing |
| `.github/workflows/pages.yml` | On every push and daily: TCG PowerTools sync, Scryfall images, save stock, deploy to GitHub Pages |
| `lib/powertools.js` | Reads PowerTools exports and works out stock changes (used by the manager and the daily job) |
| `scripts/sync-powertools.mjs` | The daily job's PowerTools sync |
| `android/` | Android app (Trusted Web Activity) that opens the shop; built by `.github/workflows/build-android.yml` |
| `manifest.webmanifest` | Lets phones install the shop to the home screen |
| `checkout-worker/` | The Stripe checkout server (Cloudflare Worker), its settings and tests |
| `.github/workflows/deploy-checkout.yml` | One-click deploy of the checkout server |
| `data/powertools/` | Drop PowerTools exports here to sync them |
| `scripts/add-scryfall-images.mjs` | Looks up missing card images on Scryfall (used by the deploy; can be run by hand) |

### Settings you'll want to change
At the top of `app.js`:

```js
const CONFIG={
  shopEmail:'hello@manahoard.co.uk',   // where basket orders and enquiries go
  stockFile:'data/stock.json',
  demoBanner:'Orders are confirmed by email — no payment is taken on this site yet.'
};
```

Page wording (home, About, Commander, Policies and so on) lives in the `pHome`, `pAbout`, `pCommander`, `pTales`, `pContact` and `pPolicies` functions in `app.js`.

## Run it on your computer

The site loads `data/stock.json`, so it needs a small local web server. Double-clicking `index.html` opens it from `file://`, where the stock can't load, and you'll only see sample stock.

```bash
# any one of these, from this folder:
python3 -m http.server 8000
npx serve .
```

Then open http://localhost:8000.

## Host it on GitHub Pages

1. Push this folder to a GitHub repository (see below).
2. In the repository go to **Settings → Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.
3. The included workflow deploys on every push to `main`. Your shop goes live at `https://<your-username>.github.io/<repo-name>/`.
4. Optional: add a custom domain such as `manahoard.co.uk` in the same Pages settings.

## Day-to-day: updating stock

The shop admin is at `…/#manager` (there's also a small "Shop admin" link in the footer).

1. **Import.** In ManaBox: Collection → Export → CSV. Drop the file into **Import from ManaBox**. Duplicates are merged, matching cards get their quantity topped up, and new cards arrive as drafts.
2. **Check and price.** In **Listings**, adjust price, quantity, condition and category, switch cards live, or "Publish all drafts". Starting prices follow **Pricing rules**: purchase price plus markup, a minimum price by rarity when there's no purchase price, adjusted for foil and condition, and rounded up to the next 5p.
3. **Publish.** In **Publish**, click **Download stock.json**. Then in GitHub open `data/`, choose **Add file → Upload files**, drop in the new `stock.json` and commit. Pages redeploys within a minute or two.

Your edits are kept in your browser as a *working copy* until you publish. On another computer, use **Reset to published stock** to start from what's live.

> The admin page isn't password-protected, but it can't change your live shop. Anyone who opens it only edits a copy in their own browser. Only a commit to `data/stock.json` in your repo changes what customers see.

### Card images (Scryfall)
Card images come from [Scryfall](https://scryfall.com):

- **When you import**, leave "Fetch card images from Scryfall" ticked. The manager looks each card up in batches of 75, within Scryfall's rate limits, using the Scryfall ID in your ManaBox export. If there's no ID it uses set and collector number, and if that doesn't match it tries name and set.
- **Listings → Card images** shows how many cards have an image. Use **Fetch missing**, **Retry not found** or **Refresh all** (for example if Scryfall replaces an image).
- **The deploy fills in anything missing.** Every time GitHub Pages deploys, `scripts/add-scryfall-images.mjs` looks up any card in `stock.json` without an image and adds it to the published copy. So a `stock.json` uploaded without images still gets them. You can also run it yourself with `node scripts/add-scryfall-images.mjs` to write the images into the file in your repo.
- Each card's image link, artist, type line and Scryfall page are saved into `stock.json` when you publish. Shoppers' browsers load images straight from Scryfall's image servers (`cards.scryfall.io`, which has no rate limit) and never call the API.
- Sealed products and accessories keep the drawn frame. Any card without an image, or whose image fails to load, falls back to the drawn frame automatically.
- Set `cardImages:false` in `CONFIG` to turn images off.

Scryfall's terms ask that card images aren't cropped, stretched, recoloured or watermarked, and that the artist and copyright line stay visible. The site shows them whole and credits the artist and Scryfall. Keep it that way if you restyle.

### Card payments: Stripe, Apple Pay and Google Pay
Shoppers can pay at checkout by card, **Apple Pay** or **Google Pay** on Stripe's secure hosted payment page. Card details never touch this site. Until you switch it on, the basket uses email orders as before.

**How it fits together:** the site is static and can't hold your Stripe secret key, so a tiny free **Cloudflare Worker** (`checkout-worker/`) does three things:
1. It takes the basket, re-checks every price and quantity against your **published** `stock.json` (so nobody can edit a price in their browser), and opens a Stripe Checkout page in pounds, with UK delivery address and your postage options.
2. Stripe's page shows cards plus whichever wallets you've switched on. Hosted Checkout needs no extra Apple Pay or Google Pay setup.
3. After payment, Stripe tells the worker (webhook). If you've given it a GitHub token, it takes the sold cards out of `data/stock.json`. That commit redeploys the shop, and each payment is applied only once.

**Set it up (about 20 minutes, test mode first):**
1. **Stripe:** create an account at stripe.com. In **Settings → Payment methods**, make sure **Cards, Apple Pay and Google Pay** are on. In **Settings → Emails**, turn on receipts for successful payments. Copy your **test** secret key (`sk_test_…`) from **Developers → API keys**.
2. **Cloudflare:** create a free account. Create an API token with the **Edit Cloudflare Workers** template, and note your **Account ID**.
3. **GitHub secrets** (repo **Settings → Secrets and variables → Actions**): add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `STRIPE_SECRET_KEY`. Optionally add `STOCK_GITHUB_TOKEN`, a fine-grained token for **this repo only** with **Contents: read and write**, so sales reduce stock automatically.
4. **Deploy:** **Actions → Deploy checkout (Stripe worker) → Run workflow.** The log shows your worker address, e.g. `https://mana-hoard-checkout.<you>.workers.dev`.
5. **Webhook:** in Stripe **Developers → Webhooks → Add endpoint**, enter `<worker address>/webhook` and choose events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its **Signing secret** (`whsec_…`) into the GitHub secret `STRIPE_WEBHOOK_SECRET`, then run the deploy again.
6. **Switch the shop on:** in `app.js` set `checkoutUrl:'https://mana-hoard-checkout.<you>.workers.dev'` and commit.
7. **Test:** buy something with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). Check the order appears in Stripe and the stock drops.
8. **Go live:** swap `STRIPE_SECRET_KEY` for your live key (`sk_live_…`), create the same webhook in live mode, update `STRIPE_WEBHOOK_SECRET`, and deploy again.

**Postage and countries** live in `checkout-worker/wrangler.toml`: `SHIPPING` (name, price in pence, delivery days), `FREE_SHIP_OVER` (e.g. `3000` for free postage over £30) and `SHIP_COUNTRIES` (`GB`, or `GB,IE`…). Change them, commit, and run the deploy again.

**Before taking real money:** fill in the **Policies** page with your delivery times and costs, returns and refunds (UK distance-selling rules give buyers 14 days to cancel), and privacy. Stripe expects these on your site.

**PowerTools users:** card sales here reduce stock **here**. Also reduce them in TCG PowerTools (it has no API), otherwise your next PowerTools sync will put the quantity back.

### Daily sync with TCG PowerTools
TCG PowerTools can be the master copy of your stock. Sales on Cardmarket, CardTrader or anywhere else PowerTools manages reduce the quantities here. PowerTools has no public API, so the sync works from its **CSV stock export** (PowerTools → **Export**).

**Three ways to run it:**

1. **From the Hoard Manager:** **TCG PowerTools** tab → choose the export. You'll see a preview of every change (updated quantities, new cards, cards now sold out) before you click **Apply**, then **Publish**. The file never leaves your browser.
2. **Upload to GitHub (hands-off):** upload the export to `data/powertools/` (works from the GitHub mobile app). The deploy merges it, adds Scryfall images, saves `stock.json` and deletes the CSV. The run's summary under **Actions** lists every change.
3. **Fully automatic daily:** if you can get a link that always downloads your latest PowerTools export (ask PowerTools support whether they offer one), add it as a repository secret named `POWERTOOLS_EXPORT_URL` (**Settings → Secrets and variables → Actions → New repository secret**). A scheduled job runs every day at 05:41 UK time in winter (06:41 in summer), downloads it, syncs and redeploys.

**How it matches cards:** by Cardmarket ID first, otherwise by name + set, and always by condition, language and foil. Settings (saved from the manager's TCG PowerTools tab and used by the GitHub job too):
- **Mark cards that aren't in the export as sold out.** Turn this off while PowerTools doesn't yet hold everything you list here. Sealed products and accessories are never zeroed. The GitHub job refuses an export that would sell out more than 80% of a large shop, in case it's partial or the wrong file.
- **Prices:** keep your shop prices, or use PowerTools prices converted at your £-per-€ rate.
- **New cards** go live straight away or arrive as drafts.

**Going the other way:** orders taken on this site arrive by email. When you send one, reduce the stock in PowerTools too, and the next sync carries it everywhere. There's no automatic push back to PowerTools without an API.

**Privacy:** purchase prices (`buyPrice` or cost) are never written to the published `stock.json`. This repository is public, and files uploaded to `data/powertools/` stay in its history. Remove private columns before uploading, or use options 1 or 3.

### Collections (the glowing jars)
**Hoard Manager → Collections.** Each collection is a jar on the home page and a filter in the shop. A collection gathers cards by rules (categories, foil, rarity, set, price range, "name contains") plus any cards you **hand-pick**. Rename it, pick its jar colour, reorder or remove it, then **Publish**. The starter set is Budget Commander, Staples under £2, Foil treasures, Mythic vault, Marvel Super Heroes and Sealed treasures. Empty jars are hidden from shoppers.

### Orders and invoices with your logo
- **Customers:** the basket has **View & print order summary**, a branded order sheet with your logo, a reference number (e.g. `MH-YXWPPB`) and their note. They can print it, save it as a PDF, or email it. The emailed order quotes the same reference.
- **You:** **Hoard Manager → Invoices.** Add the customer's details, search your stock to add cards, set postage, then **Preview & print invoice** (save as PDF to attach to your email) or **Copy email text**. **Mark these cards sold** reduces stock and moves to the next invoice number. Your business details (address, how to pay) are saved in your browser only and never published.

### Selling elsewhere
**Marketplace export** builds:
- a **Cardmarket stock sheet** (Cardmarket condition codes, language, foil flag, quantity, price in GBP), and
- a **Shopify products CSV** (one product per card, condition and finish as the variant) for when you move checkout to Shopify.

## How orders work right now

With `checkoutUrl` set, shoppers pay through Stripe (see **Card payments** above). Without it, there's no payment step. The basket's **Email this order** button opens the customer's email app with their order and reference filled in, addressed to `shopEmail`. You confirm stock and postage, send an invoice from **Invoices** (with a PayPal or bank-transfer note), mark the cards sold, and publish.

## Android app (test build)
`android/` is a small Android app that opens the live shop full-screen using Chrome's engine (a *Trusted Web Activity*). It always shows the latest shop, with no app update needed when you publish stock, and Google Pay works at checkout.

- **Get the APK:** every change under `android/` builds automatically (or run **Actions → Build Android test app**). Download `mana-hoard-test.apk` from the **android-test** release: `https://github.com/PaulMarsey/mana-hoard-app/releases/download/android-test/mana-hoard-test.apk`. Open it on your phone and allow "Install unknown apps" for your browser when asked.
- **The address bar at the top:** Android only hides it once your website proves it owns the app. GitHub Pages can only do that from your account's root site, so either:
  - create a repo named **`PaulMarsey.github.io`** containing `.well-known/assetlinks.json` (copy it from `android/assetlinks.json`), or
  - move the shop to your own domain (e.g. manahoard.co.uk) and put that file at `https://manahoard.co.uk/.well-known/assetlinks.json`, then change `shopHost` and `shopUrl` in `android/app/build.gradle`.
- **Test key only:** `android/test-signing.keystore` is a committed **test** key so each build installs over the last. Before publishing to Google Play, make a private upload key and keep it out of the repo.
- **No APK needed:** on Android or iPhone you can also open the shop in Chrome or Safari and choose **Add to Home Screen**. The site includes an app manifest and icon.

## Upgrade path

- **Checkout and live stock:** connect Shopify or Stripe. The Shopify export gives you a starting product list.
- **Market prices:** Scryfall also returns EUR/USD prices for each card, which could be used to suggest a price (not yet wired in).
- **Shared admin:** move `stock.json` into a small backend (Supabase, Firebase or a Cloudflare Worker) so edits go live without a commit.

## stock.json format

```json
{
  "updated": "2026-11-27T11:00:00.000Z",
  "settings": { "markup": 30, "foil": 1.5, "min": 10, "floor": {...}, "cond": {...} },
  "items": [
    { "id": "abc123", "name": "Sol Ring", "set": "CMR", "setName": "Commander Legends",
      "num": "472", "finish": "Foil", "rarity": "mythic", "cond": "NM", "lang": "en",
      "qty": 4, "price": 1295, "cost": 0, "cat": "Commander", "live": true, "added": 1764201600000 }
  ]
}
```

Prices are in **pence**: `1295` = £12.95. `cond` uses Cardmarket codes (`MT NM EX GD LP PL PO`). `cat` is one of `Singles`, `Commander`, `Sealed`, `Accessories`.
