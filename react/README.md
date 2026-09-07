# @rightandabove/auth-oidc-react

Headless React client for auth-oidc: Redux Toolkit slice, redux-observable epics, `useAuth()`, and `bootstrapAuthOidc()`. **No UI kit** — wire it into your own store and screens.

**Install:** `npm i @rightandabove/auth-oidc-react`

Peer deps: `react`, `@reduxjs/toolkit`, `react-redux`, `redux-observable`, `rxjs`. Depends on [`@rightandabove/auth-oidc-core`](https://www.npmjs.com/package/@rightandabove/auth-oidc-core). Pair with [`@rightandabove/auth-oidc-nest`](https://www.npmjs.com/package/@rightandabove/auth-oidc-nest) on the API.

## Usage

1. Register the reducer and epics in your store.
2. Dispatch `bootstrapAuthOidc()` once on app start.
3. Use `useAuth()` for session state; call the Nest login/logout routes for the browser flow.

## Sibling packages

| Package | Role |
| --- | --- |
| [`auth-oidc-core`](https://www.npmjs.com/package/@rightandabove/auth-oidc-core) | Schemas & shared types |
| [`auth-oidc-nest`](https://www.npmjs.com/package/@rightandabove/auth-oidc-nest) | NestJS OIDC module |
| `auth-oidc-react` | This package |

## Docs & source

Full guide: [GitHub README](https://github.com/raa-org/auth-oidc#readme)  
Repository: [raa-org/auth-oidc](https://github.com/raa-org/auth-oidc)  
License: MIT · Right&Above, LLC
