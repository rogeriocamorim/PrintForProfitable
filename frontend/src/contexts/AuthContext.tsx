import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, clearToken } from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'SUPER_ADMIN'
  avatarUrl?: string
  farmId?: string
  setupCompleted?: boolean
  impersonatedBy?: string | null
}

interface OAuthProviders {
  google: boolean
  github: boolean
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  providers: OAuthProviders
  isAdmin: boolean
  isImpersonating: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  loginWithGoogle: () => void
  loginWithGitHub: () => void
  setAuthFromToken: (token: string, user: User) => void
  stopImpersonation: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<OAuthProviders>({ google: false, github: false })

  const fetchUser = useCallback(async () => {
    try {
      const data = await api<{ user: User }>('/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
      clearToken()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch available OAuth providers
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data) => setProviders(data))
      .catch(() => {})

    const token = localStorage.getItem('token')
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  const login = async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    setUser(data.user)
  }

  const register = async (name: string, email: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google'
  }

  const loginWithGitHub = () => {
    window.location.href = '/api/auth/github'
  }

  const setAuthFromToken = (token: string, newUser: User) => {
    setToken(token)
    setUser(newUser)
  }

  const stopImpersonation = async () => {
    const data = await api<{ token: string; user: User }>('/admin/stop-impersonation', {
      method: 'POST',
    })
    setToken(data.token)
    setUser(data.user)
  }

  const isAdmin = user?.role === 'SUPER_ADMIN'
  const isImpersonating = !!user?.impersonatedBy

  return (
    <AuthContext.Provider value={{ user, loading, providers, isAdmin, isImpersonating, login, register, logout, loginWithGoogle, loginWithGitHub, setAuthFromToken, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
