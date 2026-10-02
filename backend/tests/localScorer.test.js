jest.mock('../lib/aiClient')
const aiClient = require('../lib/aiClient')
const { scoreLocally, tierFor, localDefinition } = require('../lib/localScorer')
const { getInstrument, clearInstrumentCache } = require('../lib/instrument')
const { AppError } = require('../utils/respond')

const REVERSE = [2, 5, 12]
const typical = () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), REVERSE.includes(i + 1) ? 'no' : 'yes']))
const withFlagged = (n) => { const a = typical(); for (let i = 1; i <= n; i++) a[String(i)] = REVERSE.includes(i) ? 'yes' : 'no'; return a }

describe('local M-CHAT-R scorer (offline fallback — same official rules as the AI service)', () => {
  it('typical answers → 0 flagged, low', () => {
    expect(scoreLocally(typical())).toMatchObject({ riskScore: 0, riskTier: 'low', atRiskItems: [], modelProbability: null, modelVersion: 'mchatr-rules-v1-local' })
  })
  it('only items 2, 5, 12 are flagged by a "yes"; every other item by a "no"', () => {
    for (const n of REVERSE) expect(scoreLocally({ ...typical(), [n]: 'yes' }).atRiskItems).toEqual([n])
    expect(scoreLocally({ ...typical(), 1: 'no' }).atRiskItems).toEqual([1])
    expect(scoreLocally({ ...typical(), 2: 'yes', 1: 'no' }).atRiskItems).toEqual([1, 2])
  })
  it.each([[0, 'low'], [2, 'low'], [3, 'medium'], [7, 'medium'], [8, 'high'], [20, 'high']])('%i flagged → %s (tier boundaries 2/3 and 7/8)', (n, tier) => {
    const r = scoreLocally(withFlagged(n))
    expect(r.riskScore).toBe(n); expect(r.riskTier).toBe(tier); expect(tierFor(n)).toBe(tier)
  })
  it('matches the AI service on a known case (verified against the Python scorer: items 1, 7, 9 flagged → 3, medium)', () => {
    const a = typical(); a['1'] = 'no'; a['7'] = 'no'; a['9'] = 'no'
    const r = scoreLocally(a)
    expect(r).toMatchObject({ riskScore: 3, riskTier: 'medium', atRiskItems: [1, 7, 9] })
    expect(r.domainBreakdown[0]).toEqual({ domain: 'joint_attention', label: 'Joint attention & sharing interest', atRiskCount: 3, totalItems: 7 })
  })
  it('domain counts add up and cover all 20 items', () => {
    const r = scoreLocally(withFlagged(20))
    expect(r.domainBreakdown.reduce((n, d) => n + d.atRiskCount, 0)).toBe(20)
    expect(r.domainBreakdown.reduce((n, d) => n + d.totalItems, 0)).toBe(20)
  })
  it('the built-in definition carries the copyright, 20 items and the unverified-wording flag', () => {
    expect(localDefinition.items).toHaveLength(20)
    expect(localDefinition.copyright).toMatch(/Diana Robins/)
    expect(localDefinition.wordingVerified).toBe(false)
    expect(localDefinition.domainGroupingNote).toMatch(/not part of the official instrument/)
  })
})

describe('getInstrument fallback', () => {
  beforeEach(() => { jest.resetAllMocks(); clearInstrumentCache(); jest.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('uses the live definition when the AI service answers, and caches it', async () => {
    aiClient.instrument.mockResolvedValue({ live: true })
    expect(await getInstrument()).toEqual({ live: true })
    await getInstrument()
    expect(aiClient.instrument).toHaveBeenCalledTimes(1)
  })
  it('falls back to the built-in copy when the AI service is down, without caching the fallback', async () => {
    aiClient.instrument.mockRejectedValue(new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'down'))
    expect((await getInstrument()).items).toHaveLength(20)
    aiClient.instrument.mockResolvedValue({ live: true })
    expect(await getInstrument()).toEqual({ live: true })      // back online → live definition again
  })
})
