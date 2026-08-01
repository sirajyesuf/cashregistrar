This project uses **MySQL (via Prisma)** as its backend with **standard Next.js API routes** (Route Handlers in `app/api/.../route.ts`).

- Run `npx prisma generate` after editing `prisma/schema.prisma`.
- Run `npx prisma migrate dev` locally and `npx prisma migrate deploy` on the VPS.
- Backend logic lives in Route Handlers; server-side helpers live in `lib/`.
