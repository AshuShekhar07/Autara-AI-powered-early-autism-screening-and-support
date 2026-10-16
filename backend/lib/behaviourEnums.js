/** Fixed ABC category enums so aggregation works. Keep in sync with frontend/src/lib/behaviourCategories.js. */
const ANTECEDENTS = [
  'transition', 'demand_or_task', 'denied_access', 'sensory_noise_light',
  'low_attention_alone', 'social_interaction', 'routine_change', 'other',
]
const BEHAVIOURS = [
  'meltdown_tantrum', 'aggression', 'self_injury', 'elopement',
  'repetitive_stimming', 'withdrawal', 'vocal_outburst', 'other',
]
const CONSEQUENCES = [
  'comforted', 'removed_from_situation', 'demand_removed', 'given_item',
  'planned_ignoring', 'redirected', 'other',
]
const SETTINGS = ['home', 'school', 'therapy', 'public', 'other']

module.exports = { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES, SETTINGS }

/** Plain-language label for a behaviour category (used in feeds / reports / evidence). */
const BEHAVIOUR_LABELS = {
  meltdown_tantrum: 'Meltdown / tantrum', aggression: 'Aggression', self_injury: 'Self-injury',
  elopement: 'Running off / wandering', repetitive_stimming: 'Repetitive movements (stimming)',
  withdrawal: 'Withdrawal', vocal_outburst: 'Vocal outburst', other: 'Something else',
}
module.exports.behaviourLabelOf = (v) => BEHAVIOUR_LABELS[v] || v

const ANTECEDENT_LABELS = {
  transition: 'Change of activity', demand_or_task: 'Asked to do something', denied_access: 'Told "no" / item or activity denied',
  sensory_noise_light: 'Noise, light or other sensory input', low_attention_alone: 'Little attention / left alone',
  social_interaction: 'Social interaction', routine_change: 'Change in routine', other: 'Something else',
}
const CONSEQUENCE_LABELS = {
  comforted: 'Comforted', removed_from_situation: 'Taken out of the situation', demand_removed: 'Task or demand removed',
  given_item: 'Given an item or activity', planned_ignoring: 'Planned ignoring', redirected: 'Redirected', other: 'Something else',
}
module.exports.labels = {
  behaviour: (v) => BEHAVIOUR_LABELS[v] || v,
  antecedent: (v) => ANTECEDENT_LABELS[v] || v,
  consequence: (v) => CONSEQUENCE_LABELS[v] || v,
}
