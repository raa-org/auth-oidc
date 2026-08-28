/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect } from 'vitest'
import {
  LoginRequestSchema,
  TokenPayloadSchema,
  UserProfileSchema,
  OidcClaimsSchema,
  OidcConfigSchema,
} from './schemas'

describe('LoginRequestSchema', () => {
  it('accepts empty object', () => {
    expect(LoginRequestSchema.parse({})).toEqual({})
  })

  it('accepts valid redirectUri', () => {
    const result = LoginRequestSchema.parse({ redirectUri: 'https://example.com/callback' })
    expect(result.redirectUri).toBe('https://example.com/callback')
  })

  it('rejects invalid redirectUri', () => {
    expect(() => LoginRequestSchema.parse({ redirectUri: 'not-a-url' })).toThrow()
  })
})

describe('TokenPayloadSchema', () => {
  const valid = {
    sub: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    roles: ['admin'],
    iat: 1700000000,
    exp: 1700003600,
  }

  it('accepts valid payload', () => {
    expect(TokenPayloadSchema.parse(valid)).toEqual(valid)
  })

  it('rejects missing sub', () => {
    const { sub: _sub, ...rest } = valid
    expect(() => TokenPayloadSchema.parse(rest)).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() => TokenPayloadSchema.parse({ ...valid, email: 'bad' })).toThrow()
  })

  it('rejects non-integer iat', () => {
    expect(() => TokenPayloadSchema.parse({ ...valid, iat: 1.5 })).toThrow()
  })
})

describe('UserProfileSchema', () => {
  it('accepts valid profile', () => {
    const result = UserProfileSchema.parse({ id: 'u1', email: 'a@b.com' })
    expect(result).toEqual({ id: 'u1', email: 'a@b.com', roles: [] })
  })

  it('rejects empty id', () => {
    expect(() => UserProfileSchema.parse({ id: '', email: 'a@b.com' })).toThrow()
  })

  it('accepts optional country', () => {
    const result = UserProfileSchema.parse({ id: 'u1', email: 'a@b.com', country: 'DE' })
    expect(result.country).toBe('DE')
  })

  it('stays strict: strips unknown keys (no passthrough into the JWT profile)', () => {
    const result = UserProfileSchema.parse({
      id: 'u1',
      email: 'a@b.com',
      realm_access: { roles: ['admin'] },
    })
    expect(result).toEqual({ id: 'u1', email: 'a@b.com', roles: [] })
  })
})

describe('OidcClaimsSchema', () => {
  const base = { sub: 'idp-1', email: 'a@b.com' }

  it('accepts minimal claims', () => {
    expect(OidcClaimsSchema.parse(base)).toEqual(base)
  })

  it('keeps unknown claims via passthrough', () => {
    const result = OidcClaimsSchema.parse({ ...base, tenant_id: 't-42' })
    expect(result.tenant_id).toBe('t-42')
  })

  it('keeps and types Keycloak-style nested role claims', () => {
    const result = OidcClaimsSchema.parse({
      ...base,
      realm_access: { roles: ['offline_access'] },
      resource_access: { 'my-client': { roles: ['manage-account'] } },
    })
    expect(result.realm_access?.roles).toEqual(['offline_access'])
    expect(result.resource_access?.['my-client']?.roles).toEqual(['manage-account'])
  })

  it('keeps and types the country claim', () => {
    expect(OidcClaimsSchema.parse({ ...base, country: 'DE' }).country).toBe('DE')
  })

  it('rejects malformed realm_access', () => {
    expect(() =>
      OidcClaimsSchema.parse({ ...base, realm_access: { roles: 'admin' } }),
    ).toThrow()
  })
})

describe('OidcConfigSchema', () => {
  const valid = {
    issuerUrl: 'http://localhost:8080/realms/test-realm',
    clientId: 'trusted-auth-test',
    clientSecret: 'supersecret-value-at-least-32chars!!',
    redirectUri: 'http://localhost:3000/auth-oidc/callback',
    jwtSecret: 'jwt-secret-value-at-least-32chars!!',
    sessionSecret: 'session-secret-value-at-least-32!!',
  }

  it('accepts valid config and applies defaults', () => {
    const result = OidcConfigSchema.parse(valid)
    expect(result.scope).toBe('openid email profile')
    expect(result.jwtExpiresIn).toBe('1h')
    expect(result.cookieName).toBe('auth_token')
    expect(result.frontendUrl).toBeUndefined()
  })

  it('defaults RP-initiated logout off, keeping 1.2.0 behavior', () => {
    const result = OidcConfigSchema.parse(valid)
    // Master switch is off -> logout stays local-only, no id_token cookie.
    expect(result.rpInitiatedLogout).toBe(false)
    // Cookie name has a sane default so the field is never undefined at runtime.
    expect(result.idTokenCookieName).toBe('auth_id_token')
    // Optional redirect target: absent unless the host opts in.
    expect(result.postLogoutRedirectUri).toBeUndefined()
  })

  it('accepts opt-in RP-initiated logout config', () => {
    const result = OidcConfigSchema.parse({
      ...valid,
      rpInitiatedLogout: true,
      postLogoutRedirectUri: 'https://app.example/goodbye',
      idTokenCookieName: 'my_id_token',
    })
    expect(result.rpInitiatedLogout).toBe(true)
    expect(result.postLogoutRedirectUri).toBe('https://app.example/goodbye')
    expect(result.idTokenCookieName).toBe('my_id_token')
  })

  it('rejects a non-URL postLogoutRedirectUri', () => {
    expect(() =>
      OidcConfigSchema.parse({ ...valid, postLogoutRedirectUri: 'not-a-url' }),
    ).toThrow()
  })

  it('rejects an empty idTokenCookieName', () => {
    expect(() =>
      OidcConfigSchema.parse({ ...valid, idTokenCookieName: '' }),
    ).toThrow()
  })

  it('rejects short jwtSecret', () => {
    expect(() => OidcConfigSchema.parse({ ...valid, jwtSecret: 'short' })).toThrow()
  })

  it('rejects short sessionSecret', () => {
    expect(() => OidcConfigSchema.parse({ ...valid, sessionSecret: 'short' })).toThrow()
  })

  it('rejects invalid issuerUrl', () => {
    expect(() => OidcConfigSchema.parse({ ...valid, issuerUrl: 'not-a-url' })).toThrow()
  })
})
