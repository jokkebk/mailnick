import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { addLabel, ensureLabelExists } from '$lib/server/gmail/actions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { id } = params;
	const accountId = url.searchParams.get('accountId');
	const { labelName } = await request.json();

	if (!accountId) {
		return json({ error: 'Account ID is required' }, { status: 400 });
	}

	if (!labelName) {
		return json({ error: 'Label name is required' }, { status: 400 });
	}

	try {
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

		// Ensure label exists and get its ID
		const labelId = await ensureLabelExists(accountId, labelName);

		// Add label to email
		await addLabel(accountId, id, labelId);

		// Update label IDs in local DB
		const currentLabelIds = email.labelIds ? JSON.parse(email.labelIds) : [];
		if (!currentLabelIds.includes(labelId)) {
			currentLabelIds.push(labelId);
			await db
				.update(emails)
				.set({ labelIds: JSON.stringify(currentLabelIds) })
				.where(and(eq(emails.id, id), eq(emails.accountId, accountId)));
		}

		// Insert action record into actionHistory with 24hr expiry
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24);

		const actionId = crypto.randomUUID();
		await db.insert(actionHistory).values({
			id: actionId,
			accountId,
			emailId: id,
			actionType: 'label',
			originalState: JSON.stringify({ ...originalState, addedLabelId: labelId }),
			expiresAt
		});

		return json({ success: true, actionId, labelId });
	} catch (error) {
		console.error('Label error:', error);
		return json({ error: 'Failed to add label' }, { status: 500 });
	}
};
