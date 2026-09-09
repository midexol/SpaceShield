import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import { headers } from 'next/headers'
import 'nextra-theme-docs/style.css'
import '../styles/custom.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: {
    template: '%s - SpaceShield Documentation',
    default: 'SpaceShield Documentation',
  },
  description: 'Technical documentation for SpaceShield Autonomous Parametric Satellite Insurance Protocol.',
}

const navbar = (
  <Navbar
    logo={
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/logo-light.png" alt="SpaceShield Logo" width={28} height={28} />
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>SpaceShield</span>
      </div>
    }
    projectLink="https://github.com/midexol/SpaceShield"
  />
)

const footer = (
  <Footer>
    SpaceShield Documentation © {new Date().getFullYear()} — Autonomous Parametric Satellite Insurance Protocol
  </Footer>
)

export default async function RootLayout({ children }) {
  let isNotFound = false
  try {
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || ''
    if (pathname.includes('_not-found')) {
      isNotFound = true
    }
  } catch {
    // static generation context
  }

  if (isNotFound) {
    return (
      <html lang="en" dir="ltr" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    )
  }

  const pageMap = await getPageMap()

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/midexol/SpaceShield/tree/main/docs"
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
