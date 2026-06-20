import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { PlopTypes } from '@turbo/gen'
import autocompletePrompt from 'inquirer-autocomplete-prompt'

type AutocompletePrompt = PlopTypes.PromptQuestion & {
  source: (answers: any, input: string | undefined) => Promise<any[]>
}

type Model = {
  id: string
  object: 'model'
  name: string
  description: string
} & Record<string, any>

type ModelsResponse = {
  object: 'list'
  data: Model[]
}

async function getModels() {
  const models = await fetch('https://ai-gateway.vercel.sh/v1/models')
  const data: ModelsResponse = await models.json()
  return data.data
}

async function searchModels(answers: any, input: string | undefined) {
  const models = await getModels()
  const currentSearch = input || ''
  return models
    .map(model => model.id)
    .filter(item =>
      item.toLowerCase().includes(currentSearch.toLowerCase())
    )
}

function listAgentApps(): string[] {
  const appsDir = join(process.cwd(), 'apps')
  if (!existsSync(appsDir)) return []
  return readdirSync(appsDir).filter(d => {
    const appPath = join(appsDir, d)
    return (
      statSync(appPath).isDirectory() && existsSync(join(appPath, 'agent'))
    )
  })
}

function loadEnvLocal(appName: string): Record<string, string> {
  const path = join(process.cwd(), 'apps', appName, '.env.local')
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

async function searchAgentApps(_answers: any, input: string | undefined) {
  const apps = listAgentApps()
  const q = (input ?? '').toLowerCase()
  return apps.filter(name => name.toLowerCase().includes(q))
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setPrompt('autocomplete', autocompletePrompt)

  plop.setActionType('linkClerkMachine', async answers => {
    const a = answers as { appName: string; name: string }
    const env = loadEnvLocal(a.appName)
    const secretKey = process.env.CLERK_SECRET_KEY ?? env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new Error(
        `CLERK_SECRET_KEY not found in apps/${a.appName}/.env.local or environment.`
      )
    }

    const { createClerkClient } = await import('@clerk/backend')
    const clerk = createClerkClient({ secretKey })

    const list = await clerk.machines.list({ query: a.appName })
    const parent = list.data.find(m => m.name === a.appName)
    if (!parent) {
      throw new Error(
        `No Clerk machine named "${a.appName}" found. Create one first (e.g. via demo:create-machines).`
      )
    }

    const subagentMachineName = `${a.name}-agent`
    const subagent = await clerk.machines.create({
      name: subagentMachineName,
    })
    await clerk.machines.createScope(parent.id, subagent.id)

    return [
      `Created Clerk machine "${subagentMachineName}".`,
      `Scoped ${a.appName} → ${subagentMachineName} (one-way; main can mint M2M tokens for the subagent).`,
      `Secret: ${subagent.secretKey ?? '(not returned)'}`,
      `Add as CLERK_MACHINE_SECRET_KEY in the new subagent's .env.local.`,
    ].join('\n')
  })

  plop.setGenerator('agent', {
    description:
      'Scaffold a new empty eve agent under apps/ with clerkAuth() and no extra boilerplate.',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Agent name (used as folder and package name):',
        validate: (value: string) => {
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Use lowercase letters, digits, and hyphens; must start with a letter.'
          }
          return true
        },
      },
      {
        type: 'autocomplete',
        name: 'model',
        message: 'AI Gateway model:',
        pageSize: 5,
        source: searchModels,
        validate: (value: string) => {
          if (!value) return 'Please select a model'
          return true
        },
      } as AutocompletePrompt,
      {
        type: 'input',
        name: 'port',
        message: 'Dev server port:',
        default: '3003',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/{{name}}/package.json',
        templateFile: 'templates/package.json.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{name}}/tsconfig.json',
        templateFile: 'templates/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{name}}/.env.example',
        templateFile: 'templates/env.example.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{name}}/agent/agent.ts',
        templateFile: 'templates/agent.ts.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{name}}/agent/channels/eve.ts',
        templateFile: 'templates/channels-eve.ts.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{name}}/agent/instructions.ts',
        templateFile: 'templates/instructions.ts.hbs',
      },
    ],
  })

  plop.setGenerator('subagent', {
    description:
      'Scaffold a remote subagent under an existing agent app, with optional Clerk machine wiring.',
    prompts: [
      {
        type: 'autocomplete',
        name: 'appName',
        message: 'Which agent app should host this subagent?',
        source: searchAgentApps,
      } as AutocompletePrompt,
      {
        type: 'input',
        name: 'name',
        message: 'Subagent name (file name and Clerk machine prefix):',
        validate: (value: string) => {
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Use lowercase letters, digits, and hyphens; must start with a letter.'
          }
          return true
        },
      },
      {
        type: 'input',
        name: 'url',
        message: 'Remote agent URL:',
        default: 'http://localhost:3002',
      },
      {
        type: 'input',
        name: 'urlEnv',
        message: 'Env var name that overrides the URL:',
        default: (answers: { name?: string }) =>
          `${(answers.name ?? '').toUpperCase().replace(/-/g, '_')}_AGENT_URL`,
      },
      {
        type: 'confirm',
        name: 'linkMachine',
        message:
          'Create a Clerk machine for this subagent and scope from the parent?',
        default: false,
      },
    ],
    actions: answers => {
      const acts: PlopTypes.ActionType[] = [
        {
          type: 'add',
          path: 'apps/{{appName}}/agent/subagents/{{name}}.ts',
          templateFile: 'templates/subagent.ts.hbs',
        },
      ]
      if ((answers as { linkMachine?: boolean })?.linkMachine) {
        acts.push({ type: 'linkClerkMachine' })
      }
      return acts
    },
  })
}
