/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { RequestHandler } from 'express'
import session, { type SessionOptions } from 'express-session'
import type { OidcConfigType } from '@rightandabove/auth-oidc-core'

/**
 * Build the `express-session` middleware for the auth-oidc module's own
 * routes. The session carries `state` and `nonce` across the IdP redirect
 * dance and is signed with `OidcConfigType.sessionSecret`.
 *
 * The cookie is namespaced (`auth-oidc.sid`) so it never clashes with a
 * separate `connect.sid` the host may already be using for other features.
 * The module's `NestModule.configure` mounts this middleware on
 * `/auth-oidc/*` only - it does NOT install a global express-session.
 */
export function buildAuthOidcSessionMiddleware(config: OidcConfigType): RequestHandler {
  const isProduction = process.env['NODE_ENV'] === 'production'
  const options: SessionOptions = {
    name: 'auth-oidc.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes is plenty for the redirect dance
    },
  }
  return session(options)
}
