# CashRegistrar

Invoice generator with auth, built on Next.js (App Router) + MySQL (Prisma) + standard API routes.

## Getting started

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Set `DATABASE_URL` (MySQL) and `AUTH_SECRET` (used to sign session cookies) in `.env.local`.

## Scripts

| Script                 | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start Next.js dev server             |
| `npm run build`        | Production build                     |
| `npm run start`        | Serve the production build           |
| `npm run lint`         | ESLint                               |
| `npm run typecheck`    | `tsc --noEmit`                       |
| `npm run format`       | Prettier (write)                     |
| `npm run prisma:migrate` | Apply a new migration (`prisma migrate dev`) |
| `npm run prisma:deploy`  | Apply migrations on the VPS (`prisma migrate deploy`) |

## Structure

- `app/` — Next.js pages (`/`, `/login`, `/register`, `/dashboard`, `/invoices`) and API routes (`app/api/.../route.ts`)
- `components/` — shared UI (`ui/`) and feature components (`auth/`, `invoice/`)
- `lib/` — domain logic (`invoice.ts`), Prisma client (`db.ts`), auth helpers (`auth/`)
- `prisma/schema.prisma` — MySQL data model
- `proxy.ts` — route protection (session-cookie check)
- `scripts/genkeys.mjs` — generates a random `AUTH_SECRET` for session-cookie signing
- `scripts/eims-keys.mjs` / `scripts/eims-sign.mjs` — EIMS certificate/CSR generation and request signing

## Adding UI components

```bash
npx shadcn@latest add button
```

This places components in `components/ui`.
