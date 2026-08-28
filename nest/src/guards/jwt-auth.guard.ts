/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common'
import jwt from 'jsonwebtoken'
import {
  TokenPayloadSchema,
  type OidcConfigType,
  type UserProfileType,
} from '@rightandabove/auth-oidc-core'
import { AUTH_OIDC_CONFIG_TOKEN } from '../tokens'
import type { Request } from 'express'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_OIDC_CONFIG_TOKEN) private readonly config: OidcConfigType) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(request)

    if (!token) {
      throw new UnauthorizedException('Missing authorization token')
    }

    try {
      const raw = jwt.verify(token, this.config.jwtSecret)
      const payload = TokenPayloadSchema.parse(raw)

      const user: UserProfileType = {
        id: payload.sub,
        email: payload.email,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        roles: payload.roles ?? [],
      }

      request.user = user
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }

  private extractToken(request: Request): string | undefined {
    const auth = request.headers.authorization
    if (auth) {
      const [type, token] = auth.split(' ')
      if (type === 'Bearer' && token) return token
    }

    const cookieHeader = request.headers.cookie
    if (cookieHeader) {
      const name = this.config.cookieName ?? 'auth_token'
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`)
      const match = re.exec(cookieHeader)
      if (match?.[1]) return decodeURIComponent(match[1])
    }

    return undefined
  }
}
