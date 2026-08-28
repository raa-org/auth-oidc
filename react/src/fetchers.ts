/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { AUTH_OIDC_ROUTES, type UserProfileType } from '@rightandabove/auth-oidc-core'

// Always bind the fetch to globalThis. A host that passes fetch unbound (e.g.
// `fetch: globalThis.fetch`) would otherwise have it invoked with the wrong
// `this` and throw "fetch called on an object that does not implement
// interface Window". Binding an already-bound/wrapper fetch is harmless.
function resolveFetch(impl?: typeof fetch): typeof fetch {
  return (impl ?? globalThis.fetch).bind(globalThis)
}

export async function fetchMe(
  apiBaseUrl: string,
  fetchImpl: typeof fetch,
): Promise<UserProfileType | null> {
  const doFetch = resolveFetch(fetchImpl)
  const res = await doFetch(`${apiBaseUrl}${AUTH_OIDC_ROUTES.ME}`, {
    credentials: 'include',
  })
  if (!res.ok) return null
  return (await res.json()) as UserProfileType
}
