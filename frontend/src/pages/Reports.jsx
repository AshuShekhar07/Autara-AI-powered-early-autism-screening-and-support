import React from 'react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ChildSwitcher from '../components/ChildSwitcher'
import ReportsSection from '../components/dashboard/ReportsSection'

/** /reports — export reviewed screenings and see download history. */
export default function Reports() {
  return (
    <DashboardLayout activeNav="reports" pageTitle="Reports">
      <div className="sc-wrap">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChildSwitcher /></div>
        <ReportsSection full />
      </div>
    </DashboardLayout>
  )
}
