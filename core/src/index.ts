/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

// Public API of @rightandabove/auth-oidc-core.
//
// Contains ONLY what is shared between the nest package and the react
// package: prefix system, route map, event names, Zod schemas, DTO types.
//
// Server-only concerns (DI tokens, IUserProfileMapper abstraction) live in
// `@rightandabove/auth-oidc-nest` so the frontend bundle never pulls them in.
export * from './prefix'
export * from './routes'
export * from './schemas'
export * from './types'
export * from './events'
export * from './event-classes'
