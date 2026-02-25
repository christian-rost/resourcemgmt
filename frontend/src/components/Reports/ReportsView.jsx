import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

export default function ReportsView() {
  const { fetchWithAuth, isManager } = useAuth()
  const { addToast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [billableOnly, setBillableOnly] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Global planning dashboard
  const [planningData, setPlanningData] = useState([])
  const [deviations, setDeviations] = useState([])
  const [loadingPlan, setLoadingPlan] = useState(false)

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { if (isManager) loadPlanningData() }, [year, month, isManager])

  async function loadMeta() {
    const [projResp, userResp] = await Promise.all([
      fetchWithAuth('/api/stammdaten/projects'),
      isManager ? fetchWithAuth('/api/admin/users') : Promise.resolve({ ok: false }),
    ])
    if (projResp.ok) setProjects(await projResp.json())
    if (userResp.ok) setUsers(await userResp.json())
  }

  async function loadPlanningData() {
    setLoadingPlan(true)
    try {
      const [dashResp, devResp] = await Promise.all([
        fetchWithAuth(`/api/zeitplanung/dashboard?year=${year}&month=${month}`),
        fetchWithAuth(`/api/zeitplanung/budget-validation?year=${year}&month=${month}`),
      ])
      if (dashResp.ok) setPlanningData(await dashResp.json())
      if (devResp.ok) setDeviations(await devResp.json())
    } finally {
      setLoadingPlan(false)
    }
  }

  async function exportPdf() {
    if (!selectedProject) { addToast('Bitte Projekt wählen', 'warning'); return }
    setExporting(true)
    const proj = projects.find(p => p.id === selectedProject)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    try {
      if (isManager && !selectedUser) {
        // Export all users as ZIP
        const url = `/api/reports/pdf-all?year=${year}&month=${month}&project_id=${selectedProject}&billable_only=${billableOnly}`
        const resp = await fetchWithAuth(url)
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          addToast(err.detail || 'Fehler beim ZIP-Export', 'error')
          return
        }
        const blob = await resp.blob()
        const dlUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = dlUrl
        a.download = `Zeiterfassung_${proj?.name || 'Projekt'}_${monthStr}_alle.zip`
        a.click()
        URL.revokeObjectURL(dlUrl)
        addToast('ZIP mit allen Berater-PDFs exportiert', 'success')
      } else {
        // Export single user PDF
        let url = `/api/reports/pdf?year=${year}&month=${month}&project_id=${selectedProject}&billable_only=${billableOnly}`
        if (selectedUser) url += `&user_id=${selectedUser}`
        const resp = await fetchWithAuth(url)
        if (!resp.ok) { addToast('Fehler beim PDF-Export', 'error'); return }
        const blob = await resp.blob()
        const dlUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = dlUrl
        a.download = `Zeiterfassung_${proj?.name || 'Projekt'}_${monthStr}.pdf`
        a.click()
        URL.revokeObjectURL(dlUrl)
        addToast('PDF exportiert', 'success')
      }
    } finally {
      setExporting(false)
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  // Aggregate planning data by user
  const byUser = {}
  for (const e of planningData) {
    if (!byUser[e.user_id]) byUser[e.user_id] = { user_id: e.user_id, total_hours: 0, projects: [] }
    byUser[e.user_id].total_hours += e.hours
    byUser[e.user_id].projects.push(e)
  }

  return (
    <div className="page-content">
      {/* Period nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: 'var(--color-dark)', fontSize: '1.1rem', fontWeight: 700 }}>Reports & Exporte</h2>
        <div className="period-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="period-label">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
      </div>

      {/* PDF Export */}
      <div className="card">
        <div className="card-header">PDF-Leistungsnachweis exportieren (REQ-16/17)</div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label>Projekt *</label>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">— Projekt wählen —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.customers?.name ? `${p.customers.name} / ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
            {isManager && (
              <div className="form-group">
                <label>Berater (optional)</label>
                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                  <option value="">Alle Berater</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="toggle-wrap">
              <input type="checkbox" checked={billableOnly} onChange={e => setBillableOnly(e.target.checked)} />
              Nur abrechenbare Einträge (Kundenreport — REQ-17)
            </label>
            <div className="form-hint">Ohne Häkchen: alle freigegebenen Einträge (internes Report)</div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={exportPdf} disabled={exporting || !selectedProject}>
              {exporting ? 'Exportiere PDF...' : '⬇ PDF exportieren'}
            </button>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
            Hinweis: Im PDF werden nur freigegebene (Status: Freigegeben) Zeiterfassungen berücksichtigt.
          </div>
        </div>
      </div>

      {/* Global Planning Dashboard (Manager only) */}
      {isManager && (
        <div className="card">
          <div className="card-header">Globales Planungs-Dashboard — {MONTHS[month - 1]} {year} (REQ-25)</div>
          {loadingPlan ? (
            <div className="loading"><div className="loading-spinner" /> Laden...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {planningData.length === 0 ? (
                <div className="empty-state"><p>Keine Planungsdaten für diesen Monat.</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Berater</th>
                      <th>Projekt</th>
                      <th>Kunde</th>
                      <th>Granularität</th>
                      <th style={{ textAlign: 'right' }}>Stunden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningData.map(e => {
                      const u = users.find(u => u.id === e.user_id)
                      return (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 500 }}>{u?.display_name || u?.username || e.user_id.slice(0,8)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{e.projects?.name || '—'}</td>
                          <td>{e.projects?.customers?.name || '—'}</td>
                          <td><span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>{e.plan_day ? `Tag ${e.plan_day}` : 'Monat'}</span></td>
                          <td className="num">{e.hours} h</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deviation Report (Manager only) */}
      {isManager && deviations.length > 0 && (
        <div className="card">
          <div className="card-header">Abweichungs-Report (REQ-27)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Kunde</th>
                  <th style={{ textAlign: 'right' }}>Budget (h)</th>
                  <th style={{ textAlign: 'right' }}>Geplant (h)</th>
                  <th style={{ textAlign: 'right' }}>Differenz (h)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deviations.map(v => (
                  <tr key={v.project_id}>
                    <td style={{ fontWeight: 600 }}>{v.project_name}</td>
                    <td>{v.customer_name}</td>
                    <td className="num">{v.budget_hours.toFixed(1)}</td>
                    <td className="num">{v.planned_hours.toFixed(1)}</td>
                    <td className="num" style={{ color: v.over_budget ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 700 }}>
                      {v.delta >= 0 ? '+' : ''}{v.delta.toFixed(1)}
                    </td>
                    <td>
                      {v.over_budget
                        ? <span className="badge badge-rejected">⚠ Überschritten</span>
                        : <span className="badge badge-approved">Im Budget</span>}
                    </td>
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
