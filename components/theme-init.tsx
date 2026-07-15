"use client"

import { useEffect } from "react"

export function ThemeInit() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme")
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const isDark = stored ? stored === "dark" : prefersDark
      document.documentElement.classList.toggle("dark", isDark)
      document.documentElement.style.colorScheme = isDark ? "dark" : "light"
    } catch (_) {}
  }, [])

  return null
}
