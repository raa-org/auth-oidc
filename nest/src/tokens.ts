/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { MODULE_ID } from '@rightandabove/auth-oidc-core'

/**
 * NestJS DI tokens for the auth-oidc module.
 *
 * Token strings use the `@rightandabove/<module-id>/<role>` namespace
 * so two trusted modules can never collide on the DI registry and so
 * the token strings are unambiguously module-scoped at a glance.
 */
const TOKEN_NS = `@rightandabove/${MODULE_ID}` as const

/** Holds the validated `OidcConfigType` injected through `forRoot`. */
export const AUTH_OIDC_CONFIG_TOKEN = `${TOKEN_NS}/config` as const

/**
 * Pluggable mapper that converts raw OIDC claims into the app-side
 * `UserProfileType`. Host apps register an implementation to enrich the
 * profile with their own roles / tenant / org-id; the sandbox-adapters
 * package ships a 1:1 `DefaultUserProfileMapper` for cases where the IdP
 * already provides everything the app needs.
 */
export const AUTH_OIDC_USER_PROFILE_MAPPER_TOKEN =
  `${TOKEN_NS}/user-profile-mapper` as const

/**
 * Pluggable store that auto-provisions a verified OIDC identity into the
 * app's own user storage (find-or-create by IdP `subject`, falling back to
 * email). Host apps register an implementation so the module can mint a
 * stable LOCAL user id - the handle other modules link business data to.
 * The sandbox-adapters package ships an `InMemoryUserStore` for demos.
 */
export const AUTH_OIDC_USER_STORE_TOKEN = `${TOKEN_NS}/user-store` as const

/**
 * @deprecated The module no longer emits through the ambient sandbox
 * bus directly. All lifecycle events are published via @nestjs/cqrs
 * EventBus as `AuthOidc*Event` classes from
 * `@rightandabove/auth-oidc-core`. The
 * `CqrsToSandboxEventBridgeService` in
 * `@application-assembly-pipeline/trusted-modules-core` mirrors them onto
 * the SandboxEventBus for the workbench Events panel - host code that
 * needs to subscribe should `@EventsHandler(AuthOidcLoginSuccessEvent)`
 * instead of injecting this token. Kept exported for one release to ease
 * migration of any external consumer.
 */
export const SANDBOX_EVENT_BUS_TOKEN = 'SANDBOX_EVENT_BUS' as const
