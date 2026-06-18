'use client'

import * as React from 'react'

type ApiKeyContextValue = {
  apiKey: string
  setApiKey: (key: string) => void
}

const ApiKeyContext = React.createContext<ApiKeyContextValue | null>(null)

// Stores the API key used by the chat's "API key" flow. Lives above the chat
// session so the settings dialog can set it and the session can read it.
export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = React.useState('')
  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey(): ApiKeyContextValue {
  const context = React.useContext(ApiKeyContext)
  if (!context) throw new Error('useApiKey must be used within ApiKeyProvider')
  return context
}
