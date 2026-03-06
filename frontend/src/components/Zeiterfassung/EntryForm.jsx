import { useState, useEffect } from 'react'

const EUR = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export default function EntryForm({ projects, initialDate, initialEntry, onSave, onCancel, fetchWithAuth }) {
  const [projectId, setProjectId] = useState(initialEntry?.project_id || '')
  const [entryDate, setEntryDate] = useState(initialEntry?.entry_date || initialDate || '')
  const [startTime, setStartTime] = useState(initialEntry?.start_time?.slice(0, 5) || '')
  const [endTime, setEndTime] = useState(initialEntry?.end_time?.slice(0, 5) || '')
  const [breakHours, setBreakHours] = useState(initialEntry?.break_hours || 0)
  const [comment, setComment] = useState(initialEntry?.comment || '')
  const [isBillable, setIsBillable] = useState(initialEntry?.is_billable ?? true)
  const [projectRoleRateId, setProjectRoleRateId] = useState(initialEntry?.project_role_rate_id || '')
  const [roleRates, setRoleRates] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load role rates when project changes and apply autofill
  useEffect(() => {
    if (!projectId || !fetchWithAuth) { setRoleRates([]); return }
    fetchWithAuth(`/api/stammdaten/projects/${projectId}/role-rates`)
      .then(r => r.ok ? r.json() : [])
      .then(rates => {
        const active = (rates || []).filter(r => r.is_active)
        setRoleRates(active)
        // Autofill: use last selected role for this project (unless editing)
        if (!initialEntry?.project_role_rate_id) {
          const last = localStorage.getItem(`lastRole_${projectId}`)
          if (last && active.find(r => r.id === last)) {
            setProjectRoleRateId(last)
          } else {
            setProjectRoleRateId('')
          }
        }
      })
  }, [projectId])

  function calcHours() {
    if (!startTime || !endTime) return null
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const workMins = (eh * 60 + em) - (sh * 60 + sm) - Math.round((parseFloat(breakHours) || 0) * 60)
    if (workMins <= 0) return null
    return Math.round(workMins / 60 * 100) / 100
  }

  const computed = calcHours()
  const selectedRate = roleRates.find(r => r.id === projectRoleRateId) || null

  function getRateLabel(r) {
    const name = r.project_roles?.name || r.custom_role_name || '?'
    return `${name} – ${EUR(r.daily_rate_eur)}/Tag`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!projectId || !entryDate || !startTime || !endTime) {
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    if (computed === null) {
      setError('Arbeitszeit nach Pause muss positiv sein.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        project_id: projectId,
        entry_date: entryDate,
        start_time: startTime,
        end_time: endTime,
        break_hours: parseFloat(breakHours) || 0,
        comment: comment || null,
        is_billable: isBillable,
        project_role_rate_id: projectRoleRateId || null,
      })
      // Save last used role for this project
      if (projectRoleRateId) {
        localStorage.setItem(`lastRole_${projectId}`, projectRoleRateId)
      }
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
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Projekt *</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setProjectRoleRateId('') }} required>
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
          <label>Arbeitsbeginn *</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Arbeitsende *</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Pause (h)</label>
          <input type="number" step="0.25" min="0" max="8" value={breakHours} onChange={e => setBreakHours(e.target.value)} />
        </div>
        <div className="form-group">
          <label style={{ visibility: 'hidden' }}>.</label>
          <div style={{ padding: '0.5rem 0', fontWeight: 600, color: computed !== null ? 'var(--color-primary)' : 'var(--color-text-light)' }}>
            = {computed !== null ? `${computed.toFixed(2)} h` : '—'}
          </div>
        </div>
      </div>

      {/* Rollenauswahl – nur anzeigen wenn Raten für das Projekt vorhanden */}
      {projectId && roleRates.length > 0 && (
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label>Rolle / Tagessatz</label>
            <select value={projectRoleRateId} onChange={e => setProjectRoleRateId(e.target.value)}>
              <option value="">— Keine Rolle —</option>
              {roleRates.map(r => (
                <option key={r.id} value={r.id}>{getRateLabel(r)}</option>
              ))}
            </select>
          </div>
          {selectedRate && (
            <>
              <div className="form-group">
                <label>Stundensatz</label>
                <input readOnly value={EUR(selectedRate.hourly_rate_eur)} style={{ background: 'var(--color-light)', color: 'var(--color-text-light)', cursor: 'default' }} />
              </div>
              <div className="form-group">
                <label>Reisekostenpauschale</label>
                <input readOnly value={selectedRate.travel_cost_flat_eur > 0 ? EUR(selectedRate.travel_cost_flat_eur) : '—'} style={{ background: 'var(--color-light)', color: 'var(--color-text-light)', cursor: 'default' }} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="form-group">
        <label>Kommentar</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optionaler Kommentar zur Tätigkeit…" rows={2} />
      </div>
      <div className="form-group">
        <label className="toggle-wrap">
          <input type="checkbox" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} />
          Abrechenbar (extern sichtbar im Kundenreport)
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Speichern...' : initialEntry ? 'Aktualisieren' : 'Eintrag hinzufügen'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        )}
      </div>
    </form>
  )
}
