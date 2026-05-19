// Default-width tokens for ResourceTable columns. ResourceTable's defaultColumn
// is { size: 160 } which is right for free-form text (Name, Image, URL). Short,
// constrained-value columns (Status, Phase, single-digit counts) feel oversized
// at 160 — pick a token below to set a tighter initial width. Users can still
// drag-resize and reorder; persisted prefs in tablePrefs override these.
export const COL_XS = 72 // single number/boolean: Ready (1/1), Restarts, Replicas, Suspend, Active
export const COL_SM = 96 // short label: Status, Phase, Sync, Health, Type, Age, Strategy
export const COL_MD = 130 // moderate: Namespace, Project, Schedule, Capacity, Roles
