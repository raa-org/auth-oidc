/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { z } from 'zod'
import {
  LoginRequestSchema,
  OidcClaimsSchema,
  OidcConfigSchema,
  TokenPayloadSchema,
  UserProfileSchema,
} from './schemas'

// ---------- DTO / wire types (`z.infer` only; schemas live in ./schemas) ----------

export type LoginRequestType = z.infer<typeof LoginRequestSchema>
export type TokenPayloadType = z.infer<typeof TokenPayloadSchema>
export type UserProfileType = z.infer<typeof UserProfileSchema>
export type OidcClaimsType = z.infer<typeof OidcClaimsSchema>
export type OidcConfigType = z.infer<typeof OidcConfigSchema>

// ---------- Client Redux slice (not a Zod contract) ----------

export interface AuthOidcReactStateInterface {
  user: UserProfileType | null
  isLoading: boolean
  error: string | null
}
