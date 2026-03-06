import { useState } from 'react'
import { AuthProvider, useAuth } from './auth.jsx'
import { ToastProvider, useToast } from './toast.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import ZeiterfassungView from './components/Zeiterfassung/ZeiterfassungView.jsx'
import ZeitplanungView from './components/Zeitplanung/ZeitplanungView.jsx'
import StammdatenView from './components/Stammdaten/StammdatenView.jsx'
import ReportsView from './components/Reports/ReportsView.jsx'
import AdminView from './components/Admin/AdminView.jsx'
import BudgetDashboard from './components/Budget/BudgetDashboard.jsx'

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', consultant: 'Berater' }

function PasswordModal({ onClose }) {
  const { fetchWithAuth } = useAuth()
  const { addToast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (next !== confirm) { addToast('Passwörter stimmen nicht überein', 'error'); return }
    setSaving(true)
    try {
      const resp = await fetchWithAuth('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      if (resp.ok) { addToast('Passwort geändert', 'success'); onClose() }
      else { const e = await resp.json(); addToast(e.detail || 'Fehler', 'error') }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '360px', margin: 0 }}>
        <div className="card-header">Passwort ändern</div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Aktuelles Passwort *</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Neues Passwort *</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
              <div className="form-hint">Mindestens 8 Zeichen</div>
            </div>
            <div className="form-group">
              <label>Neues Passwort bestätigen *</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Speichern...' : 'Speichern'}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading, logout, isAuthenticated, isAdmin, isManager } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [showPwModal, setShowPwModal] = useState(false)

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh', background: 'var(--color-dark)' }}>
        <div className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--color-primary)' }} />
        <span style={{ color: 'var(--color-white)' }}>Laden...</span>
      </div>
    )
  }

  if (!isAuthenticated) return <Login />

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', always: true },
    { key: 'zeiterfassung', label: 'Zeiterfassung', always: true },
    { key: 'zeitplanung', label: 'Zeitplanung', always: isManager },
    { key: 'stammdaten', label: 'Stammdaten', always: isManager },
    { key: 'reports', label: 'Reports', always: true },
    { key: 'budget', label: 'Budget', always: isManager },
    { key: 'admin', label: 'Admin', always: isManager },
  ].filter(n => n.always)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <div className="header-left">
          <h1>XQT5 Ressource</h1>
          <nav className="nav-tabs">
            {navItems.map(n => (
              <button
                key={n.key}
                className={`nav-tab${page === n.key ? ' active' : ''}`}
                onClick={() => setPage(n.key)}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-user">
          <span className="user-name">{user?.display_name || user?.username}</span>
          <span className="user-role">{ROLE_LABELS[user?.role] || user?.role}</span>
          <button className="btn btn-sm btn-outline-light" onClick={() => setShowPwModal(true)}>Passwort</button>
          <button className="btn btn-sm btn-outline-light" onClick={logout}>Logout</button>
        </div>
      </header>
      {showPwModal && <PasswordModal onClose={() => setShowPwModal(false)} />}

      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'zeiterfassung' && <ZeiterfassungView />}
        {page === 'zeitplanung' && isManager && <ZeitplanungView />}
        {page === 'stammdaten' && isManager && <StammdatenView />}
        {page === 'reports' && <ReportsView />}
        {page === 'budget' && isManager && <BudgetDashboard />}
        {page === 'admin' && isManager && <AdminView />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}
