import { getGmailClient } from './client';
import { db } from '../db';
import { emails } from '../db/schema';
import { eq } from 'drizzle-orm';

function extractDomain(email: string): string {
	const match = email.match(/<(.+@(.+))>/);
	if (match) {
		return match[2];
	}
	const parts = email.split('@');
	return parts.length > 1 ? parts[1] : email;
}

export async function syncUnreadEmails() {
	const gmail = await getGmailClient();

	// Fetch list of unread messages
	const response = await gmail.users.messages.list({
		userId: 'me',
		q: 'is:unread',
		maxResults: 100
	});

	const messages = response.data.messages || [];
	let syncedCount = 0;

	for (const message of messages) {
		if (!message.id) continue;

		// Check if already exists
		const existing = await db.select().from(emails).where(eq(emails.id, message.id)).get();
		if (existing) continue;

		// Fetch full message details
		const fullMessage = await gmail.users.messages.get({
			userId: 'me',
			id: message.id,
			format: 'metadata',
			metadataHeaders: ['From', 'To', 'Subject', 'Date']
		});

		const headers = fullMessage.data.payload?.headers || [];
		const from = headers.find((h) => h.name === 'From')?.value || '';
		const to = headers.find((h) => h.name === 'To')?.value || '';
		const subject = headers.find((h) => h.name === 'Subject')?.value || '';
		const dateHeader = headers.find((h) => h.name === 'Date')?.value;

		const receivedAt = dateHeader ? new Date(dateHeader) : new Date(Number(fullMessage.data.internalDate));

		await db.insert(emails).values({
			id: message.id,
			threadId: fullMessage.data.threadId || message.threadId || '',
			from,
			fromDomain: extractDomain(from),
			to,
			subject,
			snippet: fullMessage.data.snippet || '',
			receivedAt,
			isUnread: fullMessage.data.labelIds?.includes('UNREAD') ?? true,
			labelIds: JSON.stringify(fullMessage.data.labelIds || []),
			rawHeaders: JSON.stringify(headers),
			syncedAt: new Date()
		});

		syncedCount++;
	}

	return { syncedCount, totalUnread: messages.length };
}
