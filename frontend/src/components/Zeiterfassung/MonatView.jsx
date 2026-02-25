import { useState } from 'react'
import EntryForm from './EntryForm.jsx'

const STATUS_LABELS = { draft: 'Entwurf', submitted: 'Eingereicht', approved: 'Freigegeben', rejected: 'Abgelehnt' }
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function getWeekday(year, month, day) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7 // 0=Mo
}

export default function MonatView({
  entries, projects, year, month,
  onCreateEntry, onUpdateEntry, onDeleteEntry,
  onSubmitEntries, onApproveEntry, onCopyEntries,
  loading, isManager,
}) {
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [copyTarget, setCopyTarget] = useState('')
  const today = new Date()

  const daysInMonth = getDaysInMonth(year, month)

  // Group entries by date
  const byDate = {}
  for (const e of entries) {
    if (!byDate[e.entry_date]) byDate[e.entry_date] = []
    byDate[e.entry_date].push(e)
  }

  function isoDate(d) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    const draftIds = entries.filter(e => e.status === 'draft').map(e => e.id)
    setSelected(new Set(draftIds))
  }

  async function handleSubmitSelected() {
    if (selected.size === 0) return
    await onSubmitEntries([...selected])
    setSelected(new Set())
  }

  async function handleCopy() {
    if (!copyTarget || selected.size === 0) return
    await onCopyEntries([...selected], copyTarget)
    setSelected(new Set())
    setCopyTarget('')
  }

  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  const submittedCount = entries.filter(e => e.status === 'submitted').length
  const approvedCount = entries.filter(e => e.status === 'approved').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
          <span>Gesamt: <strong>{totalHours.toFixed(1)} h</strong></span>
          <span style={{ color: 'var(--color-text-light)' }}>Eingereicht: <strong>{submittedCount}</strong></span>
          <span style={{ color: 'var(--color-success)' }}>Freigegeben: <strong>{approvedCount}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {selected.size > 0 && (
            <>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={copyTarget}
                  onChange={e => setCopyTarget(e.target.value)}
                  style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--color-gray)', borderRadius: '4px', fontSize: '0.8rem' }}
                />
                <button className="btn btn-sm btn-secondary" onClick={handleCopy} disabled={!copyTarget}>
                  Kopieren
                </button>
              </div>
              <button className="btn btn-sm btn-outline" onClick={handleSubmitSelected}>
                {selected.size} Einreichen
              </button>
            </>
          )}
          <button className="btn btn-sm btn-secondary" onClick={selectAll}>Alle Draft wählen</button>
          <button className="btn btn-sm btn-primary" onClick={() => { setEditEntry(null); setShowForm(true) }}>
            + Eintrag
          </button>
        </div>
      </div>

      {/* Entry form */}
      {showForm && (
        <div className="card">
          <div className="card-header">{editEntry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</div>
          <div className="card-body">
            <EntryForm
              projects={projects}
              initialDate={isoDate(today.getDate())}
              initialEntry={editEntry}
              onSave={async data => {
                if (editEntry) await onUpdateEntry(editEntry.id, data)
                else await onCreateEntry(data)
                setShowForm(false)
                setEditEntry(null)
              }}
              onCancel={() => { setShowForm(false); setEditEntry(null) }}
            />
          </div>
        </div>
      )}

      {/* Month calendar-table */}
      {loading ? (
        <div className="loading"><div className="loading-spinner" /> Laden...</div>
      ) : (
        <div className="card">
          <div className="card-header">Übersicht {month < 10 ? '0' + month : month}/{year}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '32px' }}></th>
                  <th>Datum</th>
                  <th>Projekt</th>
                  <th>Stunden</th>
                  <th>Pause</th>
                  <th>Abr.</th>
                  <th>Status</th>
                  <th>Kommentar</th>
                  <th style={{ width: '100px' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1
                  const iso = isoDate(d)
                  const dayEntries = byDate[iso] || []
                  const wd = getWeekday(year, month, d)
                  const isWeekend = wd >= 5
                  const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d

                  if (dayEntries.length === 0) {
                    return (
                      <tr key={iso} style={{ opacity: 0.5 }}>
                        <td></td>
                        <td className={isWeekend ? 'day-weekend' : isToday ? 'day-today' : ''} style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginRight: '0.4rem' }}>{WEEKDAYS[wd]}</span>
                          {String(d).padStart(2,'0')}.{String(month).padStart(2,'0')}.
                        </td>
                        <td colSpan={7} style={{ color: 'var(--color-text-light)', fontSize: '0.8rem' }}>
                          {!isWeekend && (
                            <button
                              className="btn btn-xs btn-outline"
                              onClick={() => { setEditEntry(null); setShowForm(true) }}
                            >+ Eintrag</button>
                          )}
                        </td>
                      </tr>
                    )
                  }

                  return dayEntries.map((e, idx) => (
                    <tr key={e.id}>
                      <td>
                        {e.status === 'draft' && (
                          <input
                            type="checkbox"
                            checked={selected.has(e.id)}
                            onChange={() => toggleSelect(e.id)}
                            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                          />
                        )}
                      </td>
                      <td className={isWeekend ? 'day-weekend' : isToday ? 'day-today' : ''} style={{ whiteSpace: 'nowrap' }}>
                        {idx === 0 && (
                          <>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginRight: '0.4rem' }}>{WEEKDAYS[wd]}</span>
                            {String(d).padStart(2,'0')}.{String(month).padStart(2,'0')}.
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {e.projects?.customers?.name && <span style={{ color: 'var(--color-text-light)', marginRight: '0.3rem' }}>{e.projects.customers.name} /</span>}
                        {e.projects?.name || '—'}
                      </td>
                      <td className="num">{e.hours} h</td>
                      <td className="num">{e.break_hours ? `${e.break_hours} h` : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{e.is_billable ? '✓' : '—'}</td>
                      <td><span className={`badge badge-${e.status}`}>{STATUS_LABELS[e.status]}</span></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                        {e.comment || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          {e.status === 'draft' && (
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => { setEditEntry(e); setShowForm(true) }}
                            >✎</button>
                          )}
                          {e.status === 'draft' && (
                            <button
                              className="btn btn-xs btn-danger"
                              onClick={() => onDeleteEntry(e.id)}
                            >✕</button>
                          )}
                          {isManager && e.status === 'submitted' && (
                            <>
                              <button className="btn btn-xs btn-success" onClick={() => onApproveEntry(e.id, true)}>✓</button>
                              <button className="btn btn-xs btn-danger" onClick={() => onApproveEntry(e.id, false)}>✕</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
