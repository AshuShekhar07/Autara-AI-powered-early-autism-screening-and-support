import React from 'react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ChildSwitcher from '../components/ChildSwitcher'
import AskAutaraCard from '../components/dashboard/AskAutaraCard'

/** /ask — full-page Ask Autara. */
export default function Ask() {
  return (
    <DashboardLayout activeNav="ask" pageTitle="Ask Autara">
      <div className="sc-wrap" style={{ maxWidth: 820 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChildSwitcher /></div>
        <AskAutaraCard full />
      </div>
    </DashboardLayout>
  )
}
