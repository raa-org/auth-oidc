/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import {
  DynamicModule,
  Inject,
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
  type Type,
} from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import {
  AUTH_OIDC_ROUTES,
  OidcConfigSchema,
  type OidcConfigType,
} from '@rightandabove/auth-oidc-core'
import { OidcService } from './strategies/oidc.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthController } from './controllers/auth.controller'
import { UserProvisioningService } from './services/user-provisioning.service'
import { buildAuthOidcSessionMiddleware } from './configs/session.config'
import { buildAuthOidcCookieMiddleware } from './middleware/auth-cookie.middleware'
import type { IUserProfileMapper, IUserStore } from './abstractions'
import {
  AUTH_OIDC_CONFIG_TOKEN,
  AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN,
  AUTH_OIDC_USER_STORE_TOKEN,
} from './tokens'

/**
 * Options for `AuthOidcModule.forRoot(...)`. The flat `OidcConfigType`
 * fields (issuerUrl, clientId, sessionSecret, ...) are validated through
 * `OidcConfigSchema`. Two pluggable adapters are required, each accepting
 * `{ useClass }` or `{ useExisting }`:
 *
 *   - `userProfileMapper` - implements `IUserProfileMapper`: normalizes raw
 *     IdP claims into a `UserProfileType` (rename/namespace roles, look up
 *     tenant, default-fill fields). PURE, no persistence.
 *   - `userStore` - implements `IUserStore`: auto-provisions that profile
 *     into the app's own storage (find-or-create by IdP `subject`, falling
 *     back to email) and returns the local user. This is what gives the
 *     app a stable LOCAL user id to link business logic across modules.
 *
 * For sandbox / demo use, import `DefaultUserProfileMapper` and
 * `InMemoryUserStore` from `@rightandabove/auth-oidc-sandbox-adapters`.
 */
export type AuthOidcModuleOptionsInterface = OidcConfigType & {
  userProfileMapper: PluggableProviderInputType<IUserProfileMapper>
  userStore: PluggableProviderInputType<IUserStore>
}

export type PluggableProviderInputType<T> =
  | { useClass: Type<T> }
  | { useExisting: string | symbol | Type<T> }

@Module({})
export class AuthOidcModule implements NestModule {
  constructor(
    @Inject(AUTH_OIDC_CONFIG_TOKEN) private readonly config: OidcConfigType,
  ) {}

  static forRoot(options: AuthOidcModuleOptionsInterface): DynamicModule {
    if (!options.userProfileMapper) {
      throw new Error(
        'AuthOidcModule.forRoot: missing required provider for "userProfileMapper". ' +
          'Supply { useClass } or { useExisting } pointing at an implementation of ' +
          'IUserProfileMapper from "@rightandabove/auth-oidc-nest". For sandbox / unit ' +
          'tests, import DefaultUserProfileMapper from ' +
          '"@rightandabove/auth-oidc-sandbox-adapters".',
      )
    }
    if (!options.userStore) {
      throw new Error(
        'AuthOidcModule.forRoot: missing required provider for "userStore". ' +
          'Supply { useClass } or { useExisting } pointing at an implementation of ' +
          'IUserStore from "@rightandabove/auth-oidc-nest" that auto-provisions the ' +
          'OIDC identity into your storage (find-or-create by subject/email). Without it ' +
          'the app has no stable local user id to link business logic across modules. ' +
          'For sandbox / unit tests, import InMemoryUserStore from ' +
          '"@rightandabove/auth-oidc-sandbox-adapters".',
      )
    }

    const { userProfileMapper, userStore, ...rawConfig } = options
    const validated = OidcConfigSchema.parse(rawConfig)

    const providers: Provider[] = [
      { provide: AUTH_OIDC_CONFIG_TOKEN, useValue: validated },
      makePluggableProvider(AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN, userProfileMapper),
      makePluggableProvider(AUTH_OIDC_USER_STORE_TOKEN, userStore),
      UserProvisioningService,
      OidcService,
      JwtAuthGuard,
    ]

    return {
      module: AuthOidcModule,
      imports: [CqrsModule],
      controllers: [AuthController],
      providers,
      exports: [
        AUTH_OIDC_CONFIG_TOKEN,
        AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN,
        AUTH_OIDC_USER_STORE_TOKEN,
        UserProvisioningService,
        OidcService,
        JwtAuthGuard,
      ],
      global: false,
    }
  }

  /**
   * Mount express-session on the module's own routes so the host doesn't
   * have to remember to wire it. Scoped to `/auth-oidc/login` and
   * `/auth-oidc/callback` because those are the only handlers that read /
   * write `state` and `nonce`. The cookie name is `auth-oidc.sid`, so an
   * unrelated `connect.sid` the host already uses for other features stays
   * untouched.
   */
  configure(consumer: MiddlewareConsumer): void {
    const middleware = buildAuthOidcSessionMiddleware(this.config)
    consumer
      .apply(middleware)
      .forRoutes(AUTH_OIDC_ROUTES.LOGIN, AUTH_OIDC_ROUTES.CALLBACK)

    // Self-mount the cookie -> req.user middleware on every route so any module
    // reading `req.user` (subscription, payment-stripe, host code) is
    // authenticated without the host wiring a JWT-cookie middleware itself.
    consumer
      .apply(buildAuthOidcCookieMiddleware(this.config))
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}

function makePluggableProvider<T>(
  token: string,
  input: PluggableProviderInputType<T>,
): Provider {
  if ('useClass' in input) {
    return { provide: token, useClass: input.useClass }
  }
  return { provide: token, useExisting: input.useExisting }
}
