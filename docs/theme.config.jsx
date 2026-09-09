import React from 'react'

export default {
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '18px' }}>
      <img src="/logo-dark.png" alt="SpaceShield Logo" style={{ height: '26px', width: 'auto' }} />
      <span>SpaceShield <span style={{ opacity: 0.6, fontWeight: 400, fontSize: '14px' }}>Docs</span></span>
    </div>
  ),
  project: {
    link: 'https://github.com/midexol/SpaceShield'
  },
  docsRepositoryBase: 'https://github.com/midexol/SpaceShield/tree/main/docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – SpaceShield Docs'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="SpaceShield — Autonomous Spacecoin Satellite Insurance & Compensation Protocol" />
      <link rel="icon" href="/favicon.png" type="image/png" />
    </>
  ),
  footer: {
    text: (
      <span>
        © {new Date().getFullYear()} SpaceShield Protocol. Built on Nextra 4 & Next.js.
      </span>
    )
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  primaryHue: 155
}
