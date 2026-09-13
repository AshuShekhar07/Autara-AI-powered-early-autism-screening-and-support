import React from 'react'
import './ResourcesSection.css'

/**
 * ResourcesSection
 *
 * Static, curated content — no API required.
 * These resources are hardcoded and can be updated by editing STATIC_RESOURCES below.
 * They are NOT placeholders; this is real, intentionally static content.
 */

const STATIC_RESOURCES = [
  {
    id: 'ped-questions',
    tag: 'Pediatrician visit',
    title: 'Questions to ask your pediatrician',
    desc: 'A concise guide to the most important developmental questions to raise at your next well-child visit.',
    href: 'https://www.healthychildren.org/English/family-life/health-management/Pages/Well-Child-Care-A-Check-Up-for-Success.aspx',
    linkLabel: 'HealthyChildren.org',
  },
  {
    id: 'specialist',
    tag: 'Specialist referral',
    title: 'When to consult a specialist',
    desc: 'Learn which signs suggest it\'s time to reach out to a developmental pediatrician, speech therapist, or occupational therapist.',
    href: 'https://www.cdc.gov/ncbddd/actearly/concerned.html',
    linkLabel: 'CDC Act Early',
  },
  {
    id: 'milestones',
    tag: 'Development',
    title: 'Developmental milestones by age',
    desc: 'The CDC\'s updated milestone checklists cover social, language, movement, and cognitive skills from 2 months through 5 years.',
    href: 'https://www.cdc.gov/ncbddd/actearly/milestones/index.html',
    linkLabel: 'CDC Milestones',
  },
  {
    id: 'asd-signs',
    tag: 'Autism',
    title: 'Early signs of autism spectrum disorder',
    desc: 'A plain-language overview of early autism indicators, including what to watch for and how a formal evaluation works.',
    href: 'https://www.autismspeaks.org/signs-autism',
    linkLabel: 'Autism Speaks',
  },
  {
    id: 'nih-dev',
    tag: 'Research',
    title: 'Understanding the evaluation process',
    desc: 'What to expect when a professional evaluation is recommended — from the referral through to receiving a report.',
    href: 'https://www.nichd.nih.gov/health/topics/autism/conditioninfo/diagnosis',
    linkLabel: 'NIH / NICHD',
  },
]

export default function ResourcesSection() {
  return (
    <section className="resources-section" aria-labelledby="resources-heading">
      <h2 className="resources-section__heading" id="resources-heading">
        Resources &amp; Next Steps
      </h2>
      <p className="resources-section__lead">
        Curated links to trusted sources — for when you want to learn more or
        prepare for a conversation with your child's care team.
      </p>

      <ul className="resources-grid" role="list">
        {STATIC_RESOURCES.map(r => (
          <li key={r.id}>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="resource-card"
              aria-label={`${r.title} — opens in a new tab`}
            >
              <span className="resource-card__tag">{r.tag}</span>
              <span className="resource-card__title">{r.title}</span>
              <span className="resource-card__desc">{r.desc}</span>
              <span className="resource-card__link-label" aria-hidden="true">
                {r.linkLabel}
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
