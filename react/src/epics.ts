/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { merge } from 'rxjs'
import type { Action } from 'redux'
import type { Epic } from 'redux-observable'
import { ignoreElements, filter, map, tap } from 'rxjs/operators'
import { AUTH_OIDC_ROUTES } from '@rightandabove/auth-oidc-core'
import {
  bootstrapAuthOidc,
  fetchMeThunk,
  loginRedirectRequested,
  logoutLocal,
  logoutRedirectRequested,
} from './slice'

export interface AuthOidcEpicDependenciesInterface {
  apiBaseUrl: string
}

/** Dispatches `fetchMeThunk` after bootstrap (initial mount). */
export const bootstrapEpic: Epic<Action, Action, unknown> = (action$) =>
  action$.pipe(
    filter(bootstrapAuthOidc.match),
    map(() => fetchMeThunk() as unknown as Action),
  )

export const loginRedirectEpic: Epic<
  Action,
  Action,
  unknown,
  AuthOidcEpicDependenciesInterface
> = (action$, _state$, dependencies) =>
  action$.pipe(
    filter(loginRedirectRequested.match),
    tap(() => {
      window.location.assign(`${dependencies.apiBaseUrl}${AUTH_OIDC_ROUTES.LOGIN}`)
    }),
    ignoreElements(),
  )

export const logoutRedirectEpic: Epic<
  Action,
  Action,
  unknown,
  AuthOidcEpicDependenciesInterface
> = (action$, _state$, dependencies) =>
  action$.pipe(
    filter(logoutRedirectRequested.match),
    tap(() => {
      window.location.assign(`${dependencies.apiBaseUrl}${AUTH_OIDC_ROUTES.LOGOUT}`)
    }),
    map(() => logoutLocal()),
  )

/** Single combined epic for hosts that prefer one entry. */
export const allAuthOidcEpics: Epic<
  Action,
  Action,
  unknown,
  AuthOidcEpicDependenciesInterface
> = (action$, state$, dependencies) =>
  merge(
    bootstrapEpic(action$, state$, dependencies),
    loginRedirectEpic(action$, state$, dependencies),
    logoutRedirectEpic(action$, state$, dependencies),
  )

/** Array form matching the convention used by other trusted modules. */
export const epics: Epic[] = [allAuthOidcEpics as unknown as Epic]
