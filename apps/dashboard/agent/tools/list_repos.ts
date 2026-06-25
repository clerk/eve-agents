import { clerkConnect, clerkOAuthToken } from '@clerk/eve-auth/connect'
import { defineTool } from 'eve/tools'
import type { ToolContext } from 'eve/tools'
import { z } from 'zod'

// `repo` grants public + private repo access (what `visibility: 'all'` below
// needs). For public repos only, use `public_repo` here and `visibility: 'public'`.
const SCOPES = ['repo'] as const

// GitHub's `affiliation` filter. 'all' expands to every relationship; the
// others narrow to a single one ('owner' = the caller's personal repos).
const AFFILIATIONS = {
  all: 'owner,collaborator,organization_member',
  owner: 'owner',
  collaborator: 'collaborator',
  organization_member: 'organization_member',
} as const

type Repo = { full_name: string; private: boolean; html_url: string }

// GitHub paginates via the `Link` header (this endpoint returns no total
// count). Pull the `next`/`last` page numbers so the model can keep paging.
function parsePageLinks(header: string | null): {
  next?: number
  last?: number
} {
  const out: { next?: number; last?: number } = {}
  if (!header) return out
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="(next|last)"/)
    if (!match) continue
    const page = new URL(match[1]).searchParams.get('page')
    if (page) out[match[2] as 'next' | 'last'] = Number(page)
  }
  return out
}

// Signed-in users connect GitHub interactively through the tool's `auth`
// (`ctx.getToken()`). An API key minted for a user can't complete a browser
// consent, so it falls back to the non-interactive resolver, which reads the
// token Clerk already holds for the user behind the key.
async function resolveGitHubToken(
  ctx: ToolContext
): Promise<string | null> {
  if (ctx.session.auth.current?.principalType === 'user') {
    const { token } = await ctx.getToken()
    return token
  }
  const result = await clerkOAuthToken(ctx, 'github', { scopes: SCOPES })
  return result.token
}

export default defineTool({
  description: "List the caller's GitHub repositories.",
  inputSchema: z.object({
    affiliation: z
      .enum(['all', 'owner', 'collaborator', 'organization_member'])
      .default('all')
      .describe(
        "Which repositories to list by the caller's relationship: 'owner' (personal repos), 'collaborator', 'organization_member', or 'all'."
      ),
    page: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('1-based page number to fetch.'),
    perPage: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(30)
      .describe('Repositories per page (max 100).'),
  }),
  auth: clerkConnect('github', { scopes: SCOPES }),
  execute: async ({ affiliation, page, perPage }, ctx) => {
    const token = await resolveGitHubToken(ctx)
    if (!token) {
      return {
        error: true,
        message: 'Connect your GitHub account to list repositories.',
      }
    }

    // visibility=all needs the `repo` scope for private repos.
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      sort: 'updated',
      visibility: 'all',
      affiliation: AFFILIATIONS[affiliation],
    })
    const url = `https://api.github.com/user/repos?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[list_repos] github error', res.status, body)
      return { error: true, message: `GitHub API error (${res.status}).` }
    }

    const repos = (await res.json()) as Repo[]
    const links = parsePageLinks(res.headers.get('link'))
    return {
      page,
      perPage,
      count: repos.length,
      hasMore: links.next != null,
      totalPages: links.last ?? page,
      repos: repos.map(repo => ({
        name: repo.full_name,
        private: repo.private,
        url: repo.html_url,
      })),
    }
  },
})
