/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import type { UserProfileType } from '@rightandabove/auth-oidc-core'

/**
 * Auto-provisioning contract the host MUST satisfy so the module can turn
 * a verified OIDC identity into a *local* user record.
 *
 * OIDC tells you WHO signed in (`sub`, `email`, ...), but the IdP subject
 * is not a key your other modules can build on: it is owned by the IdP,
 * may be re-formatted, and means nothing to a cart / subscription / orders
 * module. To link business logic across modules the app needs its OWN
 * stable user id. This store is where that id is minted and looked up.
 *
 * The consuming app provides an implementation - either a fresh one backed
 * by its database or a thin adapter around an existing `UserService`. For
 * sandbox / demo use, import `InMemoryUserStore` from
 * `@rightandabove/auth-oidc-sandbox-adapters`.
 */
export interface IUserStore {
  /**
   * Provision the user behind a verified set of OIDC claims and return the
   * local record. Implementations MUST:
   *
   *   1. look up an existing user by the stable IdP `subject` first, then
   *      fall back to `email` (case-insensitive) so a user who already
   *      exists from another sign-in path is reused, not duplicated;
   *   2. create a fresh record when neither matches;
   *   3. return a `UserProfileType` whose `id` is the app's OWN primary
   *      key - NEVER the IdP `sub`. That local id is what flows into the
   *      JWT, `/auth-oidc/me`, and `AuthOidcLoginSuccessEvent`, so other
   *      modules link their rows to it.
   *
   * Implementations SHOULD refresh the stored `email` / `name` / `roles`
   * from the freshest claims on every login so authorization stays current.
   * MAY be async (DB / network). Throw to fail the callback with `401`
   * semantics.
   */
  findOrCreate(input: ProvisionUserInputType): Promise<UserProfileType>
}

/**
 * Identity handed to `IUserStore.findOrCreate`, assembled from the IdP
 * claims after they pass through `IUserProfileMapper`. `subject` is the raw
 * OIDC `sub` (stable correlation key); the remaining fields are the
 * normalized profile the mapper produced.
 */
export interface ProvisionUserInputType {
  /** Stable IdP subject identifier (OIDC `sub`). Primary correlation key. */
  subject: string
  /** Login email from the mapped profile. Treat case-insensitively. */
  email: string
  /** Display name, when the IdP / mapper supplied one. */
  name?: string
  /** Roles from the mapped profile (already namespaced/rewritten as needed). */
  roles: string[]
  /** Country from the mapped profile, when the IdP / mapper supplied one. */
  country?: string
}
