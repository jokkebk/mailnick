import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, tokens } from '$lib/server/db/schema';
import { desc, eq, gte, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category');
	const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
	const days = parseInt(url.searchParams.get('days') || '7');

	try {
		// Check if user is authenticated by checking for stored tokens
		const storedTokens = await db.select().from(tokens).where(eq(tokens.id, 'default')).get();

		if (!storedTokens) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		// Calculate date threshold
		const dateThreshold = new Date();
		dateThreshold.setDate(dateThreshold.getDate() - days);

		// Build query with date filter
		const conditions = [gte(emails.receivedAt, dateThreshold)];

		if (unreadOnly) {
			conditions.push(eq(emails.isUnread, true));
		}

		if (category) {
			conditions.push(eq(emails.category, category));
		}

		const result = await db
			.select()
			.from(emails)
			.where(and(...conditions))
			.orderBy(desc(emails.receivedAt))
			.limit(100);

		return json({ emails: result });
	} catch (error) {
		console.error('Fetch emails error:', error);
		return json({ error: 'Failed to fetch emails' }, { status: 500 });
	}
};
