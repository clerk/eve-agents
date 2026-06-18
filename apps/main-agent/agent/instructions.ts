import { defineDynamic, defineInstructions } from 'eve/instructions'

export default defineDynamic({
  events: {
    'session.started': (_event, ctx) => {
      const auth = ctx.session.auth.current
      const plan = auth?.attributes.plan ?? 'free'

      const sections = [
        'You are a helpful assistant.',
        `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
      ]

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
