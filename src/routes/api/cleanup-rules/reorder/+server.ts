import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { cleanupRules } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { accountId, ruleIds } = body;

		if (!accountId || !Array.isArray(ruleIds)) {
			return json({ error: 'accountId and ruleIds array are required' }, { status: 400 });
		}

		// Update display order for each rule
		for (let i = 0; i < ruleIds.length; i++) {
			await db
				.update(cleanupRules)
				.set({ displayOrder: i, updatedAt: new Date() })
				.where(and(eq(cleanupRules.id, ruleIds[i]), eq(cleanupRules.accountId, accountId)));
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to reorder cleanup rules:', error);
		return json({ error: 'Failed to reorder cleanup rules' }, { status: 500 });
	}
};
