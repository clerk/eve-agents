import Image from 'next/image'
import Link from 'next/link'
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs'

export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Image src="/mark-light.png" alt="Clerk" width={24} height={24} />
        <span className="hidden md:inline">Eve</span>
      </Link>
      <div className="flex items-center gap-2">
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  )
}
