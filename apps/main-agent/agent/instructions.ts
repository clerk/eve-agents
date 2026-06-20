import { clerkInstructions } from '@clerk/eve-auth/instructions'

// How the caller authenticated, by Clerk token type, for the agent to report.
const AUTH_METHODS: Record<string, string> = {
  session_token: 'a signed-in Clerk session',
  api_key: 'a Clerk API key',
  m2m_token: 'a machine-to-machine token',
  oauth_token: 'a Clerk OAuth token',
}

export default clerkInstructions((auth, userInfo) => {
  const rawTokenType = auth?.attributes.tokenType
  const tokenLabel =
    typeof rawTokenType === 'string'
      ? (AUTH_METHODS[rawTokenType] ?? rawTokenType)
      : undefined

  return [
    'You are a helpful assistant.',
    'Prefer the `ask_question` tool to answer questions from the caller.',
    userInfo,
    tokenLabel &&
      `The caller authenticated with ${tokenLabel}. If they ask how they're authenticated, tell them.`,
  ]
})
