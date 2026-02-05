import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { trashEmail } from '$lib/server/gmail/actions';
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

		// Call Gmail API to move to trash
		await trashEmail(accountId, id);

		// Insert action record into actionHistory with 24hr expiry
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24);

		const actionId = crypto.randomUUID();
		await db.insert(actionHistory).values({
			id: actionId,
			accountId,
			emailId: id,
			actionType: 'trash',
			originalState: JSON.stringify(originalState),
			expiresAt
		});

		return json({ success: true, actionId });
	} catch (error) {
		if (await handleReauthCleanup(error, accountId)) {
			return json(reauthResponse(), { status: 401 });
		}
		console.error('Trash error:', error);
		return json({ error: 'Failed to trash email' }, { status: 500 });
	}
};
