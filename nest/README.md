# @rightandabove/auth-oidc-nest

NestJS module for OIDC **authorization-code** login: IdP redirect, callback, auto-provision into the host’s user store, JWT in an HTTP-only cookie, and `GET /auth-oidc/me` for the SPA.

**Install:** `npm i @rightandabove/auth-oidc-nest`

Peer deps: `@nestjs/common`, `@nestjs/core`, `@nestjs/cqrs`, `rxjs`. Depends on [`@rightandabove/auth-oidc-core`](https://www.npmjs.com/package/@rightandabove/auth-oidc-core).

## Quick start

The host must implement `IUserProfileMapper` (normalize IdP claims) and `IUserStore` (find-or-create by subject, then email). `forRoot` throws if either adapter is missing.

```ts
AuthOidcModule.forRoot({
  issuerUrl: process.env.OIDC_ISSUER_URL!,
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  redirectUri: process.env.OIDC_REDIRECT_URI!,
  jwtSecret: process.env.JWT_SECRET!,
  sessionSecret: process.env.SESSION_SECRET!,
  cookiePath: process.env.BASE_PATH || '/',
  cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
  userProfileMapper: { useClass: HostUserProfileMapper },
  userStore: { useClass: HostUserStore },
})
```

The module mounts `express-session` only on `/auth-oidc/login` and `/auth-oidc/callback`. Do not add a second global session middleware for this flow.

Protect routes with `@UseGuards(JwtAuthGuard)` and `@CurrentUser()`.

## HTTP API

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/auth-oidc/login` | Redirect to the IdP |
| `GET` | `/auth-oidc/callback` | Code exchange → provision → Set-Cookie JWT |
| `GET` | `/auth-oidc/logout` | Clear cookie |
| `GET` | `/auth-oidc/me` | Current profile (`401` if missing) |

## Sibling packages

| Package | Role |
| --- | --- |
| [`auth-oidc-core`](https://www.npmjs.com/package/@rightandabove/auth-oidc-core) | Schemas & shared types |
| `auth-oidc-nest` | This package |
| [`auth-oidc-react`](https://www.npmjs.com/package/@rightandabove/auth-oidc-react) | Headless React / Redux client |

## Docs & source

Full guide & env vars: [GitHub README](https://github.com/raa-org/auth-oidc#readme)  
Repository: [raa-org/auth-oidc](https://github.com/raa-org/auth-oidc)  
License: MIT · Right&Above, LLC
