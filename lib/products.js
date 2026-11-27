/* Drawn product art for sealed product and accessories, used until a real photo is added.
   productArt(listing) -> SVG string (viewBox 252x352, same shape as a card). */
(function (root) {
  const KINDS = [
    ['Play booster pack', 'pack'], ['Collector booster pack', 'pack'], ['Booster pack', 'pack'],
    ['Play booster box', 'box'], ['Collector booster box', 'box'], ['Booster box', 'box'],
    ['Bundle', 'bundle'], ['Prerelease pack', 'bundle'], ['Commander deck', 'deck'], ['Starter deck', 'deck'],
    ['Sleeves', 'sleeves'], ['Dice', 'dice'], ['Deck box', 'deckbox'], ['Playmat', 'playmat'],
    ['Binder', 'binder'], ['Dice bag', 'dicebag'], ['T-shirt', 'tee'], ['Stickers', 'stickers'],
  ];
  function kindOf(l) {
    const t = `${l.kind || ''} ${l.finish || ''} ${l.name || ''}`.toLowerCase();
    const tests = [[/collector booster box|play booster box|booster box|display/, 'box'], [/booster pack|play booster|collector booster|draft booster|set booster|\bbooster\b/, 'pack'],
      [/bundle|fat pack|prerelease/, 'bundle'], [/commander deck|starter deck|precon|\bdeck\b(?! box)/, 'deck'], [/deck ?box|deck case/, 'deckbox'],
      [/sleeve/, 'sleeves'], [/dice bag|dice pouch/, 'dicebag'], [/\bdice\b|\bd20\b|spindown|\bdie\b/, 'dice'], [/playmat|play mat/, 'playmat'],
      [/binder|portfolio/, 'binder'], [/t-?shirt|\btee\b|hoodie/, 'tee'], [/sticker/, 'stickers']];
    for (const [re, k] of tests) if (re.test(t)) return k;
    return l.cat === 'Accessories' ? 'deckbox' : 'box';
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  function productArt(l, logo) {
    const k = kindOf(l), h = (l.hue != null ? +l.hue : hashOf(l.name + '|' + (l.set || '')) % 360);
    const merch = /mana hoard/i.test(l.name || ''), id = 'p' + (hashOf(l.id || l.name) % 1e6);
    const set = esc(String(l.set || '').slice(0, 5)), collector = /collector/i.test(`${l.name} ${l.finish} ${l.kind}`);
    const c1 = `hsl(${h} 70% 58%)`, c2 = `hsl(${(h + 40) % 360} 75% 38%)`, c3 = `hsl(${h} 55% 22%)`;
    const L = logo || 'assets/logo-small.png';
    const logoImg = (x, y, w) => `<image href="${L}" x="${x}" y="${y}" width="${w}" height="${w * 0.925}" preserveAspectRatio="xMidYMid meet"/>`;
    const defs = `<defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}g" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2516"/><stop offset="1" stop-color="#1a0f08"/></linearGradient></defs>`;
    const shadow = `<ellipse cx="126" cy="318" rx="84" ry="10" fill="#000" opacity=".35"/>`;
    const spark = (x, y, s) => `<path d="M${x} ${y - s}L${x + s * .28} ${y - s * .28}L${x + s} ${y}L${x + s * .28} ${y + s * .28}L${x} ${y + s}L${x - s * .28} ${y + s * .28}L${x - s} ${y}L${x - s * .28} ${y - s * .28}Z" fill="#fff6d6"/>`;
    let art = '';
    if (k === 'pack') {
      const crimp = (y, up) => { let d = ''; for (let x = 58; x <= 194; x += 8) d += `L${x} ${y + (((x - 58) / 8) % 2 ? (up ? -5 : 5) : 0)}`; return d; };
      art = `<path d="M58 54${crimp(54, true)}L194 54L190 300${crimp(300, false).replace(/L58 /, 'L62 ')}L62 300Z" fill="url(#${id}f)" stroke="#0007" stroke-width="2"/>
        <rect x="62" y="54" width="128" height="22" fill="#0003"/><rect x="62" y="278" width="128" height="22" fill="#0003"/>
        <path d="M70 76 L110 76 L80 278 L66 278Z" fill="url(#${id}s)" opacity=".7"/>
        <circle cx="126" cy="160" r="40" fill="#0000" stroke="#fff8" stroke-width="2"/>${spark(126, 160, 22)}${spark(158, 118, 8)}${spark(94, 206, 6)}
        <text x="126" y="236" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="26" fill="#fff">${set || 'MTG'}</text>
        <text x="126" y="262" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="12" letter-spacing="2" fill="#fff" opacity=".9">${collector ? 'COLLECTOR BOOSTER' : 'BOOSTER'}</text>`;
    } else if (k === 'box' || k === 'bundle' || k === 'deck') {
      const W = k === 'bundle' ? 150 : k === 'deck' ? 110 : 140, H = k === 'bundle' ? 120 : k === 'deck' ? 170 : 150, D = k === 'deck' ? 34 : 40;
      const x = 126 - W / 2 - D / 4, y = 300 - H;
      art = `<path d="M${x} ${y}L${x + D} ${y - D * .7}L${x + W + D} ${y - D * .7}L${x + W} ${y}Z" fill="${c1}" stroke="#0007" stroke-width="2"/>
        <path d="M${x + W} ${y}L${x + W + D} ${y - D * .7}L${x + W + D} ${300 - D * .7}L${x + W} 300Z" fill="${c3}" stroke="#0007" stroke-width="2"/>
        <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="url(#${id}f)" stroke="#0007" stroke-width="2"/>
        <rect x="${x}" y="${y}" width="${W * .35}" height="${H}" fill="url(#${id}s)" opacity=".4"/>
        ${k === 'deck' ? `<rect x="${x + 16}" y="${y + 22}" width="${W - 32}" height="${H * .45}" rx="6" fill="#1b120c" stroke="#fff6" stroke-width="2"/><rect x="${x + 26}" y="${y + 30}" width="${W - 52}" height="${H * .45 - 16}" rx="4" fill="#5a3a22"/><circle cx="${x + W / 2}" cy="${y + 22 + H * .225}" r="12" fill="none" stroke="#e9c27a" stroke-width="3"/>` : spark(x + W / 2, y + H * .4, 20)}
        ${k === 'bundle' ? `<line x1="${x}" y1="${y + 26}" x2="${x + W}" y2="${y + 26}" stroke="#0006" stroke-width="2"/>` : ''}
        <text x="${x + W / 2}" y="${y + H - 30}" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="22" fill="#fff">${set || 'MTG'}</text>
        <text x="${x + W / 2}" y="${y + H - 12}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="10" letter-spacing="1.6" fill="#fff" opacity=".9">${k === 'bundle' ? (/prerelease/i.test(l.name + l.finish) ? 'PRERELEASE' : 'BUNDLE') : k === 'deck' ? 'COMMANDER' : collector ? 'COLLECTOR BOX' : 'BOOSTER BOX'}</text>`;
    } else if (k === 'sleeves') {
      art = [3, 2, 1, 0].map(i => `<rect x="${66 + i * 10}" y="${70 - i * 6}" width="112" height="160" rx="8" transform="rotate(${(i - 1.5) * 7} 126 220)" fill="${i ? `hsl(${h} 55% ${30 + i * 8}%)` : `url(#${id}f)`}" stroke="#0006" stroke-width="2"/>`).join('') +
        `<rect x="70" y="230" width="112" height="56" rx="10" fill="#1c120b" stroke="#e9c27a88" stroke-width="2"/><text x="126" y="266" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="16" fill="#f6d38a">${/100/.test(l.name) ? '100' : 'SLEEVES'}</text>${spark(126, 140, 14)}`;
    } else if (k === 'dice') {
      const P = (cx, cy, r, s) => `<polygon points="${[0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i - Math.PI / 2; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ')}" fill="url(#${id}f)" stroke="#0007" stroke-width="2"/>
        <polygon points="${cx},${cy - r * .55} ${cx + r * .5},${cy + r * .32} ${cx - r * .5},${cy + r * .32}" fill="#fff2" stroke="#fff6" stroke-width="1.5"/>
        <text x="${cx}" y="${cy + r * .18}" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="${r * .42}" fill="#fff">${s}</text>`;
      art = /set|polyhedral|\(7\)/i.test(l.name) ? P(96, 150, 46, 20) + P(170, 178, 34, 12) + P(118, 238, 38, 8) : P(126, 186, 82, 20) + spark(186, 96, 10);
    } else if (k === 'deckbox') {
      art = `<path d="M74 110L98 92L190 92L166 110Z" fill="${c1}" stroke="#0007" stroke-width="2"/><path d="M166 110L190 92L190 282L166 300Z" fill="${c3}" stroke="#0007" stroke-width="2"/>
        <rect x="74" y="110" width="92" height="190" rx="4" fill="url(#${id}b)" stroke="#0007" stroke-width="2"/><line x1="74" y1="150" x2="166" y2="150" stroke="${c1}" stroke-width="3"/>
        ${merch ? logoImg(80, 172, 80) : spark(120, 210, 18)}`;
    } else if (k === 'playmat') {
      art = `<path d="M30 250L72 120L222 120L238 250Z" fill="url(#${id}b)" stroke="${c1}" stroke-width="3"/><path d="M30 250L238 250L238 262L30 262Z" fill="#120a05"/>
        ${merch ? `<g transform="translate(134 186) scale(1 .62) translate(-134 -186)">${logoImg(84, 126, 100)}</g>` : spark(134, 184, 22)}`;
    } else if (k === 'tee') {
      art = `<path d="M86 84L112 72Q126 88 140 72L166 84L206 112L188 146L168 136L168 298L84 298L84 136L64 146L46 112Z" fill="${merch ? '#2a1a10' : `url(#${id}f)`}" stroke="#0008" stroke-width="2"/>
        <path d="M112 72Q126 96 140 72" fill="none" stroke="#0006" stroke-width="3"/>${merch ? logoImg(92, 130, 68) : spark(126, 180, 18)}`;
    } else if (k === 'stickers') {
      art = [[96, 140, 46, -8], [168, 178, 40, 10], [112, 238, 42, 4]].map(([x, y, r, a]) => `<g transform="rotate(${a} ${x} ${y})"><circle cx="${x}" cy="${y}" r="${r}" fill="#f6ecd2" stroke="#0005" stroke-width="2"/>${merch ? logoImg(x - r * .8, y - r * .74, r * 1.6) : spark(x, y, r * .5)}</g>`).join('');
    } else if (k === 'dicebag') {
      art = `<path d="M90 120Q126 100 162 120L176 150Q200 230 170 290Q126 312 82 290Q52 230 76 150Z" fill="${merch ? '#2a1a10' : `url(#${id}f)`}" stroke="#0008" stroke-width="2"/>
        <path d="M86 128Q126 146 166 128" fill="none" stroke="#e9c27a" stroke-width="4"/><path d="M150 134Q170 160 158 184" fill="none" stroke="#e9c27a" stroke-width="3"/>${merch ? logoImg(92, 170, 68) : spark(126, 214, 18)}`;
    } else if (k === 'binder') {
      art = `<rect x="62" y="70" width="136" height="220" rx="10" fill="url(#${id}f)" stroke="#0007" stroke-width="2"/><rect x="62" y="70" width="20" height="220" rx="6" fill="#0004"/>
        <rect x="96" y="104" width="86" height="120" rx="6" fill="#0003" stroke="#fff5" stroke-width="2"/>${merch ? logoImg(100, 120, 78) : spark(139, 164, 20)}`;
    }
    return `<svg class="prodsvg" viewBox="0 0 252 352" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(l.name)}">${defs}
      <rect width="252" height="352" fill="url(#${id}b)"/><rect width="252" height="352" fill="url(#${id}g)"/>${shadow}${art}</svg>`;
  }
  root.MHProducts = { productArt, kindOf, KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
