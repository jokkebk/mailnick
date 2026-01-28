import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { actionHistory, emails, tokens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const accountId = params.accountId;

	try {
		const result = await db.transaction(async (tx) => {
			// Delete in order: action_history -> emails -> tokens
			await tx.delete(actionHistory).where(eq(actionHistory.accountId, accountId));
			await tx.delete(emails).where(eq(emails.accountId, accountId));
			const deletedTokens = await tx.delete(tokens).where(eq(tokens.id, accountId));

			return deletedTokens;
		});

		if (result.changes === 0) {
			return json({ error: 'Account not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Delete account error:', error);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};
