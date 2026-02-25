import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

export default function ZeitplanungView() {
  const { fetchWithAuth, isManager } = useAuth()
  const { addToast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [validation, setValidation] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  // Form state
  const [fUser, setFUser] = useState('')
  const [fProject, setFProject] = useState('')
  const [fDay, setFDay] = useState('')
  const [fHours, setFHours] = useState('')

  // Copy state
  const [copyTarget, setCopyTarget] = useState({ year: now.getFullYear(), month: now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2 })
  const [showCopy, setShowCopy] = useState(false)

  useEffect(() => { loadAll() }, [year, month])

  async function loadAll() {
    setLoading(true)
    try {
      const [entResp, projResp, userResp, valResp] = await Promise.all([
        fetchWithAuth(`/api/zeitplanung/entries?year=${year}&month=${month}`),
        fetchWithAuth('/api/stammdaten/projects'),
        fetchWithAuth('/api/admin/users'),
        fetchWithAuth(`/api/zeitplanung/budget-validation?year=${year}&month=${month}`),
      ])
      if (entResp.ok) setEntries(await entResp.json())
      if (projResp.ok) setProjects(await projResp.json())
      if (userResp.ok) setUsers(await userResp.json())
      if (valResp.ok) setValidation(await valResp.json())
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditEntry(null); setFUser(''); setFProject(''); setFDay(''); setFHours(''); setShowForm(true)
  }
  function openEdit(e) {
    setEditEntry(e); setFUser(e.user_id); setFProject(e.project_id)
    setFDay(e.plan_day || ''); setFHours(e.hours); setShowForm(true)
  }

  async function saveEntry(ev) {
    ev.preventDefault()
    const body = {
      user_id: fUser,
      project_id: fProject,
      plan_year: year,
      plan_month: month,
      plan_day: fDay ? parseInt(fDay) : null,
      hours: parseFloat(fHours),
    }
    const resp = await fetchWithAuth(
      editEntry ? `/api/zeitplanung/entries/${editEntry.id}` : '/api/zeitplanung/entries',
      { method: editEntry ? 'PUT' : 'POST', body: JSON.stringify(editEntry ? { hours: body.hours, plan_day: body.plan_day } : body) }
    )
    if (resp.ok) {
      addToast(editEntry ? 'Planung aktualisiert' : 'Planung angelegt', 'success')
      setShowForm(false); loadAll()
    } else {
      addToast('Fehler beim Speichern', 'error')
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Planung löschen?')) return
    await fetchWithAuth(`/api/zeitplanung/entries/${id}`, { method: 'DELETE' })
    addToast('Planung gelöscht', 'success')
    loadAll()
  }

  async function copyMonth() {
    const resp = await fetchWithAuth('/api/zeitplanung/entries/copy', {
      method: 'POST',
      body: JSON.stringify({
        source_year: year, source_month: month,
        target_year: parseInt(copyTarget.year), target_month: parseInt(copyTarget.month),
      }),
    })
    if (resp.ok) {
      addToast('Monat kopiert', 'success')
      setShowCopy(false)
    } else {
      addToast('Fehler beim Kopieren', 'error')
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  // Group entries by user
  const byUser = {}
  for (const e of entries) {
    if (!byUser[e.user_id]) byUser[e.user_id] = []
    byUser[e.user_id].push(e)
  }

  const totalPlanned = entries.reduce((s, e) => s + e.hours, 0)
  const overBudgetCount = validation.filter(v => v.over_budget).length

  return (
    <div className="page-content">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="period-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="period-label">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {overBudgetCount > 0 && (
            <span className="badge badge-warning">⚠ {overBudgetCount} Budget-Überschreitung{overBudgetCount > 1 ? 'en' : ''}</span>
          )}
          <button className="btn btn-sm btn-secondary" onClick={() => setShowCopy(!showCopy)}>Monat kopieren</button>
          <button className="btn btn-sm btn-primary" onClick={openNew}>+ Planung</button>
        </div>
      </div>

      {/* Copy panel */}
      {showCopy && (
        <div className="card">
          <div className="card-header">Monat kopieren: {MONTHS[month - 1]} {year} →</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Zielmonat</label>
                <select value={copyTarget.month} onChange={e => setCopyTarget(p => ({ ...p, month: e.target.value }))}>
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Jahr</label>
                <input type="number" value={copyTarget.year} onChange={e => setCopyTarget(p => ({ ...p, year: e.target.value }))} style={{ width: '90px' }} />
              </div>
              <button className="btn btn-primary" onClick={copyMonth}>Kopieren</button>
              <button className="btn btn-secondary" onClick={() => setShowCopy(false)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry form */}
      {showForm && (
        <div className="card">
          <div className="card-header">{editEntry ? 'Planung bearbeiten' : 'Neue Planung'}</div>
          <div className="card-body">
            <form onSubmit={saveEntry}>
              {!editEntry && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Berater *</label>
                    <select value={fUser} onChange={e => setFUser(e.target.value)} required>
                      <option value="">— Berater wählen —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Projekt *</label>
                    <select value={fProject} onChange={e => setFProject(e.target.value)} required>
                      <option value="">— Projekt wählen —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.customers?.name ? `${p.customers.name} / ` : ''}{p.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Tag (optional)</label>
                  <input type="number" min="1" max="31" value={fDay} onChange={e => setFDay(e.target.value)} placeholder="leer = Monatsplanung" />
                  <div className="form-hint">Leer lassen für Monatsplanung</div>
                </div>
                <div className="form-group">
                  <label>Stunden *</label>
                  <input type="number" step="0.5" min="0.5" value={fHours} onChange={e => setFHours(e.target.value)} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editEntry ? 'Aktualisieren' : 'Anlegen'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-label">Geplante Stunden</div>
          <div className="stat-card-value primary">{totalPlanned.toFixed(1)} h</div>
          <div className="stat-card-sub">{MONTHS[month - 1]} {year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Budget-Abweichungen</div>
          <div className={`stat-card-value ${overBudgetCount > 0 ? 'error' : 'success'}`}>{overBudgetCount}</div>
          <div className="stat-card-sub">Projekte über Budget</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Berater eingeplant</div>
          <div className="stat-card-value">{Object.keys(byUser).length}</div>
          <div className="stat-card-sub">in diesem Monat</div>
        </div>
      </div>

      {/* Planning table */}
      {loading ? (
        <div className="loading"><div className="loading-spinner" /> Laden...</div>
      ) : (
        <div className="card">
          <div className="card-header">Planungsübersicht — {MONTHS[month - 1]} {year}</div>
          <div style={{ overflowX: 'auto' }}>
            {entries.length === 0 ? (
              <div className="empty-state">
                <p>Keine Planungen für diesen Monat.</p>
                <button className="btn btn-primary" onClick={openNew}>Erste Planung anlegen</button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Berater</th>
                    <th>Projekt</th>
                    <th>Kunde</th>
                    <th>Granularität</th>
                    <th style={{ textAlign: 'right' }}>Stunden</th>
                    <th style={{ textAlign: 'right' }}>Tage*</th>
                    <th>Budget-Status</th>
                    <th style={{ width: '80px' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const u = users.find(u => u.id === e.user_id)
                    const val = validation.find(v => v.project_id === e.project_id)
                    const hoursPerDay = 8 // default, ideally from config
                    const days = e.hours / hoursPerDay
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{u?.display_name || u?.username || e.user_id.slice(0,8)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{e.projects?.name || '—'}</td>
                        <td>{e.projects?.customers?.name || '—'}</td>
                        <td><span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{e.plan_day ? `Tag ${e.plan_day}` : 'Monat'}</span></td>
                        <td className="num">{e.hours} h</td>
                        <td className="num" style={{ color: 'var(--color-text-light)' }}>{days.toFixed(1)} PT</td>
                        <td>
                          {val ? (
                            val.over_budget
                              ? <span className="badge badge-rejected">⚠ +{val.delta.toFixed(1)}h</span>
                              : <span className="badge badge-approved">OK</span>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button className="btn btn-xs btn-secondary" onClick={() => openEdit(e)}>✎</button>
                            <button className="btn btn-xs btn-danger" onClick={() => deleteEntry(e.id)}>✕</button>
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
      )}

      {/* Budget validation table */}
      {validation.length > 0 && (
        <div className="card">
          <div className="card-header">Budget-Validierung — {MONTHS[month - 1]} {year}</div>
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
                {validation.map(v => (
                  <tr key={v.project_id}>
                    <td style={{ fontWeight: 600 }}>{v.project_name}</td>
                    <td>{v.customer_name}</td>
                    <td className="num">{v.budget_hours.toFixed(1)}</td>
                    <td className="num">{v.planned_hours.toFixed(1)}</td>
                    <td className="num" style={{ color: v.over_budget ? 'var(--color-error)' : 'var(--color-success)', fontWeight: v.over_budget ? 700 : 400 }}>
                      {v.delta >= 0 ? '+' : ''}{v.delta.toFixed(1)}
                    </td>
                    <td>
                      {v.over_budget
                        ? <span className="badge badge-rejected">Überschritten</span>
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
