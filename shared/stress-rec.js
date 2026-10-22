// 💢ボタン用の記録係（狩り場・工房・アニメ工房の各ページで動く）
// 直前15秒の操作（触った場所・動かし方・押したボタン・キー・エラー）を覚えておき、
// 💢が押されたら「その瞬間の画面の絵」と一緒に渡す。説明を書かんでも何が起きてたか分かるように。
(function () {
  const KEEP = 15000, LOG = [];
  const now = () => Math.round(performance.now());
  const push = e => { LOG.push(e); const lim = now() - KEEP; while (LOG.length && LOG[0][0] < lim) LOG.shift(); };
  const label = el => { try { if (!el || !el.closest) return ''; const b = el.closest('button,label,input,select,[id]'); if (!b) return el.tagName ? el.tagName.toLowerCase() : '';
    const tx = (b.textContent || b.value || '').replace(/\s+/g, ' ').trim().slice(0, 16); return (b.id ? '#' + b.id : b.tagName.toLowerCase()) + (tx ? ' ' + tx : ''); } catch (_) { return ''; } };
  let lastMove = 0;
  const pt = e => (e.pointerType || 'm')[0];
  addEventListener('pointerdown', e => push([now(), 'down', pt(e), Math.round(e.clientX), Math.round(e.clientY), e.button, +(e.pressure || 0).toFixed(2), label(e.target)]), true);
  addEventListener('pointermove', e => { const t = now(); if (t - lastMove < 33) return; if (!e.buttons && pt(e) === 'm' && t - lastMove < 150) return; lastMove = t; push([t, 'move', pt(e), Math.round(e.clientX), Math.round(e.clientY), e.buttons]); }, true);
  addEventListener('pointerup', e => push([now(), 'up', pt(e), Math.round(e.clientX), Math.round(e.clientY)]), true);
  addEventListener('pointercancel', e => push([now(), 'cancel', pt(e)]), true);
  addEventListener('keydown', e => { if (e.repeat) return; push([now(), 'key', e.key, (e.ctrlKey ? 'C' : '') + (e.shiftKey ? 'S' : '') + (e.altKey ? 'A' : '') + (e.metaKey ? 'M' : '')]);
    if (e.key === 'F2' || e.key === '\\') { e.preventDefault(); e.stopPropagation(); const open = window.__stressOpen || (() => { try { return parent.__stressOpen; } catch (_) { return null; } })(); if (open) open(); } }, true);
  addEventListener('keyup', e => push([now(), 'keyup', e.key]), true);
  addEventListener('wheel', e => push([now(), 'wheel', Math.round(e.deltaY)]), { capture: true, passive: true });
  addEventListener('error', e => push([now(), 'error', String(e.message || '').slice(0, 200)]));
  // three.js の描画を覚えておき、押された瞬間にもう一回描いてすぐ絵を取る（WebGLは描いた直後しか絵が取れない）
  let last = null;
  if (window.THREE && THREE.WebGLRenderer) { const Orig = THREE.WebGLRenderer;
    THREE.WebGLRenderer = class extends Orig { constructor(o) { super(o); const R = this.render; this.render = (s, c) => { const r = R.call(this, s, c); if (!this.getRenderTarget()) last = { r: this, s, c }; return r; }; } }; }
  function glShot() { if (!last) return null; try { last.r.render(last.s, last.c); return { el: last.r.domElement, url: last.r.domElement.toDataURL('image/jpeg', 0.82) }; } catch (_) { return null; } }
  let h2c = null;
  const loadH2C = () => h2c || (h2c = new Promise(res => { if (window.html2canvas) return res(window.html2canvas); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = () => res(window.html2canvas || null); s.onerror = () => res(null); document.head.appendChild(s); }));
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  window.__stressQuick = () => { const g = glShot(); return g ? g.url : null; }; /* すぐ出す用：3Dの絵だけ */
  // 画面の絵（ボタンやパネルも込み）＋記録＋状態
  window.__stressGrab = async function () {
    const W = innerWidth, H = innerHeight, gl = glShot(), k = Math.min(1, 1400 / W);
    let img = null, ui = null;
    const H2 = await timeout(loadH2C(), 4000);
    if (H2) { try { ui = await timeout(H2(document.body, { backgroundColor: null, scale: k, logging: false, width: W, height: H, x: 0, y: 0, scrollX: 0, scrollY: 0, windowWidth: W, windowHeight: H,
        ignoreElements: el => el.id === '__stressBtn' || el.id === '__stressUI' || (gl && el === gl.el),
        onclone: doc => { doc.documentElement.style.background = 'transparent'; doc.body.style.background = 'transparent'; } }), 6000); } catch (_) { ui = null; } }
    // 3Dの絵を下に敷いて、ボタンやパネル（html2canvas）を上に重ねる
    const out = document.createElement('canvas'); out.width = Math.round(W * k); out.height = Math.round(H * k); const ox = out.getContext('2d');
    ox.fillStyle = getComputedStyle(document.body).backgroundColor || '#ddd'; ox.fillRect(0, 0, out.width, out.height);
    if (gl) { const im = await new Promise(r => { const m = new Image(); m.onload = () => r(m); m.onerror = () => r(null); m.src = gl.url; }); if (im) { const R = gl.el.getBoundingClientRect(); ox.drawImage(im, R.left * k, R.top * k, R.width * k, R.height * k); } }
    if (ui) ox.drawImage(ui, 0, 0, out.width, out.height);
    img = out.toDataURL('image/jpeg', 0.8);
    if (!img && gl) img = gl.url; // 絵が取れへん時は3D画面だけでも
    const on = [...document.querySelectorAll('button.on,.btn.on,[aria-pressed="true"]')].map(label).filter(Boolean).slice(0, 24);
    let st = null; try { st = window.__stressState ? window.__stressState() : null; } catch (e) { st = { err: String(e) }; }
    return { img, glOk: !!(gl && gl.url && gl.url.length > 8000), uiOk: !!ui, log: LOG.slice(), on, state: st, page: location.pathname.split('/').pop() || 'index', W, H, dpr: devicePixelRatio || 1, touch: navigator.maxTouchPoints || 0 };
  };
})();
