/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

/**
 * Single source of truth for module-scoped naming. Every route, event,
 * Redux action type, slice key, and DI token in this trusted module is
 * derived from `MODULE_ID` so that two trusted modules - or a trusted
 * module and the host app's own code - can never collide on a shared
 * symbol space.
 *
 * Rules of thumb:
 *   - Routes start with `ROUTE_PREFIX` (`/auth-oidc`).
 *   - Events start with `EVENT_PREFIX` (`auth-oidc.`).
 *   - Redux actions start with `ACTION_PREFIX` (`auth-oidc/`).
 *   - Redux slice lives under `SLICE_NAME` (`authOidc`).
 *   - DI tokens are kebab-prefixed with `MODULE_ID`.
 */

export const MODULE_ID = 'auth-oidc'

/** HTTP route prefix, e.g. `/auth-oidc`. */
export const ROUTE_PREFIX = `/${MODULE_ID}` as const

/** Redux slice key - camelCase form of the module id. */
export const SLICE_NAME = 'authOidc' as const

/**
 * Redux action type prefix, e.g. `auth-oidc/`. Use this when creating
 * createSlice / createAction to guarantee unique action types across
 * loaded modules.
 */
export const ACTION_PREFIX = `${MODULE_ID}/` as const

/** Event name prefix on the sandbox event bus, e.g. `auth-oidc.`. */
export const EVENT_PREFIX = `${MODULE_ID}.` as const
