/**
 * Create a Clerk API key with the Backend SDK.
 *
 *   bun run scripts/create-api-key.ts
 *
 * Reads CLERK_SECRET_KEY from .env.local (bun loads it automatically).
 * `subject` is a user, organization, or machine ID. Edit the constants below
 * for future runs. The printed `secret` is the bearer token to send.
 */
import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

const SUBJECT = 'mch_3FHXtKAdyZQrtqr6Ulfiji7Vrcj' // user_…, org_…, or mch_…
const SCOPES = ['projects:manage']

const apiKey = await clerk.apiKeys.create({
  name: 'projects-agent key',
  subject: SUBJECT,
  scopes: SCOPES,
})

console.log(apiKey)
console.log(`key: ${apiKey.secret}`)
