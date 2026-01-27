import { getGmailClient } from './client';
import { db } from '../db';
import { emails, actionHistory } from '../db/schema';
import { eq, lt } from 'drizzle-orm';

function extractDomain(email: string): string {
	const match = email.match(/<(.+@(.+))>/);
	if (match) {
		return match[2];
	}
	const parts = email.split('@');
	return parts.length > 1 ? parts[1] : email;
}

export async function syncUnreadEmails(days: number = 7) {
	const gmail = await getGmailClient();

	// Calculate date for query (Gmail uses YYYY/MM/DD format)
	const dateThreshold = new Date();
	dateThreshold.setDate(dateThreshold.getDate() - days);
	const dateStr = dateThreshold.toISOString().split('T')[0].replace(/-/g, '/');

	// Build query: unread emails after the date threshold
	const query = `is:unread after:${dateStr}`;

	// Fetch list of unread messages
	const response = await gmail.users.messages.list({
		userId: 'me',
		q: query,
		maxResults: 100
	});

	const messages = response.data.messages || [];
	let syncedCount = 0;

	for (const message of messages) {
		if (!message.id) continue;

		// Check if already exists
		const existing = await db.select().from(emails).where(eq(emails.id, message.id)).get();

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
		const isUnread = fullMessage.data.labelIds?.includes('UNREAD') ?? true;
		const labelIds = JSON.stringify(fullMessage.data.labelIds || []);

		if (existing) {
			// Update existing email
			await db.update(emails)
				.set({
					isUnread,
					labelIds,
					snippet: fullMessage.data.snippet || '',
					syncedAt: new Date()
				})
				.where(eq(emails.id, message.id));
		} else {
			// Insert new email
			await db.insert(emails).values({
				id: message.id,
				threadId: fullMessage.data.threadId || message.threadId || '',
				from,
				fromDomain: extractDomain(from),
				to,
				subject,
				snippet: fullMessage.data.snippet || '',
				receivedAt,
				isUnread,
				labelIds,
				rawHeaders: JSON.stringify(headers),
				syncedAt: new Date()
			});
		}

		syncedCount++;
	}

	return { syncedCount, totalUnread: messages.length };
}

/**
 * Clean up old action history and orphaned emails
 * - Deletes actions older than retention period
 * - Deletes emails not referenced by any action
 */
export async function cleanupBeforeSync(actionRetentionDays: number = 2) {
	// Calculate cutoff date for actions
	const actionCutoff = new Date();
	actionCutoff.setDate(actionCutoff.getDate() - actionRetentionDays);

	// Delete old actions first
	const deletedActionsResult = await db.delete(actionHistory).where(lt(actionHistory.timestamp, actionCutoff));

	// Get all email IDs that still have actions (these should be kept)
	const emailsWithActions = await db
		.select({ emailId: actionHistory.emailId })
		.from(actionHistory)
		.all();

	const emailIdsToKeep = new Set(emailsWithActions.map(row => row.emailId));

	// Delete orphaned emails (those not in the keep set)
	// Note: SQLite doesn't support NOT IN with large sets efficiently, so we do it in batches
	const allEmails = await db.select({ id: emails.id }).from(emails).all();
	let deletedEmails = 0;

	const emailsToDelete = allEmails.filter(email => !emailIdsToKeep.has(email.id));

	for (const email of emailsToDelete) {
		await db.delete(emails).where(eq(emails.id, email.id));
		deletedEmails++;
	}

	return {
		deletedActions: deletedActionsResult.changes,
		deletedEmails
	};
}
