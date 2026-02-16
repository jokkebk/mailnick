# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (must use bun runner for bun:sqlite)
bun run build        # Build for production
bun run check        # Type-check with svelte-check
```

Production: `cd build && bun run index.js`

Database migrations are handled automatically on startup via `src/lib/server/init.ts`. To generate new migrations after schema changes: `bunx drizzle-kit generate`.

## Architecture

**Stack:** SvelteKit (Svelte 5 runes) + Bun runtime + SQLite via `bun:sqlite` + Drizzle ORM + Bootstrap 4

This is a single-page app (`src/routes/+page.svelte`) with a SvelteKit API backend. All UI state lives in the page component; components receive data and callbacks as props.

### Key flows

**Startup:** `src/hooks.server.ts` calls `src/lib/server/init.ts` once on server start. `init.ts` validates env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) and runs idempotent SQL migrations. The app exits with a helpful error if env vars are missing or placeholder values.

**Auth:** `/auth` → Google OAuth → `/auth/callback` stores tokens in the `tokens` table (account ID = Gmail email address). Multiple accounts are supported; `selectedAccountId` is persisted in `localStorage`.

**Gmail client** (`src/lib/server/gmail/client.ts`): Loads stored OAuth tokens, auto-refreshes if expired. On OAuth failures (`invalid_grant`, 401, etc.), throws a reauth error (detected by `isReauthError` in `errors.ts`). API routes catch this with `handleReauthCleanup`, which deletes the stale token and returns `{ code: 'reauth_required' }` with a 401. The frontend detects this and shows a re-auth banner.

**Email sync** (`/api/emails/sync` POST): Calls `cleanupBeforeSync` first (deletes old action history + orphaned emails), then fetches unread Gmail messages via API and upserts them. The `category` field is extracted from Gmail's `CATEGORY_*` labels.

**Cleanup rules:** Users create rules (`cleanupRules` table) with JSON `matchCriteria` (type: `all`/`any`, conditions on fields like `from`, `fromDomain`, `subject`, etc.). `src/lib/utils/cleanup-matcher.ts` evaluates rules client-side against loaded emails. The `CleanupTasksSection` component groups emails by matching rules for batch actions.

**Action history:** Every email action (mark_read, archive, trash, label) records the previous state in `actionHistory` with a 2-day TTL for undo support.

### Database

SQLite at `./data/emails.db` (configured via `DATABASE_PATH` env var). Schema in `src/lib/server/db/schema.ts`, Drizzle config in `drizzle.config.ts`. Migration SQL files are in `drizzle/`.

### API routes pattern

All routes under `src/routes/api/` follow this pattern:
- Accept `accountId` as query param or request body
- Use `getGmailClient(accountId)` which handles token refresh
- Wrap in try/catch with `handleReauthCleanup(error, accountId)` → return 401 on reauth needed

### Environment variables

```
GOOGLE_CLIENT_ID       # Google OAuth Client ID
GOOGLE_CLIENT_SECRET   # Google OAuth Client Secret
GOOGLE_REDIRECT_URI    # http://localhost:5173/auth/callback for dev
GEMINI_API_KEY         # Gemini API (not yet integrated)
DATABASE_PATH          # ./data/emails.db
```
