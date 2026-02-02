# MailNick

A self-hosted tool for managing corporate Gmail inbox overload through intelligent categorization.

## Features

- Connect to Gmail using OAuth2
- Sync and view unread emails
- Bootstrap 4 UI
- SQLite database for local storage
- Gemini API ready for future LLM categorization

## Setup

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
```

3. Configure Google Cloud Console:
   - Create a project at console.cloud.google.com
   - Enable Gmail API
   - Configure OAuth consent screen
   - Create OAuth 2.0 credentials (Web application)
   - Add redirect URI: `http://localhost:5173/auth/callback`
   - Copy Client ID and Client Secret to `.env`

4. Run database migrations:
```bash
bun run scripts/migrate.ts
```

5. Start development server:
```bash
bun run dev
```
   (Note: The dev script uses `--bun` flag to ensure Bun runtime is used, required for `bun:sqlite` and other Bun-specific features)

6. Open http://localhost:5173 and connect your Gmail account

## Tech Stack

- **Runtime**: Bun
- **Framework**: SvelteKit (Svelte 5 with runes)
- **Database**: SQLite (bun:sqlite) + Drizzle ORM
- **Gmail Integration**: googleapis npm package
- **LLM**: Google Gemini API (to be integrated)
- **Styling**: Bootstrap 4
- **Adapter**: svelte-adapter-bun for production

## Production Build

```bash
bun run build
cd build && bun run index.js
```

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.
