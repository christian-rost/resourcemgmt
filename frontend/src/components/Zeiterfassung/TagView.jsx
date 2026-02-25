import { useState } from 'react'
import EntryForm from './EntryForm.jsx'

const STATUS_LABELS = { draft: 'Entwurf', submitted: 'Eingereicht', approved: 'Freigegeben', rejected: 'Abgelehnt' }

export default function TagView({ entries, projects, year, month, day, onCreateEntry, onUpdateEntry, onDeleteEntry, onSubmitEntries, onApproveEntry, loading, isManager }) {
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const dayEntries = entries.filter(e => e.entry_date === iso)
  const totalHours = dayEntries.reduce((s, e) => s + e.hours, 0)
  const draftIds = dayEntries.filter(e => e.status === 'draft').map(e => e.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <div className="card-header">
          <span>Tageserfassung — {String(day).padStart(2,'0')}.{String(month).padStart(2,'0')}.{year}</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>Gesamt: {totalHours.toFixed(1)} h</span>
            {draftIds.length > 0 && (
              <button className="btn btn-sm btn-outline-light" onClick={() => onSubmitEntries(draftIds)}>
                Alle einreichen
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => { setEditEntry(null); setShowForm(true) }}>
              + Eintrag
            </button>
          </div>
        </div>
        <div className="card-body">
          {showForm && (
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-gray)' }}>
              <EntryForm
                projects={projects}
                initialDate={iso}
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
          )}

          {loading ? (
            <div className="loading"><div className="loading-spinner" /></div>
          ) : dayEntries.length === 0 ? (
            <div className="empty-state">
              <p>Keine Einträge für diesen Tag.</p>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>Ersten Eintrag erfassen</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th style={{ textAlign: 'right' }}>Stunden</th>
                  <th style={{ textAlign: 'right' }}>Pause</th>
                  <th>Abrechenbar</th>
                  <th>Status</th>
                  <th>Kommentar</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>
                      {e.projects?.customers?.name && <span style={{ color: 'var(--color-text-light)', marginRight: '0.3rem' }}>{e.projects.customers.name} /</span>}
                      {e.projects?.name || '—'}
                    </td>
                    <td className="num">{e.hours} h</td>
                    <td className="num">{e.break_hours ? `${e.break_hours} h` : '—'}</td>
                    <td>{e.is_billable ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-text-light)' }}>Intern</span>}</td>
                    <td><span className={`badge badge-${e.status}`}>{STATUS_LABELS[e.status]}</span></td>
                    <td style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.comment || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {e.status === 'draft' && <button className="btn btn-xs btn-secondary" onClick={() => { setEditEntry(e); setShowForm(true) }}>✎</button>}
                        {e.status === 'draft' && <button className="btn btn-xs btn-outline" onClick={() => onSubmitEntries([e.id])}>Einreichen</button>}
                        {e.status === 'draft' && <button className="btn btn-xs btn-danger" onClick={() => onDeleteEntry(e.id)}>✕</button>}
                        {isManager && e.status === 'submitted' && (
                          <>
                            <button className="btn btn-xs btn-success" onClick={() => onApproveEntry(e.id, true)}>✓ OK</button>
                            <button className="btn btn-xs btn-danger" onClick={() => onApproveEntry(e.id, false)}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--color-light-gray)', fontWeight: 600 }}>
                  <td>Gesamt</td>
                  <td className="num">{totalHours.toFixed(1)} h</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
