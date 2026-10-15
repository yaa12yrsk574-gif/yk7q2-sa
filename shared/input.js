// Shared PC input contract. Modes supply targets and primary actions, never remap buttons.
window.__editorInput = Object.freeze({
  intent(e) { if(e.button===1 || (e.button===0&&e.altKey))return 'camera'; if(e.button===2)return 'select'; return e.button===0?'primary':'ignore'; },
  selection(current, picked, additive, key) { if(!additive)return picked.slice(); const map=new Map(current.map(v=>[key(v),v])); for(const v of picked){const k=key(v);if(map.has(k))map.delete(k);else map.set(k,v);} return [...map.values()]; }
});
