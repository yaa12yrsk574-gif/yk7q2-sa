// ---- 関節の元の金属：希少金属っぽい、コントラストの強い光沢 ----
// 映り込みは2種類で見比べられる：白黒（スタジオっぽい白い帯と黒。ギラッと強い）／景色（空と海と砂の色が映る）
window.PlayMetal = (() => {
  const mats = new Set(); let env = {}, mode = 'bw';
  try { mode = localStorage.getItem('yuya_play_metal') || 'bw'; } catch (_) {}
  function canvasEnv(draw) { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); draw(g, 512, 256); const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; return t; }
  function init(renderer) { const pm = new THREE.PMREMGenerator(renderer);
    const bw = canvasEnv((g, w, h) => { let gr = g.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9a9a9a'); g.fillStyle = gr; g.fillRect(0, 0, w, h / 2); /* 上：明るい */
      gr = g.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, '#050505'); gr.addColorStop(1, '#2a2a2a'); g.fillStyle = gr; g.fillRect(0, h / 2, w, h / 2); /* 下：真っ黒（地平線でスパッと切れる） */
      g.fillStyle = '#ffffff'; g.fillRect(0, h / 2 - 6, w, 3); for (const [x, y, ww, hh] of [[60, 40, 110, 22], [300, 30, 70, 50], [420, 70, 60, 14]]) g.fillRect(x, y, ww, hh); /* 白い帯（ハイライト） */ });
    const sc = canvasEnv((g, w, h) => { let gr = g.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, '#9fcfe8'); gr.addColorStop(1, '#f2f7f4'); g.fillStyle = gr; g.fillRect(0, 0, w, h / 2);
      gr = g.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, '#3f8fae'); gr.addColorStop(0.35, '#2f6f88'); gr.addColorStop(0.6, '#c9b688'); gr.addColorStop(1, '#8aa86a'); g.fillStyle = gr; g.fillRect(0, h / 2, w, h / 2);
      const sun = g.createRadialGradient(360, 60, 2, 360, 60, 40); sun.addColorStop(0, '#ffffff'); sun.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sun; g.fillRect(300, 0, 130, 120); });
    env.bw = pm.fromEquirectangular(bw).texture; env.scene = pm.fromEquirectangular(sc).texture; bw.dispose(); sc.dispose(); pm.dispose(); apply(); }
  function apply() { for (const m of mats) { m.envMap = env[mode] || null; m.needsUpdate = true; } }
  // 暗めの銀。ハイライトは映り込みで強く出る
  function mat(o) { const m = new THREE.MeshStandardMaterial(Object.assign({ color: 0x9aa1aa, metalness: 1, roughness: 0.12, envMapIntensity: 1.7 }, o || {})); m.envMap = env[mode] || null; mats.add(m); const d = m.dispose.bind(m); m.dispose = () => { mats.delete(m); d(); }; return m; }
  function toggle() { mode = mode === 'bw' ? 'scene' : 'bw'; try { localStorage.setItem('yuya_play_metal', mode); } catch (_) {} apply(); return mode; }
  return { init, mat, toggle, get mode() { return mode; } };
})();
