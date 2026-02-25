import { useState, useEffect } from 'react'
import { useAuth } from '../auth.jsx'

const MONTHS = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
]

export default function Dashboard() {
  const { fetchWithAuth, user, isManager } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [sollIst, setSollIst] = useState([])
  const [budgetDeviations, setBudgetDeviations] = useState([])
  const [approvalQueue, setApprovalQueue] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [year, month])

  async function load() {
    setLoading(true)
    try {
      const [siResp, ...rest] = await Promise.all([
        fetchWithAuth(`/api/zeitplanung/soll-ist?year=${year}&month=${month}`),
        isManager ? fetchWithAuth(`/api/zeitplanung/budget-validation?year=${year}&month=${month}`) : Promise.resolve(null),
        isManager ? fetchWithAuth('/api/zeiterfassung/approval-queue') : Promise.resolve(null),
      ])
      if (siResp.ok) setSollIst(await siResp.json())
      if (rest[0]?.ok) setBudgetDeviations(await rest[0].json())
      if (rest[1]?.ok) setApprovalQueue(await rest[1].json())
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const totalActual = sollIst.reduce((s, r) => s + r.actual_hours, 0)
  const totalPlanned = sollIst.reduce((s, r) => s + r.planned_hours, 0)
  const overBudgetCount = budgetDeviations.filter(d => d.over_budget).length

  return (
    <div className="page-content">
      {/* Period nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: 'var(--color-dark)', fontSize: '1.25rem' }}>
          Dashboard — {MONTHS[month - 1]} {year}
        </h2>
        <div className="period-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="period-label">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
      </div>

      {loading && <div className="loading"><div className="loading-spinner" /> Laden...</div>}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-label">Erfasste Stunden</div>
          <div className="stat-card-value primary">{totalActual.toFixed(1)} h</div>
          <div className="stat-card-sub">{MONTHS[month - 1]} {year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Geplante Stunden</div>
          <div className="stat-card-value">{totalPlanned.toFixed(1)} h</div>
          <div className="stat-card-sub">Soll {MONTHS[month - 1]}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Auslastung</div>
          <div className={`stat-card-value ${totalPlanned > 0 ? (totalActual / totalPlanned >= 0.9 ? 'success' : 'warning') : ''}`}>
            {totalPlanned > 0 ? Math.round(totalActual / totalPlanned * 100) : 0} %
          </div>
          <div className="stat-card-sub">Ist / Soll</div>
        </div>
        {isManager && (
          <div className="stat-card">
            <div className="stat-card-label">Genehmigung ausstehend</div>
            <div className={`stat-card-value ${approvalQueue.length > 0 ? 'warning' : 'success'}`}>
              {approvalQueue.length}
            </div>
            <div className="stat-card-sub">Einträge</div>
          </div>
        )}
        {isManager && (
          <div className="stat-card">
            <div className="stat-card-label">Budget-Abweichungen</div>
            <div className={`stat-card-value ${overBudgetCount > 0 ? 'error' : 'success'}`}>
              {overBudgetCount}
            </div>
            <div className="stat-card-sub">Projekte</div>
          </div>
        )}
      </div>

      {/* Soll-Ist Table */}
      <div className="card">
        <div className="card-header">Soll-Ist-Vergleich — {MONTHS[month - 1]} {year}</div>
        <div style={{ overflowX: 'auto' }}>
          {sollIst.length === 0 ? (
            <div className="empty-state"><p>Keine Daten für diesen Monat.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Kunde</th>
                  <th style={{ textAlign: 'right' }}>Geplant (h)</th>
                  <th style={{ textAlign: 'right' }}>Erfasst (h)</th>
                  <th style={{ textAlign: 'right' }}>Differenz</th>
                  <th>Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {sollIst.map(row => {
                  const pct = row.planned_hours > 0
                    ? Math.min(row.actual_hours / row.planned_hours * 100, 100)
                    : 0
                  const over = row.actual_hours > row.planned_hours
                  return (
                    <tr key={row.project_id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{row.project_name || '—'}</td>
                      <td>{row.customer_name || '—'}</td>
                      <td className="num">{row.planned_hours.toFixed(1)}</td>
                      <td className="num">{row.actual_hours.toFixed(1)}</td>
                      <td className="num" style={{ color: over ? 'var(--color-error)' : row.delta < 0 ? 'var(--color-text-light)' : 'var(--color-success)' }}>
                        {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="soll-ist-bar" style={{ flex: 1 }}>
                            <div
                              className={`soll-ist-fill${over ? ' over' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', minWidth: '35px' }}>
                            {row.planned_hours > 0 ? Math.round(row.actual_hours / row.planned_hours * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Approval Queue (Manager only) */}
      {isManager && approvalQueue.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ color: 'var(--color-warning)' }}>
            ⚠ Genehmigungen ausstehend ({approvalQueue.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Datum</th><th>Berater-ID</th><th>Projekt</th><th>Stunden</th><th>Kommentar</th></tr>
              </thead>
              <tbody>
                {approvalQueue.slice(0, 10).map(e => (
                  <tr key={e.id}>
                    <td>{e.entry_date}</td>
                    <td className="mono">{e.user_id.slice(0, 8)}…</td>
                    <td>{e.projects?.name || '—'}</td>
                    <td className="num">{e.hours} h</td>
                    <td>{e.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget deviations (Manager only) */}
      {isManager && budgetDeviations.some(d => d.over_budget) && (
        <div className="card">
          <div className="card-header" style={{ color: 'var(--color-error)' }}>
            ⚠ Budget-Überschreitungen
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Projekt</th><th>Kunde</th><th style={{ textAlign: 'right' }}>Budget (h)</th><th style={{ textAlign: 'right' }}>Geplant (h)</th><th style={{ textAlign: 'right' }}>Differenz (h)</th></tr>
              </thead>
              <tbody>
                {budgetDeviations.filter(d => d.over_budget).map(d => (
                  <tr key={d.project_id}>
                    <td style={{ fontWeight: 600 }}>{d.project_name}</td>
                    <td>{d.customer_name}</td>
                    <td className="num">{d.budget_hours.toFixed(1)}</td>
                    <td className="num">{d.planned_hours.toFixed(1)}</td>
                    <td className="num" style={{ color: 'var(--color-error)', fontWeight: 700 }}>+{d.delta.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
