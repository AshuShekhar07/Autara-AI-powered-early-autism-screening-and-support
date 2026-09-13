import React from 'react'
import DashboardLayout      from '../components/dashboard/DashboardLayout'
import WelcomeBanner        from '../components/dashboard/WelcomeBanner'
import StatCards            from '../components/dashboard/StatCards'
import ScreeningTrendChart  from '../components/dashboard/ScreeningTrendChart'
import DomainBreakdownChart from '../components/dashboard/DomainBreakdownChart'
import AskAutaraCard        from '../components/dashboard/AskAutaraCard'
import ResourcesSection     from '../components/dashboard/ResourcesSection'
import ReportsSection       from '../components/dashboard/ReportsSection'

/**
 * Dashboard — Caregiver view
 *
 * Orchestrates all dashboard sections. Real data sources:
 *   - User identity:   useAuth() via WelcomeBanner → AuthContext
 *   - Stat cards:      empty state (no screening API yet)
 *   - Charts:          empty state (no screening API yet)
 *   - Ask Autara:      "coming soon" (no LLM API yet)
 *   - Resources:       static, hardcoded — real content, no API needed
 *   - Reports:         empty state (no reports API yet)
 *
 * When the screening API is built, wire real data into StatCards and
 * the two chart components — each has a TODO comment marking the spot.
 */
export default function Dashboard() {
  // TODO: Once GET /api/screenings is available, fetch here and pass
  // the results down to StatCards, ScreeningTrendChart, and DomainBreakdownChart.
  // Use a loading/error state pattern and pass null/[] while loading.

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Dashboard">
      {/* ── Welcome + primary CTA ── */}
      <WelcomeBanner />

      {/* ── Stat cards: all empty until screening data exists ── */}
      <StatCards />

      {/* ── Charts row ── */}
      <div className="db-charts-row">
        <ScreeningTrendChart  data={[]} />
        <DomainBreakdownChart domains={[]} />
      </div>

      {/* ── Ask Autara (coming soon) ── */}
      <AskAutaraCard />

      {/* ── Resources: real static content, no API ── */}
      <ResourcesSection />

      {/* ── Reports: empty state ── */}
      <ReportsSection />
    </DashboardLayout>
  )
}
