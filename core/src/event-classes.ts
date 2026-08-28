/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { AUTH_OIDC_EVENTS } from './events'
import { MODULE_ID } from './prefix'

/**
 * CQRS event classes for auth-oidc. Published via `@nestjs/cqrs`
 * EventBus from the nest package and consumed elsewhere with
 * `@EventsHandler(...)`. Each class declares static `moduleId` and
 * `eventName` so `CqrsToSandboxEventBridgeService` can forward the
 * published instance to the workbench Events panel under the dotted name
 * listed in the manifest's `reservedNamespaces.events`.
 *
 * Other modules import these from `@rightandabove/auth-oidc-core`
 * (NEVER from `-nest`) when registering cross-module handlers, so a
 * subscriber's nest package never picks up auth-oidc's server-only DI
 * graph.
 */

export class AuthOidcLoginSuccessEvent {
  static readonly moduleId = MODULE_ID
  static readonly eventName = AUTH_OIDC_EVENTS.LoginSuccess
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

export class AuthOidcLoginFailureEvent {
  static readonly moduleId = MODULE_ID
  static readonly eventName = AUTH_OIDC_EVENTS.LoginFailure
  constructor(public readonly reason: string) {}
}

export class AuthOidcLogoutEvent {
  static readonly moduleId = MODULE_ID
  static readonly eventName = AUTH_OIDC_EVENTS.Logout
  constructor() {}
}

export class AuthOidcTokenRefreshedEvent {
  static readonly moduleId = MODULE_ID
  static readonly eventName = AUTH_OIDC_EVENTS.TokenRefreshed
  constructor(public readonly userId: string) {}
}
