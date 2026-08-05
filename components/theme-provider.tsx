"use client"

import * as React from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  systemTheme: "light" | "dark"
  themes: string[]
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

const NOOP_CONTEXT: ThemeContextValue = {
  theme: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  themes: ["light", "dark", "system"],
  setTheme: () => {},
}

const ThemeContext = createContext<ThemeContextValue>(NOOP_CONTEXT)

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system"
}

function applyThemeClass(theme: Theme, systemTheme: "light" | "dark") {
  const root = document.documentElement
  const resolved = theme === "system" ? systemTheme : theme
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    return getStoredTheme() ?? defaultTheme
  })
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    getSystemTheme()
  )

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? "dark" : "light")
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    applyThemeClass(theme, systemTheme)
  }, [theme, systemTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: theme === "system" ? systemTheme : theme,
      systemTheme,
      themes: ["light", "dark", "system"],
      setTheme,
    }),
    [theme, systemTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (typeof event.key !== "string" || event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

function ThemeProviderWithHotkey({
  children,
  defaultTheme,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  return (
    <ThemeProvider defaultTheme={defaultTheme}>
      <ThemeHotkey />
      {children}
    </ThemeProvider>
  )
}

function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

export { ThemeProviderWithHotkey as ThemeProvider, useTheme }
