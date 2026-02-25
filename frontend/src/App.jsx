import { useState } from 'react'
import { AuthProvider, useAuth } from './auth.jsx'
import { ToastProvider } from './toast.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import ZeiterfassungView from './components/Zeiterfassung/ZeiterfassungView.jsx'
import ZeitplanungView from './components/Zeitplanung/ZeitplanungView.jsx'
import StammdatenView from './components/Stammdaten/StammdatenView.jsx'
import ReportsView from './components/Reports/ReportsView.jsx'
import AdminView from './components/Admin/AdminView.jsx'

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', consultant: 'Berater' }

function AppContent() {
  const { user, loading, logout, isAuthenticated, isAdmin, isManager } = useAuth()
  const [page, setPage] = useState('dashboard')

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
    { key: 'admin', label: 'Admin', always: isManager },
  ].filter(n => n.always)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <div className="header-left">
          <h1>Ressourcenmanagement</h1>
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
          <button className="btn btn-sm btn-outline-light" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'zeiterfassung' && <ZeiterfassungView />}
        {page === 'zeitplanung' && isManager && <ZeitplanungView />}
        {page === 'stammdaten' && isManager && <StammdatenView />}
        {page === 'reports' && <ReportsView />}
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
