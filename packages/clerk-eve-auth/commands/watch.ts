#!/usr/bin/env bun
import { watch } from 'node:fs'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import { MANIFEST_REL } from '../utils/projects'
import { syncMachines } from '../utils/sync'

// agents-dev: watch every eve agent under <cwd>/apps/* and keep Clerk machines
// in sync with the agents it finds in each compiled manifest. The reconcile
// itself lives in utils/sync.ts so it can be reused by one-shot commands (e.g.
// a deploy/build step); this file is just the watch + debounce loop.

const ROOT = process.cwd()
const APPS_DIR = path.join(ROOT, 'apps')

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error(
    '[agents-dev] CLERK_SECRET_KEY is missing from the environment.'
  )
  process.exit(1)
}
const clerk = createClerkClient({ secretKey })
const log = (message: string) => console.log(`[agents-dev] ${message}`)

let running = false
let queued = false

async function reconcile() {
  if (running) {
    queued = true
    return
  }
  running = true
  try {
    await syncMachines({ clerk, appsDir: APPS_DIR, log })
  } catch (error) {
    console.error(
      '[agents-dev] reconcile failed:',
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
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void reconcile(), 600)
}

console.log(`[agents-dev] watching ${path.relative(ROOT, APPS_DIR)}/* …`)
void reconcile()
try {
  watch(APPS_DIR, { recursive: true }, (_event, filename) => {
    if (filename?.replaceAll('\\', '/').includes(MANIFEST_REL)) schedule()
  })
} catch (error) {
  console.error('[agents-dev] could not watch apps/:', error)
}
