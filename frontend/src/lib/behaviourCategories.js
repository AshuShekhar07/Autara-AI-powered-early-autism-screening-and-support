/** Fixed ABC categories (must match backend/lib/behaviourEnums.js) with plain-language labels. */
export const ANTECEDENTS = [
  { value: 'transition',          label: 'Change of activity' },
  { value: 'demand_or_task',      label: 'Asked to do something' },
  { value: 'denied_access',       label: 'Told "no" / item or activity denied' },
  { value: 'sensory_noise_light', label: 'Noise, light or other sensory input' },
  { value: 'low_attention_alone', label: 'Little attention / left alone' },
  { value: 'social_interaction',  label: 'Social interaction' },
  { value: 'routine_change',      label: 'Change in routine' },
  { value: 'other',               label: 'Something else' },
]
export const BEHAVIOURS = [
  { value: 'meltdown_tantrum',    label: 'Meltdown / tantrum' },
  { value: 'aggression',          label: 'Aggression' },
  { value: 'self_injury',         label: 'Self-injury' },
  { value: 'elopement',           label: 'Running off / wandering' },
  { value: 'repetitive_stimming', label: 'Repetitive movements (stimming)' },
  { value: 'withdrawal',          label: 'Withdrawal' },
  { value: 'vocal_outburst',      label: 'Vocal outburst' },
  { value: 'other',               label: 'Something else' },
]
export const CONSEQUENCES = [
  { value: 'comforted',              label: 'Comforted' },
  { value: 'removed_from_situation', label: 'Taken out of the situation' },
  { value: 'demand_removed',         label: 'Task or demand removed' },
  { value: 'given_item',             label: 'Given an item or activity' },
  { value: 'planned_ignoring',       label: 'Planned ignoring' },
  { value: 'redirected',             label: 'Redirected' },
  { value: 'other',                  label: 'Something else' },
]
export const SETTINGS = [
  { value: 'home', label: 'Home' }, { value: 'school', label: 'School' }, { value: 'therapy', label: 'Therapy' },
  { value: 'public', label: 'Out in public' }, { value: 'other', label: 'Other' },
]

const index = (list) => Object.fromEntries(list.map((c) => [c.value, c.label]))
const A = index(ANTECEDENTS), B = index(BEHAVIOURS), C = index(CONSEQUENCES), S = index(SETTINGS)
export const antecedentLabel  = (v) => A[v] || v
export const behaviourLabel   = (v) => B[v] || v
export const consequenceLabel = (v) => C[v] || v
export const settingLabel     = (v) => S[v] || v

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
