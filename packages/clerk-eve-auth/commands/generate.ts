#!/usr/bin/env bun
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import { buildAgents } from '../utils/agents'

// agents-json: scan every eve agent under <cwd>/apps/* and write an agents.json
// graph (agents, their tools, model, Clerk machine ids, and remote-agent edges)
// for the dashboard to serve. The file is always named agents.json; --out picks
// the directory (relative to cwd), defaulting to cwd itself.

const ROOT = process.cwd()
const APPS_DIR = path.join(ROOT, 'apps')

function parseOut(argv: string[]): string {
  const flag = argv.findIndex(a => a === '--out' || a === '-o')
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1]
  const inline = argv.find(a => a.startsWith('--out='))
  if (inline) return inline.slice('--out='.length)
  return '.'
}

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error('[agents-json] CLERK_SECRET_KEY is missing from the environment.')
  process.exit(1)
}
const clerk = createClerkClient({ secretKey })

const outFile = path.resolve(ROOT, parseOut(process.argv.slice(2)), 'agents.json')
const agents = await buildAgents({ clerk, appsDir: APPS_DIR })
await writeFile(outFile, `${JSON.stringify(agents, null, 2)}\n`)
console.log(
  `[agents-json] wrote ${agents.length} agent(s) to ${path.relative(ROOT, outFile)}`
)
