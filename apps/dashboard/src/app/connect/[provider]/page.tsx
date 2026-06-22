'use client'

import { useReverification, useUser } from '@clerk/nextjs'
import type { OAuthStrategy } from '@clerk/types'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Bridge page for eve's interactive tool auth (see `clerkConnect`). A tool's
// `startAuthorization` returns a challenge URL pointing here; this page runs
// Clerk's frontend connect flow (`createExternalAccount` / `reauthorize`),
// requesting any extra scopes, and redirects the user to the provider. After
// the provider -> Clerk round-trip, Clerk redirects back to `return` (eve's
// framework-owned callback URL), where the tool's `completeAuthorization`
// reads the now-stored token and the agent turn resumes.
export default function ConnectProviderPage() {
  const { user, isLoaded } = useUser()
  const params = useParams<{ provider: string }>()
  const search = useSearchParams()
  const [error, setError] = useState<string>()
  const started = useRef(false)

  const createExternalAccount = useReverification(
    (
      args: Parameters<
        NonNullable<typeof user>['createExternalAccount']
      >[0]
    ) => user?.createExternalAccount(args)
  )

  useEffect(() => {
    if (!isLoaded || !user || started.current) return
    started.current = true

    const provider = params.provider
    const returnUrl = search.get('return') ?? '/'
    const scopes = (search.get('scopes') ?? '')
      .split(' ')
      .map(s => s.trim())
      .filter(Boolean)
    // OIDC `prompt` forwarded to the provider so it re-shows the account/consent
    // screens instead of silently reusing a prior authorization.
    const oidcPrompt = search.get('prompt') ?? undefined
    const strategy = `oauth_${provider}` as OAuthStrategy
    const existing = user.externalAccounts.find(
      a => a.provider === provider
    )

    void (async () => {
      try {
        const account =
          existing && scopes.length
            ? await existing.reauthorize({
                additionalScopes: scopes,
                redirectUrl: returnUrl,
                oidcPrompt,
              })
            : await createExternalAccount({
                strategy,
                additionalScopes: scopes,
                redirectUrl: returnUrl,
                oidcPrompt,
              })

        const url = account?.verification?.externalVerificationRedirectURL
        if (url) {
          window.location.href = url.href
          return
        }
        setError('Clerk did not return a verification URL.')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [isLoaded, user, params.provider, search, createExternalAccount])

  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      {error
        ? `Connection failed: ${error}`
        : `Connecting ${params.provider}…`}
    </main>
  )
}
