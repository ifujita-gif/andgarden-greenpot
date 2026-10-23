/* お部屋の写真から、似合うグリーンと鉢カバーのセットを提案する(試作)
   写真はブラウザの中だけで読み取り、どこにも送らない。
   1) 壁・床の色をピンの位置から読む  2) 写真全体から目立つ色(家具など)を拾う
   3) 色の相性ルールで「グリーン+鉢カバー」に点数をつけ、上位のセットを出す */
(function () {
  'use strict';
  const C = window.SUGGEST_CATALOG;
  const $ = (id) => document.getElementById(id);
  const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');

  // ---- 色の計算 ----
  function srgbToLab([r, g, b]) {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const R = f(r), G = f(g), B = f(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    x = t(x); y = t(y); z = t(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbToHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const chroma = (lab) => Math.hypot(lab[1], lab[2]);
  const hue = (lab) => { const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI; return h < 0 ? h + 360 : h; };

  // 色に日本語の名前を付ける(おおまか)
  function colorName(lab, { floor = false } = {}) {
    const [L] = lab, c = chroma(lab), h = hue(lab);
    const warm = h >= 25 && h <= 95;
    if (floor && warm && c >= 12) return L > 66 ? '明るい木目' : L > 45 ? 'ナチュラルな木目' : '濃い木目';
    if (c < 8) return L > 88 ? 'ホワイト' : L > 72 ? 'ライトグレー' : L > 45 ? 'グレー' : L > 25 ? 'チャコール' : 'ブラック';
    if (warm && c < 22) return L > 80 ? 'アイボリー' : L > 62 ? 'グレージュ' : L > 40 ? 'トープ' : 'ダークブラウン';
    if (warm) return L > 70 ? 'ベージュ' : L > 48 ? 'キャメル' : 'ブラウン';
    if (h > 95 && h <= 170) return L > 55 ? 'グリーン' : 'カーキ';
    if (h > 170 && h <= 290) return L > 55 ? 'ブルーグレー' : 'ネイビー';
    return L > 55 ? 'ピンク' : 'テラコッタ';
  }

  // ---- 写真の読み取り ----
  let canvas = null, ctx = null, pins = { wall: { x: 0.5, y: 0.15 }, floor: { x: 0.12, y: 0.95 } };
  function sampleAt(p) {
    const W = canvas.width, H = canvas.height, r = Math.max(3, Math.round(W * 0.03));
    const cx = Math.round(p.x * W), cy = Math.round(p.y * H);
    const d = ctx.getImageData(Math.max(0, cx - r), Math.max(0, cy - r), r * 2, r * 2).data;
    const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]); // 中央値で、模様や影に強くする
  }
  // 壁・床以外で面積の大きい色(家具・ラグなど)を拾う
  function accentColors(wallLab, floorLab) {
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data, pts = [];
    const step = Math.max(1, Math.floor(d.length / 4 / 4000));
    for (let i = 0; i < d.length / 4; i += step) {
      const lab = srgbToLab([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
      if (dE(lab, wallLab) < 14 || dE(lab, floorLab) < 14) continue;
      pts.push(lab);
    }
    const total = d.length / 4 / step;
    if (pts.length < total * 0.05) return [];
    let cents = [0, 1, 2, 3].map((k) => pts[Math.floor((k + 0.5) * pts.length / 4)]);
    for (let it = 0; it < 10; it++) {
      const sum = cents.map(() => [0, 0, 0, 0]);
      for (const p of pts) { let bi = 0, bd = 1e9; cents.forEach((c, i) => { const v = dE(p, c); if (v < bd) { bd = v; bi = i; } }); const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
      cents = sum.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cents[i]));
      cents.counts = sum.map((s) => s[3]);
    }
    return cents.map((lab, i) => ({ lab, share: cents.counts[i] / total }))
      .filter((a) => a.share >= 0.05)
      .sort((a, b) => b.share - a.share).slice(0, 3)
      .map((a) => ({ ...a, name: colorName(a.lab) }));
  }

  function readRoom() {
    const wallRgb = sampleAt(pins.wall), floorRgb = sampleAt(pins.floor);
    const wall = srgbToLab(wallRgb), floor = srgbToLab(floorRgb);
    const accents = accentColors(wall, floor);
    const floorWood = hue(floor) >= 25 && hue(floor) <= 95 && chroma(floor) >= 12;
    const lowChroma = chroma(wall) < 10 && (chroma(floor) < 10 || !floorWood);
    let style = 'neutral';
    if (wall[0] < 45 || (floorWood && floor[0] < 42)) style = 'dark';
    else if (floorWood) style = 'natural';
    else if (lowChroma) style = 'modern';
    return { wall, floor, wallRgb, floorRgb, floorWood, accents, style };
  }

  // ---- 組み合わせの点数 ----
  const TONE = { silver: 'シルバーがかった葉', bright: '明るい黄緑の葉', deep: '濃い緑の葉' };
  function scorePot(p, room) {
    const lab = srgbToLab(hexToRgb(p.hex));
    let s = 0; const why = [];
    const dl = Math.abs(lab[0] - room.floor[0]);
    if (dl >= 30) { s += 2; why.push(`床(${colorName(room.floor, { floor: true })})との明るさの差で、鉢の形がきれいに見えます`); }
    else if (dE(lab, room.floor) < 15) s -= 2; // 床に溶け込んで見えなくなる
    if (dE(lab, room.wall) < 12) s -= 1;
    const acc = room.accents.find((a) => dE(lab, a.lab) < 20);
    if (acc) { s += 2; why.push(`写真の中の${acc.name}と色がそろい、家具となじみます`); }
    const st = room.style;
    if (st === 'natural' && ['NA', 'WH', 'RATTAN'].includes(p.color)) { s += 1.5; why.push('木の床のナチュラルな雰囲気に合う色です'); }
    if (st === 'modern' && ['GL', 'BL', 'WH'].includes(p.color)) { s += 1.5; why.push('モノトーンのすっきりした部屋に合う色です'); }
    if (st === 'dark' && ['BL', 'BR', 'GL', 'RATTAN'].includes(p.color)) { s += 1.5; why.push('落ち着いた濃い色の部屋を引き締めます'); }
    if (st === 'neutral' && ['WH', 'GL', 'NA'].includes(p.color)) { s += 1; why.push('どんな部屋にもなじみやすい色です'); }
    if (p.material === '天然素材' && room.floorWood) { s += 0.5; }
    return { s, why };
  }
  function scoreGreen(g, room) {
    let s = 0; const why = [];
    const wL = room.wall[0];
    if (wL < 45) { if (g.tone !== 'deep') { s += 2; why.push(`濃い壁に${TONE[g.tone]}が映えます`); } else s -= 1; }
    else if (wL > 78 && g.tone === 'deep') { s += 1.5; why.push(`白っぽい壁に${TONE.deep}がくっきり映えます`); }
    if (room.style === 'natural' && g.shape === 'airy') { s += 1.5; why.push('軽やかな枝ぶりが木の床の部屋になじみます'); }
    if (room.style === 'modern' && (g.tone === 'silver' || g.shape === 'bold')) { s += 1.5; why.push(g.tone === 'silver' ? 'グレイッシュな葉色がモノトーンに合います' : '大きな葉の存在感がシンプルな部屋の主役になります'); }
    if (room.style === 'dark' && g.tone !== 'deep') { s += 1; }
    if (room.style === 'neutral' && g.shape === 'airy') { s += 0.5; }
    return { s, why };
  }
  // ---- 大きさの組み合わせ ----
  // サイズは商品タグの「大型/中型/小型」だけで判別する(商品名のS/M/Lは商品ごとに表記が違うので使わない)
  // 大型商品→大型鉢、中型商品→中型鉢、小型商品→小型鉢。鉢付きで売っている商品は単体で提案する
  function potsFor(g) {
    return C.pots.filter((p) => p.cls === g.cls);
  }
  function pairBonus(g, color) {
    let s = 0; const why = [];
    if (['BL', 'BR', 'NV'].includes(color) && g.tone !== 'deep') { s += 0.5; why.push('濃い鉢と明るい葉で、メリハリが出ます'); }
    if (color === 'WH' && g.tone === 'deep') { s += 0.5; why.push('白い鉢が濃い緑を引き立てます'); }
    if (g.tone === 'silver' && ['GL', 'WH', 'NA'].includes(color)) { s += 0.5; why.push('やわらかい葉色と鉢の色が同じトーンでまとまります'); }
    return { s, why };
  }
  function combos(room, cls) {
    const potScore = new Map(C.pots.map((p) => [p.id, scorePot(p, room)]));
    const all = [];
    for (const g of C.greens.filter((x) => x.cls === cls)) {
      const gs = scoreGreen(g, room);
      if (g.ownPot) {
        // 鉢付きの商品: 付いている鉢の色がわかれば、鉢カバーと同じ基準で点数をつける
        let s = gs.s; const why = [...gs.why];
        if (g.ownPotColor) {
          const ps = scorePot({ color: g.ownPotColor, hex: g.ownPotHex, material: '' }, room);
          const pb = pairBonus(g, g.ownPotColor);
          s += ps.s + pb.s; why.push(...ps.why.map((w) => w.replace('鉢の形', '付いている鉢の形')), ...pb.why);
        }
        all.push({ green: g, pot: null, color: g.ownPotColor || 'own', s, why: [...new Set(why)].slice(0, 3), total: g.price });
        continue;
      }
      for (const p of potsFor(g)) {
        const ps = potScore.get(p.id), pb = pairBonus(g, p.color);
        all.push({ green: g, pot: p, color: p.color, s: gs.s + ps.s + pb.s, why: [...new Set([...gs.why, ...ps.why, ...pb.why])].slice(0, 3), total: g.price + p.price });
      }
    }
    // 点数が同じなら、価格がそのサイズの中くらいのものを先にする
    const prices = all.map((c) => c.total).sort((x, y) => x - y);
    const median = prices[prices.length >> 1] || 0;
    return all.sort((x, y) => y.s - x.s || Math.abs(x.total - median) - Math.abs(y.total - median));
  }
  // まず葉の色の系統・鉢の色・グリーンがすべて違うものを選び、足りなければ条件をゆるめる
  function pickSets(list, exclude, n) {
    const out = [], usedG = new Set(exclude), usedColor = new Set(), usedTone = new Set();
    for (const strict of [true, false]) {
      for (const c of list) {
        if (out.length === n) break;
        if (out.includes(c) || usedG.has(c.green.id)) continue;
        if (strict && (usedTone.has(c.green.tone) || usedColor.has(c.color))) continue;
        out.push(c); usedG.add(c.green.id); usedColor.add(c.color); usedTone.add(c.green.tone);
      }
    }
    return out;
  }

  // ---- 画面 ----
  const CLASSES = [
    { key: 'large', en: 'LARGE', ja: '大型(床に置く)' },
    { key: 'medium', en: 'MEDIUM', ja: '中型' },
    { key: 'small', en: 'SMALL', ja: '小型(棚・テーブルに)' },
  ];
  const state = {}; // cls -> { ranked, shown }
  const TONE_NAME = { silver: 'シルバーグリーン', bright: 'ライトグリーン', deep: 'ディープグリーン' };
  function setTitle(c) {
    const potName = c.pot ? c.pot.colorName : c.green.ownPotName ? `${c.green.ownPotName}の鉢付き` : '鉢付き';
    return `${TONE_NAME[c.green.tone]} × ${potName}`;
  }
  function renderResult(room) {
    const sw = (rgb, label) => `<span class="sg-sw"><i style="background:${rgbToHex(rgb)}"></i>${label}</span>`;
    $('reading').innerHTML = [
      sw(room.wallRgb, '壁: ' + colorName(room.wall)),
      sw(room.floorRgb, '床: ' + colorName(room.floor, { floor: true })),
      ...room.accents.map((a) => `<span class="sg-sw"><i style="background:${labToHex(a.lab)}"></i>${a.name}</span>`),
    ].join('');
    $('styleNote').textContent = {
      natural: '木の床のナチュラルな部屋として選んでいます。',
      modern: 'モノトーンのすっきりした部屋として選んでいます。',
      dark: '濃い色の落ち着いた部屋として選んでいます。',
      neutral: 'やわらかい色の部屋として選んでいます。',
    }[room.style];
    for (const c of CLASSES) { state[c.key] = { ranked: combos(room, c.key), shown: new Set() }; renderSets(c.key); }
    $('result').hidden = false;
  }
  function itemHtml(kind) {
    return `<a class="sg-item" target="_blank" rel="noopener"><img alt="" loading="lazy"><span class="sg-kind">${kind}</span><span class="sg-name"></span><span class="sg-price"></span></a>`;
  }
  function fillItem(a, it) {
    a.href = it.url; a.querySelector('img').src = it.image;
    a.querySelector('.sg-name').textContent = it.title; a.querySelector('.sg-price').textContent = yen(it.price);
  }
  function renderSets(cls) {
    const st = state[cls];
    let sets = pickSets(st.ranked, st.shown, 3);
    if (!sets.length) { st.shown = new Set(); sets = pickSets(st.ranked, st.shown, 3); } // 出し尽くしたら最初から
    sets.forEach((c) => st.shown.add(c.green.id));
    const box = $('sets-' + cls);
    box.innerHTML = '';
    for (const c of sets) {
      const el = document.createElement('article');
      el.className = 'sg-set';
      el.innerHTML = `<h4 class="sg-set-title"></h4>` +
        (c.pot ? `<div class="sg-pair">${itemHtml('グリーン')}<span class="sg-plus" aria-hidden="true">+</span>${itemHtml('鉢カバー')}</div>`
          : `<div class="sg-single">${itemHtml('グリーン(鉢付き)')}</div>`) +
        `<ul class="sg-why"></ul><div class="sg-total"><span>${c.pot ? 'セット合計' : '価格'}</span><b></b></div>
        <button type="button" class="sg-btn">${c.pot ? 'セットでカートに追加する' : 'カートに追加する'}</button>`;
      el.querySelector('.sg-set-title').textContent = setTitle(c);
      const items = el.querySelectorAll('.sg-item');
      fillItem(items[0], c.green); if (c.pot) fillItem(items[1], c.pot);
      const ul = el.querySelector('.sg-why');
      (c.why.length ? c.why : ['色の主張が少なく、合わせやすい組み合わせです']).forEach((w) => { const li = document.createElement('li'); li.textContent = w; ul.appendChild(li); });
      el.querySelector('.sg-total b').textContent = yen(c.total);
      el.querySelector('.sg-btn').onclick = () => toast('試作なのでカートには追加していません。\nストアに組み込むと、' + (c.pot ? 'この2点をまとめて' : 'この商品を') + 'カートに追加します。');
      box.appendChild(el);
    }
    $('more-' + cls).hidden = !st.ranked.length;
    $('none-' + cls).hidden = !!st.ranked.length;
  }
  function labToHex(lab) {
    // Lab → sRGB(表示用)
    let y = (lab[0] + 16) / 116, x = lab[1] / 500 + y, z = y - lab[2] / 200;
    const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
    const g = (c) => 255 * (c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c);
    return rgbToHex([g(x * 3.2406 + y * -1.5372 + z * -0.4986), g(x * -0.9689 + y * 1.8758 + z * 0.0415), g(x * 0.0557 + y * -0.204 + z * 1.057)].map((v) => Math.min(255, Math.max(0, v))));
  }

  // ---- 写真の読み込みとピン ----
  function loadPhoto(src) {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 480 / Math.max(img.width, img.height));
      canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * s); canvas.height = Math.round(img.height * s);
      ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      $('photo').src = src; $('photoWrap').hidden = false; $('drop').classList.add('has-photo');
      pins = { wall: { x: 0.5, y: 0.15 }, floor: { x: 0.12, y: 0.95 } };
      placePins(); renderResult(readRoom());
    };
    img.src = src;
  }
  function placePins() {
    for (const k of ['wall', 'floor']) { const el = $('pin-' + k); el.style.left = pins[k].x * 100 + '%'; el.style.top = pins[k].y * 100 + '%'; }
  }
  function bindPins() {
    for (const k of ['wall', 'floor']) {
      const el = $('pin-' + k);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* なくても動く */ }
        const move = (ev) => {
          const r = $('photo').getBoundingClientRect();
          pins[k] = { x: Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width)), y: Math.min(0.98, Math.max(0.02, (ev.clientY - r.top) / r.height)) };
          placePins();
        };
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); renderResult(readRoom()); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
      });
    }
  }

  // ---- 見本の部屋(写真がなくても試せるように描く) ----
  const SAMPLES = [
    { name: '明るい木目の北欧', wall: '#efece6', floor: ['#c9a273', '#bf9665'], sofa: '#8c8f88', rug: '#e3dccf', extra: '#c0874f' },
    { name: 'グレーのモダン', wall: '#dcdcd9', floor: ['#8d8d8a', '#858582'], sofa: '#2f3033', rug: '#bdbdba', extra: '#f2f2f0' },
    { name: '濃い床のカフェ風', wall: '#e7e1d6', floor: ['#5a3d2b', '#523726'], sofa: '#9a6a43', rug: '#2e3a31', extra: '#1f1f1f' },
  ];
  function drawSample(s) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
    x.fillStyle = s.wall; x.fillRect(0, 0, 640, 330);
    for (let i = 0; i < 8; i++) { x.fillStyle = s.floor[i % 2]; x.fillRect(0, 330 + i * 19, 640, 19); }
    x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 322, 640, 8);
    x.fillStyle = s.rug; x.beginPath(); x.ellipse(330, 430, 210, 38, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = s.sofa; x.fillRect(150, 230, 340, 120); x.fillRect(130, 260, 40, 95); x.fillRect(470, 260, 40, 95);
    x.fillStyle = s.extra; x.fillRect(540, 250, 60, 90); x.fillRect(60, 90, 70, 90);
    return c.toDataURL('image/png');
  }

  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('is-show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-show'), 4500); }

  function init() {
    const sampleBox = $('samples');
    SAMPLES.forEach((s) => {
      const src = drawSample(s);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sg-sample';
      b.innerHTML = `<img alt=""><span></span>`; b.querySelector('img').src = src; b.querySelector('span').textContent = s.name;
      b.onclick = () => loadPhoto(src);
      sampleBox.appendChild(b);
    });
    $('file').onchange = () => { const f = $('file').files[0]; if (f) loadPhoto(URL.createObjectURL(f)); $('file').value = ''; };
    $('pick').onclick = () => $('file').click();
    const drop = $('drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) loadPhoto(URL.createObjectURL(f)); });
    for (const c of CLASSES) $('more-' + c.key).onclick = () => { renderSets(c.key); $('sec-' + c.key).scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    bindPins();
    const m = location.hash.match(/^#sample-(\d)$/); // 見本を開いた状態で見せる(案内用)
    if (m && SAMPLES[m[1] - 1]) loadPhoto(drawSample(SAMPLES[m[1] - 1]));
    window.__suggest = { readRoom: () => readRoom(), combos, pickSets, state }; // 確認用
  }
  init();
})();
