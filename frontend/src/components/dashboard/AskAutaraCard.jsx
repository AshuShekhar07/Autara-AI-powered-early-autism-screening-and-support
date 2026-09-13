import React from 'react'
import './AskAutaraCard.css'

/**
 * AskAutaraCard
 *
 * Honest placeholder for the LLM-powered Q&A feature.
 * No fake chat interface is built here — the AI backend doesn't exist yet.
 * This card will be replaced with a real chat component once the API is ready.
 *
 * TODO: When the Ask Autara AI endpoint is built, replace this entire component
 * with a proper chat UI that calls POST /api/ask with { question: string }.
 */
export default function AskAutaraCard() {
  return (
    <div className="ask-card" role="region" aria-label="Ask Autara — coming soon">
      <div className="ask-card__icon-wrap" aria-hidden="true">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>

      <div className="ask-card__content">
        <h2 className="ask-card__title">
          Ask Autara
          <span className="ask-card__badge">Coming soon</span>
        </h2>
        <p className="ask-card__body">
          Soon you'll be able to ask Autara questions about your child's
          development — getting plain-language answers grounded in your
          screening results. We're building this feature carefully to ensure
          it's helpful, accurate, and never a replacement for professional advice.
        </p>
      </div>
    </div>
  )
}
