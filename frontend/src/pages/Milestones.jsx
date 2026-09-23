import React from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import './Milestones.css'

// ─────────────────────────────────────────────────────────────────────────────
// Milestone content — static, curated, informational only.
// Source guidance: CDC Developmental Milestones
// https://www.cdc.gov/ncbddd/actearly/milestones/index.html
//
// This is NOT a diagnostic tool. No scores, probabilities, or clinical
// judgments are presented. Content shows what children "can do" at each
// age range as informational guidance only.
// ─────────────────────────────────────────────────────────────────────────────

const MILESTONE_AGES = [
  {
    range: '2 months',
    months: 2,
    categories: {
      language:  ['Makes sounds other than crying', 'Reacts to loud sounds', 'Coos, makes gurgling sounds'],
      social:    ['Calms when spoken to or picked up', 'Looks at your face', 'Seems happy to see you'],
      motor:     ['Holds head up when on tummy', 'Moves both arms and legs', 'Opens hands briefly'],
      cognitive: ['Watches you as you move', 'Looks at a toy for a few seconds', 'Pays attention to faces'],
      adaptive:  ['Settles when fed', 'Wakes to feed regularly', 'Responds to comfort'],
    },
  },
  {
    range: '6 months',
    months: 6,
    categories: {
      language:  ['Takes turns making sounds with you', 'Blows raspberries', 'Makes squealing noises'],
      social:    ['Knows familiar people', 'Likes to look at self in mirror', 'Laughs'],
      motor:     ['Rolls from tummy to back', 'Pushes up on straight arms on tummy', 'Leans on hands to support self when sitting'],
      cognitive: ['Puts things in mouth', 'Reaches to grab a toy', 'Closes lips to show doesn't want more food'],
      adaptive:  ['Begins solid foods well when offered', 'Sleeps longer stretches', 'Holds bottle or breast when feeding'],
    },
  },
  {
    range: '12 months',
    months: 12,
    categories: {
      language:  ['Waves "bye-bye"', 'Calls a parent "mama" or "dada"', 'Understands "no"'],
      social:    ['Plays games such as pat-a-cake', 'Is shy or nervous with strangers', 'Shows fear in some situations'],
      motor:     ['Pulls up to stand', 'Walks holding onto furniture', 'Uses pincer grasp (finger + thumb)'],
      cognitive: ['Puts something in a container', 'Looks for things they see you hide', 'Bangs two things together'],
      adaptive:  ['Drinks from a cup without a lid when assisted', 'Picks up food to eat', 'Helps with dressing (holds out arm)'],
    },
  },
  {
    range: '2 years',
    months: 24,
    categories: {
      language:  ['Says 50 or more words', 'Says at least 2 words together', 'Names items in a book'],
      social:    ['Notices when others are hurt or upset', 'Looks at your face for how to react', 'Plays alongside other children'],
      motor:     ['Kicks a ball', 'Runs', 'Walks up a few stairs with or without help'],
      cognitive: ['Holds something in one hand and works with the other hand', 'Tries to use switches or buttons on toys', 'Plays with more than one toy at a time'],
      adaptive:  ['Eats with a spoon', 'Puts on loose-fitting clothes', 'Beginning toilet awareness'],
    },
  },
  {
    range: '3 years',
    months: 36,
    categories: {
      language:  ['Talks in conversation using at least 2 back-and-forth exchanges', 'Asks "who", "what", "where", or "why"', 'Says first name when asked'],
      social:    ['Plays with other children', 'Notices and reacts when a familiar adult is upset', 'Calms within 10 minutes after a caregiver leaves'],
      motor:     ['Strings items together', 'Puts on some clothes by themselves', 'Uses a fork'],
      cognitive: ['Draws a circle', 'Avoids touching hot objects', 'Names a friend'],
      adaptive:  ['Uses toilet with some reminders', 'Washes and dries hands', 'Puts on shoes (may not be correct foot)'],
    },
  },
  {
    range: '4 years',
    months: 48,
    categories: {
      language:  ['Says sentences with 4 or more words', 'Says some words from a song or story', 'Tells what comes next in a familiar story'],
      social:    ['Pretends to be something else during play', 'Asks to play with other children', 'Comforts others who are hurt or sad'],
      motor:     ['Catches a large ball most of the time', 'Serves food or pours water with supervision', 'Unbuttons some buttons'],
      cognitive: ['Names a few colours', 'Tells what happens next in a familiar story', 'Draws a person with 3 or more body parts'],
      adaptive:  ['Uses toilet on their own', 'Gets dressed without much help', 'Manages buttons and zippers'],
    },
  },
  {
    range: '5 years',
    months: 60,
    categories: {
      language:  ['Tells a simple story with at least 2 events', 'Answers simple questions about a book', 'Counts to 10'],
      social:    ['Follows rules or takes turns when playing games', 'Sings, dances, or acts', 'Does simple chores at home'],
      motor:     ['Buttons some buttons', 'Hops on one foot', 'Draws a person with at least 6 body parts'],
      cognitive: ['Names some letters in their name', 'Writes some letters', 'Can say their address or phone number'],
      adaptive:  ['Uses utensils and napkin at mealtimes', 'Washes hands independently', 'Brushes teeth with adult supervision'],
    },
  },
]

const CATEGORY_LABELS = {
  language:  'Language & Communication',
  social:    'Social Development',
  motor:     'Movement & Motor Skills',
  cognitive: 'Cognitive & Learning',
  adaptive:  'Adaptive & Daily Living',
}

function calcAgeMonths(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  return Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}

function getRelevantAgeGroup(ageMonths) {
  if (ageMonths === null) return null
  // Find the milestone group closest to (but not exceeding) the child's age
  let best = MILESTONE_AGES[0]
  for (const group of MILESTONE_AGES) {
    if (ageMonths >= group.months) best = group
  }
  return best
}

/**
 * Milestones page (/milestones)
 *
 * Full informational milestones page. Content is static, curated from
 * CDC guidance. This is NOT a diagnostic tool.
 *
 * If child DOB is available, highlights the relevant age group.
 * All age groups remain accessible.
 */
export default function Milestones() {
  const { profileData } = useAuth()
  const childDob    = profileData?.roleDetails?.childDob || null
  const ageMonths   = calcAgeMonths(childDob)
  const relevantGroup = getRelevantAgeGroup(ageMonths)

  const [activeGroup, setActiveGroup] = React.useState(
    relevantGroup ? relevantGroup.range : MILESTONE_AGES[0].range
  )

  const currentGroup = MILESTONE_AGES.find(g => g.range === activeGroup) || MILESTONE_AGES[0]

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Developmental Milestones">
      <div className="ml-container">

        {/* ── Back + heading ── */}
        <div className="ml-topbar">
          <Link to="/dashboard" className="ml-back" aria-label="Back to dashboard">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="ml-header">
          <h1 className="ml-header__title">Developmental Milestones</h1>
          <p className="ml-header__sub">
            {ageMonths !== null
              ? <>Showing milestones for <strong>{relevantGroup?.range}</strong> based on your child's age. Select any age group to explore.</>
              : 'Select an age group to explore developmental milestones. Add your child\'s date of birth to see age-specific guidance.'
            }
          </p>
          <p className="ml-header__disclaimer">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Milestone guidance is informed by CDC resources. This is an informational
            tracking tool — not a clinical assessment or diagnostic system.
            Consult your pediatrician with questions about your child's development.
          </p>
        </div>

        {/* ── Age group selector tabs ── */}
        <div className="ml-tabs" role="tablist" aria-label="Age groups">
          {MILESTONE_AGES.map(group => {
            const isActive    = group.range === activeGroup
            const isRelevant  = relevantGroup?.range === group.range
            return (
              <button
                key={group.range}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ml-tab${isActive ? ' ml-tab--active' : ''}${isRelevant && !isActive ? ' ml-tab--relevant' : ''}`}
                onClick={() => setActiveGroup(group.range)}
              >
                {group.range}
                {isRelevant && <span className="ml-tab__badge" aria-label="Matches your child's age">•</span>}
              </button>
            )
          })}
        </div>

        {/* ── Category panels ── */}
        <div className="ml-panels" role="tabpanel" aria-label={`${currentGroup.range} milestones`}>
          {Object.entries(currentGroup.categories).map(([catKey, items]) => (
            <section key={catKey} className="ml-panel" aria-labelledby={`ml-${catKey}-heading`}>
              <h2 className="ml-panel__heading" id={`ml-${catKey}-heading`}>
                {CATEGORY_LABELS[catKey]}
              </h2>
              <ul className="ml-panel__list" role="list">
                {items.map((item, i) => (
                  <li key={i} className="ml-panel__item">
                    <svg className="ml-panel__bullet" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ── Source link ── */}
        <div className="ml-source">
          <a
            href="https://www.cdc.gov/ncbddd/actearly/milestones/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-source__link"
          >
            View full milestone checklists on CDC Act Early
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>

      </div>
    </DashboardLayout>
  )
}
