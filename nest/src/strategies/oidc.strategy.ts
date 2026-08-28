/*
 * Copyright (c) 2026 Right&Above, LLC
 * https://rightandabove.com
 * SPDX-License-Identifier: MIT
 */

import { Injectable, Inject } from '@nestjs/common'
import { Issuer, type Client } from 'openid-client'
import type { OidcConfigType } from '@rightandabove/auth-oidc-core'
import { AUTH_OIDC_CONFIG_TOKEN } from '../tokens'

@Injectable()
export class OidcService {
  private clientPromise: Promise<Client> | null = null

  constructor(@Inject(AUTH_OIDC_CONFIG_TOKEN) private readonly config: OidcConfigType) {}

  /**
   * Lazily resolve the openid-client `Client`. `Issuer.discover` reaches the
   * IdP over HTTP, so doing it eagerly in the constructor turns a wrong /
   * unreachable `OIDC_ISSUER_URL` (e.g. the manifest placeholder
   * `your-idp.example.com`) into an unhandled rejection that kills the
   * NestJS process at boot. Build on first use instead, and re-throw on
   * each call so a bad config fails the auth endpoints with 500 rather
   * than the whole sandbox.
   */
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const issuer = await Issuer.discover(this.config.issuerUrl)
        return new issuer.Client({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uris: [this.config.redirectUri],
          response_types: ['code'],
        })
      })().catch((err) => {
        // Drop the memoised rejection so the next request retries discovery
        // instead of replaying the same stale error forever.
        this.clientPromise = null
        throw err
      })
    }
    return this.clientPromise
  }

  async getAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const client = await this.getClient()
    return client.authorizationUrl({
      scope: this.config.scope,
      state,
      nonce,
    })
  }

  async exchangeCode(callbackUrl: string, state: string, nonce: string) {
    const client = await this.getClient()
    const params = client.callbackParams(callbackUrl)
    return client.callback(this.config.redirectUri, params, { state, nonce })
  }

  /**
   * Build the IdP RP-initiated logout URL (`end_session_endpoint` +
   * `id_token_hint` + `post_logout_redirect_uri`). Reuses the memoized
   * `getClient()` so logout never triggers a fresh discovery round-trip;
   * `endSessionUrl` reads `issuer.end_session_endpoint` off the already
   * resolved client. Only called when `rpInitiatedLogout` is enabled.
   *
   * `idTokenHint` may be undefined (session predates the feature, or the
   * cookie expired) - the URL is still valid, Keycloak just falls back to
   * its interactive confirmation page while still terminating SSO.
   */
  async getEndSessionUrl(params: {
    idTokenHint?: string
    postLogoutRedirectUri?: string
  }): Promise<string> {
    const client = await this.getClient()
    return client.endSessionUrl({
      id_token_hint: params.idTokenHint,
      post_logout_redirect_uri: params.postLogoutRedirectUri,
    })
  }
}
