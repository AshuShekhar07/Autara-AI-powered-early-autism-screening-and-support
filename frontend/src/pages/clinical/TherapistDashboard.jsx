import React from 'react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import CaseloadTable from '../../components/clinical/CaseloadTable'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import '../../components/clinical/clinical.css'

/** /therapist — caseload list. Each child opens a workspace (ABC logging, trends, session notes). */
export default function TherapistDashboard() {
  const { data, loading, error, reload } = useApi(() => api.get('/api/me/caseload'), [])
  return (
    <DashboardLayout activeNav="caseload" pageTitle="Caseload">
      <div className="cl-wrap">
        <div><h1 className="sc-title">Your caseload</h1><p className="sc-muted">Children whose caregivers have added you to their care team.</p></div>
        <section className="cl-card" aria-label="Caseload">
          <CaseloadTable rows={data?.children} basePath="/therapist" loading={loading} error={error} onRetry={reload} />
        </section>
      </div>
    </DashboardLayout>
  )
}
