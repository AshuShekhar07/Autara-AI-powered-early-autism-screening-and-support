import React, { useRef, useState, useEffect } from 'react'
import { useChildren } from '../../context/ChildContext'
import { api } from '../../lib/api'
import { DISCLAIMER } from '../../lib/screeningCopy'
import './AskAutaraCard.css'

const GUARDRAIL_LABEL = {
  urgent_safety: 'Urgent safety',
  medication: 'Medication',
  diagnosis: 'Not a diagnosis',
  no_sources: 'No reference material yet',
  no_answer: "I don't know",
}

/**
 * Ask Autara — Q&A grounded ONLY in the approved reference material.
 * Every reply lists its sources; when it can't answer it says so. It never diagnoses, never gives
 * medication advice, and sends emergencies to a clinician / emergency services (see the AI service guardrails).
 * The conversation lives in this component's state only (nothing is stored).
 * Props: full (page layout: taller history)
 */
export default function AskAutaraCard({ full = false }) {
  const { activeChild } = useChildren()
  const [question, setQuestion] = useState('')
  const [useContext, setUseContext] = useState(true)
  const [turns, setTurns] = useState([])       // [{ q, a?: { answer, sources, guardrail }, error? }]
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [turns])

  async function submit(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)
    setQuestion('')
    const index = turns.length
    setTurns((t) => [...t, { q }])
    try {
      const body = { question: q }
      if (useContext && activeChild) body.childId = activeChild.id
      const a = await api.post('/api/assistant/ask', body)
      setTurns((t) => t.map((turn, i) => (i === index ? { ...turn, a } : turn)))
    } catch (err) {
      setTurns((t) => t.map((turn, i) => (i === index ? { ...turn, error: err.message } : turn)))
    }
    setBusy(false)
  }

  return (
    <section className="ask-card ask-card--live" id="ask" aria-labelledby="ask-h">
      <div className="ask-card__content">
        <h2 className="ask-card__title" id="ask-h">Ask Autara</h2>
        <p className="ask-card__body">
          Ask a general question about screening, follow-up or preparing for appointments. Answers come only from approved
          reference material and always show their sources. Autara can't diagnose or give medical advice.
        </p>

        <div className={`ask-log${full ? ' ask-log--full' : ''}`} role="log" aria-live="polite" aria-label="Conversation">
          {turns.length === 0 && <p className="sc-muted">No questions yet.</p>}
          {turns.map((t, i) => (
            <div key={i} className="ask-turn">
              <p className="ask-q"><span className="bh-sr">You asked: </span>{t.q}</p>
              {!t.a && !t.error && <p className="sc-muted" role="status">Looking through the reference material…</p>}
              {t.error && <p className="ask-a ask-a--error" role="alert">{t.error}</p>}
              {t.a && (
                <div className={`ask-a${t.a.guardrail === 'urgent_safety' ? ' ask-a--urgent' : ''}`} role={t.a.guardrail === 'urgent_safety' ? 'alert' : undefined}>
                  {t.a.guardrail && <span className="ask-tag">{GUARDRAIL_LABEL[t.a.guardrail] || 'Note'}</span>}
                  <p>{t.a.answer}</p>
                  {t.a.sources.length > 0 ? (
                    <ul className="ask-sources" aria-label="Sources">
                      {t.a.sources.map((s, j) => (
                        <li key={j}>
                          {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
                          <span className="sc-muted"> — {s.publisher}, {s.version}{s.page ? `, p. ${s.page}` : ''}{s.section ? `, ${s.section}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sc-hint">Sources: none</p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form className="ask-form" onSubmit={submit}>
          <label htmlFor="ask-input" className="bh-sr">Your question</label>
          <input id="ask-input" type="text" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)}
                 placeholder="e.g. What happens at a follow-up interview?" autoComplete="off" disabled={busy} />
          <button type="submit" className="btn btn--primary" disabled={busy || !question.trim()}>{busy ? 'Asking…' : 'Ask'}</button>
        </form>
        {activeChild && (
          <label className="ask-ctx">
            <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
            Use {activeChild.name}'s latest reviewed screening result as context (tier and areas only — no name is shared)
          </label>
        )}
        <p className="sc-hint">{DISCLAIMER} In an emergency, contact your local emergency services.</p>
      </div>
    </section>
  )
}
