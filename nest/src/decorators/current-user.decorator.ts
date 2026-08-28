/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { UserProfileType } from '@rightandabove/auth-oidc-core'
import type { Request } from 'express'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserProfileType => {
    const request = ctx.switchToHttp().getRequest<Request & { user: UserProfileType }>()
    return request.user
  },
)
