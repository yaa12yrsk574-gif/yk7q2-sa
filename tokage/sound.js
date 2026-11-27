// ---- 音：素材ファイルは使わず、ブラウザの中で鳴らす（仮の音。差し替えやすいように全部ここ） ----
// 最初に画面を触った時に音が出せるようになる（ブラウザの決まり）
window.TkSound = (() => {
  let ac = null, master = null, bgmBus = null, sfxBus = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('yuya_tk_mute') === '1'; } catch (_) {}
  function init() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    bgmBus = ac.createGain(); bgmBus.gain.value = 0.32; bgmBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    const n = ac.sampleRate * 1.5; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    startBgm(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, init, { passive: true }));
  const now = () => ac ? ac.currentTime : 0;
  // 1音：波形・高さ（Hz）・長さ・音量・高さの行き先
  function tone(type, f0, dur, vol, f1, when, bus) { if (!ac) return; const t = (when || now()), o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05); }
  function noise(dur, vol, fc, q, when, fc1, type) { if (!ac) return; const t = when || now(), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(fc, t); if (fc1) f.frequency.exponentialRampToValueAtTime(fc1, t + dur); f.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05); }
  const S = {
    step() { noise(0.05, 0.05, 900, 1); },
    jump(k) { tone('square', 260, 0.16, 0.08, 520 + (k || 0) * 300); },
    hop() { tone('sine', 420, 0.1, 0.12, 700); },
    land() { noise(0.12, 0.18, 400, 1); tone('sine', 120, 0.12, 0.15, 70); },
    bonk() { tone('triangle', 200, 0.18, 0.25, 90); noise(0.08, 0.15, 1200, 2); },
    flop() { tone('sine', 300, 0.35, 0.18, 110); },
    boing() { tone('sine', 180, 0.45, 0.2, 520); tone('sine', 360, 0.3, 0.06, 900, now() + 0.05); },
    creak() { noise(0.9, 0.12, 160, 6, null, 90, 'bandpass'); tone('sawtooth', 55, 0.9, 0.05, 48); },
    dossun() { tone('sine', 70, 1.2, 0.7, 30); noise(0.9, 0.5, 300, 1, null, 60); noise(0.25, 0.3, 2400, 1); },
    sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone('sine', f, 0.25, 0.05, null, now() + i * 0.06)); },
    pick() { tone('triangle', 660, 0.08, 0.12); },
    right() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0.3, 0.12, null, now() + i * 0.08)); },
    wrong() { tone('triangle', 330, 0.22, 0.12, 280); tone('triangle', 262, 0.35, 0.12, 200, now() + 0.2); },
    card() { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, 0.5, 0.1, null, now() + i * 0.07)); S.sparkle(); },
    flap() { noise(0.18, 0.22, 900, 1.2, null, 300); },
    whoosh() { noise(0.5, 0.15, 400, 0.8, null, 1800, 'bandpass'); },
    splash() { noise(0.4, 0.25, 1800, 0.7, null, 500); },
    call() { tone('sine', 520, 0.12, 0.12, 780); tone('sine', 780, 0.14, 0.1, 1040, now() + 0.12); },
    wobble() { tone('sine', 240, 0.5, 0.12, 160); tone('sine', 250, 0.5, 0.06, 170); },
    charge() { tone('sine', 300, 0.35, 0.06, 700); },
    fanfare() { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.4], [988, 0.62], [1047, 0.74]].forEach(([f, d]) => { tone('triangle', f, 0.35, 0.14, null, now() + d); tone('sine', f / 2, 0.35, 0.08, null, now() + d); }); },
    chirp() { tone('sine', 2200, 0.08, 0.05, 3200); tone('sine', 2600, 0.08, 0.04, 3600, now() + 0.1); },
    croak() { tone('sawtooth', 140, 0.18, 0.05, 110); },
  };
  // ---- BGM：ゆるいペンタトニックの繰り返し。mood で色を変える（field＝草原、think＝考え中、wonder＝見とれる、end＝おしまい） ----
  let mood = 'field', bgmT = 0, bar = 0;
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16], ROOT = { field: 392, think: 349, wonder: 330, end: 440 }, CH = { field: [0, 5, 3, 4], think: [0, 3, 5, 3], wonder: [0, 4, 5, 3], end: [0, 3, 4, 0] };
  const semi = (f, n) => f * Math.pow(2, n / 12);
  function startBgm() { bgmT = now() + 0.1; schedule(); }
  function schedule() { if (!ac) return; while (bgmT < now() + 1.2) { playBar(bgmT); bgmT += 60 / 92 * 4; bar++; } setTimeout(schedule, 400); }
  function playBar(t) { const r = ROOT[mood] || 392, beat = 60 / 92, ch = CH[mood] || CH.field, deg = ch[bar % ch.length], base = semi(r / 2, SCALE[deg] - 12);
    // 低い音（ゆっくり）
    tone('triangle', base, beat * 3.6, 0.09, null, t, bgmBus); tone('sine', base * 1.5, beat * 3.6, 0.04, null, t, bgmBus);
    if (mood === 'think') { for (let i = 0; i < 4; i++) if (Math.random() < 0.5) tone('sine', semi(r, SCALE[(deg + [0, 2, 4][i % 3]) % SCALE.length]), beat * 0.9, 0.035, null, t + i * beat, bgmBus); return; }
    // メロディ（ぽろぽろ）
    let last = deg; for (let i = 0; i < 8; i++) { if (Math.random() < (mood === 'wonder' ? 0.35 : 0.55)) { last = Math.max(0, Math.min(SCALE.length - 1, last + [-2, -1, 1, 2, 0][Math.floor(Math.random() * 5)])); tone(mood === 'end' ? 'triangle' : 'sine', semi(r, SCALE[last]), beat * 0.6, mood === 'end' ? 0.06 : 0.045, null, t + i * beat / 2, bgmBus); } } }
  function setMood(m) { mood = m; }
  function toggleMute() { muted = !muted; try { localStorage.setItem('yuya_tk_mute', muted ? '1' : '0'); } catch (_) {} if (master) master.gain.value = muted ? 0 : 0.9; return muted; }
  return Object.assign(S, { init, setMood, toggleMute, get muted() { return muted; } });
})();
