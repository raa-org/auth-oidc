/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { Inject, Injectable } from '@nestjs/common'
import type {
  OidcClaimsType,
  UserProfileType,
} from '@rightandabove/auth-oidc-core'
import type { IUserProfileMapper, IUserStore } from '../abstractions'
import {
  AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN,
  AUTH_OIDC_USER_STORE_TOKEN,
} from '../tokens'

/**
 * Orchestrates the two host-supplied adapters on every successful
 * callback: first normalize the raw IdP claims into a profile via
 * `IUserProfileMapper`, then auto-provision that profile into the app's
 * own storage via `IUserStore`. The returned `UserProfileType` carries the
 * LOCAL user id, which the controller signs into the JWT and broadcasts on
 * `AuthOidcLoginSuccessEvent` - that is the stable handle other modules
 * link business data to.
 *
 * Kept as a thin service (not inline in the controller) so the
 * map-then-provision pipeline is unit-testable and the controller stays
 * focused on HTTP/cookie concerns.
 */
@Injectable()
export class UserProvisioningService {
  constructor(
    @Inject(AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN)
    private readonly mapper: IUserProfileMapper,
    @Inject(AUTH_OIDC_USER_STORE_TOKEN)
    private readonly users: IUserStore,
  ) {}

  async provisionFromClaims(claims: OidcClaimsType): Promise<UserProfileType> {
    const profile = await this.mapper.mapClaims(claims)
    return this.users.findOrCreate({
      // The raw IdP subject is the correlation key, NOT profile.id - a
      // mapper may rewrite profile.id, but `sub` is what stays stable.
      subject: claims.sub,
      email: profile.email,
      ...(profile.name !== undefined ? { name: profile.name } : {}),
      roles: profile.roles,
      ...(profile.country !== undefined ? { country: profile.country } : {}),
    })
  }
}
