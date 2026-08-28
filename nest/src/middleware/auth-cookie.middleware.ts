/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import {
  TokenPayloadSchema,
  type OidcConfigType,
} from '@rightandabove/auth-oidc-core'

/**
 * Builds a NON-throwing functional middleware that populates `req.user` from
 * the http-only auth cookie (or an `Authorization: Bearer <jwt>` header),
 * verified with the same `config.jwtSecret` the callback signs with.
 *
 * The module self-mounts this on `forRoutes('*')` so any downstream module
 * reading `req.user` (subscription, payment-stripe, host code) is authenticated
 * without the host hand-wiring a JWT-cookie middleware. `JwtAuthGuard` still
 * guards the module's own `/auth-oidc/me`; this middleware only fills `req.user`
 * for everyone else and never throws (public routes still pass).
 *
 * Plain function (no DI / request scope), mirroring
 * `buildAuthOidcSessionMiddleware`, so `configure()` can apply it from config.
 */
export function buildAuthOidcCookieMiddleware(config: OidcConfigType) {
  const cookieName = config.cookieName ?? 'auth_token'

  return function authOidcCookieMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const request = req as Request & { user?: unknown }
    // Don't clobber a principal another auth module may have already resolved.
    if (request.user) {
      next()
      return
    }

    const token = extractToken(req, cookieName)
    if (token) {
      try {
        const payload = TokenPayloadSchema.parse(jwt.verify(token, config.jwtSecret))
        request.user = {
          id: payload.sub,
          email: payload.email,
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          roles: payload.roles ?? [],
        }
      } catch {
        // Invalid / expired token -> leave req.user unset.
      }
    }

    next()
  }
}

/**
 * Read a single cookie value straight off the raw `Cookie` request header,
 * with no dependency on `cookie-parser`. This is the ONE cookie parser the
 * module uses everywhere (auth-cookie middleware, RP-initiated logout), so
 * hosts never have to add cookie-parser to read the module's cookies.
 * Values are URL-decoded to mirror express `res.cookie`'s default encoding.
 */
export function readCookie(req: Request, cookieName: string): string | undefined {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return undefined
  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`).exec(cookieHeader)
  if (match?.[1]) return decodeURIComponent(match[1])
  return undefined
}

function extractToken(req: Request, cookieName: string): string | undefined {
  const auth = req.headers.authorization
  if (auth) {
    const [type, value] = auth.split(' ')
    if (type === 'Bearer' && value) return value
  }

  return readCookie(req, cookieName)
}
