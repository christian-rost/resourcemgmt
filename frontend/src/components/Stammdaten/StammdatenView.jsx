import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

const EUR = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export default function StammdatenView() {
  const { fetchWithAuth, isManager } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('kunden')
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [globalRoles, setGlobalRoles] = useState([])
  const [roleRates, setRoleRates] = useState([])
  const [selectedRateProject, setSelectedRateProject] = useState(null)
  const [loading, setLoading] = useState(false)

  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [showRateForm, setShowRateForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [editRole, setEditRole] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  // Customer form
  const [custName, setCustName] = useState('')
  const [custCode, setCustCode] = useState('')

  // Project form
  const [projName, setProjName] = useState('')
  const [projCode, setProjCode] = useState('')
  const [projCustomer, setProjCustomer] = useState('')
  const [projBudget, setProjBudget] = useState('')
  const [projBudgetEur, setProjBudgetEur] = useState('')

  // Assignment form
  const [assignUser, setAssignUser] = useState('')

  // Global role form
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')

  // Role rate form
  const [rateRoleId, setRateRoleId] = useState('')
  const [rateCustomName, setRateCustomName] = useState('')
  const [rateDailyRate, setRateDailyRate] = useState('')
  const [rateTravel, setRateTravel] = useState('')
  const [rateIsCustom, setRateIsCustom] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [custResp, projResp, userResp, rolesResp] = await Promise.all([
        fetchWithAuth('/api/stammdaten/customers'),
        fetchWithAuth('/api/stammdaten/projects'),
        fetchWithAuth('/api/admin/users'),
        fetchWithAuth('/api/stammdaten/project-roles'),
      ])
      if (custResp.ok) setCustomers(await custResp.json())
      if (projResp.ok) setProjects(await projResp.json())
      if (userResp.ok) setUsers(await userResp.json())
      if (rolesResp.ok) setGlobalRoles(await rolesResp.json())
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignments(projectId) {
    const resp = await fetchWithAuth(`/api/stammdaten/assignments?project_id=${projectId}`)
    if (resp.ok) setAssignments(await resp.json())
  }

  async function loadRoleRates(projectId) {
    const resp = await fetchWithAuth(`/api/stammdaten/projects/${projectId}/role-rates`)
    if (resp.ok) setRoleRates(await resp.json())
  }

  // ── Customer CRUD ─────────────────────────────────────────────────────────
  async function saveCustomer(e) {
    e.preventDefault()
    const body = { name: custName, short_code: custCode || null }
    const resp = await fetchWithAuth(
      editCustomer ? `/api/stammdaten/customers/${editCustomer.id}` : '/api/stammdaten/customers',
      { method: editCustomer ? 'PUT' : 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast(editCustomer ? 'Kunde aktualisiert' : 'Kunde angelegt', 'success')
      setShowCustomerForm(false); setEditCustomer(null); setCustName(''); setCustCode('')
      loadAll()
    } else {
      addToast('Fehler beim Speichern', 'error')
    }
  }

  async function deleteCustomer(id) {
    if (!confirm('Kunden wirklich löschen?')) return
    await fetchWithAuth(`/api/stammdaten/customers/${id}`, { method: 'DELETE' })
    addToast('Kunde gelöscht', 'success')
    loadAll()
  }

  // ── Project CRUD ──────────────────────────────────────────────────────────
  async function saveProject(e) {
    e.preventDefault()
    const body = {
      name: projName,
      short_code: projCode || null,
      customer_id: projCustomer,
      budget_hours: parseFloat(projBudget) || 0,
      budget_eur: projBudgetEur !== '' ? parseFloat(projBudgetEur) : null,
    }
    const resp = await fetchWithAuth(
      editProject ? `/api/stammdaten/projects/${editProject.id}` : '/api/stammdaten/projects',
      { method: editProject ? 'PUT' : 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast(editProject ? 'Projekt aktualisiert' : 'Projekt angelegt', 'success')
      setShowProjectForm(false); setEditProject(null)
      setProjName(''); setProjCode(''); setProjCustomer(''); setProjBudget(''); setProjBudgetEur('')
      loadAll()
    } else {
      addToast('Fehler beim Speichern', 'error')
    }
  }

  async function deleteProject(id) {
    if (!confirm('Projekt wirklich löschen?')) return
    await fetchWithAuth(`/api/stammdaten/projects/${id}`, { method: 'DELETE' })
    addToast('Projekt gelöscht', 'success')
    loadAll()
  }

  // ── Assignments ────────────────────────────────────────────────────────────
  async function selectProject(p) {
    setSelectedProject(p)
    await loadAssignments(p.id)
    setShowAssignForm(false); setAssignUser('')
  }

  async function saveAssignment(e) {
    e.preventDefault()
    const resp = await fetchWithAuth('/api/stammdaten/assignments', {
      method: 'POST',
      body: JSON.stringify({ project_id: selectedProject.id, user_id: assignUser }),
    })
    if (resp.ok) {
      addToast('Berater zugeordnet', 'success')
      setShowAssignForm(false); setAssignUser('')
      loadAssignments(selectedProject.id)
    } else {
      addToast('Fehler – bereits zugeordnet?', 'error')
    }
  }

  async function removeAssignment(id) {
    await fetchWithAuth(`/api/stammdaten/assignments/${id}`, { method: 'DELETE' })
    addToast('Zuordnung entfernt', 'success')
    loadAssignments(selectedProject.id)
  }

  // ── Global Roles ──────────────────────────────────────────────────────────
  async function saveRole(e) {
    e.preventDefault()
    const body = { name: roleName, description: roleDesc || null }
    const resp = await fetchWithAuth(
      editRole ? `/api/stammdaten/project-roles/${editRole.id}` : '/api/stammdaten/project-roles',
      { method: editRole ? 'PUT' : 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast(editRole ? 'Rolle aktualisiert' : 'Rolle angelegt', 'success')
      setShowRoleForm(false); setEditRole(null); setRoleName(''); setRoleDesc('')
      loadAll()
    } else {
      addToast('Fehler beim Speichern', 'error')
    }
  }

  async function deleteRole(id) {
    if (!confirm('Rolle wirklich löschen?')) return
    await fetchWithAuth(`/api/stammdaten/project-roles/${id}`, { method: 'DELETE' })
    addToast('Rolle gelöscht', 'success')
    loadAll()
  }

  function editRoleAction(r) {
    setEditRole(r); setRoleName(r.name); setRoleDesc(r.description || ''); setShowRoleForm(true)
  }

  // ── Role Rates ─────────────────────────────────────────────────────────────
  async function selectRateProject(p) {
    setSelectedRateProject(p)
    await loadRoleRates(p.id)
    setShowRateForm(false)
    resetRateForm()
  }

  function resetRateForm() {
    setRateRoleId(''); setRateCustomName(''); setRateDailyRate(''); setRateTravel(''); setRateIsCustom(false)
  }

  async function saveRoleRate(e) {
    e.preventDefault()
    const body = {
      role_id: rateIsCustom ? null : (rateRoleId || null),
      custom_role_name: rateIsCustom ? (rateCustomName || null) : null,
      daily_rate_eur: parseFloat(rateDailyRate) || 0,
      travel_cost_flat_eur: parseFloat(rateTravel) || 0,
    }
    if (!body.role_id && !body.custom_role_name) {
      addToast('Bitte Rolle auswählen oder individuelle Bezeichnung eingeben', 'error')
      return
    }
    const resp = await fetchWithAuth(
      `/api/stammdaten/projects/${selectedRateProject.id}/role-rates`,
      { method: 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast('Rollenrate hinzugefügt', 'success')
      setShowRateForm(false); resetRateForm()
      loadRoleRates(selectedRateProject.id)
    } else {
      addToast('Fehler beim Speichern', 'error')
    }
  }

  async function deleteRoleRate(rateId) {
    if (!confirm('Rollenrate wirklich entfernen?')) return
    await fetchWithAuth(
      `/api/stammdaten/projects/${selectedRateProject.id}/role-rates/${rateId}`,
      { method: 'DELETE' }
    )
    addToast('Rollenrate entfernt', 'success')
    loadRoleRates(selectedRateProject.id)
  }

  function editCustomerAction(c) {
    setEditCustomer(c); setCustName(c.name); setCustCode(c.short_code || ''); setShowCustomerForm(true)
  }

  function editProjectAction(p) {
    setEditProject(p); setProjName(p.name); setProjCode(p.short_code || '')
    setProjCustomer(p.customer_id || ''); setProjBudget(p.budget_hours || '')
    setProjBudgetEur(p.budget_eur ?? '')
    setShowProjectForm(true)
  }

  const getRoleName = (rate) => {
    if (rate.project_roles?.name) return rate.project_roles.name
    if (rate.custom_role_name) return `${rate.custom_role_name} (projektspezifisch)`
    return '—'
  }

  return (
    <div className="page-content">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-white)', borderRadius: '6px', padding: '0.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {[
          ['kunden', 'Kunden'],
          ['projekte', 'Projekte'],
          ['zuordnung', 'Berater-Zuordnung'],
          ['rollen', 'Projektrollen'],
          ['rollenraten', 'Rollen & Tagessätze'],
        ].map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: '4px' }} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── Kunden ── */}
      {tab === 'kunden' && (
        <div className="card">
          <div className="card-header">
            Kunden
            <button className="btn btn-sm btn-primary" onClick={() => { setEditCustomer(null); setCustName(''); setCustCode(''); setShowCustomerForm(true) }}>+ Neu</button>
          </div>
          {showCustomerForm && (
            <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
              <form onSubmit={saveCustomer}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input value={custName} onChange={e => setCustName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Kürzel</label>
                    <input value={custCode} onChange={e => setCustCode(e.target.value)} placeholder="z.B. BMW" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editCustomer ? 'Aktualisieren' : 'Anlegen'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerForm(false)}>Abbrechen</button>
                </div>
              </form>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Kürzel</th><th>Aktiv</th><th style={{ width: '100px' }}>Aktionen</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.short_code || '—'}</td>
                    <td>{c.is_active ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-error)' }}>✕</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => editCustomerAction(c)}>✎</button>
                        <button className="btn btn-xs btn-danger" onClick={() => deleteCustomer(c.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Projekte ── */}
      {tab === 'projekte' && (
        <div className="card">
          <div className="card-header">
            Projekte
            <button className="btn btn-sm btn-primary" onClick={() => { setEditProject(null); setProjName(''); setProjCode(''); setProjCustomer(''); setProjBudget(''); setProjBudgetEur(''); setShowProjectForm(true) }}>+ Neu</button>
          </div>
          {showProjectForm && (
            <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
              <form onSubmit={saveProject}>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Projektname *</label>
                    <input value={projName} onChange={e => setProjName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Kürzel</label>
                    <input value={projCode} onChange={e => setProjCode(e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kunde *</label>
                    <select value={projCustomer} onChange={e => setProjCustomer(e.target.value)} required>
                      <option value="">— Kunde wählen —</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Budget (Stunden)</label>
                    <input type="number" step="1" min="0" value={projBudget} onChange={e => setProjBudget(e.target.value)} placeholder="0" />
                    <div className="form-hint">Zeitkontingent für Stunden-Budget-Validierung</div>
                  </div>
                  <div className="form-group">
                    <label>Budget (EUR)</label>
                    <input type="number" step="0.01" min="0" value={projBudgetEur} onChange={e => setProjBudgetEur(e.target.value)} placeholder="z.B. 50000" />
                    <div className="form-hint">Monetäres Budget für Kosten-Kontrolle</div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editProject ? 'Aktualisieren' : 'Anlegen'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProjectForm(false)}>Abbrechen</button>
                </div>
              </form>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projekt</th><th>Kunde</th><th>Kürzel</th>
                  <th style={{ textAlign: 'right' }}>Budget (h)</th>
                  <th style={{ textAlign: 'right' }}>Budget (EUR)</th>
                  <th>Aktiv</th><th style={{ width: '100px' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{p.name}</td>
                    <td>{p.customers?.name || '—'}</td>
                    <td>{p.short_code || '—'}</td>
                    <td className="num">{p.budget_hours > 0 ? p.budget_hours : '—'}</td>
                    <td className="num">{p.budget_eur != null ? EUR(p.budget_eur) : '—'}</td>
                    <td>{p.is_active ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-error)' }}>✕</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => editProjectAction(p)}>✎</button>
                        <button className="btn btn-xs btn-danger" onClick={() => deleteProject(p.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Berater-Zuordnung ── */}
      {tab === 'zuordnung' && (
        <div className="split-layout">
          <div className="panel-left card" style={{ height: 'fit-content' }}>
            <div className="card-header">Projekt wählen</div>
            <div className="list-scroll">
              {projects.map(p => (
                <div
                  key={p.id}
                  className={`list-item${selectedProject?.id === p.id ? ' selected' : ''}`}
                  onClick={() => selectProject(p)}
                >
                  <div>
                    <div className="list-item-title">{p.name}</div>
                    <div className="list-item-sub">{p.customers?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-right">
            {selectedProject ? (
              <div className="card">
                <div className="card-header">
                  Berater für: {selectedProject.name}
                  <button className="btn btn-sm btn-primary" onClick={() => setShowAssignForm(true)}>+ Zuordnen</button>
                </div>
                {showAssignForm && (
                  <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
                    <form onSubmit={saveAssignment} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Benutzer</label>
                        <select value={assignUser} onChange={e => setAssignUser(e.target.value)} required>
                          <option value="">— Benutzer wählen —</option>
                          {users.filter(u => u.role === 'consultant' || u.role === 'manager').map(u => (
                            <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary">Zuordnen</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAssignForm(false)}>Abbrechen</button>
                    </form>
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Berater</th><th>Benutzername</th><th>Rolle</th><th>Aktionen</th></tr></thead>
                    <tbody>
                      {assignments.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-light)', padding: '1.5rem' }}>Noch keine Berater zugeordnet</td></tr>
                      ) : assignments.map(a => {
                        const u = users.find(u => u.id === a.user_id)
                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 500 }}>{u?.display_name || u?.username || a.user_id.slice(0, 8)}</td>
                            <td className="mono">{u?.username || '—'}</td>
                            <td><span className="badge badge-primary">{u?.role || '—'}</span></td>
                            <td><button className="btn btn-xs btn-danger" onClick={() => removeAssignment(a.id)}>Entfernen</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card"><div className="placeholder">← Projekt aus der Liste wählen</div></div>
            )}
          </div>
        </div>
      )}

      {/* ── Globale Projektrollen ── */}
      {tab === 'rollen' && (
        <div className="card">
          <div className="card-header">
            Projekt-Mitarbeiter-Rollen (global)
            <button className="btn btn-sm btn-primary" onClick={() => { setEditRole(null); setRoleName(''); setRoleDesc(''); setShowRoleForm(true) }}>+ Neu</button>
          </div>
          <div className="card-body" style={{ color: 'var(--color-text-light)', fontSize: '0.875rem', borderBottom: '1px solid var(--color-gray)' }}>
            Globale Rollen können projektübergreifend verwendet und je Projekt mit individuellen Tagessätzen hinterlegt werden (Tab „Rollen &amp; Tagessätze").
          </div>
          {showRoleForm && (
            <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
              <form onSubmit={saveRole}>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Rollenbezeichnung *</label>
                    <input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="z.B. Senior Consultant" required />
                  </div>
                  <div className="form-group" style={{ flex: 3 }}>
                    <label>Beschreibung</label>
                    <input value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editRole ? 'Aktualisieren' : 'Anlegen'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowRoleForm(false); setEditRole(null) }}>Abbrechen</button>
                </div>
              </form>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Rollenbezeichnung</th><th>Beschreibung</th><th>Aktiv</th><th style={{ width: '120px' }}>Aktionen</th></tr></thead>
              <tbody>
                {globalRoles.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-light)', padding: '1.5rem' }}>Noch keine Rollen angelegt</td></tr>
                ) : globalRoles.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: 'var(--color-text-light)' }}>{r.description || '—'}</td>
                    <td>{r.is_active ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-error)' }}>✕</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="btn btn-xs btn-secondary" onClick={() => editRoleAction(r)}>✎</button>
                        <button className="btn btn-xs btn-danger" onClick={() => deleteRole(r.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Rollen & Tagessätze je Projekt ── */}
      {tab === 'rollenraten' && (
        <div className="split-layout">
          <div className="panel-left card" style={{ height: 'fit-content' }}>
            <div className="card-header">Projekt wählen</div>
            <div className="list-scroll">
              {projects.map(p => (
                <div
                  key={p.id}
                  className={`list-item${selectedRateProject?.id === p.id ? ' selected' : ''}`}
                  onClick={() => selectRateProject(p)}
                >
                  <div>
                    <div className="list-item-title">{p.name}</div>
                    <div className="list-item-sub">{p.customers?.name}</div>
                    {p.budget_eur != null && (
                      <div className="list-item-sub" style={{ color: 'var(--color-primary)' }}>Budget: {EUR(p.budget_eur)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-right">
            {selectedRateProject ? (
              <div className="card">
                <div className="card-header">
                  Rollen &amp; Tagessätze: {selectedRateProject.name}
                  <button className="btn btn-sm btn-primary" onClick={() => { resetRateForm(); setShowRateForm(true) }}>+ Hinzufügen</button>
                </div>
                {showRateForm && (
                  <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
                    <form onSubmit={saveRoleRate}>
                      <div className="form-row" style={{ alignItems: 'flex-start' }}>
                        <div className="form-group">
                          <label>Rollentyp</label>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 'normal' }}>
                              <input type="radio" checked={!rateIsCustom} onChange={() => setRateIsCustom(false)} />
                              Globale Rolle
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 'normal' }}>
                              <input type="radio" checked={rateIsCustom} onChange={() => setRateIsCustom(true)} />
                              Projektspezifisch
                            </label>
                          </div>
                        </div>
                        {!rateIsCustom ? (
                          <div className="form-group" style={{ flex: 2 }}>
                            <label>Rolle *</label>
                            <select value={rateRoleId} onChange={e => setRateRoleId(e.target.value)} required={!rateIsCustom}>
                              <option value="">— Rolle wählen —</option>
                              {globalRoles.filter(r => r.is_active).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="form-group" style={{ flex: 2 }}>
                            <label>Individuelle Bezeichnung *</label>
                            <input value={rateCustomName} onChange={e => setRateCustomName(e.target.value)} placeholder="z.B. Projektleiter extern" required={rateIsCustom} />
                          </div>
                        )}
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Tagessatz (EUR)</label>
                          <input type="number" step="0.01" min="0" value={rateDailyRate} onChange={e => setRateDailyRate(e.target.value)} placeholder="z.B. 1200" />
                        </div>
                        <div className="form-group">
                          <label>Reisekostenpauschale (EUR)</label>
                          <input type="number" step="0.01" min="0" value={rateTravel} onChange={e => setRateTravel(e.target.value)} placeholder="z.B. 200" />
                        </div>
                        <div className="form-group">
                          <label>Stundensatz (berechnet)</label>
                          <input
                            readOnly
                            value={rateDailyRate ? EUR(parseFloat(rateDailyRate) / 8) : '—'}
                            style={{ background: 'var(--color-light)', color: 'var(--color-text-light)', cursor: 'default' }}
                          />
                          <div className="form-hint">Tagessatz ÷ 8 Std.</div>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary">Hinzufügen</button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowRateForm(false); resetRateForm() }}>Abbrechen</button>
                      </div>
                    </form>
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rolle</th>
                        <th style={{ textAlign: 'right' }}>Tagessatz</th>
                        <th style={{ textAlign: 'right' }}>Stundensatz</th>
                        <th style={{ textAlign: 'right' }}>Reisekostenpauschale</th>
                        <th>Aktiv</th>
                        <th style={{ width: '80px' }}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleRates.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-light)', padding: '1.5rem' }}>Noch keine Rollenraten hinterlegt</td></tr>
                      ) : roleRates.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500 }}>{getRoleName(r)}</td>
                          <td className="num">{EUR(r.daily_rate_eur)}</td>
                          <td className="num" style={{ color: 'var(--color-text-light)' }}>{EUR(r.hourly_rate_eur)}</td>
                          <td className="num">{r.travel_cost_flat_eur > 0 ? EUR(r.travel_cost_flat_eur) : '—'}</td>
                          <td>{r.is_active ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-error)' }}>✕</span>}</td>
                          <td>
                            <button className="btn btn-xs btn-danger" onClick={() => deleteRoleRate(r.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card"><div className="placeholder">← Projekt aus der Liste wählen</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
