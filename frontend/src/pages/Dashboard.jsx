import React from 'react'
import DashboardLayout          from '../components/dashboard/DashboardLayout'
import WelcomeBanner            from '../components/dashboard/WelcomeBanner'
import ChildProfileCard         from '../components/dashboard/ChildProfileCard'
import StatCards                from '../components/dashboard/StatCards'
import DevelopmentalMilestones  from '../components/dashboard/DevelopmentalMilestones'
import ScreeningTrendChart      from '../components/dashboard/ScreeningTrendChart'
import DomainBreakdownChart     from '../components/dashboard/DomainBreakdownChart'
import CareTeamSection          from '../components/dashboard/CareTeamSection'
import RecentActivity           from '../components/dashboard/RecentActivity'
import AskAutaraCard            from '../components/dashboard/AskAutaraCard'
import ResourcesSection         from '../components/dashboard/ResourcesSection'
import ReportsSection           from '../components/dashboard/ReportsSection'

/**
 * Dashboard — Caregiver view
 *
 * Layout order:
 *   1. WelcomeBanner          (unchanged)
 *   2. ChildProfileCard       (NEW — shows child name/DOB from roleDetails)
 *   3. StatCards              (unchanged — empty state until screening API)
 *   4. DevelopmentalMilestones(NEW — informational, age-aware, not diagnostic)
 *   5. Charts row             (unchanged — empty state until screening API)
 *   6. Care Team | Recent Activity (NEW — 2-col, empty states present)
 *   7. AskAutaraCard          (unchanged — coming soon placeholder)
 *   8. ResourcesSection       (unchanged — static curated content)
 *   9. ReportsSection         (unchanged — empty state)
 *
 * Real data sources:
 *   - User identity:     useAuth() → WelcomeBanner, ChildProfileCard
 *   - Child profile:     AuthContext.profileData.roleDetails → ChildProfileCard
 *   - Milestones status: UI state only (TODO: GET/PUT /api/milestones)
 *   - Care team:         mock adapter (TODO: GET /api/care-team)
 *   - Activity:          mock adapter (TODO: GET /api/activity)
 *   - Stat cards:        empty state (no screening API yet)
 *   - Charts:            empty state (no screening API yet)
 *   - Ask Autara:        "coming soon" (no LLM API yet)
 *   - Resources:         static hardcoded — real content, no API needed
 *   - Reports:           empty state (no reports API yet)
 */
export default function Dashboard() {
  // TODO: Once GET /api/screenings is available, fetch here and pass
  // the results down to StatCards, ScreeningTrendChart, and DomainBreakdownChart.
  // Use a loading/error state pattern and pass null/[] while loading.

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Dashboard">

      {/* ── 1. Welcome + primary CTA ── */}
      <WelcomeBanner />

      {/* ── 2. Child profile overview ── */}
      <ChildProfileCard />

      {/* ── 3. Stat cards: all empty until screening data exists ── */}
      <StatCards />

      {/* ── 4. Developmental milestones: age-aware, informational only ── */}
      <DevelopmentalMilestones />

      {/* ── 5. Charts row: empty state until screening API ── */}
      <div className="db-charts-row">
        <ScreeningTrendChart  data={[]} />
        <DomainBreakdownChart domains={[]} />
      </div>

      {/* ── 6. Care Team + Recent Activity: 2-column ── */}
      <div className="db-two-col">
        <CareTeamSection />
        <RecentActivity />
      </div>

      {/* ── 7. Ask Autara (coming soon) ── */}
      <AskAutaraCard />

      {/* ── 8. Resources: real static content, no API ── */}
      <ResourcesSection />

      {/* ── 9. Reports: empty state ── */}
      <ReportsSection />

    </DashboardLayout>
  )
}
