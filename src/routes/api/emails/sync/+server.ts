import { json } from '@sveltejs/kit';
import { syncUnreadEmails } from '$lib/server/gmail/sync';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const days = body.days || 7; // Default to 7 days

		const result = await syncUnreadEmails(days);
		return json(result);
	} catch (error) {
		console.error('Sync error:', error);
		return json({ error: 'Failed to sync emails' }, { status: 500 });
	}
};
