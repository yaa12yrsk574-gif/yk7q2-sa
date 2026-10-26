// 💢ボタン（いちばん外のページで動く）。押すと画面が止まって赤ペンが出る→「送る」で絵・赤ペン・直前15秒の操作をまとめて残す。
// claude.ai のリンクで開いてる時は db の stress に入る（くー君が読める）。それ以外は絵ごとこの端末（IndexedDB）に置いとく。
// 置いた分は 💢 の横の赤い数字から「コピー」→くー君のチャットに貼れる。claude.ai で開き直したら自動で送る。
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
#__stressBadge{position:fixed;z-index:9998;display:none;min-width:22px;height:22px;border-radius:11px;border:2px solid #fff;background:#e23b2e;color:#fff;font:800 12px/18px "Hiragino Sans",sans-serif;padding:0 5px;text-align:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25)}
#__stressRescue{position:fixed;z-index:10001;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);background:rgba(250,247,241,.97);color:#2b2a27;border-radius:16px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.3);font-family:"Hiragino Sans","Zen Kaku Gothic New",sans-serif;font-size:14px;text-align:center;max-width:calc(100vw - 24px);box-sizing:border-box}
#__stressRescue .sub{font-size:11px;color:#7a7368;margin:3px 0 9px}
#__stressRescue .row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
#__stressRescue button{font:inherit;font-weight:800;font-size:13px;border:1.5px solid #cfc7b8;background:#fff;color:#2b2a27;border-radius:99px;padding:8px 14px;cursor:pointer}
#__stressRescue button.main{background:#e23b2e;border-color:#e23b2e;color:#fff}
#__stressRescue button.del{color:#a33}
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
  // ---- 届いてへん💢の置き場（IndexedDB。絵と赤ペンごと。古い localStorage の分も引っ越す） ----
  const Q = (() => {
    let dbp = null; const open = () => dbp || (dbp = new Promise((res) => { try { const r = indexedDB.open('stress_local_db', 1); r.onupgradeneeded = () => r.result.createObjectStore('q', { keyPath: 'k', autoIncrement: true }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (_) { res(null); } }));
    const tx = async (mode, fn) => { const d = await open(); if (!d) return null; return new Promise(res => { try { const t = d.transaction('q', mode), s = t.objectStore('q'); const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : true); t.onerror = () => res(null); } catch (_) { res(null); } }); };
    return {
      add: d => tx('readwrite', s => s.add(Object.assign({}, d))),
      all: async () => (await tx('readonly', s => s.getAll())) || [],
      del: k => tx('readwrite', s => s.delete(k)),
      clear: () => tx('readwrite', s => s.clear()),
      async migrate() { const old = LS('stress_local'); if (!old || !old.length) return; for (const d of old) await this.add(Object.assign({ old: 1 }, d)); try { localStorage.removeItem('stress_local'); } catch (_) {} }
    };
  })();
  const badge = document.createElement('button'); badge.id = '__stressBadge'; document.body.appendChild(badge);
  const placeBadge = () => { badge.style.left = (btn.offsetLeft + 30) + 'px'; badge.style.top = (btn.offsetTop - 6) + 'px'; };
  async function refreshBadge() { const n = (await Q.all()).length; LS('stress_unsent_n', n); badge.textContent = n; badge.style.display = n ? 'block' : 'none'; placeBadge(); return n; }
  new MutationObserver(placeBadge).observe(btn, { attributes: true, attributeFilter: ['style'] });
  badge.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
  badge.addEventListener('click', e => { e.stopPropagation(); rescue(); });
  const ART = 'https://claude.ai/artifact/TgUYw7r6vbmovyCYbEt4cC';
  // 届いてへん💢を見せる：コピーしてくー君のチャットに貼る／claude.ai版へ／消す
  async function rescue() {
    if (document.getElementById('__stressRescue')) return; const list = await Q.all(); if (!list.length) { refreshBadge(); return; }
    const box = document.createElement('div'); box.id = '__stressRescue';
    const withImg = list.filter(d => d.img).length;
    box.innerHTML = `<b>くー君に届いてへん💢 ${list.length}件</b><div class="sub">${withImg < list.length ? `絵つき ${withImg}件・絵なし ${list.length - withImg}件（前の作りの分は絵が残ってへん）` : '絵と赤ペンも残ってる'}</div><div class="row"></div>`;
    const row = box.querySelector('.row'); const b = (t, cls, fn) => { const x = document.createElement('button'); x.textContent = t; if (cls) x.className = cls; x.onclick = fn; row.appendChild(x); return x; };
    b('コピー', 'main', async () => {
      const txt = '💢未送信 ' + list.length + '件（くー君へ）\n' + JSON.stringify(list.map(d => { const c = Object.assign({}, d); delete c.k; return c; }));
      let ok = false; try { await navigator.clipboard.writeText(txt); ok = true; } catch (_) { try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (_) {} }
      toast(ok ? 'コピーした！くー君のチャットに貼ってな' : 'コピーできへんかった…');
      if (ok) { cpd = true; delB.textContent = '貼れたから消す'; }
    });
    let cpd = false;
    if (!db) b('claude.ai版で開く', '', () => { location.href = ART; });
    const delB = b('消す', 'del', async () => { if (!cpd && !confirm('コピーしてへんけど消してええ？')) return; await Q.clear(); box.remove(); refreshBadge(); toast('消した'); });
    b('閉じる', '', () => box.remove());
    document.body.appendChild(box);
  }
  let db = null; (async () => { try { const C = window.claude; if (C && C.use) db = await C.use('db'); } catch (_) { db = null; }
    await Q.migrate(); let n = await refreshBadge();
    if (db && n) { /* claude.ai で開いた時：端末に残ってた分を自動でくー君に送る */
      let sent = 0; for (const d of await Q.all()) { const c = Object.assign({}, d); delete c.k; try { await db.collection('stress').add(c); await Q.del(d.k); sent++; } catch (_) { break; } }
      n = await refreshBadge(); if (sent) toast('端末に残ってた💢 ' + sent + '件、くー君に送った');
    } else if (!db && n && /github\.io$/.test(location.hostname)) rescue(); /* github.io で未送信がある時は先に救出画面 */
  })();
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
    ui.innerHTML = '<img alt=""><canvas></canvas><div class="bar"></div>';
    document.body.appendChild(ui); const img = ui.querySelector('img'), cv = ui.querySelector('canvas'), bar = ui.querySelector('.bar');
    if (quick) img.src = quick;
    ui.addEventListener('touchstart', e => { if (e.target === cv) e.preventDefault(); }, { passive: false }); ui.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, { passive: false }); /* iPadの手書き認識などで待たされんように */
    const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); const x = cv.getContext('2d', { desynchronized: true }); x.scale(dpr, dpr); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#ff2a1a';
    const strokes = []; let cur = null, erase = false; /* strokes：{ e:消しゴムか, p:[[x,y,筆圧]...] } */
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const W0 = (s, b) => s.e ? 26 : 3 + 5 * b[2];
    const seg = (s, n) => { const P = s.p; if (n < 2) return; const a = P[n - 2], b = P[n - 1], p0 = n > 2 ? mid(P[n - 3], a) : a, p1 = mid(a, b); x.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'; x.lineWidth = W0(s, b); x.beginPath(); x.moveTo(p0[0], p0[1]); x.quadraticCurveTo(a[0], a[1], p1[0], p1[1]); x.stroke(); }; /* 足した所だけ、なめらかに */
    const tail = s => { const P = s.p, n = P.length; x.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'; if (n === 1) { x.fillStyle = '#ff2a1a'; x.beginPath(); x.arc(P[0][0], P[0][1], W0(s, P[0]) / 2, 0, 7); x.fill(); return; } const l = P[n - 1], m = mid(P[n - 2], l); x.lineWidth = W0(s, l); x.beginPath(); x.moveTo(m[0], m[1]); x.lineTo(l[0], l[1]); x.stroke(); };
    const redraw = () => { x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, innerWidth, innerHeight); for (const s of strokes) { for (let n = 2; n <= s.p.length; n++) seg(s, n); tail(s); } x.globalCompositeOperation = 'source-over'; };
    const ring = document.createElement('div'); ring.style.cssText = 'position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:1.5px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #0006;pointer-events:none;display:none'; ui.appendChild(ring); /* 消しゴムの当たる範囲 */
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cur = { e: erase, p: [[e.clientX, e.clientY, e.pressure || 0.5]] }; strokes.push(cur); if (erase) { ring.style.display = 'block'; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; } try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    const lv = document.createElement('canvas'); lv.width = cv.width; lv.height = cv.height; lv.style.pointerEvents = 'none'; ui.insertBefore(lv, cv.nextSibling); const lx = lv.getContext('2d'); lx.scale(dpr, dpr); lx.lineCap = 'round'; lx.strokeStyle = 'rgba(255,42,26,.55)';
    cv.addEventListener('pointermove', e => { if (!cur) return; for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) { cur.p.push([ev.clientX, ev.clientY, ev.pressure || 0.5]); seg(cur, cur.p.length); }
      if (cur.e) { ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; return; }
      lx.clearRect(0, 0, innerWidth, innerHeight); const pr = e.getPredictedEvents ? e.getPredictedEvents() : []; if (pr.length) { const l = cur.p[cur.p.length - 1]; lx.lineWidth = 3 + 5 * l[2]; lx.beginPath(); lx.moveTo(l[0], l[1]); for (const q of pr) lx.lineTo(q.clientX, q.clientY); lx.stroke(); } }); /* 先読み分を薄く出して遅れを感じさせない */
    const end = () => { if (cur) tail(cur); x.globalCompositeOperation = 'source-over'; cur = null; ring.style.display = 'none'; lx.clearRect(0, 0, innerWidth, innerHeight); }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const tags = new Set();
    const mk = (t, cls, fn) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = fn; bar.appendChild(b); return b; };
    const close = () => { ui.remove(); try { tw.__paused = false; tw.focus(); } catch (_) {} };
    mk('✕', '', close);
    const penB = mk('✏️ ペン', 'on', () => setTool(false)), erB = mk('消しゴム', '', () => setTool(true));
    const setTool = v => { erase = v; penB.classList.toggle('on', !v); erB.classList.toggle('on', v); };
    mk('↶ 戻す', '', () => { if (cur) return; strokes.pop(); redraw(); });
    addEventListener('keydown', function k(e) { if (!document.body.contains(ui)) { removeEventListener('keydown', k); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); strokes.pop(); redraw(); } else if (e.key.toLowerCase() === 'e') setTool(!erase); }); /* PC：Ctrl+Z＝戻す、E＝消しゴム切替 */
    const sendB = mk('準備中…', 'send', async () => { if (!g) return; sendB.disabled = true; sendB.textContent = '送ってる…';
      const inkN = strokes.filter(t => !t.e).length; const out = await compose(img, cv, inkN);
      const doc = { t: Date.now(), page: g.page, img: out, ink: inkN, tags: [...tags], on: g.on, glOk: !!g.glOk, uiOk: !!g.uiOk, state: g.state ? JSON.stringify(g.state).slice(0, 4000) : '', log: JSON.stringify(g.log), scr: { w: g.W, h: g.H, dpr: g.dpr, touch: g.touch }, ua: navigator.userAgent.slice(0, 160) };
      let ok = false;
      if (db) { try { await db.collection('stress').add(doc); ok = true; } catch (e) { ok = false; } }
      if (ok) { const n = (LS('stress_sent') || 0) + 1; LS('stress_sent', n); close(); toast('💢 くー君に送った（' + n + '件目）'); return; }
      await Q.add(doc); close(); refreshBadge(); /* 絵と赤ペンごと端末に残す（あとでコピー or 自動で送る） */
      toast(db ? '送れへんかった。絵ごと端末に残したで' : '端末に残した。右上の数字からくー君に渡せるで'); });
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
