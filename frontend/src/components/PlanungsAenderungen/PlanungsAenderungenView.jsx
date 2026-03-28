import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

const ACTION_LABELS = { create: 'Erstellt', update: 'Geändert', delete: 'Gelöscht' }
const ACTION_BADGE  = { create: 'approved', update: 'submitted', delete: 'rejected' }

const MONTHS = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

export default function PlanungsAenderungenView() {
  const { fetchWithAuth, isPlaner, user } = useAuth()
  const { addToast } = useToast()

  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({})

  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterUser, setFilterUser] = useState('')
  const [filterProject, setFilterProject] = useState('')

  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])

  const [excelFrom, setExcelFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [excelTo, setExcelTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [downloading, setDownloading] = useState(false)
  const [acknowledging, setAcknowledging] = useState(null)

  useEffect(() => {
    loadMeta()
    loadConfig()
  }, [])

  useEffect(() => {
    load()
  }, [filterYear, filterMonth, filterUser, filterProject])

  async function loadConfig() {
    const resp = await fetchWithAuth('/api/admin/config')
    if (resp.ok) setConfig(await resp.json())
  }

  async function loadMeta() {
    const [uResp, pResp] = await Promise.all([
      fetchWithAuth('/api/admin/users'),
      fetchWithAuth('/api/stammdaten/projects?active_only=false'),
    ])
    if (uResp.ok) setUsers(await uResp.json())
    if (pResp.ok) setProjects(await pResp.json())
  }

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterYear)    params.set('year',       filterYear)
      if (filterMonth)   params.set('month',      filterMonth)
      if (filterUser)    params.set('user_id',    filterUser)
      if (filterProject) params.set('project_id', filterProject)

      const resp = await fetchWithAuth(`/api/planning-changes?${params}`)
      if (resp.ok) setChanges(await resp.json())
      else {
        const err = await resp.json()
        addToast(err.detail || 'Fehler beim Laden', 'error')
        setChanges([])
      }
    } finally {
      setLoading(false)
    }
  }

  async function acknowledge(changeId) {
    setAcknowledging(changeId)
    try {
      const resp = await fetchWithAuth(`/api/planning-changes/${changeId}/acknowledge`, { method: 'PATCH' })
      if (resp.ok) {
        addToast('Als "Übernommen" markiert', 'success')
        setChanges(prev => prev.map(c =>
          c.id === changeId
            ? { ...c, acknowledged_by: user.id, acknowledged_at: new Date().toISOString() }
            : c
        ))
      } else {
        const err = await resp.json()
        addToast(err.detail || 'Fehler', 'error')
      }
    } finally {
      setAcknowledging(null)
    }
  }

  async function downloadExcel() {
    setDownloading(true)
    try {
      const params = new URLSearchParams({ from_date: excelFrom, to_date: excelTo })
      const resp = await fetchWithAuth(`/api/planning-changes/report/excel?${params}`)
      if (!resp.ok) {
        const err = await resp.json()
        addToast(err.detail || 'Fehler beim Download', 'error')
        return
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planungsaenderungen_${excelFrom}_${excelTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const reportRoles = (config.change_report_roles || 'admin,manager').split(',').map(r => r.trim())

  function formatTs(ts) {
    if (!ts) return '–'
    try {
      return new Date(ts).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return ts }
  }

  function userName(id) {
    const u = users.find(u => u.id === id)
    return u ? (u.display_name || u.username) : id || '–'
  }

  function projectName(id) {
    const p = projects.find(p => p.id === id)
    return p ? p.name : id || '–'
  }

  function hoursArrow(change) {
    const oldH = change.old_data?.hours
    const newH = change.new_data?.hours
    if (oldH != null && newH != null) return `${oldH} → ${newH}`
    if (newH != null) return `→ ${newH}`
    if (oldH != null) return `${oldH} →`
    return '–'
  }

  return (
    <div className="page-content">
      <div className="card">
        <div className="card-header">
          Planungsänderungen
        </div>
        <div className="card-body">
          {/* Filter */}
          <div className="form-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="form-group" style={{ minWidth: '100px', flex: '0 0 auto' }}>
              <label>Jahr</label>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '130px', flex: '0 0 auto' }}>
              <label>Monat</label>
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
                <option value="">Alle</option>
                {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '160px', flex: '1' }}>
              <label>Berater</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">Alle</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '160px', flex: '1' }}>
              <label>Projekt</label>
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                <option value="">Alle</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="loading" style={{ padding: '2rem' }}>
              <div className="loading-spinner" />
              <span>Laden...</span>
            </div>
          ) : changes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted, #888)' }}>
              Keine Planungsänderungen im gewählten Zeitraum.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zeitstempel</th>
                  <th>Aktion</th>
                  <th>Geändert von</th>
                  <th>Berater</th>
                  <th>Projekt</th>
                  <th>Zeitraum</th>
                  <th>Stunden (Alt → Neu)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatTs(c.changed_at)}</td>
                    <td>
                      <span className={`badge badge-${ACTION_BADGE[c.action] || 'primary'}`}>
                        {ACTION_LABELS[c.action] || c.action}
                      </span>
                    </td>
                    <td>{userName(c.changed_by)}</td>
                    <td>{userName(c.affected_user_id)}</td>
                    <td>{projectName(c.project_id)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.plan_year && c.plan_month
                        ? `${MONTHS[c.plan_month]} ${c.plan_year}`
                        : '–'}
                    </td>
                    <td className="mono">{hoursArrow(c)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.acknowledged_at ? (
                        <span
                          className="badge badge-approved"
                          title={`Übernommen von ${userName(c.acknowledged_by)} am ${formatTs(c.acknowledged_at)}`}
                        >
                          Übernommen
                        </span>
                      ) : isPlaner ? (
                        <button
                          className="btn btn-xs btn-secondary"
                          onClick={() => acknowledge(c.id)}
                          disabled={acknowledging === c.id}
                        >
                          {acknowledging === c.id ? '...' : 'Übernehmen'}
                        </button>
                      ) : (
                        <span style={{ color: '#aaa' }}>–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Excel Download */}
        <div className="card-body" style={{ borderTop: '1px solid var(--color-gray, #e0e0e0)', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Von</label>
            <input type="date" value={excelFrom} onChange={e => setExcelFrom(e.target.value)} style={{ width: '150px' }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Bis</label>
            <input type="date" value={excelTo} onChange={e => setExcelTo(e.target.value)} style={{ width: '150px' }} />
          </div>
          <button
            className="btn btn-secondary"
            onClick={downloadExcel}
            disabled={downloading}
            style={{ marginBottom: 0 }}
          >
            {downloading ? 'Wird erstellt...' : '⬇ Excel-Report'}
          </button>
          <span style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>
            (Zeitraum für den Download – unabhängig von der Filter-Auswahl oben)
          </span>
        </div>
      </div>
    </div>
  )
}
