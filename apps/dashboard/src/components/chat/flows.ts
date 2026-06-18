// Auth flows the chat can demo. Each maps to the options passed to useEveAgent.
export type FlowId = 'session' | 'api-key' | 'unauthenticated'

export const FLOWS: { id: FlowId; label: string; description: string }[] = [
  {
    id: 'session',
    label: 'Session (default)',
    description: 'Signed-in user, via the Clerk session cookie.',
  },
  {
    id: 'api-key',
    label: 'API key',
    description: "Authenticate as a Clerk API key's user.",
  },
  {
    id: 'unauthenticated',
    label: 'Unauthenticated',
    description: 'No credentials. Returns a 401.',
  },
]

export type FlowOptions = {
  auth?: { bearer: string }
  headers?: Record<string, string>
}

// The useEveAgent options for a flow. The `no-auth-demo` header tells the agent
// to strip credentials server-side (the browser always sends the session cookie
// same-origin, so this is the only way to demo an unauthenticated call). The
// api-key flow sends the stored key as a bearer token.
export function flowOptions(flow: FlowId, apiKey?: string): FlowOptions {
  if (flow === 'unauthenticated') return { headers: { 'no-auth-demo': '1' } }
  if (flow === 'api-key' && apiKey) return { auth: { bearer: apiKey } }
  return {}
}
