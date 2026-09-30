/**
 * Whole months between a date of birth and `at` (default now), using UTC calendar fields.
 * Example: dob 2024-01-15, at 2025-03-14 → 13 (the 14th month is not complete yet).
 */
function ageInMonths(dob, at = new Date()) {
  const d = new Date(dob)
  let months = (at.getUTCFullYear() - d.getUTCFullYear()) * 12 + (at.getUTCMonth() - d.getUTCMonth())
  if (at.getUTCDate() < d.getUTCDate()) months -= 1
  return Math.max(0, months)
}

module.exports = { ageInMonths }
