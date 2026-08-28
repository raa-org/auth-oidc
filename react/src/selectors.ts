/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import {
  SLICE_NAME,
  type AuthOidcReactStateInterface,
  type UserProfileType,
} from '@rightandabove/auth-oidc-core'

export interface AuthOidcRootStateSliceInterface {
  [SLICE_NAME]: AuthOidcReactStateInterface
}

function pick(state: AuthOidcRootStateSliceInterface): AuthOidcReactStateInterface {
  return state[SLICE_NAME]
}

export const selectAuthOidcState = (
  state: AuthOidcRootStateSliceInterface,
): AuthOidcReactStateInterface => pick(state)

export const selectAuthOidcUser = (
  state: AuthOidcRootStateSliceInterface,
): UserProfileType | null => pick(state).user

export const selectAuthOidcLoading = (state: AuthOidcRootStateSliceInterface): boolean =>
  pick(state).isLoading

export const selectAuthOidcError = (state: AuthOidcRootStateSliceInterface): string | null =>
  pick(state).error
