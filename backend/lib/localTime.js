/**
 * Local-time facets for a log.
 *
 * Charts by "hour of day" / "weekday" / "week" must reflect the FAMILY's clock, not the server's.
 * The client sends `tzOffsetMinutes` (JavaScript's `-new Date().getTimezoneOffset()`, e.g. +330 for
 * India, -300 for US Eastern winter). We shift the timestamp by that offset and read UTC fields,
 * then store the results on the document so aggregation is a plain $group (fast and indexable).
 *
 *   hour    0–23
 *   weekday 0–6 (Mon=0 … Sun=6)
 *   weekStart 'YYYY-MM-DD' of the Monday of that local week
 */
function localFacets(occurredAt, tzOffsetMinutes = 0) {
  const shifted = new Date(new Date(occurredAt).getTime() + tzOffsetMinutes * 60_000)
  const hour = shifted.getUTCHours()
  const weekday = (shifted.getUTCDay() + 6) % 7 // JS: Sun=0 → we want Mon=0
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - weekday))
  return { hour, weekday, weekStart: monday.toISOString().slice(0, 10) }
}

module.exports = { localFacets }
