/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { OidcClaimsType, UserProfileType } from '@rightandabove/auth-oidc-core'

/**
 * Strategy for translating raw OIDC claims into an app-side
 * `UserProfileType`. The IdP is the source of truth for identity, but apps
 * frequently need to:
 *
 *   - rename / namespace roles (`realm_access.roles` -> `roles`)
 *   - look up a tenant / org id by sub
 *   - default-fill missing optional fields
 *
 * The mapper is the only host-supplied dependency of `AuthOidcModule`.
 * `forRoot` requires it; for sandbox / demo use, the package
 * `@rightandabove/auth-oidc-sandbox-adapters` ships a 1:1
 * `DefaultUserProfileMapper` that validates the claims through
 * `OidcClaimsSchema` and returns them unchanged.
 *
 * Implementations MAY be async if they hit external systems (e.g. fetch
 * tenant metadata from a directory). Throw to fail the callback with
 * `401` semantics.
 */
export interface IUserProfileMapper {
  mapClaims(claims: OidcClaimsType): Promise<UserProfileType> | UserProfileType
}
