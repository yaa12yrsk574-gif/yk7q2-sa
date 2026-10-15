// Shared persistence and cloud sync. Existing keys/payloads are preserved.
(function(){
const keys = window.ProjectData.keys;
function boneCloud(opt) {
  const WK = keys.works, BASE = keys.syncBase, DK = keys.draft, DT = keys.draftTime, CK = keys.current;
  const st = opt.status || (() => {}), onWorks = opt.onWorks || (() => {});
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } } };
  const H = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36); };
  const hw = w => H(JSON.stringify([w.id, w.name || '', w.created || 0, w.updated || 0, w.thumb || '', !!w.thumbFixed, w.data]));
  const enc = new TextEncoder(), bytes = s => enc.encode(s).length, CH = 60000;
  let db = null, col = null, cloud = new Map(), busy = false, again = false, lastW = null, lastD = null, gotSnap = false, t = 0;
  async function putBig(ref, meta, payload) { const s = JSON.stringify(payload);
    if (bytes(JSON.stringify(meta)) + bytes(s) < 230000) { await ref.set({ ...meta, chunks: 0, data: payload }); return; }
    const n = Math.ceil(s.length / CH); for (let i = 0; i < n; i++) await ref.collection('c').doc(String(i)).set({ s: s.slice(i * CH, (i + 1) * CH) });
    await ref.set({ ...meta, chunks: n }); }
  async function getBig(ref, d) { if (!d.chunks) return d.data; let s = ''; for (let i = 0; i < d.chunks; i++) { const x = await ref.collection('c').doc(String(i)).get(); if (!x.exists) throw new Error('chunk'); s += x.data().s; } return JSON.parse(s); }
  const loadW = () => { try { return JSON.parse(ls.get(WK) || '[]'); } catch (_) { return []; } };
  const loadBase = () => { try { return JSON.parse(ls.get(BASE) || '{}'); } catch (_) { return {}; } };
  async function syncWorks() {
    const L = loadW(), base = loadBase(), loc = new Map(L.map(w => [w.id, w])); let changed = false, err = null;
    const ids = new Set([...loc.keys(), ...cloud.keys()]);
    for (const id of ids) { const l = loc.get(id), c = cloud.get(id), b = base[id] || [];
      const lh = l ? hw(l) : null, ch = c && !c.deleted ? c.h : null;
      if (!l && !ch) { delete base[id]; continue; }
      const lC = lh !== (b[0] === undefined ? undefined : b[0]), cC = ch !== (b[1] === undefined ? undefined : b[1]);
      if (!lC && !cC) continue;
      let push; if (lC && !cC) push = true; else if (cC && !lC) push = false; else if (l && ch) push = (l.updated || 0) > (c.updated || 0); else push = !!l;
      try {
        if (push) { const ref = col.doc(id);
          if (l) { const h = lh; await putBig(ref, { id, name: l.name || '', created: l.created || 0, updated: l.updated || Date.now(), thumb: l.thumb || '', thumbFixed: !!l.thumbFixed, h }, l.data); base[id] = [lh, h]; cloud.set(id, { id, h, updated: l.updated }); }
          else { await ref.set({ id, deleted: true, updated: Date.now() }); delete base[id]; cloud.set(id, { id, deleted: true }); } }
        else { if (ch) { const data = await getBig(col.doc(id), c); const w = { id, name: c.name, created: c.created, updated: c.updated, data, thumb: c.thumb || '', thumbFixed: !!c.thumbFixed }; loc.set(id, w); base[id] = [hw(w), ch]; }
          else { loc.delete(id); delete base[id]; } changed = true; }
      } catch (e) { err = e; } }
    if (changed) { const out = [...loc.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0)); if (!ls.set(WK, JSON.stringify(out))) err = err || { code: 'local_full' }; }
    ls.set(BASE, JSON.stringify(base)); lastW = ls.get(WK); if (changed) onWorks();
    if (err) throw err; }
  async function syncDraft(first) { const raw = ls.get(DK); const lt = +(ls.get(DT) || 0); const ref = db.doc('draft/current'); const sn = await ref.get(); const d = sn.exists ? sn.data() : null;
    if (first && d && d.updated > lt) { const data = await getBig(ref, d); ls.set(DK, JSON.stringify(data)); ls.set(DT, String(d.updated)); if (d.cur) ls.set(CK, d.cur); lastD = ls.get(DK); if (opt.onDraft) opt.onDraft(); return; }
    if (raw && raw !== lastD) { let data; try { data = JSON.parse(raw); } catch (_) { return; } const now = Math.max(Date.now(), (d && d.updated || 0) + 1); await putBig(ref, { updated: now, cur: ls.get(CK) || '' }, data); ls.set(DT, String(now)); }
    lastD = raw; }
  async function run(first) { if (!db || !gotSnap) return; if (busy) { again = true; return; } busy = true; again = false; st('☁ 同期中…');
    try { await syncWorks(); await syncDraft(first); st('☁ 保存済み'); }
    catch (e) { const c = e && e.code; st(c === 'quota_exceeded' ? '☁ いっぱいで保存できへん' : c === 'local_full' ? 'この端末の容量がいっぱい' : '☁ 同期できへんかった（手元には残ってる）', true); }
    busy = false; if (again) setTimeout(() => run(false), 300); }
  const soon = () => { clearTimeout(t); t = setTimeout(() => run(false), 1500); };
  (async () => { st('この端末に保存'); db = await opt.use('db'); if (!db) return; col = db.collection('works'); st('☁ つないでる…'); let first = true;
    col.onSnapshot(sn => { cloud = new Map(); for (const d of sn.docs) { const x = d.data(); if (x) cloud.set(d.id, x); } if (sn.metadata && sn.metadata.fromCache && !sn.size) return; gotSnap = true; run(first); first = false; },
      () => st('☁ つながらへん（手元には残ってる）', true));
    setInterval(() => { if (!gotSnap) return; if (ls.get(WK) !== lastW || ls.get(DK) !== lastD) soon(); }, 2000);
    addEventListener('storage', e => { if (e.key === WK || e.key === DK) soon(); }); })();
  return { now: () => run(false) };
}
function loadWorks(){try{return JSON.parse(localStorage.getItem(keys.works)||"[]");}catch(_){return [];}}
function saveWorks(list){try{localStorage.setItem(keys.works,JSON.stringify(list));return true;}catch(_){return false;}}
function saveDraft(state){localStorage.setItem(keys.draft,JSON.stringify(state));}
window.BoneStorage=Object.freeze({boneCloud,loadWorks,saveWorks,saveDraft});
})();
