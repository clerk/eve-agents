import { defineAgent } from 'eve'

export default defineAgent({
  // Free-tier Vercel AI Gateway model, so the demo runs without adding credits.
  // Swap in a more capable model (e.g. 'anthropic/claude-sonnet-4.6') and make
  // sure your AI Gateway account has access — see the model list:
  // https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fai-gateway%2Fmodels
  model: 'anthropic/claude-haiku-4.5',
})
