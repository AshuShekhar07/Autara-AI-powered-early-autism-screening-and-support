import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout          from '../components/dashboard/DashboardLayout'
import WelcomeBanner            from '../components/dashboard/WelcomeBanner'
import ChildProfileCard         from '../components/dashboard/ChildProfileCard'
import ChildSwitcher            from '../components/ChildSwitcher'
import StatCards                from '../components/dashboard/StatCards'
import LatestResultCard         from '../components/dashboard/LatestResultCard'
import DevelopmentalMilestones  from '../components/dashboard/DevelopmentalMilestones'
import ScreeningTrendChart      from '../components/dashboard/ScreeningTrendChart'
import DomainBreakdownChart     from '../components/dashboard/DomainBreakdownChart'
import CareTeamSection          from '../components/dashboard/CareTeamSection'
import RecentActivity           from '../components/dashboard/RecentActivity'
import ResourcesSection         from '../components/dashboard/ResourcesSection'
import LogBehaviourForm         from '../components/behaviour/LogBehaviourForm'
import { useChildren }          from '../context/ChildContext'
import { useApi }               from '../hooks/useApi'
import { api }                  from '../lib/api'

const BehaviourCharts = lazy(() => import('../components/behaviour/BehaviourCharts'))

/**
 * Dashboard — caregiver / patient home.
 * Everything here is REAL data for the active child (child switcher at the top):
 *   overview (stat cards, latest result, trend, domains, open actions) → GET /api/children/:id/overview
 *   care team, activity, milestones, behaviour → their own endpoints
 */
export default function Dashboard() {
  const { activeChild, loading: childrenLoading, error: childrenError, refresh } = useChildren()
  const childId = activeChild?.id
  const [logKey, setLogKey] = useState(0)

  const { data, loading, error, reload } = useApi(
    () => api.get(`/api/children/${childId}/overview`), [childId], !!childId
  )
  const overview = data?.overview || null

  // In-page anchors (e.g. /dashboard#care-team) — scroll once the section exists
  useEffect(() => {
    if (!activeChild || !window.location.hash) return
    const el = document.getElementById(window.location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeChild])

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Dashboard">
      <WelcomeBanner />

      {childrenError && (
        <div className="status-box status-box--error" role="alert" style={{ marginBottom: 20 }}>
          Couldn't load your children: {childrenError}{' '}
          <button type="button" className="sc-link-btn" onClick={refresh}>Try again</button>
        </div>
      )}

      {!childrenLoading && !childrenError && !activeChild && (
        <div className="sc-card sc-card--center" style={{ marginBottom: 28 }}>
          <h2 className="sc-title">Add your child to get started</h2>
          <p className="sc-muted">Screenings, behaviour logs and your care team are all linked to a child.</p>
          <Link to="/child-profile" className="btn btn--primary">Add a child</Link>
        </div>
      )}

      {activeChild && (
        <>
          <div style={{ marginBottom: 20 }}><ChildSwitcher label="Showing" /></div>
          <ChildProfileCard />
          <StatCards overview={overview} loading={loading} error={error} />
          {error && <button type="button" className="btn btn--ghost" style={{ marginBottom: 20 }} onClick={reload}>Try again</button>}

          <LatestResultCard overview={overview} loading={loading} />

          <DevelopmentalMilestones />

          <div className="db-charts-row">
            <ScreeningTrendChart data={overview?.screeningTrend || []} loading={loading} error={error} />
            <DomainBreakdownChart domains={overview?.lastScreening?.domainBreakdown || []} loading={loading} error={error} />
          </div>

          <div className="db-two-col">
            <div id="quick-log" style={{ minWidth: 0 }}>
              <LogBehaviourForm childId={activeChild.id} onLogged={() => { setLogKey((k) => k + 1); reload() }} />
            </div>
            <Suspense fallback={<div className="sc-card sc-card--center" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>}>
              <BehaviourCharts childId={activeChild.id} refreshKey={logKey} compact />
            </Suspense>
          </div>

          <div className="db-two-col" style={{ marginTop: 28 }}>
            <CareTeamSection />
            <RecentActivity />
          </div>
        </>
      )}

      <ResourcesSection />
    </DashboardLayout>
  )
}
