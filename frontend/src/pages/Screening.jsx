import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import { api } from '../lib/api'
import { safeSession } from '../lib/safeStorage'
import { formatAgeMonths } from '../lib/format'
import { DISCLAIMER } from '../lib/screeningCopy'
import './Screening.css'

const draftKey = (childId) => `autara.screeningDraft.${childId}`
const CURRENT_KEY = 'autara.screeningDraft.current'   // which child's screening was open last

/**
 * Screening wizard (M-CHAT-R)
 *
 *   pick child → age check → one question per screen → review → submit → result page
 *
 * Answers live in React state; a draft (answers, question number, step) is mirrored to sessionStorage
 * (in try/catch) after every click. Leaving the page — another menu item, a refresh — and coming back
 * reopens the screening exactly where it was, with a "Start over" option. Drafts are cleared on submit
 * and on log out. The questionnaire text comes from the AI service (single
 * source of truth) via GET /api/screenings/instrument.
 */
export default function Screening() {
  const navigate = useNavigate()

  const [children, setChildren]     = useState(null)   // null = loading
  const [instrument, setInstrument] = useState(null)
  const [loadError, setLoadError]   = useState('')

  const [child, setChild]     = useState(null)
  const [step, setStep]       = useState('child')      // child | age | questions | review
  const [index, setIndex]     = useState(0)            // current question (0-based)
  const [answers, setAnswers] = useState({})           // { "1": "yes", ... }
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [resumed, setResumed] = useState(false)         // true = we reopened a saved draft

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [c, i] = await Promise.all([api.get('/api/children'), api.get('/api/screenings/instrument')])
      setChildren(c.children)
      setInstrument(i.instrument)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const items = instrument?.items || []
  const total = items.length
  const range = instrument?.ageRangeMonths || { min: 16, max: 30 }

  // Coming back to this page: reopen the screening that was in progress.
  useEffect(() => {
    if (!children || !instrument || child) return
    const currentId = safeSession.get(CURRENT_KEY)
    const c = currentId && children.find((x) => x.id === currentId)
    const draft = c && safeSession.get(draftKey(c.id))
    if (!c || !draft?.answers || Object.keys(draft.answers).length === 0) return
    if (c.ageMonths < range.min || c.ageMonths > range.max) return
    setChild(c)
    setAnswers(draft.answers)
    setIndex(Math.min(draft.index || 0, Math.max(items.length - 1, 0)))
    setStep(draft.step === 'review' ? 'review' : 'questions')
    setResumed(true)
  }, [children, instrument]) // eslint-disable-line react-hooks/exhaustive-deps

  // Closing the tab would lose the draft (it lives in this tab's storage) — let the browser ask first.
  const inProgress = (step === 'questions' || step === 'review') && Object.keys(answers).length > 0 && !submitting
  useEffect(() => {
    if (!inProgress) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [inProgress])

  function pickChild(c) {
    setChild(c)
    setSubmitError('')
    if (c.ageMonths < range.min || c.ageMonths > range.max) { setStep('age'); return }
    const draft = safeSession.get(draftKey(c.id))
    if (draft?.answers && Object.keys(draft.answers).length) {
      setAnswers(draft.answers)
      setIndex(Math.min(draft.index || 0, Math.max(total - 1, 0)))
      setResumed(true)
    } else {
      setAnswers({}); setIndex(0); setResumed(false)
    }
    safeSession.set(CURRENT_KEY, c.id)
    setStep(draft?.step === 'review' ? 'review' : 'questions')
  }

  function saveDraft(nextAnswers, nextIndex, nextStep = step) {
    if (!child) return
    safeSession.set(draftKey(child.id), { answers: nextAnswers, index: nextIndex, step: nextStep })
    safeSession.set(CURRENT_KEY, child.id)
  }

  function startOver() {
    if (child) safeSession.remove(draftKey(child.id))
    safeSession.remove(CURRENT_KEY)
    setAnswers({}); setIndex(0); setResumed(false); setChild(null); setStep('child')
  }

  function changeStep(nextStep, nextIndex = index) {
    setStep(nextStep)
    setIndex(nextIndex)
    saveDraft(answers, nextIndex, nextStep)
  }

  function choose(itemNumber, value) {
    const next = { ...answers, [itemNumber]: value }
    setAnswers(next)
    saveDraft(next, index)
  }

  function goTo(nextIndex) {
    setIndex(nextIndex)
    saveDraft(answers, nextIndex)
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const { screening } = await api.post('/api/screenings', { childId: child.id, answers })
      safeSession.remove(draftKey(child.id))
      safeSession.remove(CURRENT_KEY)
      navigate(`/screenings/${screening.id}`, { replace: true })
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  const unanswered = useMemo(() => items.filter((it) => !answers[it.number]).map((it) => it.number), [items, answers])

  /* ── loading / error ── */
  if (loadError) {
    return (
      <DashboardLayout activeNav="screening" pageTitle="New Screening">
        <div className="sc-card sc-card--center" role="alert">
          <h1 className="sc-title">We couldn't load the screening</h1>
          <p className="sc-muted">{loadError}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>Try again</button>
        </div>
      </DashboardLayout>
    )
  }
  if (!children || !instrument) {
    return (
      <DashboardLayout activeNav="screening" pageTitle="New Screening">
        <div className="sc-card sc-card--center" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout activeNav="screening" pageTitle="New Screening">
      <div className="sc-wrap">
        {!instrument.wordingVerified && (
          <div className="status-box status-box--notice sc-dev-note" role="note">
            <strong>Development build:</strong>&nbsp;the questionnaire wording has not yet been checked
            against the official M-CHAT-R/F. Do not use with real families until it has been.
          </div>
        )}

        {resumed && child && (step === 'questions' || step === 'review') && (
          <div className="status-box status-box--ok sc-resume" role="status">
            <span>
              <strong>Welcome back.</strong> Your answers for {child.name} were saved
              ({Object.keys(answers).length} of {total} answered) — carry on where you left off.
            </span>
            <button type="button" className="sc-link-btn" onClick={startOver}>Start over</button>
          </div>
        )}

        {step === 'child' && (
          <ChildStep children={children} range={range} onPick={pickChild} total={total} />
        )}

        {step === 'age' && child && (
          <AgeStep child={child} range={range} onBack={() => setStep('child')} />
        )}

        {step === 'questions' && child && (
          <QuestionStep
            instructions={instrument.instructions}
            item={items[index]} index={index} total={total}
            answer={answers[items[index].number]}
            onChoose={(v) => choose(items[index].number, v)}
            onBack={() => (index === 0 ? setStep('child') : goTo(index - 1))}
            onNext={() => (index === total - 1 ? changeStep('review', index) : goTo(index + 1))}
          />
        )}

        {step === 'review' && child && (
          <ReviewStep
            items={items} answers={answers} child={child} unanswered={unanswered}
            submitting={submitting} error={submitError}
            onEdit={(i) => changeStep('questions', i)}
            onBack={() => changeStep('questions', total - 1)}
            onSubmit={submit}
          />
        )}

        <p className="sc-footer">{instrument.copyright} {DISCLAIMER}</p>
      </div>
    </DashboardLayout>
  )
}

/* ─────────────────────────── steps ─────────────────────────── */

function ChildStep({ children, range, onPick, total }) {
  if (children.length === 0) {
    return (
      <div className="sc-card sc-card--center">
        <h1 className="sc-title">Add a child first</h1>
        <p className="sc-muted">A screening is linked to a child. Add your child's details to begin.</p>
        <Link to="/child-profile" className="btn btn--ghost">Go to child profile</Link>
      </div>
    )
  }
  return (
    <div className="sc-card">
      <h1 className="sc-title">Who is this screening for?</h1>
      <p className="sc-muted">
        The M-CHAT-R questionnaire is designed for children aged {range.min}–{range.max} months.
        It takes about 5 minutes: 20 yes/no questions.
      </p>
      <ul className="sc-child-list">
        {children.map((c) => {
          const inRange = c.ageMonths >= range.min && c.ageMonths <= range.max
          const saved = inRange ? Object.keys(safeSession.get(draftKey(c.id))?.answers || {}).length : 0
          return (
            <li key={c.id}>
              <button type="button" className="sc-child-btn" onClick={() => onPick(c)}>
                <span className="sc-child-btn__name">{c.name}</span>
                <span className="sc-child-btn__meta">
                  {formatAgeMonths(c.ageMonths)} old{inRange ? '' : ' · outside the age range'}
                </span>
                {saved > 0 && <span className="sc-child-btn__draft">In progress · {saved} of {total} answered — tap to continue</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AgeStep({ child, range, onBack }) {
  const tooYoung = child.ageMonths < range.min
  return (
    <div className="sc-card">
      <h1 className="sc-title">This questionnaire isn't the right fit right now</h1>
      <p>
        {child.name} is {formatAgeMonths(child.ageMonths)} old. The M-CHAT-R has only been validated for
        children between {range.min} and {range.max} months, so we can't give you a reliable result
        {tooYoung ? ' yet. You can come back once they reach ' + range.min + ' months.' : '.'}
      </p>
      <p className="sc-muted">That's completely okay. Here is what you can do in the meantime:</p>
      <ul className="sc-list">
        <li>Log what you notice day to day with the <Link to="/behaviour">behaviour log</Link> — it helps professionals see patterns.</li>
        <li>If you have any worries about {child.name}'s development, talk to your child's doctor or a qualified clinician. You don't need a screening result to ask.</li>
      </ul>
      <div className="sc-actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>Choose another child</button>
        <Link to="/dashboard" className="btn btn--ghost">Back to dashboard</Link>
      </div>
    </div>
  )
}

function QuestionStep({ item, index, total, answer, onChoose, onBack, onNext, instructions }) {
  const pct = Math.round((index / total) * 100)
  return (
    <div className="sc-card">
      <div className="sc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total}
           aria-valuenow={index + 1} aria-label={`Question ${index + 1} of ${total}`}>
        <div className="sc-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="sc-step-label">Question {index + 1} of {total}</p>

      <fieldset className="sc-question">
        <legend className="sc-question__text">{item.text}</legend>
        <div className="sc-choices">
          {['yes', 'no'].map((v) => (
            <label key={v} className={`sc-choice${answer === v ? ' sc-choice--on' : ''}`}>
              <input
                type="radio" name={`q-${item.number}`} value={v}
                checked={answer === v} onChange={() => onChoose(v)}
              />
              <span>{v === 'yes' ? 'Yes' : 'No'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sc-actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={!answer}>
          {index === total - 1 ? 'Review answers' : 'Next'}
        </button>
      </div>
      {/* Official instructions, shown word for word (the authors do not allow rewording). */}
      <p className="sc-hint">{instructions || 'Answer based on how your child usually behaves.'}</p>
      <p className="sc-hint">Your progress is saved on this device while this tab stays open.</p>
    </div>
  )
}

function ReviewStep({ items, answers, child, unanswered, submitting, error, onEdit, onBack, onSubmit }) {
  return (
    <div className="sc-card">
      <h1 className="sc-title">Review your answers</h1>
      <p className="sc-muted">For {child.name}. You can change any answer before submitting.</p>
      <ol className="sc-review">
        {items.map((it, i) => (
          <li key={it.number} className="sc-review__row">
            <span className="sc-review__q">{it.text}</span>
            <span className="sc-review__a">
              <strong>{answers[it.number] ? (answers[it.number] === 'yes' ? 'Yes' : 'No') : '—'}</strong>
              <button type="button" className="sc-link-btn" onClick={() => onEdit(i)}
                      aria-label={`Change answer to question ${it.number}`}>Change</button>
            </span>
          </li>
        ))}
      </ol>
      {unanswered.length > 0 && (
        <div className="status-box status-box--notice" role="alert">
          Please answer question{unanswered.length > 1 ? 's' : ''} {unanswered.join(', ')} before submitting.
        </div>
      )}
      {error && <div className="status-box status-box--error" role="alert">{error}</div>}
      <div className="sc-actions">
        <button type="button" className="btn btn--ghost" onClick={onBack} disabled={submitting}>Back</button>
        <button type="button" className="btn btn--primary" onClick={onSubmit}
                disabled={submitting || unanswered.length > 0}>
          {submitting ? 'Submitting…' : 'Submit screening'}
        </button>
      </div>
    </div>
  )
}
