/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { EVENT_PREFIX } from './prefix'

/**
 * Authoritative event-name map for the sandbox event bus. The nest
 * package emits these names; subscribers (host app, sandbox tools) listen
 * by the same names. Never hardcode the strings.
 */
export const AUTH_OIDC_EVENTS = {
  LoginSuccess: `${EVENT_PREFIX}login-success`,
  LoginFailure: `${EVENT_PREFIX}login-failure`,
  Logout: `${EVENT_PREFIX}logout`,
  TokenRefreshed: `${EVENT_PREFIX}token-refreshed`,
} as const

export type AuthOidcEventType = (typeof AUTH_OIDC_EVENTS)[keyof typeof AUTH_OIDC_EVENTS]
