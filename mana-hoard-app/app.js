{
/* ================= SHOP SETTINGS — edit these ================= */
const CONFIG={
  shopEmail:'hello@manahoard.co.uk',      // where basket orders and enquiries go
  stockFile:'data/stock.json',            // the published stock the shop reads
  demoBanner:'Orders are confirmed by email — no payment is taken on this site yet.' // set to '' to hide
};
/* ============================================================== */
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gbp=p=>'£'+(Math.max(0,p||0)/100).toFixed(2);
const isFoil=f=>/^(foil|etched)/i.test(f||'');
const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

const CONDS={MT:'Mint',NM:'Near Mint',EX:'Excellent',GD:'Good',LP:'Light Played',PL:'Played',PO:'Poor'};
const CATS=['Singles','Commander','Sealed','Accessories'];
const DEFAULTS={markup:30,foil:1.5,min:10,floor:{common:10,uncommon:20,rare:50,mythic:150,special:100},cond:{MT:1,NM:1,EX:.9,GD:.8,LP:.7,PL:.55,PO:.35}};
const DEMO=[
 {id:'d1',name:'Sol Ring',set:'CMR',setName:'Commander Legends',num:'472',finish:'Foil',rarity:'mythic',cond:'NM',lang:'en',qty:4,price:1295,cat:'Commander',live:true,added:8},
 {id:'d2',name:'Forest',set:'MH3',setName:'Modern Horizons 3',num:'309',finish:'Non-foil',rarity:'common',cond:'NM',lang:'en',qty:40,price:65,cat:'Singles',live:true,added:7},
 {id:'d3',name:'Lightning Bolt',set:'PLST',setName:'The List',num:'2XM-129',finish:'Foil',rarity:'rare',cond:'EX',lang:'en',qty:2,price:235,cat:'Singles',live:true,added:6},
 {id:'d4',name:'Commander Masters Deck',set:'CMM',setName:'Commander Masters',num:'',finish:'Deck',rarity:'special',cond:'MT',lang:'en',qty:3,price:4999,cat:'Sealed',live:true,added:5},
 {id:'d5',name:'Arcane Signet',set:'CMR',setName:'Commander Legends',num:'297',finish:'Etched',rarity:'uncommon',cond:'NM',lang:'en',qty:6,price:345,cat:'Commander',live:true,added:4},
 {id:'d6',name:'Dragon Shield Sleeves',set:'ACC',setName:'Accessories',num:'',finish:'Matte',rarity:'special',cond:'MT',lang:'en',qty:12,price:995,cat:'Accessories',live:true,added:3},
 {id:'d7',name:'The One Ring',set:'LTR',setName:'Tales of Middle-earth',num:'246',finish:'Foil',rarity:'mythic',cond:'NM',lang:'en',qty:1,price:1850,cat:'Singles',live:true,added:2},
 {id:'d8',name:'Collector Booster Box',set:'WOE',setName:'Wilds of Eldraine',num:'',finish:'Collector box',rarity:'special',cond:'MT',lang:'en',qty:2,price:13200,cat:'Sealed',live:true,added:1}];
const SAMPLE_CSV=`Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency
Cultivate,CMM,Commander Masters,281,normal,common,3,101,a1,0.25,false,false,near_mint,en,GBP
Swords to Plowshares,CMM,Commander Masters,57,normal,uncommon,2,102,a2,1.10,false,false,near_mint,en,GBP
Rhystic Study,PCY,Prophecy,45,normal,rare,1,103,a3,28.00,false,false,light_played,en,GBP
Smothering Tithe,RNA,Ravnica Allegiance,22,foil,rare,1,104,a4,19.50,false,false,near_mint,en,GBP
"Atraxa, Grand Unifier",ONE,Phyrexia: All Will Be One,196,normal,mythic,1,105,a5,9.80,false,false,excellent,en,GBP
Command Tower,CMM,Commander Masters,1028,etched,common,4,106,a6,,false,false,near_mint,en,GBP`;

let S={items:[],settings:structuredClone(DEFAULTS),dirty:false,loaded:false,canManage:true};
let PUB={items:[],settings:structuredClone(DEFAULTS),updated:null,ok:false};
let basket=store.get('mh-basket',[]);
let shop={q:'',cat:'All',stock:false,sort:'newest',finish:'All',cond:'All',set:'All',shown:48};
let mgr={tab:'import',preview:null,q:'',filter:'all',shown:100};

const catalogue=()=>{if(!PUB.ok)return {list:DEMO,demo:true};return {list:PUB.items.filter(i=>i.live),demo:false}};
const byId=id=>catalogue().list.find(i=>i.id===id);
const rk=r=>{r=String(r||'').toLowerCase();return r.startsWith('myth')?'mythic':r.startsWith('rare')?'rare':r.startsWith('unc')?'uncommon':r.startsWith('com')?'common':'special'};

function art(l){
  const h=hash(l.set||l.name)%360,sealed=l.cat==='Sealed'||l.cat==='Accessories';
  const glyph=sealed?(l.cat==='Sealed'?'◈':'❖'):['✦','✧','❂','✺','✶','☽'][hash(l.name)%6];
  const foil=isFoil(l.finish||'');
  return `<div class="cart${foil?' foil':''}${sealed?' sealed':''}" style="--h:${h}" aria-hidden="true">
  <div class="tbar"><span>${esc(l.name)}</span></div><div class="ill">${glyph}</div>
  <div class="tline"><span>${esc(l.setName||l.set||'')}</span><i class="gem ${rk(l.rarity)}"></i></div>
  <div class="txt">${esc(CONDS[l.cond]||l.cond||'')} · ${esc(l.finish||'')}${l.num?' · #'+esc(l.num):''}</div></div>`}

function pcard(l){
  const st=l.qty<=0?'<span class="pill low">Sold out</span>':l.qty<=2?'<span class="pill low">Low stock</span>':'<span class="pill">In stock</span>';
  return `<button class="pcard" data-open="${esc(l.id)}">${art(l)}
  <div class="meta"><span>${esc(l.cat)}</span><span>${esc(l.set)}</span></div>
  <h3>${esc(l.name)}</h3><div class="meta"><span>${esc(CONDS[l.cond]||l.cond)} · ${esc(l.finish)}</span></div>
  <div class="meta" style="align-items:center"><span class="price">${gbp(l.price)}</span>${st}</div></button>`}

/* ---------- pages ---------- */
const NAV=[['shop','The Hoard'],['commander','Commander'],['tales','Tales from the Hoard'],['about','About'],['contact','Contact']];
function renderNav(r){$('#nav').innerHTML=NAV.map(([k,t])=>`<a href="#${k}"${r===k?' aria-current="page"':''}>${t}</a>`).join('')}

function pHome(){
  const {list,demo}=catalogue();const fav=[...list].sort((a,b)=>b.price-a.price).slice(0,4);const recent=[...list].sort((a,b)=>(b.added||0)-(a.added||0)).slice(0,4);
  const heroCards=(fav.length>=3?fav:DEMO).slice(0,3);
  return `<section class="hero"><div class="wrap hgrid"><div>
   <h1>Every card has a legend.</h1>
   <p class="lead">Discover your next treasure. Magic: The Gathering singles, Commander staples and sealed product from an independent UK shop built by a player, for players.</p>
   <div class="cta"><a class="btn gold" href="#shop">Explore the Hoard</a><a class="btn ghost" href="#about">Discover our story</a></div>
   <p class="muted small" style="margin-top:22px">Built for Commander players, collectors and tabletop fans across the UK.</p></div>
   <div class="fan"><div class="orb"></div>${heroCards.map(art).join('')}</div></div></section>
  <div class="strip"><div>Condition-checked stock</div><div>UK pricing in pounds</div><div>Commander focused</div><div>Player-run support</div></div>
  <section class="band wrap"><div class="head"><h2>Shop your way</h2><a href="#shop">Browse everything →</a></div>
   <div class="cats">${[['Singles','Magic singles','Cards, staples and collector favourites','c1'],['Commander','Commander','Staples, ramp and ready-to-play picks','c2'],['Sealed','Sealed products','Boosters, bundles and decks','c3'],['Accessories','Accessories','Sleeves, boxes and table gear','c4']].map(([c,n,d,k])=>`<button class="cat ${k}" data-cat="${c}"><span style="font-size:30px">✦</span><span><strong>${n}</strong><small>${d}</small></span></button>`).join('')}</div></section>
  <section class="surface"><div class="band wrap"><div class="head"><h2>Hoard favourites</h2><a href="#shop">See the full catalogue →</a></div>
   ${demo?'<p class="muted small" style="margin-top:-12px">Sample stock from the original site, shown until real listings go live.</p>':''}
   ${fav.length?`<div class="grid">${fav.map(pcard).join('')}</div>`:'<div class="empty"><h3>The Hoard is being stocked.</h3><p>New cards are on their way — check back soon.</p></div>'}</div></section>
  <section class="band wrap"><div class="head"><h2>Recently added</h2><a href="#shop">Browse more →</a></div>
   <div class="grid">${recent.map(pcard).join('')}</div></section>
  <section class="surface"><div class="band wrap two" style="align-items:center"><div><h2>Made by players. Here for the community.</h2><p class="muted">Mana Hoard is an independent UK trading card store where fantasy, strategy and collecting come together. We specialise in Magic: The Gathering, with a particular passion for Commander.</p></div>
   <div class="tri" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="box"><h3>Commander</h3><p>Focused curation</p></div><div class="box"><h3>Community</h3><p>Real-player support</p></div><div class="box"><h3>Care</h3><p>Every order packed thoughtfully</p></div></div></div></section>`}

function shopFiltered(list){
  const q=shop.q.trim().toLowerCase();
  const out=list.filter(p=>(shop.cat==='All'||p.cat===shop.cat)&&(!shop.stock||p.qty>0)&&(shop.finish==='All'||(shop.finish==='Foil'?isFoil(p.finish):!isFoil(p.finish)))&&(shop.cond==='All'||p.cond===shop.cond)&&(shop.set==='All'||p.set===shop.set)&&(!q||`${p.name} ${p.set} ${p.setName} ${p.rarity} ${p.finish}`.toLowerCase().includes(q)));
  const f={'price-low':(a,b)=>a.price-b.price,'price-high':(a,b)=>b.price-a.price,alpha:(a,b)=>a.name.localeCompare(b.name),newest:(a,b)=>(b.added||0)-(a.added||0)}[shop.sort];
  return out.sort(f)}
function pShop(){
  const {list,demo}=catalogue();const sets=[...new Set(list.map(p=>p.set))].sort();
  return `<section class="band wrap"><div class="head"><div><h1>Find your next treasure.</h1><p class="muted" style="max-width:40em">Browse Magic singles, Commander staples, sealed product and accessories from a real UK shop built by players.</p></div></div>
  <div class="shop"><aside class="filters" aria-label="Filters">
   <div><label class="l" for="fq">Search</label><input id="fq" type="search" placeholder="Name, set or rarity" value="${esc(shop.q)}"></div>
   <div><span class="l">Category</span><div class="chips">${['All',...CATS].map(c=>`<button class="chip" data-fcat="${c}" aria-pressed="${shop.cat===c}">${c}</button>`).join('')}</div></div>
   <div><span class="l">Finish</span><div class="chips">${['All','Foil','Non-foil'].map(c=>`<button class="chip" data-ffin="${c}" aria-pressed="${shop.finish===c}">${c}</button>`).join('')}</div></div>
   <div><label class="l" for="fcond">Condition</label><select id="fcond"><option value="All">Any condition</option>${Object.entries(CONDS).map(([k,v])=>`<option value="${k}"${shop.cond===k?' selected':''}>${v}</option>`).join('')}</select></div>
   <div><label class="l" for="fset">Set</label><select id="fset"><option value="All">All sets</option>${sets.map(s=>`<option${shop.set===s?' selected':''}>${esc(s)}</option>`).join('')}</select></div>
   <label class="check"><input type="checkbox" id="fstock"${shop.stock?' checked':''}> In stock only</label>
   <div><label class="l" for="fsort">Sort by</label><select id="fsort">${[['newest','Newest'],['price-low','Price: low to high'],['price-high','Price: high to low'],['alpha','Alphabetical']].map(([k,v])=>`<option value="${k}"${shop.sort===k?' selected':''}>${v}</option>`).join('')}</select></div>
  </aside><div id="results"></div></div></section>`}
function renderResults(){
  const el=$('#results');if(!el)return;const {list,demo}=catalogue();const r=shopFiltered(list);
  el.innerHTML=`<div class="bar"><span class="muted">${r.length} result${r.length===1?'':'s'}${demo?' · sample stock':''}</span><button class="linkbtn" id="freset">Reset filters</button></div>
  ${r.length?`<div class="grid">${r.slice(0,shop.shown).map(pcard).join('')}</div>${r.length>shop.shown?`<p style="text-align:center;margin-top:20px"><button class="btn ghost" id="more">Show more (${r.length-shop.shown} left)</button></p>`:''}`:'<div class="empty"><h3>No matching treasures found.</h3><p>Try a different search or clear the filters to view the whole hoard.</p></div>'}`}

function pCommander(){
  const {list}=catalogue();const cmd=list.filter(p=>p.cat==='Commander').sort((a,b)=>b.price-a.price);
  return `<section class="band wrap"><h1>Lead with legend.</h1><p class="muted" style="max-width:40em">Ramp, card draw, removal and top-end finishers — the staples that make a Commander table sing.</p></section>
  <section class="wrap"><div class="tri">
   <div class="box"><span>Decks</span><h3>Preconstructed favourites</h3><p>Commander-ready decks and hero picks for players building their next table.</p></div>
   <div class="box"><span>Singles</span><h3>High-impact staples</h3><p>The cards every deck wants, condition-checked and priced fairly.</p></div>
   <div class="box"><span>Collections</span><h3>Future editorials</h3><p>Deck guides and gameplay content as the Hoard grows.</p></div></div></section>
  <section class="band wrap"><div class="head"><h2>Commander staples in the Hoard</h2><a href="#shop" data-cat="Commander">Filter the shop →</a></div>
   ${cmd.length?`<div class="grid">${cmd.slice(0,24).map(pcard).join('')}</div>`:'<div class="empty"><h3>No Commander staples listed yet.</h3><p>They’ll appear here once tagged in the Hoard Manager.</p></div>'}</section>`}
const pTales=()=>`<section class="band wrap"><h1>Stories from the table.</h1><p class="muted">Deck features, let’s plays and collecting deep dives. Nothing published yet — this space is ready for the first tale.</p></section>
  <section class="wrap"><div class="tri"><div class="box"><span>Commander</span><h3>Deck features</h3><p>Budget builds, new strategies and legendary combinations.</p></div><div class="box"><span>Video</span><h3>Let’s play</h3><p>Gameplay, product openings and community moments.</p></div><div class="box"><span>Collecting</span><h3>Coming soon</h3><p>Set deep dives and good finds for collectors.</p></div></div></section>`;
const pAbout=()=>`<section class="band wrap" style="max-width:780px"><h1>Every card has a legend.</h1>
  <p>Welcome to Mana Hoard, an independent UK trading card store where fantasy, strategy and collecting come together.</p>
  <p>Born from a love of high fantasy, knights, legendary battles and tabletop gaming, Mana Hoard helps players and collectors discover their next treasure.</p>
  <p>We specialise in Magic: The Gathering, with a particular passion for Commander. Whether you're searching for the final card for your deck, discovering a new commander or expanding your collection, we want exploring the Hoard to feel like part of the adventure.</p>
  <p>As we grow, we hope to share more of that adventure through deck features, gameplay videos and conversations with the community.</p>
  <a class="btn" href="#shop">Browse the Hoard</a></section>`;
const pContact=()=>`<section class="band wrap" style="max-width:720px"><h1>Ask the Hoard.</h1><p class="muted">Looking for a specific card, or a question about an order? Email <b>${esc(CONFIG.shopEmail)}</b>, or draft your message here and copy it.</p>
  <form id="cform" style="display:grid;gap:14px;margin-top:18px">
   <div><label class="l" for="ctype">Enquiry type</label><select id="ctype"><option>Orders</option><option>Card wanted</option><option>Products</option><option>General enquiry</option></select></div>
   <div><label class="l" for="cname">Name</label><input id="cname" type="text" autocomplete="name"></div>
   <div><label class="l" for="cmail">Email</label><input id="cmail" type="email" autocomplete="email"></div>
   <div><label class="l" for="cmsg">Message</label><textarea id="cmsg" rows="6"></textarea></div>
   <div class="row"><button class="btn" type="submit">Copy message</button><a class="btn ghost" href="mailto:${esc(CONFIG.shopEmail)}">Open email app</a></div>
   <p id="cstatus" class="muted small"></p></form></section>`;
const pPolicies=()=>`<section class="band wrap"><h1>Policies</h1><p class="muted">Delivery, returns and privacy wording is pending business review before launch.</p></section>
  <section class="wrap"><div class="tri"><div class="box"><span>Delivery</span><h3>Shipping</h3><p>Delivery options and charges to be confirmed before publication.</p></div><div class="box"><span>Returns</span><h3>Refunds</h3><p>Return policy and handling details must be confirmed before launch.</p></div><div class="box"><span>Privacy</span><h3>Data handling</h3><p>Privacy, cookie and terms content pending legal review.</p></div></div></section>`;

/* ---------- manager ---------- */
function pManager(){
  if(!S.canManage)return `<section class="band wrap"><h1>Hoard Manager</h1><p class="muted">Only the shop owner and editors can manage stock.</p></section>`;
  const it=S.items,live=it.filter(i=>i.live);
  const val=live.reduce((s,i)=>s+i.price*i.qty,0),cards=it.reduce((s,i)=>s+i.qty,0);
  const tabs=[['import','Import from ManaBox'],['listings','Listings'],['pricing','Pricing rules'],['publish','Publish'+(unpublished()?' •':'')],['export','Marketplace export']];
  return `<section class="band wrap"><div class="head"><div><h1>Hoard Manager</h1><p class="muted" style="max-width:46em">This is your working copy, saved in this browser. Customers see <code>${esc(CONFIG.stockFile)}</code>${PUB.updated?` (published ${esc(new Date(PUB.updated).toLocaleString('en-GB'))})`:''} — use <b>Publish</b> to update it.</p></div><span id="savestate" class="pill${unpublished()?' low':''}">${unpublished()?'Unpublished changes':'Matches the live shop'}</span></div>
  <div class="stats"><div class="stat"><b>${it.length}</b><span>listings</span></div><div class="stat"><b>${cards}</b><span>cards in stock</span></div><div class="stat"><b>${live.length}</b><span>live in the shop</span></div><div class="stat"><b>${gbp(val)}</b><span>live stock value</span></div></div>
  <div class="tabs" role="tablist">${tabs.map(([k,t])=>`<button role="tab" data-tab="${k}" aria-selected="${mgr.tab===k}">${t}</button>`).join('')}</div>
  <div id="mpanel">${({import:mImport,listings:mListings,pricing:mPricing,publish:mPublish,export:mExport})[mgr.tab]()}</div></section>`}

function mImport(){
  const p=mgr.preview;
  return `<div class="two"><div><h2>Bring in your collection</h2>
   <p class="muted">In ManaBox, open your collection → Export → CSV, then drop the file here. Moxfield, Deckbox and Cardmarket CSVs with name, set and quantity columns work too.</p>
   <label class="l" for="file">CSV file</label><input type="file" id="file" accept=".csv,text/csv">
   <p class="l" style="margin-top:16px">…or paste the CSV</p><textarea id="paste" placeholder="Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,…"></textarea>
   <div class="row" style="margin-top:10px"><button class="btn" id="parse">Read CSV</button><button class="btn ghost" id="sample">Try a sample export</button></div></div>
   <div>${p?`<h2>${p.rows.length} listings ready</h2><p class="muted">${p.total} cards from ${p.raw} rows${p.skipped?`, ${p.skipped} rows skipped (no name or quantity)`:''}. Matching cards already in the Hoard get their quantity topped up.</p>
    <div class="tbl" style="max-height:340px"><table><thead><tr><th>Card</th><th>Set</th><th>Finish</th><th>Cond.</th><th class="n">Qty</th><th class="n">Cost</th><th class="n">Price</th></tr></thead><tbody>
    ${p.rows.slice(0,200).map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.set)}</td><td>${esc(r.finish)}</td><td>${esc(r.cond)}</td><td class="n">${r.qty}</td><td class="n">${r.cost?gbp(r.cost):'—'}</td><td class="n">${gbp(r.price)}</td></tr>`).join('')}</tbody></table></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="golive"> Put straight into the shop (otherwise they arrive as drafts to check first)</label>
    <label class="check"><input type="checkbox" id="tagcmd"> Tag these as Commander staples</label>
    <div class="row" style="margin-top:10px"><button class="btn gold" id="commit">Add ${p.rows.length} listings to the Hoard</button><button class="btn ghost" id="discard">Discard</button></div>
    <p class="muted small">Prices come from your pricing rules: purchase price plus markup, or a rarity floor when there’s no purchase price. Adjust any of them in Listings.</p>`
   :`<div class="empty"><h3>Nothing read yet</h3><p>Your import preview will appear here, with quantities merged and starting prices worked out.</p></div>`}</div></div>`}

function mgrFiltered(){const q=mgr.q.toLowerCase();return S.items.filter(i=>(mgr.filter==='all'||(mgr.filter==='live'?i.live:mgr.filter==='draft'?!i.live:mgr.filter==='out'?i.qty<=0:true))&&(!q||`${i.name} ${i.set} ${i.setName}`.toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name))}
function mListings(){
  const r=mgrFiltered(),drafts=S.items.filter(i=>!i.live).length;
  if(!S.items.length)return `<div class="empty"><h3>No listings yet</h3><p>Import a ManaBox export to fill the Hoard.</p><p><button class="btn" data-tab="import">Go to import</button></p></div>`;
  return `<div class="bar"><div class="row"><input type="search" id="mq" placeholder="Search listings" value="${esc(mgr.q)}" style="width:240px">
   <div class="chips">${[['all','All'],['live','Live'],['draft','Drafts'],['out','Sold out']].map(([k,t])=>`<button class="chip" data-mf="${k}" aria-pressed="${mgr.filter===k}">${t}</button>`).join('')}</div></div>
   <div class="row"><button class="btn sm ghost" id="repriceDrafts"${drafts?'':' disabled'}>Re-price drafts by rules</button><button class="btn sm" id="publishAll"${drafts?'':' disabled'}>Publish ${drafts} draft${drafts===1?'':'s'}</button></div></div>
  <div class="tbl"><table><thead><tr><th>Card</th><th>Finish</th><th>Cond.</th><th class="n">Qty</th><th class="n">Price £</th><th>Category</th><th>Live</th><th></th></tr></thead><tbody>
  ${r.slice(0,mgr.shown).map(i=>`<tr data-id="${esc(i.id)}"><td><b>${esc(i.name)}</b><br><span class="muted small">${esc(i.setName||i.set)} ${i.num?'#'+esc(i.num):''} · ${esc(i.lang||'en')}</span></td><td>${esc(i.finish)}</td>
   <td><select data-f="cond" aria-label="Condition">${Object.keys(CONDS).map(k=>`<option${i.cond===k?' selected':''}>${k}</option>`).join('')}</select></td>
   <td class="n"><input type="number" min="0" step="1" data-f="qty" value="${i.qty}" aria-label="Quantity"></td>
   <td class="n"><input type="number" min="0" step="0.01" data-f="price" value="${(i.price/100).toFixed(2)}" aria-label="Price in pounds"></td>
   <td><select data-f="cat" aria-label="Category">${CATS.map(c=>`<option${i.cat===c?' selected':''}>${c}</option>`).join('')}</select></td>
   <td><button class="switch" role="switch" data-f="live" aria-checked="${!!i.live}" aria-label="Live in shop"></button></td>
   <td><button class="linkbtn" data-del="${esc(i.id)}" style="color:var(--warn)">Remove</button></td></tr>`).join('')}
  </tbody></table></div>${r.length>mgr.shown?`<p style="text-align:center"><button class="btn ghost" id="mmore">Show more (${r.length-mgr.shown} left)</button></p>`:''}
  <p class="muted small">${r.length} of ${S.items.length} listings shown. Edits save automatically.</p>`}

function mPricing(){const s=S.settings;
  const f=(id,v,lab,step=1)=>`<div><label class="l" for="${id}">${lab}</label><input type="number" id="${id}" data-set="${id}" value="${v}" step="${step}" min="0"></div>`;
  return `<div class="two"><div class="box" style="display:grid;gap:14px"><h2>Starting price</h2>
   ${f('markup',s.markup,'Markup on purchase price (%)')}${f('foil',s.foil,'Foil / etched multiplier',0.05)}${f('min',(s.min/100).toFixed(2),'Lowest price for any card (£)',0.01)}
   <p class="muted small" style="margin:0">Final prices round up to the next 5p.</p></div>
   <div class="box" style="display:grid;gap:14px"><h2>When there’s no purchase price</h2>
   ${['common','uncommon','rare','mythic','special'].map(k=>f('floor_'+k,(s.floor[k]/100).toFixed(2),k[0].toUpperCase()+k.slice(1)+' (£)',0.01)).join('')}</div>
   <div class="box" style="grid-column:1/-1"><h2>Condition adjustments</h2><div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));margin:14px 0 0">
   ${Object.keys(CONDS).map(k=>f('cond_'+k,s.cond[k],CONDS[k]+' ×',0.05)).join('')}</div>
   <p class="muted small">Example: a near-mint foil rare bought at £4.00 lists at ${gbp(priceFor({cost:400,finish:'Foil',cond:'NM',rarity:'rare'}))}.</p></div></div>`}

function mExport(){
  const live=S.items.filter(i=>i.live&&i.qty>0);
  return `<div class="two"><div class="box"><h2>Cardmarket stock sheet</h2><p class="muted">Every live card with Cardmarket condition codes, language, foil flag, quantity and your price — ready to work through in Cardmarket’s stock upload.</p><button class="btn" data-exp="cm"${live.length?'':' disabled'}>Build sheet (${live.length})</button></div>
  <div class="box"><h2>Shopify products CSV</h2><p class="muted">One product per card with a variant per condition and finish, so Shopify can stay the source of truth for checkout and stock when you connect it.</p><button class="btn" data-exp="sh"${live.length?'':' disabled'}>Build CSV (${live.length})</button></div></div>
  <div id="expout" style="margin-top:20px"></div>`}

const stockJSON=()=>JSON.stringify({updated:new Date().toISOString(),settings:S.settings,items:S.items},null,1);
const unpublished=()=>JSON.stringify({s:S.settings,i:S.items})!==JSON.stringify({s:PUB.settings,i:PUB.items});
function mPublish(){
  return `<div class="two"><div class="box" style="display:grid;gap:12px"><h2>Publish to your shop</h2>
   <ol style="margin:0;padding-left:20px;display:grid;gap:6px"><li>Download <b>stock.json</b> below.</li><li>In your GitHub repository, open the <code>data</code> folder and replace <code>stock.json</code> with the new file (Add file → Upload files), then commit.</li><li>GitHub Pages redeploys in a minute or two and customers see the new stock.</li></ol>
   <div class="row"><button class="btn gold" id="dlStock">Download stock.json</button><button class="btn ghost" id="cpStock">Copy JSON</button></div>
   <p class="muted small" style="margin:0">${S.items.length} listings, ${S.items.filter(i=>i.live).length} live.</p></div>
   <div class="box" style="display:grid;gap:12px"><h2>Start again from the live shop</h2><p class="muted" style="margin:0">Throws away this browser’s working copy and reloads what’s currently published. Use this on a new computer, or after editing stock.json by hand.</p>
   <div><button class="btn ghost" id="resetWork"${PUB.ok?'':' disabled'}>Reset to published stock</button></div></div></div>`}

/* ---------- csv + pricing ---------- */
function parseCSV(t){const rows=[];let row=[],f='',q=false;t=t.replace(/^﻿/,'');const first=t.split(/\r?\n/)[0]||'';const D=!first.includes(',')&&first.includes(';')?';':',';
  for(let i=0;i<t.length;i++){const c=t[i];
   if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
   else if(c==='"')q=true;else if(c===D){row.push(f);f=''}
   else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);if(row.some(x=>x.trim()))rows.push(row);row=[];f=''}else f+=c}
  row.push(f);if(row.some(x=>x.trim()))rows.push(row);return rows}
function condCode(v){v=String(v||'').toLowerCase().replace(/[_-]/g,' ');
  if(/^(mt|nm|ex|gd|lp|pl|po)$/.test(v))return v.toUpperCase();
  if(v.includes('near'))return 'NM';if(v.includes('mint'))return 'MT';if(v.includes('excel'))return 'EX';if(v.includes('light')||v.includes('slight'))return 'LP';
  if(v.includes('good'))return 'GD';if(v.includes('heav')||v.includes('poor')||v.includes('damag'))return 'PO';if(v.includes('play'))return 'PL';return 'NM'}
function priceFor(l,s=S.settings){
  let p=l.cost>0?l.cost*(1+s.markup/100):(s.floor[rk(l.rarity)]||s.min);
  if(isFoil(l.finish||''))p*=s.foil;p*=(s.cond[l.cond]??1);
  return Math.ceil(Math.max(p,s.min)/5)*5}
const keyOf=l=>(l.sid?l.sid:[l.name,l.set,l.num].join('|').toLowerCase())+'|'+l.finish+'|'+l.cond+'|'+l.lang;
function readImport(text){
  const rows=parseCSV(text);if(rows.length<2)return null;
  const h=rows[0].map(x=>x.trim().toLowerCase());const col=(...n)=>{for(const k of n){const i=h.findIndex(x=>x===k);if(i>=0)return i}for(const k of n){const i=h.findIndex(x=>x.includes(k));if(i>=0)return i}return -1};
  const C={name:col('name','card name','card'),set:col('set code','edition code','set'),setName:col('set name','edition'),num:col('collector number','card number','number'),foil:col('foil','finish','printing'),rar:col('rarity'),qty:col('quantity','count','qty','amount'),sid:col('scryfall id'),cost:col('purchase price','price'),cond:col('condition'),lang:col('language','lang')};
  if(C.name<0)return {error:'No "Name" column found — is this a collection export?'};
  const g=(r,i)=>i>=0?String(r[i]??'').trim():'';const map=new Map();let skipped=0;
  for(const r of rows.slice(1)){const name=g(r,C.name),qty=parseInt(g(r,C.qty)||'1',10);if(!name||!(qty>0)){skipped++;continue}
   const fv=g(r,C.foil).toLowerCase();const finish=fv.includes('etch')?'Etched':(fv==='foil'||fv==='true'||fv==='yes'||fv==='1'||fv.includes('foil'))&&!fv.includes('non')?'Foil':'Non-foil';
   const l={name,set:g(r,C.set).toUpperCase(),setName:g(r,C.setName),num:g(r,C.num),finish,rarity:rk(g(r,C.rar)),qty,sid:g(r,C.sid),cost:Math.round((parseFloat(g(r,C.cost).replace(/[^0-9.]/g,''))||0)*100),cond:condCode(g(r,C.cond)),lang:(g(r,C.lang)||'en').toLowerCase()};
   const k=keyOf(l);if(map.has(k))map.get(k).qty+=qty;else map.set(k,l)}
  const out=[...map.values()].map(l=>({...l,price:priceFor(l)}));
  return {rows:out,raw:rows.length-1,skipped,total:out.reduce((s,l)=>s+l.qty,0)}}

/* ---------- persistence ---------- */
let saveTimer=null;
function markDirty(){clearTimeout(saveTimer);saveTimer=setTimeout(save,400);const ss=$('#savestate');if(ss){ss.textContent='Unpublished changes';ss.classList.add('low')}}
function save(){store.set('mh-work',{settings:S.settings,items:S.items})}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

/* ---------- basket ---------- */
const bQty=()=>basket.reduce((s,b)=>s+b.qty,0);
function addToBasket(id,n=1){const l=byId(id);if(!l||l.qty<=0)return;const b=basket.find(x=>x.id===id);const have=b?b.qty:0;const q=Math.min(l.qty,have+n);
  if(b)b.qty=q;else basket.push({id,qty:q});store.set('mh-basket',basket);renderBasket();toast(`${l.name} added to your basket`)}
function renderBasket(){
  basket=basket.filter(b=>byId(b.id));$('#bcount').textContent=bQty();
  const lines=basket.map(b=>({b,l:byId(b.id)}));const sub=lines.reduce((s,{b,l})=>s+l.price*b.qty,0);
  $('#dbody').innerHTML=lines.length?lines.map(({b,l})=>`<div class="line">${art(l)}<div><b>${esc(l.name)}</b><br><span class="muted small">${esc(l.set)} · ${esc(l.cond)} · ${esc(l.finish)} · ${gbp(l.price)}</span></div>
   <div class="qty"><button data-bq="${esc(b.id)}" data-d="-1" aria-label="One fewer">−</button><span>${b.qty}</span><button data-bq="${esc(b.id)}" data-d="1" aria-label="One more"${b.qty>=l.qty?' disabled':''}>+</button></div></div>`).join(''):'<div class="empty" style="margin-top:20px"><h3>Your basket is empty</h3><p>Find something legendary in the Hoard.</p></div>';
  $('#dfoot').innerHTML=lines.length?`<div class="bar" style="margin:0"><span>Subtotal</span><b class="price">${gbp(sub)}</b></div><p class="muted small" style="margin:0">Send your basket by email and the shop will confirm stock, delivery and payment.</p>
   <div><label class="l" for="bnote">Note (optional)</label><input type="text" id="bnote" placeholder="e.g. combine postage with last order"></div>
   <button class="btn gold" id="sendReq">Email this order</button><button class="btn ghost" id="copyReq">Copy order summary</button>
   <p class="muted small" style="margin:0">Or send it to ${esc(CONFIG.shopEmail)}</p>`:''}
function summary(){return basket.map(b=>{const l=byId(b.id);return `${b.qty} x ${l.name} (${l.set} ${l.num||''}, ${l.cond}, ${l.finish}) @ ${gbp(l.price)}`}).join('\n')+`\nSubtotal: ${gbp(basket.reduce((s,b)=>s+byId(b.id).price*b.qty,0))}`}
function sendRequest(){
  const note=($('#bnote')||{}).value||'';const body=`Hello Mana Hoard,\n\nI'd like to order:\n\n${summary()}\n${note?`\nNote: ${note}\n`:''}\nThanks!`;
  location.href=`mailto:${CONFIG.shopEmail}?subject=${encodeURIComponent('Mana Hoard order')}&body=${encodeURIComponent(body)}`}

/* ---------- misc ---------- */
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),3200)}
async function copy(txt){try{await navigator.clipboard.writeText(txt);return true}catch{return false}}
function openDrawer(on){$('#drawer').classList.toggle('open',on);$('#scrim').classList.toggle('on',on);$('#drawer').setAttribute('aria-hidden',!on);if(on)renderBasket()}
function openCard(id){const l=byId(id);if(!l)return;const d=$('#dlg');const inB=(basket.find(b=>b.id===id)||{}).qty||0;
  d.innerHTML=`<div style="position:relative"><button class="x" data-close aria-label="Close">×</button><div class="dlg"><div>${art(l)}</div><div>
   <span class="pill">${esc(l.cat)}</span><h2 style="margin-top:10px">${esc(l.name)}</h2><p class="muted">${esc(l.setName||l.set)}</p>
   <dl><dt>Set</dt><dd>${esc(l.set)}${l.num?' #'+esc(l.num):''}</dd><dt>Condition</dt><dd>${esc(CONDS[l.cond]||l.cond)}</dd><dt>Finish</dt><dd>${esc(l.finish)}</dd><dt>Rarity</dt><dd style="text-transform:capitalize">${esc(rk(l.rarity))}</dd><dt>Language</dt><dd>${esc((l.lang||'en').toUpperCase())}</dd><dt>In stock</dt><dd>${l.qty}</dd></dl>
   <p class="price" style="font-size:28px;margin:8px 0 16px">${gbp(l.price)}</p>
   <div class="row"><button class="btn gold" data-add="${esc(l.id)}"${l.qty<=inB?' disabled':''}>${l.qty<=0?'Sold out':l.qty<=inB?'All in your basket':'Add to basket'}</button>${inB?`<span class="muted">${inB} in basket</span>`:''}</div></div></div></div>`;
  d.showModal()}

/* ---------- router ---------- */
const ROUTES={home:pHome,shop:pShop,commander:pCommander,tales:pTales,about:pAbout,contact:pContact,policies:pPolicies,manager:pManager};
function route(){const r=location.hash.slice(1);return ROUTES[r]?r:'home'}
function render(scroll){const r=route();renderNav(r);$('#view').innerHTML=ROUTES[r]();if(r==='shop')renderResults();{const d=$('#demo');if(d)d.hidden=r==='manager'}if(scroll)window.scrollTo(0,0)}
function rerenderSoft(){const r=route();if(r==='shop')renderResults();else if(r==='manager'){const p=$('#mpanel');if(p&&document.activeElement&&p.contains(document.activeElement)&&document.activeElement.matches('input,select'))return;render(false)}else render(false);renderBasket()}
addEventListener('hashchange',()=>render(true));

/* ---------- events ---------- */
document.addEventListener('click',async e=>{const t=e.target.closest('button,a');if(!t)return;
  if(t.dataset.open){openCard(t.dataset.open);return}
  if(t.dataset.add){addToBasket(t.dataset.add);$('#dlg').close();return}
  if(t.hasAttribute('data-close')){$('#dlg').close();return}
  if(t.dataset.cat){e.preventDefault();shop={...shop,cat:t.dataset.cat,shown:48};location.hash='shop';if(route()==='shop')render(true);return}
  if(t.dataset.fcat){shop.cat=t.dataset.fcat;shop.shown=48;document.querySelectorAll('[data-fcat]').forEach(b=>b.setAttribute('aria-pressed',b===t));renderResults();return}
  if(t.dataset.ffin){shop.finish=t.dataset.ffin;shop.shown=48;document.querySelectorAll('[data-ffin]').forEach(b=>b.setAttribute('aria-pressed',b===t));renderResults();return}
  if(t.id==='freset'){shop={q:'',cat:'All',stock:false,sort:'newest',finish:'All',cond:'All',set:'All',shown:48};render(false);return}
  if(t.id==='more'){shop.shown+=48;renderResults();return}
  if(t.id==='openBasket'){openDrawer(true);return}if(t.id==='closeBasket'){openDrawer(false);return}
  if(t.dataset.bq){const b=basket.find(x=>x.id===t.dataset.bq);if(b){b.qty+=+t.dataset.d;if(b.qty<=0)basket=basket.filter(x=>x!==b);store.set('mh-basket',basket);renderBasket()}return}
  if(t.id==='sendReq'){sendRequest();return}
  if(t.id==='copyReq'){toast(await copy(summary())?'Order summary copied':'Copy was blocked — select the basket text instead');return}
  // manager
  if(t.dataset.tab){mgr.tab=t.dataset.tab;render(false);return}
  if(t.id==='sample'){$('#paste').value=SAMPLE_CSV;return}
  if(t.id==='parse'){const r=readImport($('#paste').value);if(!r)toast('Paste a CSV with a header row first');else if(r.error)toast(r.error);else{mgr.preview=r;render(false)}return}
  if(t.id==='discard'){mgr.preview=null;render(false);return}
  if(t.id==='commit'){const live=$('#golive').checked,cmd=$('#tagcmd').checked;let added=0,merged=0;const idx=new Map(S.items.map(i=>[keyOf(i),i]));const now=Date.now();
    mgr.preview.rows.forEach((r,n)=>{const ex=idx.get(keyOf(r));if(ex){ex.qty+=r.qty;merged++}else{S.items.push({...r,id:uid(),cat:cmd?'Commander':'Singles',live,added:now+n});added++}});
    mgr.preview=null;mgr.tab='listings';mgr.filter=live?'all':'draft';markDirty();render(false);toast(`${added} new listings${merged?`, ${merged} topped up`:''}`);return}
  if(t.dataset.mf){mgr.filter=t.dataset.mf;mgr.shown=100;render(false);return}
  if(t.id==='mmore'){mgr.shown+=100;render(false);return}
  if(t.id==='publishAll'){let n=0;S.items.forEach(i=>{if(!i.live&&i.qty>0){i.live=true;n++}});markDirty();render(false);toast(`${n} listings are now live`);return}
  if(t.id==='repriceDrafts'){S.items.forEach(i=>{if(!i.live)i.price=priceFor(i)});markDirty();render(false);toast('Drafts re-priced');return}
  if(t.dataset.f==='live'){const i=S.items.find(x=>x.id===t.closest('tr').dataset.id);i.live=!i.live;t.setAttribute('aria-checked',i.live);markDirty();return}
  if(t.dataset.del){const i=S.items.findIndex(x=>x.id===t.dataset.del);if(i<0)return;const [gone]=S.items.splice(i,1);markDirty();render(false);
    const tEl=$('#toast');tEl.style.pointerEvents='auto';tEl.innerHTML=`${esc(gone.name)} removed <button class="linkbtn" style="color:var(--goldf);margin-left:8px" id="undo">Undo</button>`;tEl.classList.add('on');clearTimeout(tt);
    $('#undo').onclick=()=>{S.items.splice(i,0,gone);markDirty();render(false);tEl.classList.remove('on')};tt=setTimeout(()=>{tEl.classList.remove('on');tEl.style.pointerEvents='none'},6000);return}
  if(t.dataset.exp){const live=S.items.filter(i=>i.live&&i.qty>0);const q=v=>/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v);
    const csv=t.dataset.exp==='cm'?['Name,Expansion,Set code,Collector number,Language,Condition,Foil,Quantity,Price (GBP)',...live.map(i=>[i.name,i.setName,i.set,i.num,(i.lang||'en').toUpperCase(),i.cond,isFoil(i.finish)?'Y':'',i.qty,(i.price/100).toFixed(2)].map(q).join(','))]
     :['Handle,Title,Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Inventory Qty,Variant Price,Variant Requires Shipping',...live.map(i=>{const h=(i.name+'-'+i.set+'-'+(i.num||'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return [h,i.name,'Mana Hoard',i.cat,[i.set,rk(i.rarity),i.finish].join(', '),'TRUE','Condition',`${CONDS[i.cond]} ${i.finish}`,i.id,i.qty,(i.price/100).toFixed(2),'TRUE'].map(q).join(',')})];
    const txt=csv.join('\n');$('#expout').innerHTML=`<div class="bar"><b>${live.length} rows</b><div class="row"><button class="btn sm" id="dlExp" data-name="${t.dataset.exp==='cm'?'cardmarket-stock.csv':'shopify-products.csv'}">Download CSV</button><button class="btn sm ghost" id="copyExp">Copy CSV</button></div></div><textarea readonly style="min-height:260px;font:13px/1.4 ui-monospace,monospace" id="exptxt"></textarea>`;$('#exptxt').value=txt;return}
  if(t.id==='copyExp'){const ok=await copy($('#exptxt').value);toast(ok?'CSV copied — paste into a .csv file or sheet':'Copy blocked — select the text and copy it');if(!ok)$('#exptxt').select();return}
  if(t.id==='dlExp'){download(t.dataset.name,$('#exptxt').value,'text/csv');return}
  if(t.id==='dlStock'){download('stock.json',stockJSON(),'application/json');toast('stock.json downloaded — upload it to data/ in your repo');return}
  if(t.id==='cpStock'){toast(await copy(stockJSON())?'JSON copied':'Copy was blocked');return}
  if(t.id==='resetWork'){if(!t.dataset.sure){t.dataset.sure=1;t.textContent='Click again to confirm';return}S.items=structuredClone(PUB.items);S.settings=structuredClone(PUB.settings);save();render(false);toast('Working copy reset to the live shop');return}
});
$('#scrim').addEventListener('click',()=>openDrawer(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#drawer').classList.contains('open'))openDrawer(false)});
$('#dlg').addEventListener('click',e=>{if(e.target.id==='dlg')$('#dlg').close()});
let qt;document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='fq'){clearTimeout(qt);qt=setTimeout(()=>{shop.q=t.value;shop.shown=48;renderResults()},150)}
  if(t.id==='mq'){clearTimeout(qt);qt=setTimeout(()=>{mgr.q=t.value;mgr.shown=100;render(false);const m=$('#mq');m.focus();m.setSelectionRange(m.value.length,m.value.length)},250)}});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='fcond'){shop.cond=t.value;renderResults()}if(t.id==='fset'){shop.set=t.value;renderResults()}if(t.id==='fsort'){shop.sort=t.value;renderResults()}if(t.id==='fstock'){shop.stock=t.checked;renderResults()}
  if(t.id==='file'&&t.files[0]){const txt=await t.files[0].text();const r=readImport(txt);if(!r||r.error){toast(r?r.error:'That file looks empty');return}mgr.preview=r;render(false)}
  const tr=t.closest&&t.closest('tr[data-id]');if(tr&&t.dataset.f){const i=S.items.find(x=>x.id===tr.dataset.id);if(!i)return;
    if(t.dataset.f==='qty')i.qty=Math.max(0,parseInt(t.value,10)||0);if(t.dataset.f==='price')i.price=Math.max(0,Math.round((parseFloat(t.value)||0)*100));if(t.dataset.f==='cond')i.cond=t.value;if(t.dataset.f==='cat')i.cat=t.value;markDirty()}
  if(t.dataset.set){const k=t.dataset.set,v=parseFloat(t.value)||0,s=S.settings;
    if(k==='markup')s.markup=v;else if(k==='foil')s.foil=v;else if(k==='min')s.min=Math.round(v*100);else if(k.startsWith('floor_'))s.floor[k.slice(6)]=Math.round(v*100);else if(k.startsWith('cond_'))s.cond[k.slice(5)]=v;markDirty()}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='cform')return;e.preventDefault();
  const m=`To: ${CONFIG.shopEmail}\nSubject: ${$('#ctype').value}\n\n${$('#cmsg').value}\n\n${$('#cname').value}\n${$('#cmail').value}`;
  $('#cstatus').textContent=(await copy(m))?`Message copied — paste it into an email to ${CONFIG.shopEmail}. Nothing has been sent yet.`:`Copy was blocked — please email ${CONFIG.shopEmail} directly.`});

/* ---------- boot ---------- */
const clean=a=>(Array.isArray(a)?a:[]).filter(x=>x&&x.id&&x.name).map(x=>({...x,qty:+x.qty||0,price:+x.price||0}));
async function boot(){
  try{const r=await fetch(CONFIG.stockFile,{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json();
    PUB={items:clean(j.items),settings:{...structuredClone(DEFAULTS),...(j.settings||{})},updated:j.updated||null,ok:true}}
  catch{PUB.ok=false;console.warn('Could not load',CONFIG.stockFile,'— showing sample stock. Serve the site over http(s), not file://.')}
  const w=store.get('mh-work',null);
  if(w&&Array.isArray(w.items)){S.items=clean(w.items);S.settings={...structuredClone(DEFAULTS),...(w.settings||{})}}
  else{S.items=structuredClone(PUB.items);S.settings=structuredClone(PUB.settings)}
  S.loaded=true;render(false);renderBasket()}
if(CONFIG.demoBanner)$('#demo').textContent=CONFIG.demoBanner;else $('#demo').remove();
$('#femail').textContent=CONFIG.shopEmail;
render(false);renderBasket();boot();
}
