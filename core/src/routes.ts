/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { ROUTE_PREFIX } from './prefix'

/**
 * Authoritative route map for the auth-oidc HTTP surface. The NestJS
 * controller and the React fetchers both import these constants - never
 * hardcode the strings. Adding a new endpoint here is the only place a
 * new route should appear in the codebase.
 */
export const AUTH_OIDC_ROUTES = {
  LOGIN: `${ROUTE_PREFIX}/login`,
  CALLBACK: `${ROUTE_PREFIX}/callback`,
  LOGOUT: `${ROUTE_PREFIX}/logout`,
  ME: `${ROUTE_PREFIX}/me`,
} as const

export type AuthOidcRouteType = (typeof AUTH_OIDC_ROUTES)[keyof typeof AUTH_OIDC_ROUTES]
