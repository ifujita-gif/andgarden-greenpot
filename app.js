'use strict';

// ---- 状態 ----
const state = {
  greens: [], pots: [], backgrounds: [],
  greenId: null, potId: null, bgId: null,
  adjust: loadStore('greenpot-adjust'),
  place: {}, // 背景ごとの置き場所 { x, floorY, scale }
};
const imgCache = new Map(); // src -> { img, w, h, analysis }
const $ = (id) => document.getElementById(id);
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const NS = 'http://www.w3.org/2000/svg';
const ROOM_VIEW_CM = 260;   // 描いた部屋の背景で、画面の高さが何cm相当か
const PHOTO_VIEW_CM = 250;  // 写真の背景の初期値

// ---- 画像の読み込みと解析 ----
function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src).promise;
  const entry = {};
  entry.promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      entry.img = img; entry.w = img.naturalWidth || 1; entry.h = img.naturalHeight || 1;
      try { entry.analysis = analyze(img); } catch { entry.analysis = null; } // file:// で開くと解析できないことがある → 数値から計算
      resolve(entry);
    };
    img.onerror = () => reject(new Error('画像を読み込めません: ' + src));
    img.src = src;
  });
  imgCache.set(src, entry);
  return entry.promise;
}

// 透過部分から各行の不透明な範囲を調べ、内鉢の位置(株元)と幹の中心を求める
function analyze(img) {
  const H = Math.min(800, img.naturalHeight || 800);
  const W = Math.max(1, Math.round((img.naturalWidth / img.naturalHeight) * H));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const rows = new Array(H);
  let top = -1, bottom = -1, maxW = 0, maxRowCenter = 0.5;
  for (let y = 0; y < H; y++) {
    let minX = -1, maxX = -1;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { if (minX < 0) minX = x; maxX = x; }
    rows[y] = minX < 0 ? null : [minX, maxX];
    if (minX >= 0) {
      if (top < 0) top = y; bottom = y;
      if (maxX - minX > maxW) { maxW = maxX - minX; maxRowCenter = (minX + maxX) / 2 / W; }
    }
  }
  if (top < 0) return null;
  const span = (y) => (rows[y] ? rows[y][1] - rows[y][0] : 0);
  // 内鉢の幅: 下端は底の丸みで細くなるので、下から4%の範囲でいちばん広い行を使う
  let baseW = 0, baseRow = null;
  for (let y = bottom; y > bottom - Math.max(4, H * 0.04) && y >= 0; y--) if (span(y) > baseW) { baseW = span(y); baseRow = rows[y]; }
  const baseCenter = (baseRow[0] + baseRow[1]) / 2 / W;
  // 下から上へ見て、幅が内鉢の6割を下回り続けた行 = 内鉢の上端(株元)。下から3割より上で見つかったものは信用しない
  let nurseryTop = null;
  for (let y = bottom; y > Math.max(top + 3, bottom - (bottom - top) * 0.3); y--) {
    if (span(y) < baseW * 0.6 && span(y - 1) < baseW * 0.6 && span(y - 2) < baseW * 0.6) { nurseryTop = y + 1; break; }
  }
  return { top: top / H, bottom: (bottom + 1) / H, baseCenterX: baseCenter, baseWidthRatio: baseW / H, nurseryTop: nurseryTop == null ? null : nurseryTop / H, centerX: maxRowCenter };
}

// ---- 初期化 ----
async function init() {
  const data = window.GREENPOT_DATA;
  if (!data) throw new Error('products.js が読み込めません');
  state.greens = data.greens.slice(); state.pots = data.pots.slice(); state.backgrounds = (data.backgrounds || []).slice();
  const t = readToken();
  state.greenId = t ? t.green : state.greens[0]?.id ?? null;
  state.potId = t ? t.pot : state.pots[0]?.id ?? null;
  state.bgId = (t && t.bg && state.backgrounds.some((b) => b.id === t.bg)) ? t.bg : state.backgrounds[0]?.id ?? null;
  if (state.greenId && !findGreen()) state.greenId = null;
  if (state.potId && !findPot()) state.potId = null;
  await Promise.allSettled([
    ...state.greens.map((g) => loadImage(g.image)),
    ...state.pots.flatMap((p) => [p.imageFront, p.imageBack].filter(Boolean).map(loadImage)),
  ]);
  renderLists(); render(); bindUi();
  new ResizeObserver(() => render()).observe($('stage'));
}

const findGreen = () => state.greens.find((g) => g.id === state.greenId) || null;
const findPot = () => state.pots.find((p) => p.id === state.potId) || null;
const findBg = () => state.backgrounds.find((b) => b.id === state.bgId) || null;

function greenGeometry(g) {
  const a = imgCache.get(g.image)?.analysis;
  let baseY = a?.nurseryTop;
  if (baseY == null && g.nurseryHcm) baseY = 1 - g.nurseryHcm / g.heightCm;
  if (baseY == null) baseY = 0.93;
  return { baseY, centerX: a?.baseCenterX ?? 0.5, detectedNurseryW: a ? a.baseWidthRatio * g.heightCm : null, detectedNurseryH: (1 - baseY) * g.heightCm };
}
function potGeometry(p) {
  const a = imgCache.get(p.imageFront)?.analysis;
  return { rimY: p.rimY ?? a?.top ?? 0, centerX: a?.centerX ?? 0.5, soilDepthCm: p.soilDepthCm ?? 3 };
}

// ---- 共有URL(#グリーンID~鉢ID~背景ID、外したものは 0) ----
const shareToken = () => [state.greenId ?? '0', state.potId ?? '0', findBg()?.local ? '0' : state.bgId ?? '0'].join('~');
function readToken() {
  const m = location.hash.match(/^#([\w.-]+)~([\w.-]+)(?:~([\w.-]+))?$/);
  if (!m) return null;
  const v = (s) => (!s || s === '0' ? null : s);
  return { green: v(m[1]), pot: v(m[2]), bg: v(m[3]) };
}
function syncUrl() { try { history.replaceState(null, '', location.pathname + location.search + '#' + shareToken()); } catch { /* 書き換えられなくても動作は続ける */ } }

// ---- 一覧 ----
function renderLists() {
  renderProductList($('greenList'), state.greens, 'green');
  renderProductList($('potList'), state.pots, 'pot');
  renderBgList();
  $('pickedGreen').textContent = findGreen()?.title ?? '選択なし';
  $('pickedPot').textContent = findPot()?.title ?? '選択なし';
}

function card({ pressed, cls = '', ph, name, price, badge, onClick, onDelete }) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'card ' + cls;
  b.setAttribute('aria-pressed', String(!!pressed));
  b.innerHTML = `<div class="ph">${ph}</div><div class="nm"></div>${price != null ? '<div class="pr"></div>' : ''}`;
  b.querySelector('.nm').textContent = name;
  if (price != null) b.querySelector('.pr').textContent = price;
  if (badge) { const s = document.createElement('span'); s.className = 'badge ' + (badge.cls || ''); s.textContent = badge.text; b.appendChild(s); }
  if (onDelete) {
    const d = document.createElement('span');
    d.className = 'del'; d.textContent = '×'; d.title = '一覧から削除'; d.setAttribute('role', 'button');
    d.onclick = (e) => { e.stopPropagation(); onDelete(); };
    b.appendChild(d);
  }
  b.onclick = onClick;
  return b;
}

function renderProductList(el, items, kind) {
  el.innerHTML = '';
  const selected = kind === 'green' ? state.greenId : state.potId;
  el.appendChild(card({ pressed: selected == null, cls: 'none', ph: '外す', name: kind === 'green' ? 'グリーンなし' : '鉢カバーなし', price: '', onClick: () => select(kind, null) }));
  for (const it of items) {
    const ph = kind === 'green' ? `<img src="${it.image}" alt="">`
      : (it.imageBack ? `<img class="stack" src="${it.imageBack}" alt=""><img class="stack" src="${it.imageFront}" alt="">` : `<img src="${it.imageFront}" alt="">`);
    const badge = it.local ? { text: '追加' } : (it.provisional?.length ? { text: '仮', cls: 'temp' } : null);
    el.appendChild(card({
      pressed: selected === it.id, ph, name: it.title, price: it.price ? yen(it.price) : '—', badge,
      onClick: () => select(kind, selected === it.id ? null : it.id), // 選択中をもう一度押すと外す
      onDelete: it.local ? () => removeLocal(kind, it.id) : null,
    }));
  }
}

function renderBgList() {
  const el = $('bgList');
  el.innerHTML = '';
  for (const b of state.backgrounds) {
    const ph = b.type === 'room'
      ? `<div class="room-swatch" style="background:${roomGradient(b, 0.62, 0.66)}"></div>`
      : `<img src="${b.image}" alt="">`;
    const c = card({ pressed: state.bgId === b.id, ph, name: b.title, badge: b.local ? { text: '写真' } : null, onClick: () => selectBg(b.id), onDelete: b.local ? () => removeBg(b.id) : null });
    if (b.type !== 'room') c.querySelector('.ph').classList.add('full');
    el.appendChild(c);
  }
  el.appendChild(card({ cls: 'add', ph: '+', name: 'お部屋の写真を使う', onClick: () => $('bgFile').click() }));
}

function roomGradient(b, horizon, floorStart) {
  const h = (horizon * 100).toFixed(1), f = (floorStart * 100).toFixed(1);
  return `linear-gradient(to bottom, ${b.wall} 0%, ${b.wall} ${h}%, ${b.baseboard} ${h}%, ${b.baseboard} ${f}%, ${b.floor} ${f}%, ${b.floor} 100%)`;
}

function select(kind, id) {
  if (kind === 'green') state.greenId = id; else state.potId = id;
  renderLists(); render(); syncUrl();
}
function selectBg(id) { state.bgId = id; renderBgList(); render(); syncUrl(); }

// ---- 置き場所 ----
function currentPlace() {
  const b = findBg();
  const key = b?.id ?? 'none';
  if (!state.place[key]) state.place[key] = { x: b?.x ?? 0.5, floorY: b?.floorY ?? 0.9, scale: 1 };
  return state.place[key];
}
function viewCm() {
  const b = findBg();
  const base = !b || b.type === 'room' ? ROOM_VIEW_CM : (b.viewCm ?? PHOTO_VIEW_CM);
  return base / currentPlace().scale;
}

// ---- 合成 ----
let lastRender = null;
function render() {
  const stage = $('stage');
  stage.querySelectorAll('img.layer, svg.soil').forEach((n) => n.remove());
  const under = $('under'); under.innerHTML = '';
  const g = findGreen(), p = findPot(), b = findBg();
  $('empty').hidden = !!(g || p);

  const W = stage.clientWidth, H = stage.clientHeight;
  const place = currentPlace();
  const s = H / viewCm();                // px / cm
  const cx = place.x * W, floorY = place.floorY * H;

  // 背景
  const bgLayer = $('bgLayer');
  if (!b) { bgLayer.innerHTML = ''; bgLayer.style.background = ''; }
  else if (b.type === 'room') {
    // 壁と床の境目は、置いた位置より少し奥に見えるように置き場所の上に描く
    const horizon = Math.min(0.86, Math.max(0.4, place.floorY - 0.14));
    bgLayer.innerHTML = ''; bgLayer.style.background = roomGradient(b, horizon, horizon + 0.012);
  } else {
    bgLayer.style.background = '';
    if (bgLayer.dataset.src !== b.image) { bgLayer.innerHTML = `<img src="${b.image}" alt="">`; bgLayer.dataset.src = b.image; }
  }
  if (!b || b.type === 'room') bgLayer.dataset.src = '';

  // 物差し(描いた部屋の背景のときだけ)
  const showRuler = !b || b.type === 'room';
  $('rulerNote').textContent = showRuler ? '左の目盛りは10cmごと' : '';
  if (showRuler) drawRuler(under, floorY, s, b?.type === 'room' && /dark/.test(b.id));

  const layers = [];
  let topMost = floorY, potBox = null, soil = null;

  if (p) {
    const e = imgCache.get(p.imageFront);
    if (e?.img) {
      const geo = potGeometry(p);
      const h = p.heightCm * s, w = h * (e.w / e.h);
      const left = cx - geo.centerX * w, top = floorY - h;
      potBox = { top, h, geo };
      if (p.imageBack) layers.push([p.imageBack, left, top, w, h, 1]);
      layers.push([p.imageFront, left, top, w, h, 4]);
      topMost = Math.min(topMost, top);
      shadow(under, cx, floorY, w * 0.55, Math.max(3, w * 0.07));
      if (p.imageBack && p.mouthCm) {
        const rx = (p.mouthCm / 2 - 0.3) * s;
        soil = { cx, cy: top + geo.rimY * h + geo.soilDepthCm * s, rx, ry: rx * (p.ellipseRatio ?? 0.16) };
      }
    }
  }
  if (g) {
    const e = imgCache.get(g.image);
    if (e?.img) {
      const geo = greenGeometry(g);
      const adj = state.adjust[g.id] || { x: g.offsetXcm || 0, y: g.offsetYcm || 0 };
      const h = g.heightCm * s, w = h * (e.w / e.h);
      let left, top;
      if (potBox) {
        const soilY = potBox.top + potBox.geo.rimY * potBox.h + potBox.geo.soilDepthCm * s;
        left = cx - geo.centerX * w + adj.x * s;
        top = soilY - geo.baseY * h + adj.y * s;
      } else {
        left = cx - geo.centerX * w; top = floorY - h;
        shadow(under, cx, floorY, Math.max(14, (g.nurseryWcm ?? geo.detectedNurseryW ?? 18) * s * 0.7), 4);
      }
      layers.push([g.image, left, top, w, h, 2]);
      topMost = Math.min(topMost, top);
    }
  }
  for (const [src, left, top, w, h, z] of layers) {
    const img = document.createElement('img');
    img.className = 'layer'; img.src = src; img.alt = '';
    Object.assign(img.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px', zIndex: z });
    stage.appendChild(img);
  }
  if (soil) {
    // 土の面(仮)。グリーンの株元を隠す。本番はマルチング素材の画像に置き換えられる
    const sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('class', 'overlay soil'); sv.style.zIndex = 3;
    sv.innerHTML = `<defs><radialGradient id="soilG" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#6b5440"/><stop offset="1" stop-color="#3e3024"/></radialGradient></defs><ellipse cx="${soil.cx}" cy="${soil.cy}" rx="${soil.rx}" ry="${soil.ry}" fill="url(#soilG)"/>`;
    stage.appendChild(sv);
  }

  const chip = $('heightChip');
  chip.hidden = !(g || p);
  chip.textContent = `設置したときの高さ 約${Math.round((floorY - topMost) / s)}cm`;
  $('scale').value = place.scale;
  lastRender = { W, H };
  renderFit(g, p); renderTotal(g, p); renderAdjust(g);
}

function drawRuler(svg, floorY, s, dark) {
  const ink = dark ? 'rgba(255,255,255,.6)' : 'rgba(18,18,18,.45)';
  const x = 26;
  const line = (x1, y1, x2, y2, w) => { const l = document.createElementNS(NS, 'line'); Object.entries({ x1, y1, x2, y2, stroke: ink, 'stroke-width': w }).forEach(([k, v]) => l.setAttribute(k, v)); svg.appendChild(l); };
  let maxCm = 0;
  for (let cm = 0; floorY - cm * s > 8; cm += 10) {
    const y = floorY - cm * s, major = cm % 50 === 0;
    line(x - (major ? 10 : 5), y, x, y, major ? 1.1 : 0.8);
    if (major && cm > 0) { const t = document.createElementNS(NS, 'text'); Object.entries({ x: 4, y: y + 3.5, 'font-size': 9.5, fill: ink, 'font-family': 'Josefin Sans, sans-serif' }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = cm; svg.appendChild(t); }
    maxCm = cm;
  }
  line(x, floorY, x, floorY - maxCm * s, 0.8);
}

function shadow(svg, cx, cy, rx, ry) {
  const e = document.createElementNS(NS, 'ellipse');
  Object.entries({ cx, cy, rx, ry, fill: 'rgba(0,0,0,.2)' }).forEach(([k, v]) => e.setAttribute(k, v));
  e.style.filter = 'blur(3px)';
  svg.appendChild(e);
}

// ---- サイズの相性 ----
function renderFit(g, p) {
  const el = $('fit');
  if (!g || !p) { el.hidden = true; return; }
  const geo = greenGeometry(g);
  const nW = g.nurseryWcm ?? geo.detectedNurseryW;
  const est = g.nurseryWcm ? '' : '(画像から推定)';
  const lines = [];
  if (p.mouthCm && nW) {
    if (nW > p.mouthCm) lines.push(`<span class="ng">入りません</span> 内鉢 約${nW.toFixed(1)}cm${est} が口径 ${p.mouthCm}cm より大きいです`);
    else if (p.innerBottomCm && nW > p.innerBottomCm) lines.push(`<span class="warn">底まで沈みません</span> 内鉢 約${nW.toFixed(1)}cm が内底 ${p.innerBottomCm}cm より大きく、途中で止まります`);
    else lines.push(`<span class="ok">入ります</span> 内鉢 約${nW.toFixed(1)}cm${est} / 口径 ${p.mouthCm}cm${p.innerBottomCm ? ` / 内底 ${p.innerBottomCm}cm` : ''}`);
    const gap = p.mouthCm - nW;
    if (gap > 8 && nW <= p.mouthCm) lines.push(`すき間が約${gap.toFixed(0)}cmあるので、マルチングで隠すのがおすすめです`);
  }
  if (!lines.length) { el.hidden = true; return; }
  el.innerHTML = lines.join('<br>');
  el.hidden = false;
}

// ---- 合計とカート ----
function renderTotal(g, p) {
  const rows = $('rows'); rows.innerHTML = '';
  let sum = 0;
  for (const [label, it] of [['グリーン', g], ['鉢カバー', p]]) {
    if (!it) continue;
    sum += it.price || 0;
    const d = document.createElement('div'); d.className = 'row';
    const left = document.createElement('span');
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = label;
    const name = document.createElement(it.url ? 'a' : 'span');
    if (it.url) { name.href = it.url; name.target = '_blank'; name.rel = 'noopener'; }
    name.textContent = it.title;
    left.append(lbl, name);
    const price = document.createElement('span'); price.className = 'yen'; price.textContent = it.price ? yen(it.price) : '—';
    d.append(left, price); rows.appendChild(d);
  }
  $('summary').hidden = !(g || p);
  $('sum').textContent = yen(sum);
  $('addCart').disabled = !(g?.variantId || p?.variantId);
}

async function addToCart() {
  const items = [findGreen(), findPot()].filter((it) => it?.variantId).map((it) => ({ id: it.variantId, quantity: 1 }));
  if (!items.length) return;
  if (window.Shopify && window.Shopify.shop) { // ストアに埋め込んだときだけ実際にカートへ入れる
    const r = await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    if (r.ok) location.href = '/cart'; else toast('カートに追加できませんでした(' + r.status + ')');
    return;
  }
  toast('試作なのでカートには追加していません。\nストアに埋め込むと、選んだ商品をまとめてカートに追加します。');
}

// ---- 微調整 ----
function loadStore(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function saveAdjust() { try { localStorage.setItem('greenpot-adjust', JSON.stringify(state.adjust)); } catch { /* 保存できなくても動作は続ける */ } }
function renderAdjust(g) {
  const a = (g && state.adjust[g.id]) || { x: g?.offsetXcm || 0, y: g?.offsetYcm || 0 };
  $('adjX').value = a.x; $('adjY').value = a.y;
  $('adjX').disabled = $('adjY').disabled = !g;
  $('adjXv').textContent = a.x + 'cm'; $('adjYv').textContent = a.y + 'cm';
  $('adjOut').textContent = g ? JSON.stringify({ offsetXcm: a.x, offsetYcm: a.y }) : '—';
}

// ---- 手元の素材を追加 ----
let pendingFile = null;
function setFile(file) {
  if (!file || !/^image\/(png|webp|svg\+xml)$/.test(file.type)) { toast('透過PNG・WebP・SVGの画像を選んでください'); return; }
  pendingFile = file;
  $('fileName').textContent = file.name;
  if (!$('tName').value) $('tName').value = file.name.replace(/\.[^.]+$/, '');
  $('addBtn').disabled = false;
}
async function addLocal() {
  if (!pendingFile) return;
  const kind = $('kind').value;
  const heightCm = parseFloat($('tHeight').value);
  if (!(heightCm > 0)) { toast('画像の高さ(cm)を入れてください'); return; }
  const url = URL.createObjectURL(pendingFile);
  const num = (id) => { const v = parseFloat($(id).value); return v > 0 ? v : undefined; };
  const base = { id: 'local-' + Date.now(), title: $('tName').value || pendingFile.name, price: num('tPrice') || 0, heightCm, local: true };
  try { await loadImage(url); } catch { toast('画像を読み込めませんでした'); return; }
  const a = imgCache.get(url).analysis;
  if (a && (a.top > 0.02 || a.bottom < 0.98)) toast('画像の上下に余白があります。上端〜下端がちょうど「画像の高さ」になるように切り抜くと正確になります');
  if (kind === 'green') { state.greens.push({ ...base, image: url, nurseryWcm: num('tNurseryW'), nurseryHcm: num('tNurseryH') }); state.greenId = base.id; }
  else { state.pots.push({ ...base, imageFront: url, mouthCm: num('tMouth'), innerBottomCm: num('tBottom'), soilDepthCm: 3 }); state.potId = base.id; }
  pendingFile = null; $('fileName').textContent = '続けて追加できます'; $('addBtn').disabled = true;
  for (const id of ['tName', 'tHeight', 'tNurseryW', 'tNurseryH', 'tMouth', 'tBottom', 'tPrice']) $(id).value = '';
  renderLists(); render(); syncUrl();
}
function removeLocal(kind, id) {
  const list = kind === 'green' ? state.greens : state.pots;
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list.splice(i, 1);
  if (kind === 'green' && state.greenId === id) state.greenId = null;
  if (kind === 'pot' && state.potId === id) state.potId = null;
  renderLists(); render(); syncUrl();
}

// ---- 背景写真 ----
function addBgPhoto(file) {
  if (!file || !/^image\//.test(file.type)) { toast('画像ファイルを選んでください'); return; }
  const url = URL.createObjectURL(file);
  const id = 'photo-' + Date.now();
  state.backgrounds.push({ id, title: file.name.replace(/\.[^.]+$/, ''), type: 'photo', image: url, local: true });
  selectBg(id);
  toast('置きたい場所までドラッグし、「大きさ」で周りの家具と合わせてください');
}
function removeBg(id) {
  const i = state.backgrounds.findIndex((b) => b.id === id);
  if (i >= 0) state.backgrounds.splice(i, 1);
  if (state.bgId === id) state.bgId = state.backgrounds[0]?.id ?? null;
  renderBgList(); render(); syncUrl();
}

// ---- ドラッグで置き場所を動かす ----
function bindDrag() {
  const stage = $('stage');
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const pl = currentPlace();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: pl.x, y: pl.floorY };
    stage.setPointerCapture(e.pointerId); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !lastRender) return;
    const pl = currentPlace();
    pl.x = Math.min(0.95, Math.max(0.05, drag.x + (e.clientX - drag.sx) / lastRender.W));
    pl.floorY = Math.min(0.99, Math.max(0.3, drag.y + (e.clientY - drag.sy) / lastRender.H));
    render();
  });
  const end = () => { drag = null; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
}

// ---- 画面操作 ----
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

function bindUi() {
  bindDrag();
  $('addCart').onclick = () => addToCart().catch((e) => toast('エラー: ' + e.message));
  $('copyUrl').onclick = async () => {
    const url = location.href.split('#')[0] + '#' + shareToken();
    const local = [findGreen(), findPot(), findBg()].some((x) => x?.local);
    try { await navigator.clipboard.writeText(url); toast(local ? 'URLをコピーしました(手元で追加した画像や写真はURLでは共有されません)' : 'URLをコピーしました'); }
    catch { toast('コピーできませんでした:\n' + url); }
  };
  $('scale').oninput = () => { currentPlace().scale = parseFloat($('scale').value); render(); };
  $('resetPlace').onclick = () => { delete state.place[findBg()?.id ?? 'none']; render(); };
  $('bgFile').onchange = () => { addBgPhoto($('bgFile').files[0]); $('bgFile').value = ''; };
  for (const [id, key] of [['adjX', 'x'], ['adjY', 'y']]) {
    $(id).oninput = () => {
      const g = findGreen(); if (!g) return;
      const a = state.adjust[g.id] || { x: g.offsetXcm || 0, y: g.offsetYcm || 0 };
      a[key] = parseFloat($(id).value);
      state.adjust[g.id] = a; saveAdjust(); render();
    };
  }
  $('kind').onchange = () => { $('drop').dataset.kind = $('kind').value; };
  $('pickFile').onclick = () => $('fileInput').click();
  $('fileInput').onchange = () => { setFile($('fileInput').files[0]); $('fileInput').value = ''; };
  $('addBtn').onclick = () => addLocal();
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); });
  // プレビューに落とした画像: 透過素材なら素材として、それ以外(JPEGなど)は背景写真として使う
  const stage = $('stage');
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (/^image\/(png|webp|svg\+xml)$/.test(f.type)) { $('toolsBox').open = true; setFile(f); $('drop').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else addBgPhoto(f);
  });
}

init().catch((e) => { $('empty').hidden = false; $('empty').textContent = '読み込みに失敗しました: ' + e.message; });
