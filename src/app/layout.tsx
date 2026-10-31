import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import type { ReactNode } from 'react'
import ClubRail from '@/components/ClubRail'
import SearchBox from '@/components/SearchBox'
import { SITE } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: football statistics with context`, template: `%s · ${SITE.name}` },
  description: 'Football statistics that show the context behind the numbers: minutes, starts and sample size next to every figure.',
  openGraph: { siteName: SITE.name, type: 'website' },
}

export const viewport: Viewport = { themeColor: '#0b1440', colorScheme: 'dark' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
        <header className="sticky top-0 z-40 border-b border-line bg-bg/40 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-ink">B</span>
              <span className="hidden sm:inline">{SITE.name}</span>
            </Link>
            <nav aria-label="Main" className="glass hidden items-center gap-1 rounded-full p-1 text-sm md:flex">
              <Link href="/competitions/premier-league" className="rounded-full px-4 py-1.5 text-muted transition hover:bg-surface-2 hover:text-text">Premier League</Link>
              <Link href="/compare" className="rounded-full px-4 py-1.5 text-muted transition hover:bg-surface-2 hover:text-text">Compare</Link>
            </nav>
            <div className="ml-auto w-full max-w-sm">
              <SearchBox />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1">{children}</main>
        <ClubRail />

        <footer className="mt-16 border-t border-line bg-bg/30 backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <p className="font-medium text-text">{SITE.name}</p>
              <p>{SITE.tagline} An independent project by {SITE.owner}. Not affiliated with any league or club.</p>
            </div>
            <div className="space-y-1 text-xs text-faint">
              <p className="font-medium text-muted">Data sources</p>
              <p>Match data: openfootball (CC0 public domain).</p>
              {process.env.FOOTBALL_DATA_API_KEY && <p>Football data provided by the Football-Data.org API.</p>}
              <p>Statistics are derived from published lineups and match events. Methods are explained next to each figure.</p>
              <p><Link href="/credits" className="underline-offset-2 hover:text-text hover:underline">Credits: data sources and photo attribution</Link></p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
