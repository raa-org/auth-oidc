# auth-oidc

OIDC **authorization-code** login for a NestJS host: redirect to the identity provider, callback, auto-provision the user into the app’s own store, JWT in an HTTP-only cookie, and `GET /auth-oidc/me` for the SPA. The React package is **headless** (Redux Toolkit slice, redux-observable epics, hooks) — no UI kit.

License: [MIT](LICENSE). Published as `@rightandabove/auth-oidc-*` on npm.

## Packages

| Package | Role |
| --- | --- |
| `@rightandabove/auth-oidc-core` | Shared prefix, routes, Zod schemas, DTOs, event names. Depends only on `zod`. |
| `@rightandabove/auth-oidc-nest` | `AuthOidcModule.forRoot()`, `IUserProfileMapper` + `IUserStore`, JWT guard, current-user decorator. |
| `@rightandabove/auth-oidc-react` | Headless slice, epics, `useAuth()`, `bootstrapAuthOidc()`. |

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

The module mounts its own `express-session` only on `/auth-oidc/login` and `/auth-oidc/callback`. Do not add a second global session middleware for this flow.

## HTTP API

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/auth-oidc/login` | Redirect to the IdP (`state` / `nonce` in session). |
| `GET` | `/auth-oidc/callback` | Code exchange → map claims → provision → Set-Cookie JWT → redirect. |
| `GET` | `/auth-oidc/logout` | Clear cookie, redirect to `frontendUrl`. |
| `GET` | `/auth-oidc/me` | Current profile (Bearer or cookie). `401` if missing. |

On the client: register the reducer and epics, dispatch `bootstrapAuthOidc()` once, use `useAuth()`. Protect API routes with `@UseGuards(JwtAuthGuard)` and `@CurrentUser()`.

## Environment

Copy [`.env.example`](./.env.example). Required: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `JWT_SECRET` (min 32 chars), `SESSION_SECRET`.

## Develop

```bash
npm install
npm run build
npm test
```

Publish each workspace package with `npm publish --access public` from `core/`, `nest/`, then `react/` after they are built.
