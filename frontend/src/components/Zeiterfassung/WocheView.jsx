import { useState } from 'react'
import EntryForm from './EntryForm.jsx'

const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const STATUS_LABELS = { draft: 'Entwurf', submitted: 'Eingereicht', approved: 'Freigegeben', rejected: 'Abgelehnt' }

function getWeekDates(year, month, day) {
  const d = new Date(year, month - 1, day)
  const wd = (d.getDay() + 6) % 7 // 0=Mo
  const monday = new Date(d)
  monday.setDate(d.getDate() - wd)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dt
  })
}

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function WocheView({ entries, projects, year, month, day, onCreateEntry, onUpdateEntry, onDeleteEntry, onSubmitEntries, loading, isManager }) {
  const [showForm, setShowForm] = useState(false)
  const [initDate, setInitDate] = useState('')

  const weekDates = getWeekDates(year, month, day)
  const byDate = {}
  for (const e of entries) {
    if (!byDate[e.entry_date]) byDate[e.entry_date] = []
    byDate[e.entry_date].push(e)
  }

  const weekEntries = weekDates.flatMap(d => byDate[toIso(d)] || [])
  const totalHours = weekEntries.reduce((s, e) => s + e.hours, 0)
  const draftIds = weekEntries.filter(e => e.status === 'draft').map(e => e.id)

  const today = new Date()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <div className="card-header">
          <span>Wochenerfassung — KW {getWeekNumber(weekDates[0])} ({toIso(weekDates[0])} – {toIso(weekDates[6])})</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>Gesamt: {totalHours.toFixed(1)} h</span>
            {draftIds.length > 0 && (
              <button className="btn btn-sm btn-outline-light" onClick={() => onSubmitEntries(draftIds)}>
                Woche einreichen
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {showForm && (
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-gray)' }}>
              <EntryForm
                projects={projects}
                initialDate={initDate}
                onSave={async data => {
                  await onCreateEntry(data)
                  setShowForm(false)
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {loading ? (
            <div className="loading"><div className="loading-spinner" /></div>
          ) : (
            <div className="time-grid">
              {weekDates.map((date, idx) => {
                const iso = toIso(date)
                const dayEntries = byDate[iso] || []
                const isWeekend = idx >= 5
                const isToday = toIso(today) === iso
                const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0)

                return (
                  <div key={iso} style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid var(--color-gray)',
                    alignItems: 'flex-start',
                    background: isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}>
                    {/* Day header */}
                    <div style={{ width: '130px', flexShrink: 0, paddingTop: '0.2rem' }}>
                      <div style={{
                        fontWeight: isToday ? 700 : 600,
                        color: isToday ? 'var(--color-primary)' : isWeekend ? 'var(--color-text-light)' : 'var(--color-dark)',
                        fontSize: '0.875rem',
                      }}>
                        {WEEKDAYS_LONG[idx]}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                        {String(date.getDate()).padStart(2,'0')}.{String(date.getMonth()+1).padStart(2,'0')}.
                        {dayTotal > 0 && <span style={{ marginLeft: '0.4rem', color: 'var(--color-primary)', fontWeight: 600 }}>{dayTotal.toFixed(1)}h</span>}
                      </div>
                    </div>

                    {/* Entries */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {dayEntries.map(e => (
                        <div key={e.id} style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                          padding: '0.4rem 0.6rem',
                          background: 'var(--color-white)',
                          border: '1px solid var(--color-gray)',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                        }}>
                          <span style={{ flex: 1, fontWeight: 500, color: 'var(--color-dark)' }}>
                            {e.projects?.name || '—'}
                          </span>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{e.hours}h</span>
                          <span className={`badge badge-${e.status}`} style={{ fontSize: '0.7rem' }}>
                            {STATUS_LABELS[e.status]}
                          </span>
                          {e.status === 'draft' && (
                            <button className="btn btn-xs btn-danger" onClick={() => onDeleteEntry(e.id)}>✕</button>
                          )}
                        </div>
                      ))}
                      {!isWeekend && (
                        <button
                          className="btn btn-xs btn-outline"
                          style={{ alignSelf: 'flex-start' }}
                          onClick={() => { setInitDate(iso); setShowForm(true) }}
                        >
                          + Eintrag
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}
