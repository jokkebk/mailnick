import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, tokens, actionHistory } from '$lib/server/db/schema';
import { desc, eq, gte, and, notInArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { reauthResponse } from '$lib/server/gmail/reauth';
import { getRequiredAccountId } from '$lib/server/utils';
import { MAX_EMAIL_RESULTS } from '$lib/constants';

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category');
	const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
	const days = parseInt(url.searchParams.get('days') || '7');
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	try {

		// Check if user is authenticated by checking for stored tokens
		const storedTokens = await db.select().from(tokens).where(eq(tokens.id, accountId)).get();

		if (!storedTokens) {
			return json(reauthResponse(), { status: 401 });
		}

		// Calculate date threshold
		const dateThreshold = new Date();
		dateThreshold.setDate(dateThreshold.getDate() - days);

		// Build query with date filter
		const conditions = [gte(emails.receivedAt, dateThreshold), eq(emails.accountId, accountId)];

		if (unreadOnly) {
			conditions.push(eq(emails.isUnread, true));

			// Exclude emails with active (non-undone) actions (any action makes it "handled")
			const activeActions = await db
				.select({ emailId: actionHistory.emailId })
				.from(actionHistory)
				.where(and(eq(actionHistory.accountId, accountId), eq(actionHistory.undone, false)));

			const excludedEmailIds = activeActions.map((a) => a.emailId);
			if (excludedEmailIds.length > 0) {
				conditions.push(notInArray(emails.id, excludedEmailIds));
			}
		}

		if (category) {
			conditions.push(eq(emails.category, category));
		}

		const result = await db
			.select()
			.from(emails)
			.where(and(...conditions))
			.orderBy(desc(emails.receivedAt))
			.limit(MAX_EMAIL_RESULTS);

		return json({ emails: result });
	} catch (error) {
		console.error('Fetch emails error:', error);
		return json({ error: 'Failed to fetch emails' }, { status: 500 });
	}
};
