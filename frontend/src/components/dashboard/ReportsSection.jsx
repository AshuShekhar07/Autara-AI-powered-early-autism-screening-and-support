import React from 'react'
import './ReportsSection.css'

/**
 * ReportsSection
 *
 * Empty state — no reports exist until a screening is completed.
 * There are no download buttons because there is nothing to export yet.
 *
 * TODO: When GET /api/reports is available, replace the empty state with
 * a list of downloadable report cards. Each report object will need:
 *   { id, title, date, downloadUrl }
 */
export default function ReportsSection() {
  // TODO: replace with real data from GET /api/reports once built.
  const reports = []

  return (
    <section className="reports-section" aria-labelledby="reports-heading">
      <h2 className="reports-section__heading" id="reports-heading">Reports</h2>

      {reports.length === 0 ? (
        <div className="reports-empty" role="status" aria-label="No reports available">
          <div className="reports-empty__icon" aria-hidden="true">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="12" y2="17"/>
            </svg>
          </div>
          <p className="reports-empty__title">No reports yet</p>
          <p className="reports-empty__body">
            Reports will appear here after your first screening is completed.
            Each report can be downloaded and shared with your child's care team.
          </p>
        </div>
      ) : (
        // TODO: render report list here once data exists
        null
      )}
    </section>
  )
}
