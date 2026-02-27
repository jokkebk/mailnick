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
   - If OAuth app audience is **External** and publishing status is **Testing** (developer mode), add all allowed accounts under **Audience -> Test users** (including your own). Only whitelisted test users can authorize the app.
   - Create OAuth 2.0 credentials (Web application)
   - Add redirect URI: `http://localhost:5173/auth/callback`
   - Copy Client ID and Client Secret to `.env`

4. Configure Gemini API key for AI features:
   - Open Google AI Studio and create an API key
   - AI Studio keys are usually configuration-light: for this app, you typically don't need to manually enable extra APIs in Cloud Console
   - If you use a manually managed Cloud API key instead, ensure it's allowed for the Generative Language API
   - Add the key to `.env` as:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

   - Without this key, AI grouping features will stay disabled

5. Start development server:
```bash
bun run dev
```

   On first startup, the app will automatically:
   - Validate your environment variables
   - Run database migrations
   - Create necessary tables

   If environment variables are missing or invalid, the app will exit with a helpful error message.

   (Note: The dev script uses `--bun` flag to ensure Bun runtime is used, required for `bun:sqlite` and other Bun-specific features)

6. Open http://localhost:5173 and connect your Gmail account

## Tech Stack

- **Runtime**: Bun
- **Framework**: SvelteKit (Svelte 5 with runes)
- **Database**: SQLite (bun:sqlite) + Drizzle ORM
- **Gmail Integration**: googleapis npm package
- **LLM**: Google Gemini API
- **Styling**: Bootstrap 4
- **Adapter**: svelte-adapter-bun for production

## Production Build

```bash
bun run build
cd build && bun run index.js
```
