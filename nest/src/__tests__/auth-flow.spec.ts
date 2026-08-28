/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { INestApplication, Module } from '@nestjs/common'
import { CqrsModule, EventBus } from '@nestjs/cqrs'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import {
  AUTH_OIDC_ROUTES,
  AuthOidcLoginFailureEvent,
  AuthOidcLoginSuccessEvent,
  AuthOidcLogoutEvent,
  type OidcClaimsType,
  type OidcConfigType,
} from '@rightandabove/auth-oidc-core'
import {
  AUTH_OIDC_CONFIG_TOKEN,
  AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN,
  AUTH_OIDC_USER_STORE_TOKEN,
  AuthOidcModule,
  OidcService,
  type IUserProfileMapper,
  type IUserStore,
  type ProvisionUserInputType,
} from '../index'

const testConfig: OidcConfigType = {
  issuerUrl: 'http://localhost:8080/realms/test',
  clientId: 'test',
  clientSecret: 'test-secret-must-be-long-enough!!',
  redirectUri: 'http://localhost:3000/auth-oidc/callback',
  jwtSecret: 'test-jwt-secret-must-be-32-chars!!',
  sessionSecret: 'test-session-secret-32-chars-long!!',
  scope: 'openid email profile',
  jwtExpiresIn: '1h',
  cookieName: 'auth_token',
}

class StubMapper implements IUserProfileMapper {
  mapClaims(claims: OidcClaimsType) {
    return {
      id: claims.sub,
      email: claims.email,
      ...(claims.name ? { name: claims.name } : {}),
      roles: claims.roles ?? [],
    }
  }
}

// Auto-provisioning stub: mints a LOCAL id (`local-N`) distinct from the
// IdP `sub`, keyed by subject so repeated logins reuse the same record.
// Proves the JWT / success event carry the local id, not the raw `sub`.
class StubUserStore implements IUserStore {
  private readonly bySubject = new Map<string, ReturnType<StubMapper['mapClaims']>>()
  private seq = 0

  async findOrCreate(input: ProvisionUserInputType) {
    const existing = this.bySubject.get(input.subject)
    if (existing) return existing
    const user = {
      id: `local-${++this.seq}`,
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      roles: input.roles,
    }
    this.bySubject.set(input.subject, user)
    return user
  }
}

// Stand-in for the real OidcService that does Issuer.discover() at construct time.
const oidcStub = {
  getAuthorizationUrl: vi.fn(
    async (state: string, nonce: string) =>
      `https://idp.example/authorize?state=${state}&nonce=${nonce}`,
  ),
  exchangeCode: vi.fn(async () => ({
    claims: (): OidcClaimsType => ({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      roles: ['admin'],
    }),
  })),
}

@Module({
  imports: [
    CqrsModule,
    AuthOidcModule.forRoot({
      ...testConfig,
      userProfileMapper: { useClass: StubMapper },
      userStore: { useClass: StubUserStore },
    }),
  ],
})
class TestRootModule {}

describe('AuthOidc end-to-end flow', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestRootModule],
    })
      .overrideProvider(OidcService)
      .useValue(oidcStub)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it(`GET ${AUTH_OIDC_ROUTES.LOGIN} redirects to IdP`, async () => {
    const res = await request(app.getHttpServer()).get(AUTH_OIDC_ROUTES.LOGIN)
    expect(res.status).toBe(302)
    expect(res.headers['location']).toContain('idp.example/authorize')
    expect(oidcStub.getAuthorizationUrl).toHaveBeenCalled()
  })

  it(`GET ${AUTH_OIDC_ROUTES.CALLBACK} sets JWT cookie and redirects`, async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)

    const res = await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
    expect(res.status).toBe(302)

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    const authCookie = cookies.find((c) => c.startsWith(`${testConfig.cookieName}=`))
    expect(authCookie).toBeDefined()

    // Regression guard: with rpInitiatedLogout unset, callback sets ONLY the
    // auth cookie - no id_token cookie is written (byte-for-byte 1.2.0).
    expect(cookies.some((c) => c.startsWith('auth_id_token='))).toBe(false)

    const tokenMatch = authCookie?.match(new RegExp(`${testConfig.cookieName}=([^;]+)`))
    const token = tokenMatch?.[1]
    expect(token).toBeTruthy()

    const decoded = jwt.verify(token!, testConfig.jwtSecret) as Record<string, unknown>
    // sub is the LOCAL provisioned id, NOT the IdP sub ('user-1').
    expect(decoded['sub']).toBe('local-1')
    expect(decoded['email']).toBe('user@example.com')
    expect(decoded['roles']).toEqual(['admin'])
  })

  it(`GET ${AUTH_OIDC_ROUTES.ME} returns 401 without token`, async () => {
    const res = await request(app.getHttpServer()).get(AUTH_OIDC_ROUTES.ME)
    expect(res.status).toBe(401)
  })

  it(`GET ${AUTH_OIDC_ROUTES.ME} returns the mapped user for a valid bearer JWT`, async () => {
    const token = jwt.sign(
      { sub: 'user-9', email: 'a@b.com', roles: ['user'] },
      testConfig.jwtSecret,
      { expiresIn: '1h' },
    )
    const res = await request(app.getHttpServer())
      .get(AUTH_OIDC_ROUTES.ME)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 'user-9', email: 'a@b.com', roles: ['user'] })
  })

  it(`GET ${AUTH_OIDC_ROUTES.LOGOUT} clears the cookie`, async () => {
    const res = await request(app.getHttpServer()).get(AUTH_OIDC_ROUTES.LOGOUT)
    expect(res.status).toBe(302)
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    expect(
      cookies.some((c) => c.startsWith(`${testConfig.cookieName}=`) && /Expires=/i.test(c)),
    ).toBe(true)
    // Regression guard: legacy logout clears ONLY the auth cookie and 302s to
    // the frontend fallback ('/', since testConfig has no frontendUrl) - it
    // must NOT touch an id_token cookie or hit an IdP end-session endpoint.
    expect(cookies.some((c) => c.startsWith('auth_id_token='))).toBe(false)
    expect(res.headers['location']).toBe('/')
  })

  it('publishes AuthOidcLoginSuccessEvent on callback and AuthOidcLogoutEvent on logout', async () => {
    const eventBus = app.get(EventBus)
    const captured: object[] = []
    const subscription = eventBus.subscribe((event) => captured.push(event as object))

    const agent = request.agent(app.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)
    await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
    await request(app.getHttpServer()).get(AUTH_OIDC_ROUTES.LOGOUT)

    const successes = captured.filter(
      (e): e is AuthOidcLoginSuccessEvent => e instanceof AuthOidcLoginSuccessEvent,
    )
    expect(successes).toHaveLength(1)
    // The success event carries the LOCAL provisioned id so cross-module
    // subscribers link business data to a stable app-owned key.
    expect(successes[0]!.userId).toBe('local-1')
    expect(successes[0]!.email).toBe('user@example.com')

    const logouts = captured.filter(
      (e): e is AuthOidcLogoutEvent => e instanceof AuthOidcLogoutEvent,
    )
    expect(logouts).toHaveLength(1)

    subscription.unsubscribe()
  })

  it('publishes AuthOidcLoginFailureEvent when exchangeCode throws', async () => {
    const failingStub = {
      getAuthorizationUrl: oidcStub.getAuthorizationUrl,
      exchangeCode: vi.fn(async () => {
        throw new Error('idp unreachable')
      }),
    }
    const moduleRef = await Test.createTestingModule({
      imports: [TestRootModule],
    })
      .overrideProvider(OidcService)
      .useValue(failingStub)
      .compile()
    const failApp = moduleRef.createNestApplication()
    await failApp.init()

    const failBus = failApp.get(EventBus)
    const captured: object[] = []
    const subscription = failBus.subscribe((event) => captured.push(event as object))

    const agent = request.agent(failApp.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)
    await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
    // Endpoint will return 500 because exchangeCode threw, that's fine for the assertion.

    const failures = captured.filter(
      (e): e is AuthOidcLoginFailureEvent => e instanceof AuthOidcLoginFailureEvent,
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]!.reason).toBe('idp unreachable')

    subscription.unsubscribe()
    await failApp.close()
  })

  it('AUTH_OIDC_CONFIG_TOKEN is registered with validated config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestRootModule],
    })
      .overrideProvider(OidcService)
      .useValue(oidcStub)
      .compile()
    const cfg = moduleRef.get<OidcConfigType>(AUTH_OIDC_CONFIG_TOKEN)
    expect(cfg.scope).toBe('openid email profile')
    expect(cfg.cookieName).toBe('auth_token')
    expect(cfg.jwtExpiresIn).toBe('1h')
    expect(moduleRef.get(AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN)).toBeInstanceOf(StubMapper)
    expect(moduleRef.get(AUTH_OIDC_USER_STORE_TOKEN)).toBeInstanceOf(StubUserStore)
    await moduleRef.close()
  })
})

// ── Opt-in RP-initiated (single) logout ──────────────────────────────────
// A second app instance with `rpInitiatedLogout: true`. Everything else is
// identical to the default flow; this isolates the new behavior so the block
// above remains the untouched-1.2.0 regression guard.

const rpConfig: OidcConfigType = {
  ...testConfig,
  rpInitiatedLogout: true,
  postLogoutRedirectUri: 'https://app.example/goodbye',
  idTokenCookieName: 'auth_id_token',
}

// Same shape as oidcStub, but exchangeCode also returns a raw id_token and we
// add getEndSessionUrl (the openid-client `endSessionUrl` wrapper). The stub
// echoes its params into the URL so tests can assert on id_token_hint /
// post_logout_redirect_uri without a real IdP.
const oidcRpStub = {
  getAuthorizationUrl: vi.fn(
    async (state: string, nonce: string) =>
      `https://idp.example/authorize?state=${state}&nonce=${nonce}`,
  ),
  exchangeCode: vi.fn(async () => ({
    id_token: 'fake.id.token',
    claims: (): OidcClaimsType => ({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      roles: ['admin'],
    }),
  })),
  getEndSessionUrl: vi.fn(
    async (params: { idTokenHint?: string; postLogoutRedirectUri?: string }) => {
      const url = new URL(
        'https://idp.example/realms/test/protocol/openid-connect/logout',
      )
      if (params.idTokenHint) url.searchParams.set('id_token_hint', params.idTokenHint)
      if (params.postLogoutRedirectUri) {
        url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri)
      }
      return url.toString()
    },
  ),
}

@Module({
  imports: [
    CqrsModule,
    AuthOidcModule.forRoot({
      ...rpConfig,
      userProfileMapper: { useClass: StubMapper },
      userStore: { useClass: StubUserStore },
    }),
  ],
})
class RpTestRootModule {}

describe('AuthOidc RP-initiated logout (opt-in)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RpTestRootModule],
    })
      .overrideProvider(OidcService)
      .useValue(oidcRpStub)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('callback sets BOTH the auth cookie and the id_token cookie', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)

    const res = await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
    expect(res.status).toBe(302)

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    expect(cookies.some((c) => c.startsWith(`${rpConfig.cookieName}=`))).toBe(true)
    const idCookie = cookies.find((c) => c.startsWith(`${rpConfig.idTokenCookieName}=`))
    expect(idCookie).toBeDefined()
    // httpOnly like the auth cookie, and carrying the raw id_token.
    expect(idCookie).toMatch(/HttpOnly/i)
    expect(idCookie).toContain('fake.id.token')
  })

  it('logout clears both cookies and 302s to the end-session URL with id_token_hint', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)
    await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)

    const res = await agent.get(AUTH_OIDC_ROUTES.LOGOUT)
    expect(res.status).toBe(302)

    // Both local cookies cleared.
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    expect(
      cookies.some((c) => c.startsWith(`${rpConfig.cookieName}=`) && /Expires=/i.test(c)),
    ).toBe(true)
    expect(
      cookies.some(
        (c) => c.startsWith(`${rpConfig.idTokenCookieName}=`) && /Expires=/i.test(c),
      ),
    ).toBe(true)

    // Redirects to the IdP end-session endpoint carrying both params.
    const location = res.headers['location'] ?? ''
    expect(location).toContain('idp.example')
    expect(location).toContain('/logout')
    expect(location).toContain('id_token_hint=fake.id.token')
    expect(location).toContain(
      `post_logout_redirect_uri=${encodeURIComponent(rpConfig.postLogoutRedirectUri!)}`,
    )
    expect(oidcRpStub.getEndSessionUrl).toHaveBeenCalledWith({
      idTokenHint: 'fake.id.token',
      postLogoutRedirectUri: rpConfig.postLogoutRedirectUri,
    })
  })

  it('logout with no id_token cookie still 302s to end-session, hint omitted', async () => {
    // Fresh agent -> never logged in -> no id_token cookie present.
    const res = await request(app.getHttpServer()).get(AUTH_OIDC_ROUTES.LOGOUT)
    expect(res.status).toBe(302)

    const location = res.headers['location'] ?? ''
    expect(location).toContain('/logout')
    expect(location).not.toContain('id_token_hint')
    // SSO termination is still requested; only the hint is missing.
    expect(oidcRpStub.getEndSessionUrl).toHaveBeenCalledWith({
      idTokenHint: undefined,
      postLogoutRedirectUri: rpConfig.postLogoutRedirectUri,
    })
  })

  it('publishes AuthOidcLogoutEvent on the RP logout path too', async () => {
    // Contract: AuthOidcLogoutEvent must fire in EVERY logout path, including
    // the RP-initiated one - cross-module subscribers depend on it.
    const eventBus = app.get(EventBus)
    const captured: object[] = []
    const subscription = eventBus.subscribe((e) => captured.push(e as object))

    const agent = request.agent(app.getHttpServer())
    await agent.get(AUTH_OIDC_ROUTES.LOGIN)
    await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
    await agent.get(AUTH_OIDC_ROUTES.LOGOUT)

    const logouts = captured.filter(
      (e): e is AuthOidcLogoutEvent => e instanceof AuthOidcLogoutEvent,
    )
    expect(logouts).toHaveLength(1)
    subscription.unsubscribe()
  })
})

// Build a fresh app (fresh stubs) per edge-case test so mock-call state and
// config never leak between them. Defining the decorated root class inside
// the helper keeps each variant fully isolated.
async function bootRpApp(
  config: OidcConfigType,
  oidcOverride: unknown,
): Promise<INestApplication> {
  @Module({
    imports: [
      CqrsModule,
      AuthOidcModule.forRoot({
        ...config,
        userProfileMapper: { useClass: StubMapper },
        userStore: { useClass: StubUserStore },
      }),
    ],
  })
  class DynRpRootModule {}

  const moduleRef = await Test.createTestingModule({ imports: [DynRpRootModule] })
    .overrideProvider(OidcService)
    .useValue(oidcOverride)
    .compile()
  const bootedApp = moduleRef.createNestApplication()
  await bootedApp.init()
  return bootedApp
}

describe('AuthOidc RP-initiated logout (edge cases)', () => {
  it('falls back to the frontend redirect (not 500) when getEndSessionUrl throws', async () => {
    // openid-client throws when the issuer advertises no end_session_endpoint;
    // getClient() re-throws on discovery failure. Logout must degrade to a
    // local logout + frontend redirect, still publishing the logout event.
    const throwingStub = {
      getAuthorizationUrl: vi.fn(async () => 'https://idp.example/authorize'),
      exchangeCode: vi.fn(async () => ({
        id_token: 'fake.id.token',
        claims: (): OidcClaimsType => ({ sub: 'user-1', email: 'user@example.com', roles: [] }),
      })),
      getEndSessionUrl: vi.fn(async () => {
        throw new Error('end_session_endpoint must be configured on the issuer')
      }),
    }
    const boot = await bootRpApp(
      { ...rpConfig, frontendUrl: 'https://app.example/me' },
      throwingStub,
    )
    try {
      const eventBus = boot.get(EventBus)
      const captured: object[] = []
      const subscription = eventBus.subscribe((e) => captured.push(e as object))

      const agent = request.agent(boot.getHttpServer())
      await agent.get(AUTH_OIDC_ROUTES.LOGIN)
      await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
      const res = await agent.get(AUTH_OIDC_ROUTES.LOGOUT)

      // No 500: degrade to the local frontend redirect (/me -> /login).
      expect(res.status).toBe(302)
      expect(res.headers['location']).toBe('https://app.example/login')
      expect(throwingStub.getEndSessionUrl).toHaveBeenCalled()
      // Event still fired despite the end-session failure.
      const logouts = captured.filter(
        (e): e is AuthOidcLogoutEvent => e instanceof AuthOidcLogoutEvent,
      )
      expect(logouts).toHaveLength(1)
      subscription.unsubscribe()
    } finally {
      await boot.close()
    }
  })

  it('falls back to frontendUrl for post_logout_redirect_uri when postLogoutRedirectUri is unset', async () => {
    const echoStub = {
      getAuthorizationUrl: vi.fn(async () => 'https://idp.example/authorize'),
      exchangeCode: vi.fn(async () => ({
        id_token: 'fake.id.token',
        claims: (): OidcClaimsType => ({ sub: 'user-1', email: 'user@example.com', roles: [] }),
      })),
      getEndSessionUrl: vi.fn(
        async (params: { idTokenHint?: string; postLogoutRedirectUri?: string }) => {
          const url = new URL('https://idp.example/logout')
          if (params.postLogoutRedirectUri) {
            url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri)
          }
          return url.toString()
        },
      ),
    }
    // rpInitiatedLogout on, NO postLogoutRedirectUri, frontendUrl set -> the
    // controller must fall back to frontendUrl.
    const noPlruConfig: OidcConfigType = {
      ...testConfig,
      rpInitiatedLogout: true,
      idTokenCookieName: 'auth_id_token',
      frontendUrl: 'https://app.example/home',
    }
    const boot = await bootRpApp(noPlruConfig, echoStub)
    try {
      const agent = request.agent(boot.getHttpServer())
      await agent.get(AUTH_OIDC_ROUTES.LOGIN)
      await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)
      const res = await agent.get(AUTH_OIDC_ROUTES.LOGOUT)

      expect(res.status).toBe(302)
      expect(echoStub.getEndSessionUrl).toHaveBeenCalledWith({
        idTokenHint: 'fake.id.token',
        postLogoutRedirectUri: 'https://app.example/home',
      })
      expect(res.headers['location']).toContain(
        `post_logout_redirect_uri=${encodeURIComponent('https://app.example/home')}`,
      )
    } finally {
      await boot.close()
    }
  })

  it('writes NO id_token cookie when the token set carries no id_token (rp on)', async () => {
    // Guard `rpInitiatedLogout && tokenSet.id_token`: a token set without an
    // id_token must not produce a bogus `auth_id_token=undefined` cookie.
    const noIdTokenStub = {
      getAuthorizationUrl: vi.fn(async () => 'https://idp.example/authorize'),
      exchangeCode: vi.fn(async () => ({
        // no id_token field
        claims: (): OidcClaimsType => ({ sub: 'user-1', email: 'user@example.com', roles: [] }),
      })),
      getEndSessionUrl: vi.fn(async () => 'https://idp.example/logout'),
    }
    const boot = await bootRpApp(rpConfig, noIdTokenStub)
    try {
      const agent = request.agent(boot.getHttpServer())
      await agent.get(AUTH_OIDC_ROUTES.LOGIN)
      const res = await agent.get(`${AUTH_OIDC_ROUTES.CALLBACK}?code=fake&state=fake`)

      expect(res.status).toBe(302)
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
      // Auth cookie set as usual; NO id_token cookie despite the flag being on.
      expect(cookies.some((c) => c.startsWith(`${rpConfig.cookieName}=`))).toBe(true)
      expect(cookies.some((c) => c.startsWith(`${rpConfig.idTokenCookieName}=`))).toBe(false)
    } finally {
      await boot.close()
    }
  })
})

describe('AuthOidcModule.forRoot validation', () => {
  it('throws when userProfileMapper is missing', () => {
    expect(() =>
      AuthOidcModule.forRoot({
        ...testConfig,
        userStore: { useClass: StubUserStore },
      } as unknown as Parameters<typeof AuthOidcModule.forRoot>[0]),
    ).toThrow(/userProfileMapper/)
  })

  it('throws when userStore is missing', () => {
    expect(() =>
      AuthOidcModule.forRoot({
        ...testConfig,
        userProfileMapper: { useClass: StubMapper },
      } as unknown as Parameters<typeof AuthOidcModule.forRoot>[0]),
    ).toThrow(/userStore/)
  })
})
