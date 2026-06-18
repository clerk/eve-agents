import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { machineName } from '@clerk/eve-auth'

// An eve agent project is any `apps/*` dir with a compiled manifest.
export const MANIFEST_REL = '.eve/compile/compiled-agent-manifest.json'

// The slice of the compiled manifest we read. The compiler emits much more;
// these are the fields the reconcile and the agents.json generator consume.
export type CompiledManifest = {
  config?: {
    name?: string
    model?: { id?: string; routing?: { kind?: string; target?: string } }
  }
  instructions?: { markdown?: string }
  tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }>
  remoteAgents?: Array<{ name?: string; description?: string; url?: string }>
}

export type ProjectManifest = { dir: string; manifest: CompiledManifest }

// Read every `apps/*` compiled manifest that names a primary agent. Shared by
// the machine reconcile and the agents.json generator.
export async function readManifests(appsDir: string): Promise<ProjectManifest[]> {
  const entries = await readdir(appsDir, { withFileTypes: true }).catch(() => [])
  const out: ProjectManifest[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(appsDir, entry.name)
    try {
      const manifest = JSON.parse(
        await readFile(path.join(dir, MANIFEST_REL), 'utf8')
      ) as CompiledManifest
      if (typeof manifest?.config?.name !== 'string') continue
      out.push({ dir, manifest })
    } catch {
      // no manifest yet, or mid-write — skip this pass
    }
  }
  return out
}

export type AgentProject = {
  dir: string // apps/<x>
  machine: string // eve:<config.name normalized>
  remotes: string[] // eve:<remote name normalized>
}

// Each project reduced to the machine names it implies: its primary agent plus
// every remote agent it delegates to.
export async function scanProjects(appsDir: string): Promise<AgentProject[]> {
  const manifests = await readManifests(appsDir)
  return manifests.map(({ dir, manifest }) => {
    const name = manifest.config?.name as string
    const remotes = (manifest.remoteAgents ?? [])
      .map(r => r.name)
      .filter((n): n is string => typeof n === 'string')
      .map(machineName)
    return { dir, machine: machineName(name), remotes }
  })
}
