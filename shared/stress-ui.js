// 💢ボタン（いちばん外のページで動く）。押すと画面が止まって赤ペンが出る→「送る」で絵・赤ペン・直前15秒の操作をまとめて残す。
// claude.ai のリンクで開いてる時は db の stress に入る（くー君が読める）。それ以外はこの端末に置いとく。
(function () {
  if (window.__stressUI) return; window.__stressUI = true;
  const TAGS = ['遅い・重い', '狙った所に行かん', '見えん・隠れる', '何が起きたか分からん', '手順が多い', '思った動きと違う'];
  const css = `
#__stressBtn{position:fixed;z-index:9998;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.88);box-shadow:0 2px 10px rgba(0,0,0,.18);font-size:22px;line-height:44px;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer;padding:0}
#__stressBtn:active{transform:scale(.92)}
#__stressUI{position:fixed;inset:0;z-index:9999;background:#111;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Hiragino Sans","Zen Kaku Gothic New",sans-serif}
#__stressUI img,#__stressUI canvas{position:absolute;inset:0;width:100%;height:100%}
#__stressUI img{object-fit:contain}
#__stressUI .bar{position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;background:rgba(250,247,241,.95);border-radius:16px;padding:8px;box-shadow:0 4px 18px rgba(0,0,0,.3);max-width:calc(100vw - 24px);box-sizing:border-box}
#__stressUI .bar button{font:inherit;font-weight:800;font-size:13px;border:1.5px solid #cfc7b8;background:#fff;color:#2b2a27;border-radius:99px;padding:8px 12px;cursor:pointer}
#__stressUI .bar button.on{background:#e23b2e;border-color:#e23b2e;color:#fff}
#__stressUI .bar .send{background:#2b2a27;color:#fff;border-color:#2b2a27;padding:8px 18px}
#__stressUI .bar .sep{width:1px;align-self:stretch;background:#cfc7b8}
#__stressUI .hint{position:absolute;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);background:rgba(226,59,46,.95);color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:99px;white-space:nowrap;pointer-events:none}
#__stressToast{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:10000;background:#2b2a27;color:#fff;font:800 13px "Hiragino Sans",sans-serif;padding:9px 16px;border-radius:99px;opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const toastEl = document.createElement('div'); toastEl.id = '__stressToast'; document.body.appendChild(toastEl);
  let tt = 0; const toast = s => { toastEl.textContent = s; toastEl.style.opacity = 1; clearTimeout(tt); tt = setTimeout(() => toastEl.style.opacity = 0, 2600); };
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (_) { return null; } };
  // ---- ボタン（ドラッグで好きな所へ。場所は覚える） ----
  const btn = document.createElement('button'); btn.id = '__stressBtn'; btn.textContent = '💢'; btn.title = 'ストレス！（F2）'; document.body.appendChild(btn);
  const place = p => { const x = Math.max(4, Math.min(innerWidth - 48, p.x)), y = Math.max(4, Math.min(innerHeight - 48, p.y)); btn.style.left = x + 'px'; btn.style.top = y + 'px'; };
  let pos = LS('stress_btn_pos') || { fx: 1, fy: 0.3 }; const applyPos = () => place({ x: pos.fx * (innerWidth - 52), y: pos.fy * (innerHeight - 52) }); applyPos(); addEventListener('resize', applyPos);
  let drag = null;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: btn.offsetLeft, by: btn.offsetTop, moved: false }; try { btn.setPointerCapture(e.pointerId); } catch (_) {} });
  btn.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 8) drag.moved = true; if (drag.moved) place({ x: drag.bx + dx, y: drag.by + dy }); });
  btn.addEventListener('pointerup', e => { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (d.moved) { pos = { fx: btn.offsetLeft / Math.max(1, innerWidth - 52), fy: btn.offsetTop / Math.max(1, innerHeight - 52) }; LS('stress_btn_pos', pos); } else open(); });
  addEventListener('keydown', e => { if (e.key === 'F2' || e.key === '\\') { e.preventDefault(); open(); } });
  // ---- どのページの絵を取るか：工房と狩り場が入ってる外枠なら、今見えてる方 ----
  function target() { const fr = [...document.querySelectorAll('iframe')].filter(f => getComputedStyle(f).display !== 'none'); for (const f of fr) { try { if (f.contentWindow.__stressGrab) return f.contentWindow; } catch (_) {} } return window.__stressGrab ? window : null; }
  let db = null; (async () => { try { const C = window.claude; if (C && C.use) db = await C.use('db'); } catch (_) { db = null; } })();
  let busy = false;
  async function open() {
    if (busy || document.getElementById('__stressUI')) return; busy = true; const tw = target();
    if (!tw) { busy = false; toast('この画面は記録できへん'); return; }
    try { tw.__paused = true; tw.__clearMovementInput && tw.__clearMovementInput(); } catch (_) {}
    let quick = null; try { quick = tw.__stressQuick ? tw.__stressQuick() : null; } catch (_) {}
    const full = new Promise(r => setTimeout(r, 60)).then(async () => { btn.style.visibility = 'hidden'; try { return await tw.__stressGrab(); } catch (_) { return null; } finally { btn.style.visibility = ''; } }); /* 先に赤ペン画面を出してから、裏で全体の絵を取る */
    busy = false; sheet(quick, full, tw); /* 赤ペンはすぐ描ける。ボタン類込みの絵は後から差し替え */
  }
  window.__stressOpen = open;
  // ---- 止めた画面＋赤ペン ----
  function sheet(quick, fullP, tw) { let g = null;
    const ui = document.createElement('div'); ui.id = '__stressUI';
    ui.innerHTML = '<img alt=""><canvas></canvas><div class="hint">💢 気になる所に赤ペンで印（描かんでもOK）</div><div class="bar"></div>';
    document.body.appendChild(ui); const img = ui.querySelector('img'), cv = ui.querySelector('canvas'), bar = ui.querySelector('.bar');
    if (quick) img.src = quick;
    ui.addEventListener('touchstart', e => { if (e.target === cv) e.preventDefault(); }, { passive: false }); ui.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, { passive: false }); /* iPadの手書き認識などで待たされんように */
    const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); const x = cv.getContext('2d', { desynchronized: true }); x.scale(dpr, dpr); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#ff2a1a';
    const strokes = []; let cur = null;
    const redraw = () => { x.clearRect(0, 0, innerWidth, innerHeight); for (const s of strokes) { for (let n = 2; n <= s.length; n++) seg(s.slice(0, n)); } };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cur = [[e.clientX, e.clientY, e.pressure || 0.5]]; strokes.push(cur); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    const lv = document.createElement('canvas'); lv.width = cv.width; lv.height = cv.height; lv.style.pointerEvents = 'none'; ui.insertBefore(lv, cv.nextSibling); const lx = lv.getContext('2d'); lx.scale(dpr, dpr); lx.lineCap = 'round'; lx.strokeStyle = 'rgba(255,42,26,.55)';
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const seg = s => { const n = s.length; if (n < 2) return; const a = s[n - 2], b = s[n - 1], p0 = n > 2 ? mid(s[n - 3], a) : a, p1 = mid(a, b); x.lineWidth = 3 + 5 * b[2]; x.beginPath(); x.moveTo(p0[0], p0[1]); x.quadraticCurveTo(a[0], a[1], p1[0], p1[1]); x.stroke(); }; /* 足した所だけ、なめらかに */
    cv.addEventListener('pointermove', e => { if (!cur) return; for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) { cur.push([ev.clientX, ev.clientY, ev.pressure || 0.5]); seg(cur); }
      lx.clearRect(0, 0, innerWidth, innerHeight); const pr = e.getPredictedEvents ? e.getPredictedEvents() : []; if (pr.length) { const l = cur[cur.length - 1]; lx.lineWidth = 3 + 5 * l[2]; lx.beginPath(); lx.moveTo(l[0], l[1]); for (const q of pr) lx.lineTo(q.clientX, q.clientY); lx.stroke(); } }); /* 先読み分を薄く出して遅れを感じさせない */
    const end = () => { if (cur && cur.length > 1) { const l = cur[cur.length - 1], m = mid(cur[cur.length - 2], l); x.lineWidth = 3 + 5 * l[2]; x.beginPath(); x.moveTo(m[0], m[1]); x.lineTo(l[0], l[1]); x.stroke(); } cur = null; lx.clearRect(0, 0, innerWidth, innerHeight); }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const tags = new Set();
    for (const t of TAGS) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { tags.has(t) ? tags.delete(t) : tags.add(t); b.classList.toggle('on', tags.has(t)); }; bar.appendChild(b); }
    const sep = document.createElement('div'); sep.className = 'sep'; bar.appendChild(sep);
    const mk = (t, cls, fn) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = fn; bar.appendChild(b); return b; };
    mk('↶ 戻す', '', () => { strokes.pop(); redraw(); });
    const close = () => { ui.remove(); try { tw.__paused = false; tw.focus(); } catch (_) {} };
    mk('やめる', '', close);
    const sendB = mk('準備中…', 'send', async () => { if (!g) return; sendB.disabled = true; sendB.textContent = '送ってる…';
      const out = await compose(img, cv, strokes.length);
      const doc = { t: Date.now(), page: g.page, img: out, ink: strokes.length, tags: [...tags], on: g.on, glOk: !!g.glOk, uiOk: !!g.uiOk, state: g.state ? JSON.stringify(g.state).slice(0, 4000) : '', log: JSON.stringify(g.log), scr: { w: g.W, h: g.H, dpr: g.dpr, touch: g.touch }, ua: navigator.userAgent.slice(0, 160) };
      let ok = false;
      if (db) { try { await db.collection('stress').add(doc); ok = true; } catch (e) { ok = false; } }
      if (ok) { const n = (LS('stress_sent') || 0) + 1; LS('stress_sent', n); close(); toast('💢 くー君に送った（' + n + '件目）'); return; }
      const q = LS('stress_local') || []; q.push(Object.assign({}, doc, { img: '' })); LS('stress_local', q.slice(-30)); close();
      toast(db ? '送れへんかった。この端末には残したで' : 'この画面からはくー君に届かへん。claude.aiのリンクで開いてな'); });
    sendB.disabled = true; fullP.then(r => { if (!document.body.contains(ui)) return; g = r || { img: quick, log: [], on: [], state: null, page: '?', W: innerWidth, H: innerHeight, dpr: devicePixelRatio || 1, touch: navigator.maxTouchPoints || 0 }; if (r && r.img) img.src = r.img; sendB.disabled = false; sendB.textContent = '送る'; });
  }
  // 止めた画面と赤ペンを1枚の絵に（大きすぎたら小さく）
  async function compose(img, ink, n) {
    const W = innerWidth, H = innerHeight;
    for (const [maxW, q] of [[1280, 0.72], [1100, 0.6], [900, 0.55], [700, 0.5]]) {
      const k = Math.min(1, maxW / W), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const x = c.getContext('2d');
      x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      if (img.naturalWidth) { const s = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s; x.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h); }
      if (n) x.drawImage(ink, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', q); if (url.length < 200000) return url; }
    return '';
  }
})();
