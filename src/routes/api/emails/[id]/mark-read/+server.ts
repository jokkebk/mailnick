import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { markAsRead } from '$lib/server/gmail/actions';
import { handleReauthCleanup, reauthResponse } from '$lib/server/gmail/reauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const accountId = url.searchParams.get('accountId');

	try {
		if (!accountId) {
			return json({ error: 'Account ID is required' }, { status: 400 });
		}

		// Get email from DB to capture original state
		const email = await db
			.select()
			.from(emails)
			.where(and(eq(emails.id, id), eq(emails.accountId, accountId)))
			.get();

		if (!email) {
			return json({ error: 'Email not found' }, { status: 404 });
		}

		const originalState = {
			isUnread: email.isUnread,
			labelIds: email.labelIds
		};

		// Call Gmail API to mark as read
		await markAsRead(accountId, id);

		// Update email in local DB
		await db
			.update(emails)
			.set({ isUnread: false })
			.where(and(eq(emails.id, id), eq(emails.accountId, accountId)));

		// Insert action record into actionHistory with 24hr expiry
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24);

		const actionId = crypto.randomUUID();
		await db.insert(actionHistory).values({
			id: actionId,
			accountId,
			emailId: id,
			actionType: 'mark_read',
			originalState: JSON.stringify(originalState),
			expiresAt
		});

		return json({ success: true, actionId });
	} catch (error) {
		if (await handleReauthCleanup(error, accountId)) {
			return json(reauthResponse(), { status: 401 });
		}
		console.error('Mark as read error:', error);
		return json({ error: 'Failed to mark as read' }, { status: 500 });
	}
};
