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
