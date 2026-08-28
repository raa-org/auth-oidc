/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { z } from 'zod'

export const LoginRequestSchema = z.object({
  redirectUri: z.string().url().optional(),
})

export const TokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  roles: z.array(z.string()).optional(),
  iat: z.number().int(),
  exp: z.number().int(),
})

// Deliberately strict (no passthrough): this shape feeds the module's own
// JWT cookie and /me response - arbitrary IdP claims must not leak into it.
// `country` is the one custom claim carried through provisioning.
export const UserProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  roles: z.array(z.string()).default([]),
  country: z.string().optional(),
})

export const OidcClaimsSchema = z
  .object({
    sub: z.string().min(1),
    email: z.string().email(),
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    iss: z.string().url().optional(),
    aud: z.string().optional(),
    exp: z.number().int().optional(),
    iat: z.number().int().optional(),
    // Typed for host-mapper convenience; IdPs like Keycloak nest roles here
    // instead of a flat `roles` claim. The module never parses these itself -
    // the host's IUserProfileMapper does.
    realm_access: z.object({ roles: z.array(z.string()).optional() }).optional(),
    resource_access: z
      .record(z.object({ roles: z.array(z.string()).optional() }))
      .optional(),
    country: z.string().optional(),
  })
  // Keep every claim the IdP sent (custom attributes, tenant ids, ...) so the
  // host mapper can read them - zod strips unknown keys by default.
  .passthrough()

export const OidcConfigSchema = z.object({
  issuerUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  jwtSecret: z.string().min(32),
  scope: z.string().default('openid email profile'),
  jwtExpiresIn: z.union([z.string(), z.number()]).default('1h'),
  frontendUrl: z.string().url().optional(),
  cookieName: z.string().min(1).default('auth_token'),
  // `Secure` flag - env-driven: false on local http, true on https. Default
  // false. (Was previously hardcoded to NODE_ENV==='production'.)
  cookieSecure: z.boolean().default(false),
  // Cookie `path` - scope to the app base path (e.g. `/<sessionId>/`) so
  // sessions don't clobber each other's auth_token in the multi-tenant
  // runtime. Default `'/'`. (Was previously hardcoded to '/'.)
  cookiePath: z.string().min(1).default('/'),
  // Signing secret for the OIDC server-session that carries `state` / `nonce`
  // across the IdP redirect dance. AuthOidcModule mounts express-session on
  // its own routes using this secret - host apps don't need to wire session
  // middleware themselves.
  sessionSecret: z.string().min(32),
  // ---- RP-initiated (single) logout - opt-in, additive (v1.3.0) ----
  // Master switch. When false (default) `/auth-oidc/logout` keeps its current
  // local-only behavior: clear the auth cookie and redirect to the frontend.
  // When true, logout ALSO terminates the IdP SSO session by redirecting the
  // browser to the IdP `end_session_endpoint` (RP-initiated logout), passing
  // an `id_token_hint` so Keycloak logs out silently instead of showing its
  // "Do you want to log out?" confirmation page.
  rpInitiatedLogout: z.boolean().default(false),
  // Where the IdP returns the browser after a successful RP-initiated logout.
  // When omitted, falls back to `frontendUrl`. MUST be registered as a "Valid
  // Post Logout Redirect URI" on the IdP client (host-side Keycloak config).
  // Ignored unless `rpInitiatedLogout` is true.
  postLogoutRedirectUri: z.string().url().optional(),
  // Name of the httpOnly cookie that stores the raw IdP `id_token` so logout
  // can pass it as `id_token_hint`. Written at login ONLY when
  // `rpInitiatedLogout` is true; with the flag off no such cookie is ever set.
  idTokenCookieName: z.string().min(1).default('auth_id_token'),
})
