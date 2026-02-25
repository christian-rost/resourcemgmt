import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'
import { useToast } from '../../toast.jsx'

const ROLES = ['admin', 'manager', 'consultant']
const ROLE_LABELS = { admin: 'Administrator', manager: 'Manager', consultant: 'Berater' }

export default function AdminView() {
  const { fetchWithAuth, isAdmin, isManager, user } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editUser, setEditUser] = useState(null)

  // User form
  const [uName, setUName] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uDisplay, setUDisplay] = useState('')
  const [uRole, setURole] = useState('consultant')
  const [uPw, setUPw] = useState('')

  // Config form
  const [cfgHours, setCfgHours] = useState('')
  const [cfgCompany, setCfgCompany] = useState('')
  const [cfgLogoUrl, setCfgLogoUrl] = useState('')
  const [cfgPrimary, setCfgPrimary] = useState('')
  const [cfgDark, setCfgDark] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [userResp, cfgResp] = await Promise.all([
        fetchWithAuth('/api/admin/users'),
        fetchWithAuth('/api/admin/config'),
      ])
      if (userResp.ok) setUsers(await userResp.json())
      if (cfgResp.ok) {
        const c = await cfgResp.json()
        setConfig(c)
        setCfgHours(c.hours_per_day || '8')
        setCfgCompany(c.company_name || '')
        setCfgLogoUrl(c.logo_url || '')
        setCfgPrimary(c.primary_color || '#ee7f00')
        setCfgDark(c.dark_color || '#213452')
      }
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditUser(null); setUName(''); setUEmail(''); setUDisplay(''); setURole('consultant'); setUPw(''); setShowUserForm(true)
  }
  function openEdit(u) {
    setEditUser(u); setUName(u.username); setUEmail(u.email); setUDisplay(u.display_name || ''); setURole(u.role); setUPw(''); setShowUserForm(true)
  }

  async function saveUser(ev) {
    ev.preventDefault()
    const body = editUser
      ? { email: uEmail, display_name: uDisplay, role: uRole, ...(uPw ? { password: uPw } : {}) }
      : { username: uName, email: uEmail, display_name: uDisplay, role: uRole, password: uPw }
    const resp = await fetchWithAuth(
      editUser ? `/api/admin/users/${editUser.id}` : '/api/admin/users',
      { method: editUser ? 'PUT' : 'POST', body: JSON.stringify(body) }
    )
    if (resp.ok) {
      addToast(editUser ? 'Benutzer aktualisiert' : 'Benutzer angelegt', 'success')
      setShowUserForm(false); loadAll()
    } else {
      const err = await resp.json()
      addToast(err.detail || 'Fehler', 'error')
    }
  }

  async function deleteUser(id) {
    if (!confirm('Benutzer wirklich löschen?')) return
    const resp = await fetchWithAuth(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (resp.ok) { addToast('Benutzer gelöscht', 'success'); loadAll() }
    else addToast('Fehler beim Löschen', 'error')
  }

  async function saveConfig(ev) {
    ev.preventDefault()
    const resp = await fetchWithAuth('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({
        hours_per_day: parseFloat(cfgHours),
        company_name: cfgCompany,
        logo_url: cfgLogoUrl,
        primary_color: cfgPrimary,
        dark_color: cfgDark,
      }),
    })
    if (resp.ok) { addToast('Konfiguration gespeichert', 'success') }
    else addToast('Fehler beim Speichern', 'error')
  }

  return (
    <div className="page-content">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-white)', borderRadius: '6px', padding: '0.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignSelf: 'flex-start' }}>
        <button className={`btn btn-sm ${tab==='users'?'btn-primary':'btn-secondary'}`} style={{ borderRadius: '4px' }} onClick={() => setTab('users')}>Benutzer</button>
        {isAdmin && <button className={`btn btn-sm ${tab==='config'?'btn-primary':'btn-secondary'}`} style={{ borderRadius: '4px' }} onClick={() => setTab('config')}>Konfiguration</button>}
      </div>

      {/* ── Users ── */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            Benutzerverwaltung
            {isManager && <button className="btn btn-sm btn-primary" onClick={openNew}>+ Neu</button>}
          </div>
          {showUserForm && isManager && (
            <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)' }}>
              <form onSubmit={saveUser}>
                <div className="form-row">
                  {!editUser && (
                    <div className="form-group">
                      <label>Benutzername *</label>
                      <input value={uName} onChange={e => setUName(e.target.value)} required minLength={3} maxLength={32} />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Anzeigename</label>
                    <input value={uDisplay} onChange={e => setUDisplay(e.target.value)} placeholder="Vor- und Nachname" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>E-Mail *</label>
                    <input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Rolle *</label>
                    <select value={uRole} onChange={e => setURole(e.target.value)}>
                      {ROLES.filter(r => isAdmin || r !== 'admin').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ maxWidth: '300px' }}>
                  <label>{editUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label>
                  <input type="password" value={uPw} onChange={e => setUPw(e.target.value)} required={!editUser} minLength={8} />
                  {!editUser && <div className="form-hint">Mindestens 8 Zeichen</div>}
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">{editUser ? 'Aktualisieren' : 'Anlegen'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUserForm(false)}>Abbrechen</button>
                </div>
              </form>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Anzeigename</th><th>Benutzername</th><th>E-Mail</th><th>Rolle</th><th>Aktiv</th>{isAdmin && <th style={{ width: '100px' }}>Aktionen</th>}</tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.display_name || u.username}</td>
                    <td className="mono">{u.username}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role === 'admin' ? 'rejected' : u.role === 'manager' ? 'submitted' : 'primary'}`}>{ROLE_LABELS[u.role]}</span></td>
                    <td>{u.is_active !== false ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--color-error)' }}>✕</span>}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button className="btn btn-xs btn-secondary" onClick={() => openEdit(u)}>✎</button>
                          <button className="btn btn-xs btn-danger" onClick={() => deleteUser(u.id)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Config ── */}
      {tab === 'config' && isAdmin && (
        <div className="card">
          <div className="card-header">Anwendungskonfiguration</div>
          <div className="card-body">
            <form onSubmit={saveConfig}>
              <div className="form-row">
                <div className="form-group">
                  <label>Stunden pro Arbeitstag</label>
                  <input type="number" step="0.5" min="1" max="24" value={cfgHours} onChange={e => setCfgHours(e.target.value)} />
                  <div className="form-hint">Wird für Soll-Ist-Berechnung und PDF-Export genutzt (Standard: 8)</div>
                </div>
                <div className="form-group">
                  <label>Unternehmensname</label>
                  <input value={cfgCompany} onChange={e => setCfgCompany(e.target.value)} placeholder="Meine Unternehmensberatung GmbH" />
                </div>
              </div>
              <div className="form-group">
                <label>Logo-URL (für PDF-Export)</label>
                <input type="url" value={cfgLogoUrl} onChange={e => setCfgLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Primärfarbe</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="color" value={cfgPrimary} onChange={e => setCfgPrimary(e.target.value)} style={{ width: '50px', padding: '2px', height: '38px', cursor: 'pointer' }} />
                    <input value={cfgPrimary} onChange={e => setCfgPrimary(e.target.value)} placeholder="#ee7f00" style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Dunkelfarbe (Header)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="color" value={cfgDark} onChange={e => setCfgDark(e.target.value)} style={{ width: '50px', padding: '2px', height: '38px', cursor: 'pointer' }} />
                    <input value={cfgDark} onChange={e => setCfgDark(e.target.value)} placeholder="#213452" style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Konfiguration speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
