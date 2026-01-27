# Gmail Inbox Cleaner - Architecture

A self-hosted tool for managing corporate Gmail inbox overload through intelligent categorization.

## Tech Stack

- **Runtime**: Bun
- **Framework**: SvelteKit (Svelte 5 with runes)
- **Database**: SQLite + Drizzle ORM
- **Gmail Integration**: `googleapis` npm package
- **LLM**: Anthropic Claude API (for email categorization)
- **Styling**: Tailwind CSS v3
- **Adapter**: `svelte-adapter-bun` for production

## Project Setup

```bash
# Create project
bunx sv create gmail-cleaner
# Select: SvelteKit minimal, TypeScript, Tailwind, Drizzle

cd gmail-cleaner

# Add production adapter
bun add -D svelte-adapter-bun

# Add dependencies
bun add googleapis @anthropic-ai/sdk
bun add drizzle-orm better-sqlite3
bun add -D drizzle-kit @types/better-sqlite3

# Development
bun run dev

# Production build
bun run build
cd build && bun run index.js
```

Update `svelte.config.js`:
```javascript
import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/kit/vite';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
};
```

## Gmail API Setup

### Google Cloud Console

1. Create project at console.cloud.google.com
2. Enable Gmail API (APIs & Services → Library)
3. Configure OAuth consent screen (Internal for Workspace, External otherwise)
4. Create OAuth 2.0 credentials (Web application type)
5. Add redirect URI: `http://localhost:5173/auth/callback`

### Required Scopes

```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',  // Read emails
  'https://www.googleapis.com/auth/gmail.modify',    // Mark as read, archive
  'https://www.googleapis.com/auth/gmail.labels',    // Manage labels
];
```

**Note**: Corporate Google Workspace may require admin consent for these scopes.

### Environment Variables

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

ANTHROPIC_API_KEY=your_api_key

DATABASE_PATH=./data/emails.db
```

## Directory Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle schema
│   │   │   └── index.ts       # DB connection
│   │   ├── gmail/
│   │   │   ├── client.ts      # Gmail API wrapper
│   │   │   ├── oauth.ts       # OAuth2 flow
│   │   │   └── sync.ts        # Fetch & sync emails
│   │   └── categorizer/
│   │       └── index.ts       # LLM categorization
│   ├── components/
│   │   ├── EmailList.svelte
│   │   ├── EmailCard.svelte
│   │   ├── CategoryFilter.svelte
│   │   └── BulkActions.svelte
│   └── stores/
│       └── emails.svelte.ts   # Svelte 5 runes-based state
├── routes/
│   ├── +page.svelte           # Main inbox view
│   ├── +layout.svelte
│   ├── auth/
│   │   ├── +server.ts         # Initiate OAuth
│   │   └── callback/
│   │       └── +server.ts     # OAuth callback
│   └── api/
│       ├── emails/
│       │   ├── +server.ts     # GET unread, POST bulk actions
│       │   └── sync/
│       │       └── +server.ts # Trigger sync
│       └── categorize/
│           └── +server.ts     # Trigger LLM categorization
└── app.html
```

## Database Schema

```typescript
// src/lib/server/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const emails = sqliteTable('emails', {
  id: text('id').primaryKey(),              // Gmail message ID
  threadId: text('thread_id').notNull(),
  from: text('from').notNull(),
  fromDomain: text('from_domain').notNull(), // Extracted for grouping
  to: text('to'),
  subject: text('subject'),
  snippet: text('snippet'),                  // Preview text
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  isUnread: integer('is_unread', { mode: 'boolean' }).default(true),
  labelIds: text('label_ids'),               // JSON array
  category: text('category'),                // LLM-assigned
  categoryConfidence: integer('category_confidence'), // 0-100
  rawHeaders: text('raw_headers'),           // JSON for debugging
  syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),              // e.g., "AWS Notifications"
  description: text('description'),
  rules: text('rules'),                       // JSON: LLM prompt hints
  color: text('color'),                       // For UI
  autoAction: text('auto_action'),           // "archive" | "mark_read" | null
});

export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey().default('default'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});
```

## Core Flows

### 1. OAuth Flow

```
User clicks "Connect Gmail"
  → GET /auth (generates consent URL, redirects)
  → User approves on Google
  → GET /auth/callback (exchanges code for tokens, stores in DB)
  → Redirect to /
```

### 2. Email Sync

```
User clicks "Sync" or periodic job runs
  → POST /api/emails/sync
  → Fetch unread emails via Gmail API (users.messages.list + get)
  → Extract metadata, store in SQLite
  → Return count
```

### 3. LLM Categorization

```
After sync or on-demand
  → POST /api/categorize
  → Batch emails by sender domain
  → Send to Claude with category definitions
  → Update emails with category + confidence
  → Return updated counts
```

### 4. Bulk Actions

```
User selects category or emails
  → POST /api/emails { action: "archive" | "mark_read", ids: [...] }
  → Call Gmail API batch modify
  → Update local DB
```

## LLM Categorization Strategy

### Prompt Structure

```typescript
const systemPrompt = `You categorize corporate emails into these categories:
${categories.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Respond with JSON array: [{"id": "email_id", "category": "category_name", "confidence": 0-100}]
`;

const userPrompt = `Categorize these emails:
${emails.map(e => `
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Snippet: ${e.snippet}
`).join('\n---\n')}`;
```

### Default Categories (User-Configurable)

1. **AWS Notifications** - CloudWatch, billing, service alerts
2. **CI/CD** - GitHub Actions, Jenkins, deployment notifications  
3. **Calendar** - Meeting invites, updates, cancellations
4. **JIRA/Tickets** - Issue updates, comments, assignments
5. **Newsletters** - Marketing, product updates, digests
6. **Direct Messages** - Actual human correspondence (high priority)
7. **Other** - Uncategorized

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth` | Initiate OAuth flow |
| GET | `/auth/callback` | OAuth callback |
| GET | `/api/emails` | List cached emails (with filters) |
| POST | `/api/emails/sync` | Fetch new emails from Gmail |
| POST | `/api/emails` | Bulk actions (archive, mark read) |
| POST | `/api/categorize` | Run LLM categorization |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create/update category |

## UI Components

### Main View (`+page.svelte`)

- Header: Sync button, last sync time, unread count
- Sidebar: Category filters with counts
- Main area: Email list grouped by category or sender
- Bulk action bar: Archive all, Mark read, custom actions

### Email Card

- Sender (with domain badge)
- Subject + snippet preview
- Category badge (colored)
- Time received
- Checkbox for bulk selection

## Phase 2: Future Features

- **Reply from tool**: Compose and send via Gmail API (add `gmail.send` scope)
- **Custom rules**: User-defined regex/keyword filters before LLM
- **Scheduled sync**: Cron-style background sync
- **Statistics**: Email volume trends, category breakdown over time
- **Mobile-friendly**: Responsive design for phone triage

## Development Notes

- Use `bun --bun run dev` to use Bun runtime during development (needed for bun:sqlite if used)
- Standard `bun run dev` uses Node.js via Vite (fine for googleapis)
- Store OAuth tokens encrypted in production
- Rate limit Gmail API calls (250 quota units/user/second)
- Batch LLM calls to reduce API costs (10-20 emails per request)
