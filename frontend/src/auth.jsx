import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const getToken = () => localStorage.getItem('rm_token')

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = getToken()
    return fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  }, [])

  const loadUser = useCallback(async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const resp = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) {
        setUser(await resp.json())
      } else {
        localStorage.removeItem('rm_token')
      }
    } catch {
      localStorage.removeItem('rm_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const login = async (username, password) => {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.detail || 'Login fehlgeschlagen')
    }
    const { access_token } = await resp.json()
    localStorage.setItem('rm_token', access_token)
    await loadUser()
  }

  const logout = () => {
    localStorage.removeItem('rm_token')
    setUser(null)
  }

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isPlaner = user?.role === 'manager' && user?.is_planer === true

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, fetchWithAuth,
      isAuthenticated, isAdmin, isManager, isPlaner,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
