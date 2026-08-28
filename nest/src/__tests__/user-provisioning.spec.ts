/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect, vi } from 'vitest'
import type {
  OidcClaimsType,
  UserProfileType,
} from '@rightandabove/auth-oidc-core'
import { UserProvisioningService } from '../services/user-provisioning.service'
import type {
  IUserProfileMapper,
  IUserStore,
  ProvisionUserInputType,
} from '../abstractions'

// 1:1 mapper - normalization is out of scope here; we only assert the
// map-then-provision wiring.
const passthroughMapper: IUserProfileMapper = {
  mapClaims: (claims: OidcClaimsType): UserProfileType => ({
    id: claims.sub,
    email: claims.email,
    ...(claims.name !== undefined ? { name: claims.name } : {}),
    roles: claims.roles ?? [],
  }),
}

// Minimal find-or-create store keyed by subject, minting a local id.
function makeInMemoryStore(): IUserStore {
  const bySubject = new Map<string, UserProfileType>()
  let seq = 0
  return {
    async findOrCreate(input: ProvisionUserInputType): Promise<UserProfileType> {
      const existing = bySubject.get(input.subject)
      if (existing) return existing
      const user: UserProfileType = {
        id: `local-${++seq}`,
        email: input.email,
        ...(input.name !== undefined ? { name: input.name } : {}),
        roles: input.roles,
      }
      bySubject.set(input.subject, user)
      return user
    },
  }
}

const claims: OidcClaimsType = {
  sub: 'idp-sub-123',
  email: 'Alice@Example.com',
  name: 'Alice',
  roles: ['admin'],
}

describe('UserProvisioningService', () => {
  it('maps claims then provisions, returning a LOCAL id (not the IdP sub)', async () => {
    const service = new UserProvisioningService(passthroughMapper, makeInMemoryStore())

    const user = await service.provisionFromClaims(claims)

    expect(user.id).toBe('local-1')
    expect(user.id).not.toBe(claims.sub)
    expect(user.email).toBe('Alice@Example.com')
    expect(user.name).toBe('Alice')
    expect(user.roles).toEqual(['admin'])
  })

  it('passes the raw IdP subject (not the mapped profile.id) to the store', async () => {
    const store: IUserStore = { findOrCreate: vi.fn(makeInMemoryStore().findOrCreate) }
    // Mapper that rewrites profile.id - the store must still correlate on `sub`.
    const rewritingMapper: IUserProfileMapper = {
      mapClaims: (c) => ({ id: `rewritten-${c.sub}`, email: c.email, roles: c.roles ?? [] }),
    }
    const service = new UserProvisioningService(rewritingMapper, store)

    await service.provisionFromClaims(claims)

    expect(store.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'idp-sub-123', email: 'Alice@Example.com', roles: ['admin'] }),
    )
  })

  it('reuses the same local user across repeated logins (idempotent by subject)', async () => {
    const service = new UserProvisioningService(passthroughMapper, makeInMemoryStore())

    const first = await service.provisionFromClaims(claims)
    const second = await service.provisionFromClaims(claims)
    const other = await service.provisionFromClaims({ ...claims, sub: 'idp-sub-999' })

    expect(second.id).toBe(first.id)
    expect(other.id).not.toBe(first.id)
  })

  it('omits name when the claims carry none', async () => {
    const service = new UserProvisioningService(passthroughMapper, makeInMemoryStore())

    const user = await service.provisionFromClaims({
      sub: 'no-name',
      email: 'bob@example.com',
      roles: [],
    })

    expect(user.name).toBeUndefined()
  })

  it('passes country from the mapped profile to the store', async () => {
    const store: IUserStore = { findOrCreate: vi.fn(makeInMemoryStore().findOrCreate) }
    const countryMapper: IUserProfileMapper = {
      mapClaims: (c) => ({ id: c.sub, email: c.email, roles: c.roles ?? [], country: 'DE' }),
    }
    const service = new UserProvisioningService(countryMapper, store)

    await service.provisionFromClaims(claims)

    expect(store.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'DE' }),
    )
  })

  it('omits country when the mapper does not supply one', async () => {
    const store: IUserStore = { findOrCreate: vi.fn(makeInMemoryStore().findOrCreate) }
    const service = new UserProvisioningService(passthroughMapper, store)

    await service.provisionFromClaims(claims)

    const input = (store.findOrCreate as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as ProvisionUserInputType
    expect('country' in input).toBe(false)
  })
})
