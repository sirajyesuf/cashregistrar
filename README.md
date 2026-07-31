# CashRegistrar

Invoice generator with auth, built on Next.js (App Router) + Convex + Convex Auth.

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` starts the Convex dev server and Next.js together.

## Scripts

| Script         | Description                               |
| -------------- | ----------------------------------------- |
| `npm run dev`  | Start Convex dev server + Next.js         |
| `npm run build`| Production build                          |
| `npm run start`| Serve the production build                |
| `npm run lint` | ESLint                                    |
| `npm run typecheck` | `tsc --noEmit`                      |
| `npm run format` | Prettier (write)                       |

## Structure

- `app/` — Next.js pages (`/`, `/login`, `/register`, `/dashboard`, `/invoices`)
- `components/` — shared UI (`ui/`) and feature components (`auth/`, `invoice/`)
- `convex/` — Convex backend (auth config, schema, queries)
- `lib/` — pure domain logic (`invoice.ts`) and utilities
- `scripts/genkeys.mjs` — generates RS256 keypair for Convex auth JWKS into `.keys/`

## Adding UI components

```bash
npx shadcn@latest add button
```

This places components in `components/ui`.
