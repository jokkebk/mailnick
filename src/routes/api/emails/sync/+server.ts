import { json } from '@sveltejs/kit';
import { syncUnreadEmails } from '$lib/server/gmail/sync';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		const result = await syncUnreadEmails();
		return json(result);
	} catch (error) {
		console.error('Sync error:', error);
		return json({ error: 'Failed to sync emails' }, { status: 500 });
	}
};
