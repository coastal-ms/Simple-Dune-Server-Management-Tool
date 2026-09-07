import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('remote access retirement guidance', () => {
  it('keeps Expo functional while directing users to the Tailscale Browser Portal', () => {
    const nativeSource = readFileSync(
      resolve(process.cwd(), '..', 'mobile', 'app', 'index.tsx'),
      'utf8',
    )
    const settingsSource = readFileSync(
      resolve(process.cwd(), 'src', 'pages', 'settings', 'MobileAppCard.tsx'),
      'utf8',
    )

    expect(nativeSource).toContain('Native app retirement planned')
    expect(nativeSource).toContain('Browser Portal')
    expect(nativeSource).toContain('Tailscale link or QR code')
    expect(settingsSource).toContain('Native mobile apps are being retired')
    expect(settingsSource).toContain('Tailscale remote access and this')
    expect(settingsSource).toContain('responsive portal remain supported')
  })

  it('keeps legacy Cloudflare configuration reversible but disabled by default in v15', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src', 'pages', 'settings', 'RemoteAccessCard.tsx'),
      'utf8',
    )

    expect(source).toContain('configuration is retained in v15.0.0')
    expect(source).toContain('legacy portal is disabled by default')
    expect(source).toContain('can be explicitly re-enabled')
    expect(source).toContain('without clearing the owner or ACL')
    expect(source).toContain('Plan your migration to the Browser Portal')
    expect(source).toContain('Tailscale Funnel')
  })
})
