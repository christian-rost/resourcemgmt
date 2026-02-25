import { useState } from 'react'

export default function EntryForm({ projects, initialDate, initialEntry, onSave, onCancel }) {
  const [projectId, setProjectId] = useState(initialEntry?.project_id || '')
  const [entryDate, setEntryDate] = useState(initialEntry?.entry_date || initialDate || '')
  const [hours, setHours] = useState(initialEntry?.hours || '')
  const [breakHours, setBreakHours] = useState(initialEntry?.break_hours || 0)
  const [comment, setComment] = useState(initialEntry?.comment || '')
  const [isBillable, setIsBillable] = useState(initialEntry?.is_billable ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!projectId || !entryDate || !hours) {
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        project_id: projectId,
        entry_date: entryDate,
        hours: parseFloat(hours),
        break_hours: parseFloat(breakHours) || 0,
        comment: comment || null,
        is_billable: isBillable,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label>Datum *</label>
          <input
            type="date"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Projekt *</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} required>
            <option value="">— Projekt wählen —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.customers?.name ? `${p.customers.name} / ` : ''}{p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Stunden *</label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={hours}
            onChange={e => setHours(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Pause (h)</label>
          <input
            type="number"
            step="0.25"
            min="0"
            max="8"
            value={breakHours}
            onChange={e => setBreakHours(e.target.value)}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Kommentar</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Optionaler Kommentar zur Tätigkeit…"
          rows={2}
        />
      </div>
      <div className="form-group">
        <label className="toggle-wrap">
          <input
            type="checkbox"
            checked={isBillable}
            onChange={e => setIsBillable(e.target.checked)}
          />
          Abrechenbar (extern sichtbar im Kundenreport)
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Speichern...' : initialEntry ? 'Aktualisieren' : 'Eintrag hinzufügen'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  )
}
