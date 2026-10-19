/* グリーンと鉢カバーの組み合わせ(草合体できて草)
   単独のページ(index.html + products.js)と、Shopifyのセクション(sections/greenpot.liquid)の両方で動く。
   <div class="gp" data-greenpot> の中に画面を組み立てる。データは次のどちらかから読む:
     - 中の <script type="application/json" data-gp-data>(Shopify)
     - window.GREENPOT_DATA(単独のページ) */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const ROOM_VIEW_CM = 260;   // 描いた部屋の背景で、画面の高さが何cm相当か
  const PHOTO_VIEW_CM = 250;  // 写真の背景の初期値
  const ROOMS = [
    { id: 'room-white', title: 'ホワイト', type: 'room', wall: '#f3f2ee', floor: '#d6c9b2', baseboard: '#ffffff' },
    { id: 'room-greige', title: 'グレージュ', type: 'room', wall: '#e4e0d8', floor: '#a8998a', baseboard: '#f0ede7' },
    { id: 'room-mortar', title: 'モルタル', type: 'room', wall: '#d9d9d6', floor: '#9c9c98', baseboard: '#cfcfcb' },
    { id: 'room-dark', title: 'ダーク', type: 'room', wall: '#4a4b47', floor: '#6b5847', baseboard: '#3d3e3a' },
  ];
  const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function template(o) {
    return `
<div class="gp-layout">
  <section class="gp-media" aria-label="組み合わせのプレビュー">
    <div class="gp-stage" data-gp="stage">
      <div class="gp-bg" data-gp="bg"></div>
      <svg class="gp-overlay" data-gp="under"></svg>
      <span class="gp-chip" data-gp="chip" hidden></span>
      <div class="gp-empty" data-gp="empty" hidden>グリーンか鉢カバーを選んでください</div>
    </div>
    <div class="gp-media-note"><span>プレビューをドラッグすると置く位置を動かせます</span><span data-gp="rulerNote"></span></div>
  </section>
  <section class="gp-info">
    <div class="gp-title">
      <h2>${esc(o.title)}</h2>
      ${o.lead ? `<p>${esc(o.lead)}</p>` : ''}
    </div>
    <div>
      <h3 class="gp-head"><span class="gp-en">GREEN</span><span class="gp-ja">グリーン</span><span class="gp-picked" data-gp="pickedGreen"></span></h3>
      <div class="gp-cards" data-gp="greenList"></div>
    </div>
    <div>
      <h3 class="gp-head"><span class="gp-en">POT</span><span class="gp-ja">鉢カバー</span><span class="gp-picked" data-gp="pickedPot"></span></h3>
      <div class="gp-cards" data-gp="potList"></div>
    </div>
    <div class="gp-fit" data-gp="fit" hidden></div>
    <div>
      <h3 class="gp-head"><span class="gp-en">ROOM</span><span class="gp-ja">背景</span></h3>
      <div class="gp-cards" data-gp="bgList"></div>
      <input type="file" data-gp="bgFile" accept="image/*" hidden>
      <div class="gp-place">
        <label>大きさ <input type="range" data-gp="scale" min="0.5" max="1.8" step="0.01" value="1"></label>
        <button type="button" class="gp-link" data-gp="resetPlace">位置を戻す</button>
      </div>
      <p class="gp-hint">お部屋の写真を使うときは、置きたい場所までドラッグし、周りの家具と見比べて「大きさ」を合わせてください。写真はこの端末の中だけで使い、どこにも送りません。</p>
    </div>
    <div class="gp-summary" data-gp="summary">
      <div data-gp="rows" class="gp-rows"></div>
      <div class="gp-total"><span>合計</span><b data-gp="sum">¥0</b></div>
    </div>
    <div class="gp-actions">
      <button type="button" class="gp-btn gp-btn-primary" data-gp="addCart" disabled>まとめてカートに追加する</button>
      <button type="button" class="gp-btn gp-btn-outline" data-gp="copyUrl">この組み合わせのURLをコピー</button>
    </div>
    ${o.showTools === false ? '' : `
    <details class="gp-tools" data-gp="toolsBox">
      <summary>素材の確認用(スタッフ向け)</summary>
      <div class="gp-tools-body">
        <div>
          <h3>位置の微調整</h3>
          <div class="gp-adjust">
            <span>上下</span><input type="range" data-gp="adjY" min="-15" max="15" step="0.5" value="0"><output data-gp="adjYv">0cm</output>
            <span>左右</span><input type="range" data-gp="adjX" min="-15" max="15" step="0.5" value="0"><output data-gp="adjXv">0cm</output>
          </div>
          <p class="gp-hint">選んでいるグリーンごとに、このブラウザに保存されます。上下はプラスで深く沈みます。決まった値は商品の「左右の補正」「上下の補正」に入れてください。<br>決まった値: <code data-gp="adjOut">—</code></p>
        </div>
        <div>
          <h3>手元の透過素材で試す</h3>
          <div class="gp-drop" data-gp="drop" data-kind="green">
            <div class="gp-r">
              <button class="gp-btn gp-btn-outline gp-btn-sm" data-gp="pickFile" type="button">画像を選ぶ</button>
              <span class="gp-file" data-gp="fileName">PNG / WebP / SVG をここかプレビューにドラッグしても追加できます</span>
              <input type="file" data-gp="fileInput" accept="image/png,image/webp,image/svg+xml" hidden>
            </div>
            <div class="gp-r">
              <label>種類<select data-gp="kind"><option value="green">グリーン</option><option value="pot">鉢カバー</option></select></label>
              <label>名前<input type="text" data-gp="tName" placeholder="例: 210cmの樹木"></label>
            </div>
            <div class="gp-r">
              <label>画像の高さ(cm)<input type="number" data-gp="tHeight" step="0.1" min="1" placeholder="210"></label>
              <label class="gp-green-only">内鉢の径(cm)<input type="number" data-gp="tNurseryW" step="0.1" placeholder="15.5"></label>
              <label class="gp-green-only">内鉢の高さ(cm)<input type="number" data-gp="tNurseryH" step="0.1" placeholder="14"></label>
              <label class="gp-pot-only">口径(cm)<input type="number" data-gp="tMouth" step="0.1" placeholder="26"></label>
              <label class="gp-pot-only">内底の径(cm)<input type="number" data-gp="tBottom" step="0.1" placeholder="17"></label>
            </div>
            <div class="gp-r"><label>価格(任意)<input type="number" data-gp="tPrice" step="1" placeholder="0"></label></div>
            <div><button class="gp-btn gp-btn-primary gp-btn-sm" data-gp="addBtn" type="button" disabled>一覧に追加</button></div>
            <p class="gp-hint" style="margin:0">鉢カバーは1枚(真横から撮影)でも、前面・背面の2枚組でも使えます。追加したものは再読み込みすると消えます。</p>
          </div>
        </div>
      </div>
    </details>`}
  </section>
</div>
<div class="gp-toast" data-gp="toast" role="status"></div>`;
  }

  function mount(root) {
    const jsonEl = root.querySelector('script[data-gp-data]');
    const data = jsonEl ? JSON.parse(jsonEl.textContent) : window.GREENPOT_DATA;
    if (!data) { root.textContent = '商品データが読み込めません'; return; }
    const o = Object.assign({ title: 'グリーンと鉢カバーの組み合わせ', lead: '', rooms: true, showTools: true, cart: null }, data.options || {});
    root.insertAdjacentHTML('beforeend', template(o));
    const $ = (name) => root.querySelector(`[data-gp="${name}"]`);

    // ---- 状態 ----
    const state = {
      greens: (data.greens || []).slice(), pots: (data.pots || []).slice(),
      backgrounds: [...(o.rooms ? ROOMS : []), ...(data.backgrounds || [])],
      greenId: null, potId: null, bgId: null,
      adjust: loadStore('greenpot-adjust'),
      place: {},
    };
    const imgCache = new Map();

    // ---- 画像の読み込みと解析 ----
    function loadImage(src) {
      if (imgCache.has(src)) return imgCache.get(src).promise;
      const entry = {};
      entry.promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          entry.img = img; entry.w = img.naturalWidth || 1; entry.h = img.naturalHeight || 1;
          try { entry.analysis = analyze(img); } catch { entry.analysis = null; } // 別ドメインの画像やfile://では解析できないことがある → 数値から計算
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
      const px = ctx.getImageData(0, 0, W, H).data;
      const rows = new Array(H);
      let top = -1, bottom = -1, maxW = 0, maxRowCenter = 0.5;
      for (let y = 0; y < H; y++) {
        let minX = -1, maxX = -1;
        for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 40) { if (minX < 0) minX = x; maxX = x; }
        rows[y] = minX < 0 ? null : [minX, maxX];
        if (minX >= 0) {
          if (top < 0) top = y; bottom = y;
          if (maxX - minX > maxW) { maxW = maxX - minX; maxRowCenter = (minX + maxX) / 2 / W; }
        }
      }
      if (top < 0) return null;
      const span = (y) => (rows[y] ? rows[y][1] - rows[y][0] : 0);
      // 内鉢の幅: 下端は底の丸みで細くなるので、下から4%の範囲でいちばん広い行を使う
      let baseW = 0, baseRow = rows[bottom];
      for (let y = bottom; y > bottom - Math.max(4, H * 0.04) && y >= 0; y--) if (span(y) > baseW) { baseW = span(y); baseRow = rows[y]; }
      // 下から上へ見て、幅が内鉢の6割を下回り続けた行 = 内鉢の上端(株元)。下から3割より上で見つかったものは信用しない
      let nurseryTop = null;
      for (let y = bottom; y > Math.max(top + 3, bottom - (bottom - top) * 0.3); y--) {
        if (span(y) < baseW * 0.6 && span(y - 1) < baseW * 0.6 && span(y - 2) < baseW * 0.6) { nurseryTop = y + 1; break; }
      }
      return { top: top / H, bottom: (bottom + 1) / H, baseCenterX: (baseRow[0] + baseRow[1]) / 2 / W, baseWidthRatio: baseW / H, nurseryTop: nurseryTop == null ? null : nurseryTop / H, centerX: maxRowCenter };
    }

    const findGreen = () => state.greens.find((g) => g.id === state.greenId) || null;
    const findPot = () => state.pots.find((p) => p.id === state.potId) || null;
    const findBg = () => state.backgrounds.find((b) => b.id === state.bgId) || null;

    function greenGeometry(g) {
      const a = imgCache.get(g.image)?.analysis;
      let baseY = a?.nurseryTop;
      if (baseY == null && g.nurseryHcm) baseY = 1 - g.nurseryHcm / g.heightCm;
      if (baseY == null) baseY = 0.93;
      return { baseY, centerX: a?.baseCenterX ?? 0.5, detectedNurseryW: a ? a.baseWidthRatio * g.heightCm : null };
    }
    function potGeometry(p) {
      const a = imgCache.get(p.imageFront)?.analysis;
      return { rimY: p.rimY ?? a?.top ?? 0, centerX: a?.centerX ?? 0.5, soilDepthCm: p.soilDepthCm ?? 3 };
    }

    // ---- 共有URL: #グリーン~鉢~背景(空=最初の候補、0=外す) ----
    const tok = (id, local) => (id == null ? '0' : local ? '' : encodeURIComponent(id));
    const shareToken = () => [tok(state.greenId, findGreen()?.local), tok(state.potId, findPot()?.local), tok(state.bgId, findBg()?.local)].join('~');
    function readToken() {
      const m = decodeURIComponent(location.hash.slice(1)).match(/^([^~]*)~([^~]*)(?:~([^~]*))?$/);
      if (!m) return null;
      const v = (s) => (s === undefined || s === '' ? undefined : s === '0' ? null : s);
      return { green: v(m[1]), pot: v(m[2]), bg: v(m[3]) };
    }
    function syncUrl() { try { history.replaceState(history.state, '', location.pathname + location.search + '#' + shareToken()); } catch { /* 書き換えられなくても動作は続ける */ } }

    // ---- 一覧 ----
    function card({ pressed, cls = '', ph, name, price, badge, onClick, onDelete }) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gp-card ' + cls;
      b.setAttribute('aria-pressed', String(!!pressed));
      b.innerHTML = `<div class="gp-ph">${ph}</div><div class="gp-nm"></div>${price != null ? '<div class="gp-pr"></div>' : ''}`;
      b.querySelector('.gp-nm').textContent = name;
      if (price != null) b.querySelector('.gp-pr').textContent = price;
      if (badge) { const s = document.createElement('span'); s.className = 'gp-badge ' + (badge.cls || ''); s.textContent = badge.text; b.appendChild(s); }
      if (onDelete) {
        const d = document.createElement('span');
        d.className = 'gp-del'; d.textContent = '×'; d.title = '一覧から削除'; d.setAttribute('role', 'button');
        d.onclick = (e) => { e.stopPropagation(); onDelete(); };
        b.appendChild(d);
      }
      b.onclick = onClick;
      return b;
    }

    function renderProductList(el, items, kind) {
      el.innerHTML = '';
      const selected = kind === 'green' ? state.greenId : state.potId;
      el.appendChild(card({ pressed: selected == null, cls: 'is-none', ph: '外す', name: kind === 'green' ? 'グリーンなし' : '鉢カバーなし', price: '', onClick: () => select(kind, null) }));
      for (const it of items) {
        const ph = kind === 'green' ? `<img src="${esc(it.image)}" alt="" loading="lazy">`
          : (it.imageBack ? `<img class="gp-stack" src="${esc(it.imageBack)}" alt=""><img class="gp-stack" src="${esc(it.imageFront)}" alt="">` : `<img src="${esc(it.imageFront)}" alt="" loading="lazy">`);
        const badge = it.local ? { text: '追加' } : it.available === false ? { text: '在庫切れ' } : (it.provisional?.length ? { text: '仮', cls: 'is-light' } : null);
        el.appendChild(card({
          pressed: selected === it.id, cls: it.available === false ? 'is-soldout' : '', ph, name: it.title, price: it.price ? yen(it.price) : '—', badge,
          onClick: () => select(kind, selected === it.id ? null : it.id), // 選択中をもう一度押すと外す
          onDelete: it.local ? () => removeLocal(kind, it.id) : null,
        }));
      }
    }

    function renderPicked(el, it) {
      // 見出し横の商品名は、商品ページへのリンクにする
      const a = document.createElement(it?.url ? 'a' : 'span');
      a.className = 'gp-picked'; a.textContent = it ? it.title : '選択なし';
      if (it?.url) { a.href = it.url; a.title = '商品ページを見る'; }
      el.replaceWith(a); a.setAttribute('data-gp', el.getAttribute('data-gp'));
    }

    function renderBgList() {
      const el = $('bgList');
      el.innerHTML = '';
      for (const b of state.backgrounds) {
        const ph = b.type === 'room' ? `<div class="gp-room" style="background:${roomGradient(b, 0.62, 0.66)}"></div>` : `<img src="${esc(b.image)}" alt="" loading="lazy">`;
        const c = card({ pressed: state.bgId === b.id, ph, name: b.title, badge: b.local ? { text: '写真' } : null, onClick: () => selectBg(b.id), onDelete: b.local ? () => removeBg(b.id) : null });
        if (b.type !== 'room') c.querySelector('.gp-ph').classList.add('gp-full');
        el.appendChild(c);
      }
      el.appendChild(card({ cls: 'is-add', ph: '+', name: 'お部屋の写真を使う', onClick: () => $('bgFile').click() }));
    }

    function renderLists() {
      renderProductList($('greenList'), state.greens, 'green');
      renderProductList($('potList'), state.pots, 'pot');
      renderBgList();
      renderPicked($('pickedGreen'), findGreen());
      renderPicked($('pickedPot'), findPot());
    }

    function roomGradient(b, horizon, floorStart) {
      const h = (horizon * 100).toFixed(1), f = (floorStart * 100).toFixed(1);
      return `linear-gradient(to bottom, ${b.wall} 0%, ${b.wall} ${h}%, ${b.baseboard} ${h}%, ${b.baseboard} ${f}%, ${b.floor} ${f}%, ${b.floor} 100%)`;
    }

    function select(kind, id) { if (kind === 'green') state.greenId = id; else state.potId = id; renderLists(); render(); syncUrl(); }
    function selectBg(id) { state.bgId = id; renderBgList(); render(); syncUrl(); }

    // ---- 置き場所 ----
    function currentPlace() {
      const b = findBg(); const key = b?.id ?? 'none';
      if (!state.place[key]) state.place[key] = { x: b?.x ?? 0.5, floorY: b?.floorY ?? 0.9, scale: 1 };
      return state.place[key];
    }
    function viewCm() {
      const b = findBg();
      const base = !b || b.type === 'room' ? ROOM_VIEW_CM : (b.viewCm || PHOTO_VIEW_CM);
      return base / currentPlace().scale;
    }

    // ---- 合成 ----
    let last = null;
    function render() {
      const stage = $('stage');
      stage.querySelectorAll('.gp-layer, .gp-soil').forEach((n) => n.remove());
      const under = $('under'); under.innerHTML = '';
      const g = findGreen(), p = findPot(), b = findBg();
      $('empty').hidden = !!(g || p);
      const W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      const place = currentPlace();
      const s = H / viewCm();
      const cx = place.x * W, floorY = place.floorY * H;

      const bgLayer = $('bg');
      if (!b || b.type === 'room') {
        bgLayer.innerHTML = ''; bgLayer.dataset.src = '';
        // 壁と床の境目は、置いた位置より少し奥に見えるように置き場所の上に描く
        const horizon = Math.min(0.86, Math.max(0.4, place.floorY - 0.14));
        bgLayer.style.background = b ? roomGradient(b, horizon, horizon + 0.012) : '';
      } else {
        bgLayer.style.background = '';
        if (bgLayer.dataset.src !== b.image) { bgLayer.innerHTML = `<img src="${esc(b.image)}" alt="">`; bgLayer.dataset.src = b.image; }
      }

      const showRuler = !b || b.type === 'room';
      $('rulerNote').textContent = showRuler ? '左の目盛りは10cmごと' : '';
      if (showRuler) drawRuler(under, floorY, s, b?.id === 'room-dark');

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
        img.className = 'gp-layer'; img.src = src; img.alt = '';
        Object.assign(img.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px', zIndex: z });
        stage.appendChild(img);
      }
      if (soil) {
        // 土の面(仮)。グリーンの株元を隠す
        const sv = document.createElementNS(NS, 'svg');
        sv.setAttribute('class', 'gp-overlay gp-soil'); sv.style.zIndex = 3;
        sv.innerHTML = `<defs><radialGradient id="gpSoil" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#6b5440"/><stop offset="1" stop-color="#3e3024"/></radialGradient></defs><ellipse cx="${soil.cx}" cy="${soil.cy}" rx="${soil.rx}" ry="${soil.ry}" fill="url(#gpSoil)"/>`;
        stage.appendChild(sv);
      }
      const chip = $('chip');
      chip.hidden = !(g || p);
      chip.textContent = `設置したときの高さ 約${Math.round((floorY - topMost) / s)}cm`;
      $('scale').value = place.scale;
      last = { W, H };
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
        if (major && cm > 0) { const t = document.createElementNS(NS, 'text'); Object.entries({ x: 4, y: y + 3.5, 'font-size': 9.5, fill: ink }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = cm; svg.appendChild(t); }
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
        if (nW > p.mouthCm) lines.push(`<span class="is-ng">入りません</span> 内鉢 約${nW.toFixed(1)}cm${est} が口径 ${p.mouthCm}cm より大きいです`);
        else if (p.innerBottomCm && nW > p.innerBottomCm) lines.push(`<span class="is-warn">底まで沈みません</span> 内鉢 約${nW.toFixed(1)}cm が内底 ${p.innerBottomCm}cm より大きく、途中で止まります`);
        else lines.push(`<span class="is-ok">入ります</span> 内鉢 約${nW.toFixed(1)}cm${est} / 口径 ${p.mouthCm}cm${p.innerBottomCm ? ` / 内底 ${p.innerBottomCm}cm` : ''}`);
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
        const d = document.createElement('div'); d.className = 'gp-row';
        const left = document.createElement('span');
        const lbl = document.createElement('span'); lbl.className = 'gp-lbl'; lbl.textContent = label;
        const name = document.createElement('span'); name.className = 'gp-name'; name.textContent = it.title;
        left.append(lbl, name);
        if (it.url) { const a = document.createElement('a'); a.className = 'gp-go'; a.href = it.url; a.textContent = '商品ページを見る ›'; left.append(a); }
        const right = document.createElement('span');
        const price = document.createElement('span'); price.className = 'gp-yen'; price.textContent = it.price ? yen(it.price) : '—';
        right.append(price);
        if (it.available === false) { const so = document.createElement('span'); so.className = 'gp-soldout'; so.textContent = '在庫切れ'; right.append(so); }
        d.append(left, right); rows.appendChild(d);
      }
      $('summary').hidden = !(g || p);
      $('sum').textContent = yen(sum);
      $('addCart').disabled = !cartItems().length;
      const soldOut = [g, p].some((it) => it && it.available === false);
      $('addCart').textContent = soldOut ? '在庫のある商品だけカートに追加する' : 'まとめてカートに追加する';
    }
    const cartItems = () => [findGreen(), findPot()].filter((it) => it?.variantId && it.available !== false).map((it) => ({ id: it.variantId, quantity: 1 }));

    async function addToCart() {
      const items = cartItems();
      if (!items.length) return;
      if (!o.cart) { toast('試作なのでカートには追加していません。\nストアに組み込むと、選んだ商品をまとめてカートに追加します。'); return; }
      const r = await fetch(o.cart.addUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
      if (r.ok) { location.href = o.cart.cartUrl; return; }
      let msg = ''; try { msg = (await r.json()).description || ''; } catch { /* 本文なし */ }
      toast('カートに追加できませんでした' + (msg ? ':\n' + msg : '(' + r.status + ')'));
    }

    // ---- 微調整 ----
    function loadStore(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
    function saveAdjust() { try { localStorage.setItem('greenpot-adjust', JSON.stringify(state.adjust)); } catch { /* 保存できなくても動作は続ける */ } }
    function renderAdjust(g) {
      if (!$('adjX')) return;
      const a = (g && state.adjust[g.id]) || { x: g?.offsetXcm || 0, y: g?.offsetYcm || 0 };
      $('adjX').value = a.x; $('adjY').value = a.y;
      $('adjX').disabled = $('adjY').disabled = !g;
      $('adjXv').textContent = a.x + 'cm'; $('adjYv').textContent = a.y + 'cm';
      $('adjOut').textContent = g ? `左右 ${a.x} / 上下 ${a.y}` : '—';
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
      const num = (n) => { const v = parseFloat($(n).value); return v > 0 ? v : undefined; };
      const base = { id: 'local-' + Date.now(), title: $('tName').value || pendingFile.name, price: num('tPrice') || 0, heightCm, local: true };
      try { await loadImage(url); } catch { toast('画像を読み込めませんでした'); return; }
      const a = imgCache.get(url).analysis;
      if (a && (a.top > 0.02 || a.bottom < 0.98)) toast('画像の上下に余白があります。上端〜下端がちょうど「画像の高さ」になるように切り抜くと正確になります');
      if (kind === 'green') { state.greens.push({ ...base, image: url, nurseryWcm: num('tNurseryW'), nurseryHcm: num('tNurseryH') }); state.greenId = base.id; }
      else { state.pots.push({ ...base, imageFront: url, mouthCm: num('tMouth'), innerBottomCm: num('tBottom'), soilDepthCm: 3 }); state.potId = base.id; }
      pendingFile = null; $('fileName').textContent = '続けて追加できます'; $('addBtn').disabled = true;
      for (const n of ['tName', 'tHeight', 'tNurseryW', 'tNurseryH', 'tMouth', 'tBottom', 'tPrice']) $(n).value = '';
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
      const id = 'photo-' + Date.now();
      state.backgrounds.push({ id, title: file.name.replace(/\.[^.]+$/, ''), type: 'photo', image: URL.createObjectURL(file), local: true });
      selectBg(id);
      toast('置きたい場所までドラッグし、「大きさ」で周りの家具と合わせてください');
    }
    function removeBg(id) {
      const i = state.backgrounds.findIndex((b) => b.id === id);
      if (i >= 0) state.backgrounds.splice(i, 1);
      if (state.bgId === id) state.bgId = state.backgrounds[0]?.id ?? null;
      renderBgList(); render(); syncUrl();
    }

    // ---- 画面操作 ----
    let toastTimer;
    function toast(msg) {
      const t = $('toast'); t.textContent = msg; t.classList.add('is-show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-show'), 5000);
    }

    function bindUi() {
      const stage = $('stage');
      let drag = null;
      stage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const pl = currentPlace();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: pl.x, y: pl.floorY };
        try { stage.setPointerCapture(e.pointerId); } catch { /* 捕捉できなくてもドラッグは続ける */ }
        stage.classList.add('is-dragging');
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id || !last) return;
        const pl = currentPlace();
        pl.x = Math.min(0.95, Math.max(0.05, drag.x + (e.clientX - drag.sx) / last.W));
        pl.floorY = Math.min(0.99, Math.max(0.3, drag.y + (e.clientY - drag.sy) / last.H));
        render();
      });
      const end = () => { drag = null; stage.classList.remove('is-dragging'); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

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
      stage.addEventListener('dragover', (e) => e.preventDefault());
      stage.addEventListener('drop', (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0]; if (!f) return;
        if (/^image\/(png|webp|svg\+xml)$/.test(f.type) && $('drop')) { $('toolsBox').open = true; setFile(f); $('drop').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else addBgPhoto(f);
      });

      if (!$('drop')) return; // スタッフ向けの欄を出さない設定
      for (const [n, key] of [['adjX', 'x'], ['adjY', 'y']]) {
        $(n).oninput = () => {
          const g = findGreen(); if (!g) return;
          const a = state.adjust[g.id] || { x: g.offsetXcm || 0, y: g.offsetYcm || 0 };
          a[key] = parseFloat($(n).value);
          state.adjust[g.id] = a; saveAdjust(); render();
        };
      }
      $('kind').onchange = () => { $('drop').dataset.kind = $('kind').value; };
      $('pickFile').onclick = () => $('fileInput').click();
      $('fileInput').onchange = () => { setFile($('fileInput').files[0]); $('fileInput').value = ''; };
      $('addBtn').onclick = () => addLocal();
      const drop = $('drop');
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); setFile(e.dataTransfer.files[0]); });
    }

    // ---- 開始 ----
    const t = readToken();
    const pick = (want, list) => (want === undefined ? list[0]?.id ?? null : want === null ? null : list.some((x) => x.id === want) ? want : list[0]?.id ?? null);
    state.greenId = pick(t?.green, state.greens);
    state.potId = pick(t?.pot, state.pots);
    state.bgId = pick(t?.bg, state.backgrounds);
    Promise.allSettled([
      ...state.greens.map((g) => loadImage(g.image)),
      ...state.pots.flatMap((p) => [p.imageFront, p.imageBack].filter(Boolean).map(loadImage)),
    ]).then(() => {
      renderLists(); render(); bindUi();
      new ResizeObserver(() => render()).observe($('stage'));
      root.greenpot = { state, greenGeometry, render }; // 確認用
    });
  }

  function boot() { document.querySelectorAll('[data-greenpot]').forEach((root) => { if (!root.dataset.gpMounted) { root.dataset.gpMounted = '1'; mount(root); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot); // テーマのカスタマイズ画面で編集したとき
})();
