import { defineDynamic, defineInstructions } from 'eve/instructions'

// How the caller authenticated, by Clerk token type, for the agent to report.
const AUTH_METHODS: Record<string, string> = {
  session_token: 'a signed-in Clerk session',
  api_key: 'a Clerk API key',
  m2m_token: 'a machine-to-machine token',
  oauth_token: 'a Clerk OAuth token',
}

export default defineDynamic({
  events: {
    'session.started': (_event, ctx) => {
      const auth = ctx.session.auth.current
      const plan = auth?.attributes.plan ?? 'free'

      const sections = [
        'You are a helpful assistant.',
        'Prefer the `ask_question` tool to answer questions from the caller.',
        `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
      ]

      // Tell the agent how the caller authenticated so it can report it.
      const tokenType = auth?.attributes.tokenType
      if (typeof tokenType === 'string') {
        sections.push(
          `The caller authenticated with ${AUTH_METHODS[tokenType] ?? tokenType}. If they ask how they're authenticated, tell them.`
        )
      }

      // When the caller is a signed-in user, personalize with their name.
      if (auth?.principalType === 'user' && auth.attributes.name) {
        sections.push(
          `You are speaking with ${auth.attributes.name}. Address them by name when it feels natural.`
        )
      }

      return defineInstructions({ markdown: sections.join('\n\n') })
    },
  },
})
