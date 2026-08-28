/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { UserProfileType } from '@rightandabove/auth-oidc-core'

declare module 'express-session' {
  interface SessionData {
    oidc_state?: string
    oidc_nonce?: string
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: UserProfileType
    }
  }
}

export {}
