# MailNick

A self-hosted tool for managing corporate Gmail inbox overload through intelligent categorization.

## Features

- Connect to Gmail using OAuth2
- Sync and view unread emails
- AI-powered email grouping via Google Gemini
- SQLite database for local storage

## Installation

Pre-built binaries are available on the [Releases](../../releases) page for Apple Silicon (arm64) Macs. No Bun installation required.

1. Download and extract the `.tar.gz`:
```bash
tar -xzf mailnick-arm64.tar.gz
cd mailnick
```
2. On macOS, remove the quarantine flag:
```bash
xattr -cr mailnick
```
3. Copy `.env.example` to `.env` and configure it (see [Configuration](#configuration) below)
4. Run the app:
```bash
./mailnick
```
5. Open http://localhost:3000 and connect your Gmail account

The `client/` directory must stay next to the `mailnick` binary — it contains the web UI assets.

## Configuration

Copy `.env.example` to `.env` and fill in the values below.

### Google OAuth (required)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Gmail API
3. Configure OAuth consent screen
   - If the app audience is **External** and publishing status is **Testing**, add all allowed accounts under **Audience → Test users** (including your own)
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `http://localhost:3000/auth/callback` (or `http://localhost:5173/auth/callback` for development)
6. Copy Client ID and Client Secret to `.env`

### Gemini API (optional, enables AI grouping)

1. Open [Google AI Studio](https://aistudio.google.com) and create an API key
2. Add the key to `.env` as `GEMINI_API_KEY`

Without this key, AI grouping features will stay disabled.

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime

### Setup

```bash
bun install
cp .env.example .env  # then configure as above
bun run dev
```

On first startup, the app will automatically validate environment variables, run database migrations, and create necessary tables. If environment variables are missing or invalid, the app will exit with a helpful error message.

The dev server runs at http://localhost:5173.

### Production build

```bash
bun run build
cd build && bun run index.js
```

### Building standalone binary

```bash
bun run build:binary
```

This produces `dist/mailnick` and `dist/client/`. Run the binary from inside `dist/`.

### Tech stack

- **Runtime**: Bun
- **Framework**: SvelteKit (Svelte 5 with runes)
- **Database**: SQLite (bun:sqlite) + Drizzle ORM
- **Gmail**: googleapis npm package
- **LLM**: Google Gemini API
- **Styling**: Bootstrap 4
- **Adapter**: svelte-adapter-bun
