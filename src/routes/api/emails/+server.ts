import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category');
	const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

	try {
		let query = db.select().from(emails).$dynamic();

		if (unreadOnly) {
			query = query.where(eq(emails.isUnread, true));
		}

		if (category) {
			query = query.where(eq(emails.category, category));
		}

		const result = await query.orderBy(desc(emails.receivedAt)).limit(100);

		return json({ emails: result });
	} catch (error) {
		console.error('Fetch emails error:', error);
		return json({ error: 'Failed to fetch emails' }, { status: 500 });
	}
};
