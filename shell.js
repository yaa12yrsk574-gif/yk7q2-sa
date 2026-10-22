



const fT = document.getElementById('fTool'), fG = document.getElementById('fGame'); fG.src = 'hunting.html?v=4d1924f8fd4a'; let toolLoaded = false;
// 狩り場はiframe。子だけのblurでは、画面分割やウィンドウ切替で取り逃す場合がある
window.__gameOn = true;
window.__openTool = () => document.querySelector('#tabs button[data-t="tool"]').click();
function stopGameMovement() { try { fG.contentWindow.__clearMovementInput?.(); } catch (_) {} }
addEventListener('blur', stopGameMovement);
addEventListener('focus', stopGameMovement);
addEventListener('pagehide', stopGameMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopGameMovement(); });
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { stopGameMovement(); const t = b.dataset.t; window.__gameOn = t === 'game'; try { fG.contentWindow.__paused = t !== 'game'; } catch (_) {} document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  fT.classList.toggle('on', t === 'tool'); fG.classList.toggle('on', t === 'game'); document.getElementById('tabs').style.display = t === 'game' ? 'none' : 'flex'; /* 狩り場では右タブを出さない。工房へはキャンプから */
  if (t === 'tool' && !toolLoaded) { toolLoaded = true; fT.src = 'workshop.html?v=be4d493c4a46'; }
  if (t === 'game') { try { fG.contentWindow.dispatchEvent(new Event('resize')); fG.contentWindow.__field.refresh(); fG.contentWindow.focus(); } catch (_) {} } else { try { fT.contentWindow.focus(); } catch (_) {} } });

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
  onDraft: () => { if (toolLoaded) fT.src = 'workshop.html?v=be4d493c4a46'; } });
