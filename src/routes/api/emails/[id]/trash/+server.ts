import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { trashEmail } from '$lib/server/gmail/actions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		// Get email from DB to capture original state
		const email = await db.select().from(emails).where(eq(emails.id, id)).get();

		if (!email) {
			return json({ error: 'Email not found' }, { status: 404 });
		}

		const originalState = {
			isUnread: email.isUnread,
			labelIds: email.labelIds
		};

		// Call Gmail API to move to trash
		await trashEmail(id);

		// Insert action record into actionHistory with 24hr expiry
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24);

		const actionId = crypto.randomUUID();
		await db.insert(actionHistory).values({
			id: actionId,
			emailId: id,
			actionType: 'trash',
			originalState: JSON.stringify(originalState),
			expiresAt
		});

		return json({ success: true, actionId });
	} catch (error) {
		console.error('Trash error:', error);
		return json({ error: 'Failed to trash email' }, { status: 500 });
	}
};
