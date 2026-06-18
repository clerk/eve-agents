#!/usr/bin/env bun
import { watch } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import {
  linkMachineScopes,
  listManagedMachines,
  machineName,
  revokeMachineTokens,
} from '@clerk/eve-auth'
import { Command } from 'commander'
import { buildAgents } from './graph'
import { MANIFEST_REL } from './projects'
import { syncMachines } from './sync'

const log = (message: string) => console.log(`[eve-agents] ${message}`)
const appsDir = () => path.join(process.cwd(), 'apps')

// Parse `--host <dir>=<agent>` mappings: an app that hosts an agent and needs
// that agent's machine secret mirrored into its env (e.g. a withEve Next app).
function parseHosts(mappings: string[]): { dir: string; machine: string }[] {
  return mappings.flatMap(mapping => {
    const eq = mapping.indexOf('=')
    if (eq < 1 || eq === mapping.length - 1) {
      console.error(`[eve-agents] ignoring --host "${mapping}": expected <dir>=<agent>`)
      return []
    }
    return [
      {
        dir: path.resolve(process.cwd(), mapping.slice(0, eq)),
        machine: machineName(mapping.slice(eq + 1)),
      },
    ]
  })
}

function getClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    console.error('[eve-agents] CLERK_SECRET_KEY is missing from the environment.')
    process.exit(1)
  }
  return createClerkClient({ secretKey })
}

const program = new Command()
program
  .name('eve-agents')
  .description('Manage Clerk machines for the eve agents under apps/*')

program
  .command('dev')
  .description('Watch apps/* and keep Clerk machines + agents.json in sync (warns about unlinked agents)')
  .option('-o, --out <dir>', 'agents.json output directory, relative to cwd', '.')
  .option(
    '--host <mapping...>',
    "mirror an agent's machine secret into a host app: <dir>=<agent>"
  )
  .action((opts: { out: string; host?: string[] }) => {
    const clerk = getClerk()
    const dir = appsDir()
    const outFile = path.resolve(process.cwd(), opts.out, 'agents.json')
    const hosts = parseHosts(opts.host ?? [])

    let running = false
    let queued = false
    async function reconcile() {
      if (running) {
        queued = true
        return
      }
      running = true
      try {
        // One machine list shared across the pass: syncMachines keeps it current
        // (creates/deletes), then buildAgents reuses it instead of re-listing.
        const existing = await listManagedMachines(clerk)
        await syncMachines({ clerk, appsDir: dir, log, existing, hosts })
        // Keep agents.json fresh as agents/scopes change.
        const graph = await buildAgents({ clerk, appsDir: dir, existing })
        await writeFile(outFile, `${JSON.stringify(graph, null, 2)}\n`)
        log(`wrote ${graph.agents.length} agent(s) to ${path.relative(process.cwd(), outFile)}`)
      } catch (error) {
        console.error(
          '[eve-agents] reconcile failed:',
          error instanceof Error ? error.message : error
        )
      } finally {
        running = false
        if (queued) {
          queued = false
          void reconcile()
        }
      }
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void reconcile(), 600)
    }

    log(`watching ${path.relative(process.cwd(), dir)}/* …`)
    void reconcile()
    try {
      watch(dir, { recursive: true }, (_event, filename) => {
        const rel = filename?.replaceAll('\\', '/')
        if (!rel) return
        const base = rel.slice(rel.lastIndexOf('/') + 1)
        // Manifest rebuilds (agents added/removed) and env edits (e.g. a removed
        // CLERK_MACHINE_SECRET_KEY) both reconcile. Re-writing the env is
        // idempotent — the next pass sees the key present and does nothing — so
        // healing the key can't loop.
        if (rel.includes(MANIFEST_REL) || base === '.env' || base === '.env.local') {
          schedule()
        }
      })
    } catch (error) {
      console.error('[eve-agents] could not watch apps/:', error)
    }
  })

program
  .command('generate')
  .description('Write agents.json (the agent graph) for the dashboard to serve')
  .option('-o, --out <dir>', 'output directory, relative to cwd', '.')
  .option('--apps <dir>', 'directory holding the agent apps, relative to cwd', 'apps')
  .action(async (opts: { out: string; apps: string }) => {
    const clerk = getClerk()
    const outFile = path.resolve(process.cwd(), opts.out, 'agents.json')
    const appsPath = path.resolve(process.cwd(), opts.apps)
    const graph = await buildAgents({ clerk, appsDir: appsPath })
    await writeFile(outFile, `${JSON.stringify(graph, null, 2)}\n`)
    log(
      `wrote ${graph.agents.length} agent(s)` +
        `${graph.pendingConnections.length ? `, ${graph.pendingConnections.length} pending connection(s)` : ''}` +
        ` to ${path.relative(process.cwd(), outFile)}`
    )
  })

program
  .command('link')
  .description('Link every pending agent connection (bidirectional Clerk scopes)')
  .action(async () => {
    const clerk = getClerk()
    const { pendingConnections } = await buildAgents({ clerk, appsDir: appsDir() })
    if (pendingConnections.length === 0) {
      log('no pending connections — all agents are linked.')
      return
    }
    for (const connection of pendingConnections) {
      const [a, b] = connection.machines
      await linkMachineScopes(clerk, a, b)
      // Drop outstanding tokens so the new scope applies on the next call.
      await revokeMachineTokens(clerk, [a, b])
      log(`linked ${connection.agents[0]} <-> ${connection.agents[1]}`)
    }
    log(`linked ${pendingConnections.length} connection(s).`)
  })

program.parseAsync()
