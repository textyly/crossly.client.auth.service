# @textyly/crossly-client-auth-contracts

Shared TypeScript contracts (types / DTOs) for the Crossly **Client Auth** service.

These types describe the auth tokens and responses exchanged over the service's HTTP API and are
meant to be consumed by any TypeScript/JavaScript client — for example [`crossly.ui`](https://github.com/textyly) —
and by other services that validate Crossly access tokens.

## Install

```bash
npm install @textyly/crossly-client-auth-contracts
```

## Usage

```ts
import type {
    AccessTokenClaims,
    GuestSessionResponse,
} from '@textyly/crossly-client-auth-contracts';
```

The package ships only type declarations and has no runtime or server dependencies.

## License

Apache-2.0 — part of the [textyly / crossly](https://github.com/textyly) open-source project.
