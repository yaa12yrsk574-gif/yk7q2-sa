// Existing persistence keys and project format. Do not rename without a migration.
window.ProjectData = Object.freeze({keys:Object.freeze({"draft":"yuya_bone_lowpoly_v1","works":"yuya_bone_lowpoly_works","current":"yuya_bone_lowpoly_cur","draftTime":"yuya_bone_lowpoly_v1_t","syncBase":"yuya_bone_sync_base","blueprints":"yuya_bp_count"}),
 newState: () => ({bones: [], sym: true}),
 clone: o => JSON.parse(JSON.stringify(o))
});
