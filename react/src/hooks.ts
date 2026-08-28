/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { UserProfileType } from '@rightandabove/auth-oidc-core'
import {
  selectAuthOidcError,
  selectAuthOidcLoading,
  selectAuthOidcUser,
} from './selectors'
import {
  fetchMeThunk,
  loginRedirectRequested,
  logoutRedirectRequested,
} from './slice'

export interface UseAuthResultInterface {
  user: UserProfileType | null
  isLoading: boolean
  error: string | null
  login: () => void
  logout: () => void
  refresh: () => Promise<void>
}

export function useAuth(): UseAuthResultInterface {
  const dispatch = useDispatch()
  const user = useSelector(selectAuthOidcUser)
  const isLoading = useSelector(selectAuthOidcLoading)
  const error = useSelector(selectAuthOidcError)

  const login = useCallback(() => {
    dispatch(loginRedirectRequested())
  }, [dispatch])

  const logout = useCallback(() => {
    dispatch(logoutRedirectRequested())
  }, [dispatch])

  const refresh = useCallback(async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (dispatch as any)(fetchMeThunk()).unwrap()
  }, [dispatch])

  return { user, isLoading, error, login, logout, refresh }
}

export function useCurrentUser(): UserProfileType | null {
  return useSelector(selectAuthOidcUser)
}
