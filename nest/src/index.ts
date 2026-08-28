/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

// Public API of @rightandabove/auth-oidc-nest.
//
// The module ships:
//   - AuthOidcModule (DynamicModule, strict forRoot)
//   - IUserProfileMapper + IUserStore abstractions the host MUST implement
//     + their DI tokens
//   - UserProvisioningService (map claims -> provision into the user store)
//   - JwtAuthGuard, CurrentUser, OidcService (for hosts that need direct access)
//   - sessionConfig default for express-session wiring
//
// Default 1:1 IUserProfileMapper + in-memory IUserStore implementations are
// shipped separately in @rightandabove/auth-oidc-sandbox-adapters - they
// are intentionally NOT re-exported here so production builds cannot
// accidentally pull them in.

export {
  AuthOidcModule,
  type AuthOidcModuleOptionsInterface,
  type PluggableProviderInputType,
} from './auth-oidc.module'

export { JwtAuthGuard } from './guards/jwt-auth.guard'
export { CurrentUser } from './decorators/current-user.decorator'
export { OidcService } from './strategies/oidc.strategy'
export { UserProvisioningService } from './services/user-provisioning.service'
export { buildAuthOidcSessionMiddleware } from './configs/session.config'

export * from './abstractions'
export * from './tokens'
