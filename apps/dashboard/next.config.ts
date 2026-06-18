import type { NextConfig } from 'next'
import { withEve } from 'eve/next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.ngrok.dev', '*.ngrok-free.dev'],
}

// Mount the main-agent eve runtime on this app's origin so `useEveAgent()` can
// reach same-origin /eve/v1/* routes with no CORS or host config.
export default withEve(nextConfig, {
  eveRoot: '../main-agent',
})
