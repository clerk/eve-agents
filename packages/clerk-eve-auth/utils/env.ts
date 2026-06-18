import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// `.env.local` takes precedence over `.env` for both reads and writes.
const envFiles = (dir: string) => [
  path.join(dir, '.env.local'),
  path.join(dir, '.env'),
]

// True when `key` is already set to a non-empty value in this project's env.
export async function hasEnvKey(dir: string, key: string): Promise<boolean> {
  const re = new RegExp(`^${key}=.+$`, 'm')
  for (const file of envFiles(dir)) {
    try {
      if (re.test(await readFile(file, 'utf8'))) return true
    } catch {}
  }
  return false
}

// Set `key=value`, preferring an existing `.env.local` then `.env` (creating
// `.env.local` if neither exists). Returns the file written, or null if the
// value was already present unchanged (so callers can skip logging a no-op).
export async function upsertEnv(
  dir: string,
  key: string,
  value: string
): Promise<string | null> {
  const candidates = envFiles(dir)
  let target = candidates[0]
  let content = ''
  for (const file of candidates) {
    try {
      await access(file)
      target = file
      content = await readFile(file, 'utf8')
      break
    } catch {}
  }
  const re = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  const next = re.test(content)
    ? content.replace(re, line)
    : `${content && !content.endsWith('\n') ? `${content}\n` : content}${line}\n`
  if (next === content) return null
  await writeFile(target, next)
  return target
}
