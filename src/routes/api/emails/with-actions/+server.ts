import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory, tokens } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Check if user is authenticated
		const storedTokens = await db.select().from(tokens).where(eq(tokens.id, 'default')).get();

		if (!storedTokens) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		// Get all emails that have actions (not undone)
		const emailsWithActions = await db
			.select({
				email: emails,
				action: actionHistory
			})
			.from(actionHistory)
			.innerJoin(emails, eq(actionHistory.emailId, emails.id))
			.where(eq(actionHistory.undone, false))
			.orderBy(desc(actionHistory.timestamp))
			.all();

		return json({ emailsWithActions });
	} catch (error) {
		console.error('Fetch emails with actions error:', error);
		return json({ error: 'Failed to fetch emails with actions' }, { status: 500 });
	}
};
