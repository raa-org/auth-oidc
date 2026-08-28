/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import {
  Controller,
  Get,
  Inject,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'
import type { Request, Response } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { generators } from 'openid-client'
import {
  AUTH_OIDC_ROUTES,
  AuthOidcLoginFailureEvent,
  AuthOidcLoginSuccessEvent,
  AuthOidcLogoutEvent,
  OidcClaimsSchema,
  type OidcConfigType,
  type UserProfileType,
} from '@rightandabove/auth-oidc-core'
import { AUTH_OIDC_CONFIG_TOKEN } from '../tokens'
import { OidcService } from '../strategies/oidc.strategy'
import { UserProvisioningService } from '../services/user-provisioning.service'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { CurrentUser } from '../decorators/current-user.decorator'
import { readCookie } from '../middleware/auth-cookie.middleware'

@Controller()
export class AuthController {
  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(AUTH_OIDC_CONFIG_TOKEN) private readonly config: OidcConfigType,
    @Inject(UserProvisioningService)
    private readonly provisioning: UserProvisioningService,
    @Inject(EventBus) private readonly eventBus: EventBus,
  ) {}

  @Get(AUTH_OIDC_ROUTES.LOGIN)
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    const nonce = generators.nonce()
    const state = generators.state()

    req.session.oidc_state = state
    req.session.oidc_nonce = nonce

    const url = await this.oidcService.getAuthorizationUrl(state, nonce)

    res.redirect(url)
  }

  @Get(AUTH_OIDC_ROUTES.CALLBACK)
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const state = req.session.oidc_state ?? ''
    const nonce = req.session.oidc_nonce ?? ''

    try {
      const tokenSet = await this.oidcService.exchangeCode(req.url, state, nonce)
      const claims = OidcClaimsSchema.parse(tokenSet.claims())

      // Map IdP claims -> normalized profile, then auto-provision the user
      // into the app's own store. `user.id` is the LOCAL id, so the JWT and
      // the success event carry the handle other modules link against.
      const user = await this.provisioning.provisionFromClaims(claims)

      const payload = { sub: user.id, email: user.email, name: user.name, roles: user.roles }
      const secret = this.config.jwtSecret
      const expiresIn = this.config.jwtExpiresIn ?? '1h'
      const token = jwt.sign(payload, secret, { expiresIn } as SignOptions)

      res.cookie(this.config.cookieName, token, {
        httpOnly: true,
        secure: this.config.cookieSecure,
        sameSite: 'lax',
        // Scope to the app base path for multi-tenant isolation; omit domain
        // so the cookie is host-only (works on any host, not just localhost).
        path: this.config.cookiePath,
        maxAge: this.maxAgeMs(),
      })

      // Persist the raw IdP id_token for a later `id_token_hint` at logout,
      // but ONLY when RP-initiated logout is enabled - with the flag off no
      // extra cookie is written and callback behaves exactly as in 1.2.0.
      // Keycloak id_tokens are ~1-2 KB, well under the 4 KB cookie limit.
      if (this.config.rpInitiatedLogout && tokenSet.id_token) {
        res.cookie(this.config.idTokenCookieName, tokenSet.id_token, {
          httpOnly: true,
          secure: this.config.cookieSecure,
          sameSite: 'lax',
          path: this.config.cookiePath,
          maxAge: this.maxAgeMs(),
        })
      }

      this.eventBus.publish(new AuthOidcLoginSuccessEvent(user.id, user.email))
      res.redirect(this.config.frontendUrl ?? '/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      this.eventBus.publish(new AuthOidcLoginFailureEvent(message))
      throw err
    }
  }

  @Get(AUTH_OIDC_ROUTES.LOGOUT)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    res.clearCookie(this.config.cookieName, {
      path: this.config.cookiePath,
    })

    // Publish the logout event up front and unconditionally: cross-module
    // subscribers must fire in EVERY logout path, even if the optional IdP
    // end-session step below fails. (Order vs the redirect is irrelevant.)
    this.eventBus.publish(new AuthOidcLogoutEvent())

    // Opt-in RP-initiated (single) logout: also terminate the IdP SSO
    // session so a fresh login isn't silently re-authenticated. Enabled
    // only when `rpInitiatedLogout` is set; otherwise the legacy local-only
    // redirect below runs unchanged.
    if (this.config.rpInitiatedLogout) {
      // Same header-based cookie parser the auth-cookie middleware uses -
      // no cookie-parser required from the host.
      const idToken = readCookie(req, this.config.idTokenCookieName)
      res.clearCookie(this.config.idTokenCookieName, {
        path: this.config.cookiePath,
      })
      try {
        // idToken may be absent (session predates the feature / cookie
        // expired): still redirect to end-session so SSO is terminated -
        // Keycloak just shows its confirmation page without an id_token_hint.
        const url = await this.oidcService.getEndSessionUrl({
          idTokenHint: idToken,
          postLogoutRedirectUri:
            this.config.postLogoutRedirectUri ?? this.config.frontendUrl,
        })
        res.redirect(url)
        return
      } catch {
        // The IdP advertises no `end_session_endpoint`, or discovery failed.
        // The local cookies are already cleared, so local logout still
        // succeeds; fall through to the frontend redirect instead of 500ing.
        // (Only the IdP SSO termination is skipped in this degraded case.)
      }
    }

    // Legacy / fallback: local cookie already cleared, redirect to the frontend.
    const logoutRedirect = this.config.frontendUrl?.replace('/me', '/login') ?? '/'
    res.redirect(logoutRedirect)
  }

  @Get(AUTH_OIDC_ROUTES.ME)
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserProfileType): UserProfileType {
    return user
  }

  private maxAgeMs(): number {
    const value = this.config.jwtExpiresIn ?? '1h'
    if (typeof value === 'number') return value * 1000
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value)
    if (!match) return 60 * 60 * 1000
    const n = Number(match[1])
    switch (match[2]) {
      case 'ms':
        return n
      case 's':
        return n * 1000
      case 'm':
        return n * 60 * 1000
      case 'h':
        return n * 60 * 60 * 1000
      case 'd':
        return n * 24 * 60 * 60 * 1000
      default:
        return n * 1000
    }
  }
}
