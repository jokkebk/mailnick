import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory, tokens } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { reauthResponse } from '$lib/server/gmail/reauth';
import { getRequiredAccountId } from '$lib/server/utils';

export const GET: RequestHandler = async ({ url }) => {
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	try {
		// Check if user is authenticated
		const storedTokens = await db.select().from(tokens).where(eq(tokens.id, accountId)).get();

		if (!storedTokens) {
			return json(reauthResponse(), { status: 401 });
		}

		// Get all emails that have actions (not undone)
		const emailsWithActions = await db
			.select({
				email: emails,
				action: actionHistory
			})
			.from(actionHistory)
			.innerJoin(emails, eq(actionHistory.emailId, emails.id))
			.where(
				and(
					eq(actionHistory.undone, false),
					eq(actionHistory.accountId, accountId),
					eq(emails.accountId, accountId)
				)
			)
			.orderBy(desc(actionHistory.timestamp))
			.all();

		return json({ emailsWithActions });
	} catch (error) {
		console.error('Fetch emails with actions error:', error);
		return json({ error: 'Failed to fetch emails with actions' }, { status: 500 });
	}
};
