const { ageInMonths } = require('../utils/age')

it('counts whole completed months', () => {
  expect(ageInMonths('2024-01-15', new Date('2025-03-14T00:00:00Z'))).toBe(13)
  expect(ageInMonths('2024-01-15', new Date('2025-03-15T00:00:00Z'))).toBe(14)
  expect(ageInMonths('2024-01-31', new Date('2024-01-31T00:00:00Z'))).toBe(0)
})
it('never returns negative', () => {
  expect(ageInMonths('2030-01-01', new Date('2025-01-01T00:00:00Z'))).toBe(0)
})
