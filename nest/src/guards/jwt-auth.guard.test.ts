/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import type { OidcConfigType } from '@rightandabove/auth-oidc-core'
import { JwtAuthGuard } from './jwt-auth.guard'

const config: OidcConfigType = {
  issuerUrl: 'http://localhost:8080/realms/test',
  clientId: 'test-client',
  clientSecret: 'test-secret-must-be-long-enough!!',
  redirectUri: 'http://localhost:3000/auth-oidc/callback',
  jwtSecret: 'test-jwt-secret-must-be-32-chars!!',
  scope: 'openid email profile',
  jwtExpiresIn: '1h',
  cookieName: 'auth_token',
}

function makeContext(headers: { authorization?: string; cookie?: string } = {}): ExecutionContext {
  const request: {
    headers: typeof headers
    user?: unknown
  } = {
    headers,
    user: undefined,
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard

  beforeEach(() => {
    guard = new JwtAuthGuard(config)
  })

  it('passes with a valid Bearer token', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'u@x.com', roles: [] },
      config.jwtSecret,
      { expiresIn: '1h' },
    )
    const ctx = makeContext({ authorization: `Bearer ${token}` })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('passes with a valid token in auth_token cookie', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'u@x.com', roles: [] },
      config.jwtSecret,
      { expiresIn: '1h' },
    )
    const ctx = makeContext({ cookie: `other=foo; auth_token=${token}; bar=baz` })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('throws UnauthorizedException when token is missing', () => {
    const ctx = makeContext()
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when token is expired', () => {
    const token = jwt.sign(
      { sub: 'u1', email: 'u@x.com', roles: [] },
      config.jwtSecret,
      { expiresIn: -1 },
    )
    const ctx = makeContext({ authorization: `Bearer ${token}` })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when token is malformed', () => {
    const ctx = makeContext({ authorization: 'Bearer not.a.jwt' })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })
})
