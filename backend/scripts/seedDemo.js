/**
 * Attach SYNTHETIC demo data to existing (Firebase-backed) accounts so the full demo works after signup.
 *
 *   npm run seed:demo -- --caregiver <email> --therapist <email> --clinician <email>
 *
 * Creates (idempotently — safe to re-run, nothing is duplicated):
 *   - 2 synthetic children for the caregiver (marked "(demo)"), care-team links to the therapist + clinician
 *   - 3 screenings (one per risk tier) — the first two reviewed, the high-tier one waiting in the review queue
 *   - ~60 behaviour logs over 6 weeks with realistic patterns (transitions → meltdowns, mostly late afternoon…)
 *   - a couple of therapist session notes
 * Every name below is fictional. Nothing is copied from real people. Data is tagged so re-runs update it in place.
 *
 * The accounts must already exist (sign up in the app first). Reads MONGODB_URI from backend/.env.
 * Needs the AI service ONLY if you want scored answers computed there; this script computes the official
 * M-CHAT-R score locally from fixed answer sets so it works offline (same rules as ai-service).
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const SessionNote = require('../models/SessionNote')
const { localFacets } = require('../lib/localTime')

const DEMO_TAG = 'demo-seed-v1'
const DAY = 86400000

/** Deterministic pseudo-random so every run creates the same pattern. */
function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// ── Official M-CHAT-R scoring rules (kept in sync with ai-service/app/screening/mchatr.py) ──
const REVERSE = new Set([2, 5, 12])
const DOMAINS = [
  ['joint_attention', 'Joint attention & sharing interest', [1, 6, 7, 9, 16, 17, 19]],
  ['social_engagement', 'Social engagement', [8, 10, 11, 14]],
  ['communication', 'Communication & understanding', [2, 18]],
  ['imitation_play', 'Imitation & pretend play', [3, 15]],
  ['sensory_motor', 'Sensory, motor & movement', [4, 5, 12, 13, 20]],
]
const atRisk = (n, a) => (REVERSE.has(n) ? a === 'yes' : a === 'no')
function score(answers) {
  const items = []
  for (let n = 1; n <= 20; n++) if (atRisk(n, answers[n])) items.push(n)
  const riskScore = items.length
  return {
    riskScore, riskTier: riskScore <= 2 ? 'low' : riskScore <= 7 ? 'medium' : 'high', atRiskItems: items,
    domainBreakdown: DOMAINS.map(([domain, label, list]) => ({ domain, label, atRiskCount: list.filter((n) => items.includes(n)).length, totalItems: list.length })),
  }
}
/** Typical answers (nothing flagged) with the given items flipped to the flagged direction. */
function answersFlagging(flagged) {
  const a = {}
  for (let n = 1; n <= 20; n++) a[n] = REVERSE.has(n) ? 'no' : 'yes'
  for (const n of flagged) a[n] = REVERSE.has(n) ? 'yes' : 'no'
  return a
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i]
  return out
}

const ANT = [['transition', 0.36], ['demand_or_task', 0.2], ['sensory_noise_light', 0.14], ['routine_change', 0.1], ['denied_access', 0.1], ['social_interaction', 0.06], ['low_attention_alone', 0.04]]
const CONS = ['comforted', 'comforted', 'removed_from_situation', 'demand_removed', 'given_item', 'redirected', 'planned_ignoring']
function pick(r, weighted) {
  let x = r(); for (const [v, w] of weighted) { if ((x -= w) <= 0) return v } return weighted[0][0]
}

/** ~60 logs over 6 weeks; transitions → meltdowns dominate, afternoons peak, intensity slowly eases. */
function buildLogs(childId, uids, tz = 0) {
  const r = rng(42)
  const logs = []
  const now = Date.now()
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(r() * 42)
    const hour = r() < 0.55 ? 15 + Math.floor(r() * 4) : 7 + Math.floor(r() * 12)  // afternoon peak (15–18h)
    const at = new Date(now - daysAgo * DAY); at.setUTCHours(hour, Math.floor(r() * 60), 0, 0)
    if (at.getTime() > now) at.setTime(now - 3600_000)
    const antecedent = pick(r, ANT)
    const behaviour = antecedent === 'transition' && r() < 0.75 ? 'meltdown_tantrum'
      : antecedent === 'sensory_noise_light' ? (r() < 0.5 ? 'withdrawal' : 'vocal_outburst')
      : pick(r, [['meltdown_tantrum', 0.4], ['vocal_outburst', 0.2], ['withdrawal', 0.15], ['repetitive_stimming', 0.15], ['elopement', 0.06], ['aggression', 0.04]])
    const intensity = Math.max(1, Math.min(5, Math.round(3.6 - (42 - daysAgo) / 42 * 0.9 + (r() - 0.5) * 2)))
    const byTherapist = i % 5 === 0
    logs.push({
      childId, occurredAt: at,
      loggedBy: byTherapist ? uids.therapist : uids.caregiver, loggedByRole: byTherapist ? 'therapist' : 'caregiver',
      antecedent: { category: antecedent, notes: i % 6 === 0 ? 'Synthetic demo entry.' : '' },
      behaviour: { category: behaviour, description: i % 4 === 0 ? 'Synthetic demo entry — cried and needed a few minutes to settle.' : '' },
      consequence: { category: CONS[Math.floor(r() * CONS.length)], notes: '' },
      intensity, durationMinutes: 3 + Math.floor(r() * 20), setting: byTherapist ? 'therapy' : (r() < 0.75 ? 'home' : 'public'),
      tzOffsetMinutes: tz, local: localFacets(at, tz), demoTag: DEMO_TAG,
    })
  }
  return logs
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.caregiver || !args.therapist || !args.clinician) {
    console.error('Usage: npm run seed:demo -- --caregiver <email> --therapist <email> --clinician <email>')
    process.exit(1)
  }
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set (see backend/.env.example).'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)

  try {
    const find = async (email, roles) => {
      const u = await User.findOne({ email: email.trim().toLowerCase() })
      if (!u) throw new Error(`No account for ${email}. Sign up in the app first, then re-run.`)
      if (!roles.includes(u.role)) throw new Error(`${email} is a ${u.role}; expected ${roles.join(' or ')}.`)
      return u
    }
    const caregiver = await find(args.caregiver, ['caregiver', 'patient'])
    const therapist = await find(args.therapist, ['therapist'])
    const clinician = await find(args.clinician, ['clinician'])
    for (const u of [therapist, clinician]) if (!u.verified) { u.verified = true; u.verificationStatus = 'approved'; await u.save(); console.log(`Verified ${u.email} (demo convenience).`) }

    const team = [{ uid: therapist.uid, role: 'therapist' }, { uid: clinician.uid, role: 'clinician' }]
    const months = (m) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m); return d }

    // Two synthetic children (demo tag lets re-runs find them again)
    const ensureChild = async (name, ageMonths, sex) => {
      let c = await Child.findOne({ caregiverUid: caregiver.uid, name })
      if (!c) c = new Child({ caregiverUid: caregiver.uid, name, dob: months(ageMonths), sex })
      c.careTeam = team.map((m) => ({ ...m, addedAt: new Date() }))
      await c.save()
      return c
    }
    const river = await ensureChild('River (demo)', 22, 'other')
    const sky = await ensureChild('Sky (demo)', 26, 'female')
    const uids = { caregiver: caregiver.uid, therapist: therapist.uid }

    // Screenings: one of each tier. Reset demo screenings so re-runs don't stack duplicates.
    await Screening.deleteMany({ childId: { $in: [river._id, sky._id] }, demoTag: DEMO_TAG })
    const mk = async (child, flagged, daysAgo, extra = {}) => {
      const a = answersFlagging(flagged)
      const created = new Date(Date.now() - daysAgo * DAY)
      const s = await Screening.create({
        childId: child._id, submittedBy: caregiver.uid, childAgeMonths: child === river ? 22 : 26, answers: a, ...score(a),
        modelProbability: null, modelVersion: 'mchatr-rules-v1', demoTag: DEMO_TAG, createdAt: created, updatedAt: created,
        status: 'INSIGHTS_READY', statusHistory: [{ status: 'INSIGHTS_READY', at: created, by: 'system' }], ...extra,
      })
      return s
    }
    // low (2 flagged), reviewed
    await mk(sky, [8, 11], 30, {
      status: 'REVIEWED', clinicianReview: { reviewerUid: clinician.uid, reviewedAt: new Date(Date.now() - 27 * DAY), annotations: [{ text: 'Synthetic demo note: no concerns raised at review.', by: clinician.uid, at: new Date(Date.now() - 27 * DAY) }], override: null },
    })
    // medium (5 flagged), reviewed with a clinician override to low (shows the override flow)
    await mk(river, [1, 7, 9, 10, 14], 14, {
      status: 'REVIEWED',
      clinicianReview: { reviewerUid: clinician.uid, reviewedAt: new Date(Date.now() - 10 * DAY), annotations: [{ text: 'Synthetic demo note: follow-up interview done.', by: clinician.uid, at: new Date(Date.now() - 11 * DAY) }],
        override: { riskTier: 'low', originalTier: 'medium', reason: 'Synthetic demo: follow-up interview did not confirm the flagged items.', by: clinician.uid, at: new Date(Date.now() - 10 * DAY) } },
    })
    // high (10 flagged), waiting in the clinician review queue
    await mk(river, [1, 3, 6, 7, 8, 9, 10, 11, 15, 17], 2)

    // Behaviour logs: replace demo logs, keep anything the users added themselves
    await BehaviourLog.deleteMany({ childId: river._id, demoTag: DEMO_TAG })
    await BehaviourLog.insertMany(buildLogs(river._id, uids))

    await SessionNote.deleteMany({ childId: river._id, demoTag: DEMO_TAG })
    await SessionNote.insertMany([
      { childId: river._id, authorUid: therapist.uid, demoTag: DEMO_TAG, text: 'Synthetic demo note: practised turn-taking with blocks; used a visual timer before transitions.', createdAt: new Date(Date.now() - 6 * DAY) },
      { childId: river._id, authorUid: therapist.uid, demoTag: DEMO_TAG, text: 'Synthetic demo note: transition warnings 2 minutes ahead seemed to help.', createdAt: new Date(Date.now() - 1 * DAY) },
    ])

    console.log(`Seeded synthetic demo data:
  children      River (demo), Sky (demo) — care team: ${therapist.email}, ${clinician.email}
  screenings    3 (low reviewed · medium→low override reviewed · high waiting for review)
  behaviour     60 logs over 6 weeks, 2 session notes
Log in as the clinician to see the review queue, as the caregiver to see results and trends.`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => { console.error(err.message); process.exit(1) })
