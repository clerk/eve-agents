import type { NextConfig } from 'next'
import { withEve } from 'eve/next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.ngrok.dev', '*.ngrok-free.dev'],
}

// Mount the colocated eve agent (./agent) on this app's origin so
// `useEveAgent()` can reach same-origin /eve/v1/* routes with no CORS or host
// config. withEve defaults eveRoot to the Next.js app root.
export default withEve(nextConfig)
