/**
 * Create a Clerk machine (for minting M2M tokens) with the Backend SDK.
 *
 *   bun run scripts/create-machine.ts
 *
 * Reads CLERK_SECRET_KEY from .env.local (bun loads it automatically).
 * The printed `secretKey` is what mints M2M tokens for this machine.
 */
import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

const machine = await clerk.machines.create({
  name: 'projects-agent',
  defaultTokenTtl: 300, // seconds; default TTL for M2M tokens this machine mints
})

console.log(machine)
console.log(`key: ${machine.secretKey}`)
