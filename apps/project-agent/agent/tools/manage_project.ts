import { defineTool } from 'eve/tools'
import { z } from 'zod'

export default defineTool({
  description: 'Archive or restore a project in the workspace.',
  inputSchema: z.object({
    projectId: z.string(),
    action: z.enum(['archive', 'restore']),
  }),
  execute: async ({ projectId, action }) => {
    // Replace with your real data-layer call.
    return { ok: true, projectId, action }
  },
})
