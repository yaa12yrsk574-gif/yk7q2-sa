



const fT = document.getElementById('fTool'), fG = document.getElementById('fGame'); fG.src = 'hunting.html?v=ab2c3b219733'; let toolLoaded = false;
// 狩り場はiframe。子だけのblurでは、画面分割やウィンドウ切替で取り逃す場合がある
window.__gameOn = true;
window.__openTool = () => document.querySelector('#tabs button[data-t="tool"]').click();
function stopGameMovement() { try { fG.contentWindow.__clearMovementInput?.(); } catch (_) {} }
addEventListener('blur', stopGameMovement);
addEventListener('focus', stopGameMovement);
addEventListener('pagehide', stopGameMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopGameMovement(); });
// 工房で保存せずに狩り場へ戻る時は、ひと声かける（保存せんと相棒は前の動きのまま）
function leaveAsk(go) { let d = document.getElementById('leaveDlg'); if (!d) { d = document.createElement('div'); d.id = 'leaveDlg'; d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#0006;display:flex;align-items:center;justify-content:center;padding:16px;font-family:sans-serif';
    d.innerHTML = '<div style="background:#faf7f1;border-radius:16px;padding:18px 18px 14px;max-width:360px;width:100%;box-shadow:0 8px 30px #0004;font-weight:800;color:#2b2a27"><div style="font-size:17px;margin-bottom:6px">まだ保存してへんで</div><div style="font-size:13px;color:#6b6457;margin-bottom:14px;line-height:1.5">保存せんと、狩り場の相棒は前の形・動きのまま。</div><div style="display:flex;flex-direction:column;gap:8px"><button data-a="save" style="font:inherit;font-size:15px;padding:11px;border-radius:11px;border:0;background:#d9572b;color:#fff">保存して戻る</button><button data-a="go" style="font:inherit;font-size:14px;padding:10px;border-radius:11px;border:1.5px solid #cfc7b8;background:#fff;color:#2b2a27">保存せずに戻る</button><button data-a="stay" style="font:inherit;font-size:14px;padding:10px;border-radius:11px;border:0;background:transparent;color:#6b6457">工房に残る</button></div></div>';
    document.body.appendChild(d); }
  d.style.display = 'flex'; d.querySelectorAll('button').forEach(x => x.onclick = () => { d.style.display = 'none'; const a = x.dataset.a; if (a === 'save') { try { fT.contentWindow.__saveWork(); } catch (_) {} go(); } else if (a === 'go') go(); }); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { if (b.dataset.t === 'game' && fT.classList.contains('on')) { let un = false; try { un = !!(fT.contentWindow.__unsaved && fT.contentWindow.__unsaved()); } catch (_) {} if (un) { leaveAsk(() => switchTab(b)); return; } } switchTab(b); });
function switchTab(b) { stopGameMovement(); const t = b.dataset.t; window.__gameOn = t === 'game'; try { fG.contentWindow.__paused = t !== 'game'; } catch (_) {} document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  fT.classList.toggle('on', t === 'tool'); fG.classList.toggle('on', t === 'game'); document.getElementById('tabs').style.display = t === 'game' ? 'none' : 'flex'; /* 狩り場では右タブを出さない。工房へはキャンプから */
  if (t === 'tool' && !toolLoaded) { toolLoaded = true; fT.src = 'workshop.html?v=77acbee03dd3'; }
  if (t === 'game') { try { fG.contentWindow.dispatchEvent(new Event('resize')); fG.contentWindow.__field.refresh(); fG.contentWindow.focus(); } catch (_) {} } else { try { fT.contentWindow.focus(); } catch (_) {} } }

// <bone_sync>
// ---- 工房・狩り場の作品をクラウド（このページのdb）と同期する ----
// localStorage の作品リストを「作業用の手元コピー」として、db の works/<id> と3方向で突き合わせる。
// 下書き（今いじってる状態）は draft/current に新しい方勝ちで置く。
const boneCloud = window.BoneStorage.boneCloud;
// </bone_sync>
window.__boneOuter = true;
boneCloud({ use: n => { try { return window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null); } catch (_) { return Promise.resolve(null); } },
  status: (t, warn) => { const e = document.getElementById('cloudSt'); e.textContent = t.replace('（手元には残ってる）', '').replace('この端末に保存', ''); e.style.color = warn ? '#ffb199' : ''; },
  onWorks: () => { try { fG.contentWindow.__field.refresh(); } catch (_) {} },
  onDraft: () => { if (toolLoaded) fT.src = 'workshop.html?v=77acbee03dd3'; } });
