"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type User = {
  email: string
  name: string
}

type AuthContext = {
  user: User | null
  login: (email: string, password: string) => string | null
  register: (name: string, email: string, password: string) => string | null
  logout: () => void
}

const AuthCtx = createContext<AuthContext | null>(null)

function getUsers(): Record<string, { name: string; password: string }> {
  if (typeof window === "undefined") return {}
  return JSON.parse(localStorage.getItem("users") || "{}")
}

function saveUsers(users: Record<string, { name: string; password: string }>) {
  localStorage.setItem("users", JSON.stringify(users))
}

function getInitialUser(): User | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("currentUser")
  return stored ? JSON.parse(stored) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser)

  const login = useCallback((email: string, password: string): string | null => {
    const users = getUsers()
    const record = users[email]
    if (!record) return "No account found with this email"
    if (record.password !== password) return "Incorrect password"
    const u = { email, name: record.name }
    localStorage.setItem("currentUser", JSON.stringify(u))
    setUser(u)
    return null
  }, [])

  const register = useCallback((name: string, email: string, password: string): string | null => {
    const users = getUsers()
    if (users[email]) return "An account with this email already exists"
    users[email] = { name, password }
    saveUsers(users)
    const u = { email, name }
    localStorage.setItem("currentUser", JSON.stringify(u))
    setUser(u)
    return null
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("currentUser")
    setUser(null)
  }, [])

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
