import { json } from '@sveltejs/kit';
import { syncUnreadEmails, cleanupBeforeSync } from '$lib/server/gmail/sync';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const days = body.days || 7; // Default to 7 days for unread emails
		const accountId = body.accountId as string | undefined;
		const actionRetentionDays = 2; // Keep action history for 2 days

		if (!accountId) {
			return json({ error: 'Account ID is required' }, { status: 400 });
		}

		// Clean up old actions and orphaned emails first
		const cleanupResult = await cleanupBeforeSync(accountId, actionRetentionDays);

		// Then sync unread emails within the date range
		const syncResult = await syncUnreadEmails(accountId, days);

		return json({
			...syncResult,
			...cleanupResult
		});
	} catch (error) {
		console.error('Sync error:', error);
		return json({ error: 'Failed to sync emails' }, { status: 500 });
	}
};
