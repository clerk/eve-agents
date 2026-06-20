import type { PlopTypes } from '@turbo/gen'
import autocompletePrompt from 'inquirer-autocomplete-prompt';


type AutocompletePrompt = PlopTypes.PromptQuestion & { 
  source: (answers: any, input: string | undefined) => Promise<any[]> 
}

type Model = {
  id: string
  object: "model",
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
  const currentSearch = input || ""; 
  return models
  .map((model) => model.id)
  .filter((item) =>
    item.toLowerCase().includes(currentSearch.toLowerCase())
  )
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setPrompt('autocomplete', autocompletePrompt);
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
}
