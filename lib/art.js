/* Mana Hoard illustrations — original artwork drawn as SVG.
 * HoardArt.burrowBack()  : the cosy burrow behind the hero (glowing tunnel, shelves of jars, lantern)
 * HoardArt.burrowFront() : the coin hoard in front of the cards (the dragon lives in the logo)
 * HoardArt.jar(...)      : a glowing labelled jar used for browsing shelves
 */
(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // little shelf jar: x,y = base centre
  const shelfJar = (x, y, w, h, hue, glow) => `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="${-h / 2}" rx="${w * 0.9}" ry="${h * 0.7}" fill="hsl(${hue} 95% 65%)" opacity="${glow}" filter="url(#bb-soft)"/>
      <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="${w * 0.28}" fill="hsl(${hue} 70% 58%)" opacity=".85"/>
      <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h * 0.42}" rx="${w * 0.28}" fill="#fff" opacity=".18"/>
      <rect x="${-w * 0.3}" y="${-h - 5}" width="${w * 0.6}" height="6" rx="2" fill="#8a5a33"/>
      <rect x="${-w * 0.36}" y="${-h * 0.62}" width="${w * 0.72}" height="${h * 0.26}" rx="2" fill="#f6e7c8" opacity=".92"/>
    </g>`;
  const book = (x, y, w, h, c, tilt = 0) => `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${c}" transform="rotate(${tilt} ${x + w / 2} ${y})"/><rect x="${x + 2}" y="${y - h + 6}" width="${w - 4}" height="3" fill="#f3d58f" opacity=".6" transform="rotate(${tilt} ${x + w / 2} ${y})"/>`;

  function burrowBack() {
    const leftJars = [[46, 120, 16, 24, 28, .55], [70, 120, 13, 30, 330, .5], [92, 120, 18, 20, 140, .45], [128, 205, 15, 26, 200, .5], [150, 205, 12, 18, 45, .6], [64, 205, 17, 28, 280, .45]];
    const rightJars = [[470, 132, 15, 26, 48, .6], [494, 132, 13, 22, 10, .5], [548, 132, 16, 30, 170, .45], [476, 222, 17, 22, 300, .5], [520, 222, 14, 28, 40, .6]];
    return `<svg class="scene-back" viewBox="0 0 600 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bb-tunnel" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#fff2c4"/><stop offset=".35" stop-color="#ffc35a"/><stop offset=".75" stop-color="#c46a2a"/><stop offset="1" stop-color="#5a2e16"/></radialGradient>
        <radialGradient id="bb-room" cx="58%" cy="48%" r="70%"><stop offset="0" stop-color="#8a4f25"/><stop offset=".55" stop-color="#4a2a17"/><stop offset="1" stop-color="#1e120b"/></radialGradient>
        <radialGradient id="bb-lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe09a" stop-opacity=".95"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        <filter id="bb-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="bb-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
      </defs>
      <rect width="600" height="460" fill="url(#bb-room)"/>
      <!-- rough rock rings around the room -->
      <path d="M0 0h600v460H0z M60 460 C40 330 70 150 170 80 C240 30 380 30 450 85 C545 160 570 330 545 460z" fill="#26170e" fill-rule="evenodd" opacity=".85"/>
      <path d="M85 460 C70 340 95 175 185 105 C250 60 370 60 435 110 C520 175 540 330 520 460" fill="none" stroke="#6b3d20" stroke-width="10" opacity=".45"/>
      <!-- glowing tunnel at the back -->
      <g filter="url(#bb-blur)">
        <path d="M250 330 C246 250 270 190 318 175 C368 162 402 210 404 280 C405 300 404 318 402 330z" fill="url(#bb-tunnel)"/>
        <path d="M282 330 C282 270 298 232 326 226 C356 222 372 260 372 330z" fill="#fff4cf" opacity=".55"/>
      </g>
      <ellipse cx="327" cy="330" rx="110" ry="18" fill="#ffd27a" opacity=".35" filter="url(#bb-soft)"/>
      <!-- far coin heap inside the tunnel -->
      <path d="M268 330 Q300 300 330 312 Q360 296 392 330z" fill="#f6c45a" opacity=".85"/>
      <!-- shelves -->
      <g>
        <rect x="24" y="120" width="120" height="8" rx="3" fill="#7a4a27"/><rect x="40" y="205" width="130" height="8" rx="3" fill="#7a4a27"/>
        ${book(104, 120, 9, 30, '#3d6b4f', -4)}${book(114, 120, 8, 26, '#8b3a2e')}${book(123, 120, 10, 32, '#5a4b8a')}
        ${leftJars.map(j => shelfJar(...j)).join('')}
        <rect x="452" y="132" width="124" height="8" rx="3" fill="#7a4a27"/><rect x="456" y="222" width="110" height="8" rx="3" fill="#7a4a27"/>
        ${book(512, 132, 9, 28, '#8b3a2e', 3)}${book(522, 132, 10, 34, '#3d6b4f')}${book(540, 222, 9, 26, '#5a4b8a')}${book(550, 222, 9, 30, '#b5762f', -5)}
        ${rightJars.map(j => shelfJar(...j)).join('')}
      </g>
      <!-- hanging lantern -->
      <g class="lantern">
        <line x1="508" y1="250" x2="508" y2="282" stroke="#5a3a20" stroke-width="2"/>
        <circle cx="508" cy="312" r="62" fill="url(#bb-lamp)" class="lampglow"/>
        <path d="M494 288h28l-4 8h-20z" fill="#3a2414"/>
        <rect x="494" y="296" width="28" height="34" rx="6" fill="#ffd27a" stroke="#3a2414" stroke-width="3"/>
        <path d="M508 300 q-6 10 0 22 q6 -12 0 -22z" fill="#fff6d8"/>
        <path d="M492 330h32l-3 6h-26z" fill="#3a2414"/>
      </g>
      <!-- dried flowers in a bottle, bottom left -->
      <g transform="translate(70 395)">
        <path d="M-8 0 v-30 q0 -8 8 -8 q8 0 8 8 v30 q0 8 -8 8 q-8 0 -8 -8z" fill="#a7d3c6" opacity=".55"/>
        <path d="M0 -36 C-6 -60 -16 -72 -22 -86 M0 -36 C2 -62 4 -78 0 -96 M0 -36 C8 -58 18 -70 24 -82" stroke="#7a8f4e" stroke-width="2" fill="none"/>
        <circle cx="-22" cy="-88" r="7" fill="#e3734f"/><circle cx="0" cy="-98" r="6" fill="#f2b84b"/><circle cx="24" cy="-84" r="7" fill="#d9734a"/>
      </g>
    </svg>`;
  }

  function coins(cx, cy, w, h, n, seed) {
    let s = seed, out = '';
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < n; i++) {
      const t = rnd(), u = rnd();
      const x = cx + (t - .5) * w * (1 - u * .55);
      const y = cy - u * h + (rnd() - .5) * 8;
      const r = 6 + rnd() * 5;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * .55).toFixed(1)}" fill="${rnd() > .5 ? '#f6c45a' : '#e9a93a'}" stroke="#a8641f" stroke-width="1"/>`;
      if (rnd() > .8) out += `<ellipse cx="${(x - r * .3).toFixed(1)}" cy="${(y - r * .15).toFixed(1)}" rx="${(r * .35).toFixed(1)}" ry="${(r * .16).toFixed(1)}" fill="#fff3c4"/>`;
    }
    return out;
  }

  function burrowFront() {
    return `<svg class="scene-front" viewBox="0 0 600 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bf-belly" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#ffe8a8"/><stop offset="1" stop-color="#e7b45a"/></radialGradient>
        <linearGradient id="bf-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fbf8e"/><stop offset="1" stop-color="#2f7d63"/></linearGradient>
        <linearGradient id="bf-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f8f73"/><stop offset="1" stop-color="#235f4d"/></linearGradient>
        <filter id="bf-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>
      <!-- warm light pooling on the floor -->
      <ellipse cx="300" cy="438" rx="290" ry="40" fill="#ffc35a" opacity=".25" filter="url(#bf-glow)"/>
      <!-- the hoard -->
      <path d="M40 460 C90 395 170 380 230 392 C280 360 360 362 410 390 C470 375 545 400 580 460z" fill="#d9952f"/>
      ${coins(300, 452, 520, 70, 120, 7)}
      <!-- a few treasures in the pile -->
      <g transform="translate(150 418) rotate(-18)"><rect x="-14" y="-10" width="28" height="20" rx="3" fill="#7a3f9c"/><rect x="-14" y="-10" width="28" height="7" rx="3" fill="#a46cc7"/><circle cx="0" cy="0" r="3" fill="#f3d58f"/></g>
      <g transform="translate(468 420) rotate(14)"><path d="M0 -14 l6 8 -6 8 -6 -8z" fill="#7fd6e8" stroke="#2f7d93" stroke-width="1.5"/></g>
      <g transform="translate(420 440)"><path d="M-6 0 v-14 a6 6 0 0 1 12 0 v14z" fill="#e3734f" opacity=".9"/><rect x="-3" y="-20" width="6" height="5" rx="1" fill="#8a5a33"/></g>

    </svg>`;
  }

  /** a glowing labelled jar for the browsing shelf */
  function jar(label, hue, fill, count) {
    const id = 'j' + Math.abs([...String(label)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
    const top = 128 - Math.max(.25, Math.min(.92, fill)) * 92;
    return `<svg class="jar" viewBox="0 0 120 150" aria-hidden="true">
      <defs>
        <radialGradient id="${id}g" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="hsl(${hue} 100% 80%)"/><stop offset="1" stop-color="hsl(${hue} 85% 52%)"/></radialGradient>
        <clipPath id="${id}c"><path d="M30 34 h60 v6 q14 8 14 26 v58 q0 14 -14 14 h-60 q-14 0 -14 -14 v-58 q0 -18 14 -26z"/></clipPath>
        <filter id="${id}b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
      </defs>
      <ellipse class="jglow" cx="60" cy="96" rx="52" ry="52" fill="hsl(${hue} 100% 62%)" opacity=".5" filter="url(#${id}b)"/>
      <g clip-path="url(#${id}c)">
        <rect x="0" y="0" width="120" height="150" fill="hsl(${hue} 40% 20%)" opacity=".5"/>
        <rect x="0" y="${top}" width="120" height="150" fill="url(#${id}g)"/>
        <circle cx="44" cy="${top + 22}" r="3" fill="#fff" opacity=".7"/><circle cx="76" cy="${top + 40}" r="2" fill="#fff" opacity=".6"/><circle cx="58" cy="${top + 60}" r="2.5" fill="#fff" opacity=".5"/>
      </g>
      <path d="M30 34 h60 v6 q14 8 14 26 v58 q0 14 -14 14 h-60 q-14 0 -14 -14 v-58 q0 -18 14 -26z" fill="none" stroke="#f6e7c8" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M24 70 q0 -16 10 -22" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="34" y="16" width="52" height="20" rx="5" fill="#9b6a3f"/><rect x="34" y="16" width="52" height="6" rx="3" fill="#c08a55"/>
      <path d="M30 36 h60" stroke="#6b4426" stroke-width="3"/>
      <g transform="rotate(-3 60 92)"><rect x="24" y="76" width="72" height="34" rx="4" fill="#f6e7c8" stroke="#c9a97a"/>
      <text x="60" y="${count == null ? 98 : 92}" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="${String(label).length > 11 ? 13 : 16}" fill="#4a2a17">${esc(label)}</text>
      ${count == null ? '' : `<text x="60" y="105" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="9.5" fill="#8a5a33">${esc(count)}</text>`}</g>
    </svg>`;
  }

  root.HoardArt = { burrowBack, burrowFront, jar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
