import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { actionHistory, emails, tokens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const accountId = params.accountId;

	try {
		await db.delete(actionHistory).where(eq(actionHistory.accountId, accountId));
		await db.delete(emails).where(eq(emails.accountId, accountId));
		const deletedTokens = await db.delete(tokens).where(eq(tokens.id, accountId));

		if (deletedTokens.changes === 0) {
			return json({ error: 'Account not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Delete account error:', error);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};
