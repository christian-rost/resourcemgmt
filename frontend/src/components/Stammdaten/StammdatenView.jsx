import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

export default function StammdatenView() {
  const { fetchWithAuth, isManager } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('kunden')
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  // Customer form state
  const [custName, setCustName] = useState('')
  const [custCode, setCustCode] = useState('')

  // Project form state
  const [projName, setProjName] = useState('')
  const [projCode, setProjCode] = useState('')
  const [projCustomer, setProjCustomer] = useState('')
  const [projBudget, setProjBudget] = useState('')

  // Assignment form state
  const [assignUser, setAssignUser] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [custResp, projResp, userResp] = await Promise.all([
        fetchWithAuth('/api/stammdaten/customers'),
        fetchWithAuth('/api/stammdaten/projects'),
        fetchWithAuth('/api/admin/users'),
      ])
      if (custResp.ok) setCustomers(await custResp.json())
      if (projResp.ok) setProjects(await projResp.json())
      if (userResp.ok) setUsers(await userResp.json())
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignments(projectId) {
    const resp = await fetchWithAuth(`/api/stammdaten/assignments?project_id=${projectId}`)
    if (resp.ok) setAssignments(await resp.json())
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
    }
    const resp = await fetchWithAuth(
      editProject ? `/api/stammdaten/projects/${editProject.id}` : '/api/stammdaten/projects',
      { method: editProject ? 'PUT' : 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast(editProject ? 'Projekt aktualisiert' : 'Projekt angelegt', 'success')
      setShowProjectForm(false); setEditProject(null)
      setProjName(''); setProjCode(''); setProjCustomer(''); setProjBudget('')
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
    setShowAssignForm(false)
    setAssignUser('')
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

  function editCustomerAction(c) {
    setEditCustomer(c); setCustName(c.name); setCustCode(c.short_code || ''); setShowCustomerForm(true)
  }

  function editProjectAction(p) {
    setEditProject(p); setProjName(p.name); setProjCode(p.short_code || '')
    setProjCustomer(p.customer_id || ''); setProjBudget(p.budget_hours || '')
    setShowProjectForm(true)
  }

  return (
    <div className="page-content">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-white)', borderRadius: '6px', padding: '0.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignSelf: 'flex-start' }}>
        {[['kunden','Kunden'],['projekte','Projekte'],['zuordnung','Berater-Zuordnung']].map(([key,label]) => (
          <button key={key} className={`btn btn-sm ${tab===key?'btn-primary':'btn-secondary'}`} style={{ borderRadius: '4px' }} onClick={() => setTab(key)}>{label}</button>
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
            <button className="btn btn-sm btn-primary" onClick={() => { setEditProject(null); setProjName(''); setProjCode(''); setProjCustomer(''); setProjBudget(''); setShowProjectForm(true) }}>+ Neu</button>
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
                    <div className="form-hint">Zeitkontingent für Budget-Validierung</div>
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
              <thead><tr><th>Projekt</th><th>Kunde</th><th>Kürzel</th><th style={{ textAlign: 'right' }}>Budget (h)</th><th>Aktiv</th><th style={{ width: '100px' }}>Aktionen</th></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{p.name}</td>
                    <td>{p.customers?.name || '—'}</td>
                    <td>{p.short_code || '—'}</td>
                    <td className="num">{p.budget_hours > 0 ? p.budget_hours : '—'}</td>
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
                        <label>Berater</label>
                        <select value={assignUser} onChange={e => setAssignUser(e.target.value)} required>
                          <option value="">— Berater wählen —</option>
                          {users.filter(u => u.role === 'consultant').map(u => (
                            <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
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
                            <td style={{ fontWeight: 500 }}>{u?.display_name || u?.username || a.user_id.slice(0,8)}</td>
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
    </div>
  )
}
