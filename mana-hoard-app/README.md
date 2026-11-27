# Mana Hoard — shop and stock manager

The Mana Hoard storefront for an independent UK Magic: The Gathering shop, plus a **Hoard Manager** that turns a ManaBox collection export into priced shop listings.

It's a plain static site: HTML, CSS and JavaScript with no build step, no server and no database. You can host it free on GitHub Pages, Netlify, Cloudflare Pages or any web host.

## What's in here

| File | What it does |
| --- | --- |
| `index.html` | Page shell: header, footer, basket drawer |
| `styles.css` | All styling. Brand colours are the variables at the top (`--deep`, `--goldf`, `--bg` …) |
| `app.js` | Shop pages, basket, Hoard Manager, CSV import and pricing |
| `data/stock.json` | **Your published stock.** This is what customers see |
| `data/sample-manabox-export.csv` | Example ManaBox export to practise importing |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages on every push to `main` |

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

### Selling elsewhere
**Marketplace export** builds:
- a **Cardmarket stock sheet** (Cardmarket condition codes, language, foil flag, quantity, price in GBP), and
- a **Shopify products CSV** (one product per card, condition and finish as the variant) for when you move checkout to Shopify.

## How orders work right now

There's no payment step. The basket's **Email this order** button opens the customer's email app with their order filled in, addressed to `shopEmail`. You confirm stock and postage and send an invoice (for example a PayPal or Stripe payment link), then lower the quantities in the manager and publish.

## Upgrade path

- **Checkout and live stock:** connect Shopify or Stripe. The Shopify export gives you a starting product list.
- **Card images and market prices:** add Scryfall lookups (the import keeps each card's Scryfall ID). Browsers can call `https://api.scryfall.com` directly from a self-hosted site.
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
