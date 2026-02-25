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

export default function ZeiterfassungView() {
  const { fetchWithAuth, isManager } = useAuth()
  const { addToast } = useToast()
  const now = new Date()
  const [mode, setMode] = useState('monat')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadEntries() }, [mode, year, month, day])

  async function loadProjects() {
    const resp = await fetchWithAuth('/api/stammdaten/projects/assigned')
    if (resp.ok) setProjects(await resp.json())
  }

  async function loadEntries() {
    setLoading(true)
    try {
      let url = `/api/zeiterfassung/entries?year=${year}&month=${month}`
      if (mode === 'tag') url += `&day=${day}`
      const resp = await fetchWithAuth(url)
      if (resp.ok) setEntries(await resp.json())
    } finally {
      setLoading(false)
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

  async function approveEntry(id, approved) {
    const resp = await fetchWithAuth(`/api/zeiterfassung/entries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: approved ? 'approved' : 'rejected' }),
    })
    if (resp.ok) {
      addToast(approved ? 'Freigegeben' : 'Zurückgewiesen', 'success')
      await loadEntries()
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
    } else {
      if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
    }
  }
  function nextPeriod() {
    if (mode === 'tag') {
      const d = new Date(year, month - 1, day + 1)
      setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(d.getDate())
    } else {
      if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
    }
  }

  const periodLabel = mode === 'tag'
    ? `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
    : `${MONTHS[month - 1]} ${year}`

  const sharedProps = {
    entries, projects, year, month, day,
    onCreateEntry: createEntry,
    onUpdateEntry: updateEntry,
    onDeleteEntry: deleteEntry,
    onSubmitEntries: submitEntries,
    onApproveEntry: approveEntry,
    onCopyEntries: copyEntries,
    loading,
    isManager,
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
    </div>
  )
}
