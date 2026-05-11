# cuervito.app

T3 stack scaffold for **cuervito.app** — sports & event photography marketplace where photographers sell shots directly to athletes (10% platform fee).

Stack: Next.js (App Router) · TypeScript · tRPC · Prisma · NextAuth · Tailwind · Supabase (Postgres + Storage).

## Setup

1. Create a Supabase project (https://supabase.com).
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — pooler connection (port 6543, `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` — direct connection (port 5432) — used by `prisma migrate`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, for Storage uploads)
   - `AUTH_SECRET` — `npx auth secret`
   - `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` (or swap provider in `src/server/auth/config.ts`)
3. Push schema to Supabase:

   ```bash
   npm run db:push
   ```

4. Run dev server:

   ```bash
   npm run dev
   ```

## Project layout

- `prisma/schema.prisma` — domain models: `User`, `Photographer`, `Organizer`, `Event`, `Photo`, `Order`, `OrderItem`, `Payout`, `PayoutAccount`.
- `src/server/api/routers/event.ts` — tRPC event router (starter).
- `src/server/supabase.ts` — service-role Supabase client (server-only).
- `src/lib/supabase-browser.ts` — browser Supabase client (Storage public URLs, etc.).
- `src/server/auth/` — NextAuth config.
- `../designs/` — HTML/CSS reference designs (extracted from `test.zip`): `index.html`, `search.html`, `gallery.html`, `onboarding.html`, `dashboard.html`, `styles.css`. Use these as the visual source-of-truth when porting screens to React components.

## Notes

- Currency stored as integer cents (`Int`) to avoid float drift; default currency `ARS`.
- `Photo.faceEmbeddings` is `Bytes` — populate via your face-recognition worker; Postgres `pgvector` can be added later via `Unsupported("vector")` if needed.
- `Photo.bibNumbers` is a `String[]` (Postgres array) for bib detection results.
- The 10% platform commission is stored per-photographer (`Photographer.commissionPct`) so it can be negotiated per-partner.
