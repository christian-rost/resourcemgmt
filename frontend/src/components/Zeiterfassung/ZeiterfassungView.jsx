import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'
import TagView from './TagView.jsx'
import WocheView from './WocheView.jsx'
import MonatView from './MonatView.jsx'

const MODES = [
  { key: 'tag', label: 'Tag' },
  { key: 'woche', label: 'Woche' },
  { key: 'monat', label: 'Monat' },
]

const MONTHS = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
]

const STATUS_LABELS = { draft: 'Entwurf', submitted: 'Eingereicht', approved: 'Freigegeben', rejected: 'Abgelehnt' }

export default function ZeiterfassungView() {
  const { fetchWithAuth, isManager, user } = useAuth()
  const { addToast } = useToast()
  const now = new Date()
  const [mode, setMode] = useState('monat')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  // Approval queue (managers only)
  const [approvalEntries, setApprovalEntries] = useState([])
  const [approvalUsers, setApprovalUsers] = useState({}) // id → display_name
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadEntries() }, [mode, year, month, day])
  useEffect(() => { if (isManager) loadApprovalQueue() }, [isManager])

  async function loadProjects() {
    const resp = await fetchWithAuth('/api/stammdaten/projects/assigned')
    if (resp.ok) setProjects(await resp.json())
  }

  async function loadEntries() {
    if (!user) return
    setLoading(true)
    try {
      if (mode === 'woche') {
        // Compute monday/sunday of the current week
        const d = new Date(year, month - 1, day)
        const wd = (d.getDay() + 6) % 7
        const monday = new Date(d)
        monday.setDate(d.getDate() - wd)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const monYear = monday.getFullYear(), monMonth = monday.getMonth() + 1
        const sunYear = sunday.getFullYear(), sunMonth = sunday.getMonth() + 1

        const fetches = [fetchWithAuth(`/api/zeiterfassung/entries?year=${monYear}&month=${monMonth}&user_id=${user.id}`)]
        if (monYear !== sunYear || monMonth !== sunMonth) {
          fetches.push(fetchWithAuth(`/api/zeiterfassung/entries?year=${sunYear}&month=${sunMonth}&user_id=${user.id}`))
        }
        const resps = await Promise.all(fetches)
        const all = []
        for (const resp of resps) { if (resp.ok) all.push(...await resp.json()) }
        setEntries(all)
      } else {
        let url = `/api/zeiterfassung/entries?year=${year}&month=${month}&user_id=${user.id}`
        if (mode === 'tag') url += `&day=${day}`
        const resp = await fetchWithAuth(url)
        if (resp.ok) setEntries(await resp.json())
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadApprovalQueue() {
    setApprovalLoading(true)
    try {
      const [qResp, uResp] = await Promise.all([
        fetchWithAuth('/api/zeiterfassung/approval-queue'),
        fetchWithAuth('/api/admin/users'),
      ])
      if (qResp.ok) setApprovalEntries(await qResp.json())
      if (uResp.ok) {
        const users = await uResp.json()
        const map = {}
        for (const u of users) map[u.id] = u.display_name || u.username
        setApprovalUsers(map)
      }
    } finally {
      setApprovalLoading(false)
    }
  }

  async function createEntry(data) {
    const resp = await fetchWithAuth('/api/zeiterfassung/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!resp.ok) {
      const err = await resp.json()
      addToast(err.detail || 'Fehler beim Speichern', 'error')
      return null
    }
    addToast('Eintrag gespeichert', 'success')
    await loadEntries()
    return await resp.json()
  }

  async function updateEntry(id, data) {
    const resp = await fetchWithAuth(`/api/zeiterfassung/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    if (!resp.ok) {
      const err = await resp.json()
      addToast(err.detail || 'Fehler beim Aktualisieren', 'error')
      return
    }
    addToast('Eintrag aktualisiert', 'success')
    await loadEntries()
  }

  async function deleteEntry(id) {
    const resp = await fetchWithAuth(`/api/zeiterfassung/entries/${id}`, { method: 'DELETE' })
    if (!resp.ok) {
      addToast('Fehler beim Löschen', 'error')
      return
    }
    addToast('Eintrag gelöscht', 'success')
    await loadEntries()
  }

  async function submitEntries(ids) {
    for (const id of ids) {
      await fetchWithAuth(`/api/zeiterfassung/entries/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'submitted' }),
      })
    }
    addToast(`${ids.length} Einträge eingereicht`, 'success')
    await loadEntries()
  }

  async function approveQueueEntry(id, approved, reason) {
    const body = { status: approved ? 'approved' : 'rejected' }
    if (!approved && reason) body.rejection_reason = reason
    const resp = await fetchWithAuth(`/api/zeiterfassung/entries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (resp.ok) {
      addToast(approved ? 'Freigegeben' : 'Zurückgewiesen', 'success')
      setRejectId(null)
      setRejectReason('')
      await loadApprovalQueue()
    } else {
      const err = await resp.json()
      addToast(err.detail || 'Fehler', 'error')
    }
  }

  async function copyEntries(ids, targetDate) {
    const resp = await fetchWithAuth('/api/zeiterfassung/entries/copy', {
      method: 'POST',
      body: JSON.stringify({ entry_ids: ids, target_date: targetDate }),
    })
    if (resp.ok) {
      addToast('Einträge kopiert', 'success')
      await loadEntries()
    } else {
      addToast('Fehler beim Kopieren', 'error')
    }
  }

  function prevPeriod() {
    if (mode === 'tag') {
      const d = new Date(year, month - 1, day - 1)
      setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(d.getDate())
    } else if (mode === 'woche') {
      const d = new Date(year, month - 1, day - 7)
      setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(d.getDate())
    } else {
      if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
    }
  }
  function nextPeriod() {
    if (mode === 'tag') {
      const d = new Date(year, month - 1, day + 1)
      setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(d.getDate())
    } else if (mode === 'woche') {
      const d = new Date(year, month - 1, day + 7)
      setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(d.getDate())
    } else {
      if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
    }
  }

  const periodLabel = (() => {
    if (mode === 'tag') {
      return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
    }
    if (mode === 'woche') {
      const d = new Date(year, month - 1, day)
      const wd = (d.getDay() + 6) % 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - wd)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const fmt = dt => `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.`
      // ISO week number
      const du = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()))
      du.setUTCDate(du.getUTCDate() + 4 - (du.getUTCDay() || 7))
      const kw = Math.ceil((((du - new Date(Date.UTC(du.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7)
      return `KW ${kw} — ${fmt(monday)} bis ${fmt(sunday)}${sunday.getFullYear()}`
    }
    return `${MONTHS[month - 1]} ${year}`
  })()

  const sharedProps = {
    entries, projects, year, month, day,
    onCreateEntry: createEntry,
    onUpdateEntry: updateEntry,
    onDeleteEntry: deleteEntry,
    onSubmitEntries: submitEntries,
    onCopyEntries: copyEntries,
    loading,
    fetchWithAuth,
  }

  return (
    <div className="page-content">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-white)', borderRadius: '6px', padding: '0.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {MODES.map(m => (
            <button
              key={m.key}
              className={`btn btn-sm ${mode === m.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode(m.key)}
              style={{ borderRadius: '4px' }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="period-nav">
          <button onClick={prevPeriod}>‹</button>
          <span className="period-label">{periodLabel}</span>
          <button onClick={nextPeriod}>›</button>
        </div>
      </div>

      {mode === 'tag' && <TagView {...sharedProps} />}
      {mode === 'woche' && <WocheView {...sharedProps} />}
      {mode === 'monat' && <MonatView {...sharedProps} />}

      {/* Approval queue for managers/admins */}
      {isManager && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            Ausstehende Genehmigungen
            {approvalEntries.length > 0 && (
              <span style={{ marginLeft: '0.5rem', background: 'var(--color-primary)', color: '#fff', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.78rem' }}>
                {approvalEntries.length}
              </span>
            )}
          </div>
          {approvalLoading ? (
            <div className="loading"><div className="loading-spinner" /> Laden...</div>
          ) : approvalEntries.length === 0 ? (
            <div className="empty-state"><p>Keine Einträge zur Genehmigung.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Berater</th>
                    <th>Datum</th>
                    <th>Projekt</th>
                    <th style={{ textAlign: 'right' }}>Stunden</th>
                    <th>Abr.</th>
                    <th>Kommentar</th>
                    <th style={{ width: '140px' }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalEntries.map(e => (
                    <>
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{approvalUsers[e.user_id] || e.user_id.slice(0, 8)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{e.entry_date}</td>
                        <td>
                          {e.projects?.customers?.name && <span style={{ color: 'var(--color-text-light)', marginRight: '0.3rem' }}>{e.projects.customers.name} /</span>}
                          {e.projects?.name || '—'}
                        </td>
                        <td className="num">{e.hours} h</td>
                        <td style={{ textAlign: 'center' }}>{e.is_billable ? '✓' : '—'}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.comment || '—'}
                        </td>
                        <td>
                          {rejectId === e.id ? null : (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button className="btn btn-xs btn-success" onClick={() => approveQueueEntry(e.id, true)}>✓ OK</button>
                              <button className="btn btn-xs btn-danger" onClick={() => { setRejectId(e.id); setRejectReason('') }}>✕ Ablehnen</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {rejectId === e.id && (
                        <tr key={`reject-${e.id}`} style={{ background: '#fff8f8' }}>
                          <td colSpan={7} style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Ablehnungsgrund (optional)"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                style={{ flex: 1, padding: '0.3rem 0.5rem', border: '1px solid var(--color-gray)', borderRadius: '4px', fontSize: '0.85rem' }}
                              />
                              <button className="btn btn-xs btn-danger" onClick={() => approveQueueEntry(e.id, false, rejectReason)}>Ablehnen</button>
                              <button className="btn btn-xs btn-secondary" onClick={() => setRejectId(null)}>Abbrechen</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
