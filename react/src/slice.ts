/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { createAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  ACTION_PREFIX,
  SLICE_NAME,
  type AuthOidcReactStateInterface,
  type UserProfileType,
} from '@rightandabove/auth-oidc-core'
import { fetchMe } from './fetchers'

export interface AuthOidcThunkExtraInterface {
  apiBaseUrl: string
  fetch: typeof fetch
}

interface ThunkApiInterface {
  extra: AuthOidcThunkExtraInterface
  rejectValue: string
}

export const bootstrapAuthOidc = createAction(`${ACTION_PREFIX}bootstrap`)
export const loginRedirectRequested = createAction(`${ACTION_PREFIX}loginRedirectRequested`)
export const logoutRedirectRequested = createAction(`${ACTION_PREFIX}logoutRedirectRequested`)

export const fetchMeThunk = createAsyncThunk<
  UserProfileType | null,
  void,
  ThunkApiInterface
>(`${ACTION_PREFIX}fetchMe`, async (_arg, api) => {
  const { apiBaseUrl, fetch } = api.extra
  try {
    return await fetchMe(apiBaseUrl, fetch)
  } catch (err) {
    return api.rejectWithValue(
      err instanceof Error ? err.message : `fetch ${SLICE_NAME}/me failed`,
    )
  }
})

const initialState: AuthOidcReactStateInterface = {
  user: null,
  isLoading: false,
  error: null,
}

const slice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    logoutLocal(state) {
      state.user = null
      state.error = null
      state.isLoading = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMeThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload
        state.error = null
      })
      .addCase(fetchMeThunk.rejected, (state, action) => {
        state.isLoading = false
        state.user = null
        state.error = action.payload ?? action.error.message ?? 'fetch failed'
      })
  },
})

export const reducer = slice.reducer
export const sliceName = SLICE_NAME
export const { logoutLocal } = slice.actions
