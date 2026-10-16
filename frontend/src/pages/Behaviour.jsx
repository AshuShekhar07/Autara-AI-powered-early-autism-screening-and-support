import React, { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ChildSwitcher from '../components/ChildSwitcher'
import LogBehaviourForm from '../components/behaviour/LogBehaviourForm'
import BehaviourHistory from '../components/behaviour/BehaviourHistory'
const BehaviourCharts = lazy(() => import('../components/behaviour/BehaviourCharts'))
import { useChildren } from '../context/ChildContext'

/** /behaviour — caregiver / patient behaviour tracking: quick log, trends, history. */
export default function Behaviour() {
  const { activeChild, loading, error, refresh } = useChildren()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <DashboardLayout activeNav="behaviour" pageTitle="Behaviour log">
      <div className="sc-wrap" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="sc-title">Behaviour log</h1>
            <p className="sc-muted">Notes on what happened before, during and after — they help professionals spot patterns.</p>
          </div>
          <ChildSwitcher />
        </div>

        {loading && !activeChild && <div className="sc-card sc-card--center" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>}
        {error && (
          <div className="sc-card sc-card--center" role="alert">
            <p>Couldn't load your children: {error}</p>
            <button type="button" className="btn btn--ghost" onClick={refresh}>Try again</button>
          </div>
        )}
        {!loading && !error && !activeChild && (
          <div className="sc-card sc-card--center">
            <p>Add a child first to start logging.</p>
            <Link to="/child-profile" className="btn btn--ghost">Go to child profile</Link>
          </div>
        )}
        {activeChild && (
          <>
            <LogBehaviourForm childId={activeChild.id} onLogged={() => setRefreshKey((k) => k + 1)} />
            <Suspense fallback={<div className="sc-card sc-card--center" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>}>
              <BehaviourCharts childId={activeChild.id} refreshKey={refreshKey} />
            </Suspense>
            <BehaviourHistory childId={activeChild.id} refreshKey={refreshKey} />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
