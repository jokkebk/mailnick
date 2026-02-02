import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { cleanupRules } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request }) => {
	const { ruleId } = params;

	try {
		const body = await request.json();
		const { accountId, name, matchCriteria, color, enabled } = body;

		if (!accountId) {
			return json({ error: 'accountId is required' }, { status: 400 });
		}

		// Build update object
		const updates: any = {
			updatedAt: new Date()
		};

		if (name !== undefined) updates.name = name;
		if (matchCriteria !== undefined) updates.matchCriteria = JSON.stringify(matchCriteria);
		if (color !== undefined) updates.color = color;
		if (enabled !== undefined) updates.enabled = enabled;

		await db
			.update(cleanupRules)
			.set(updates)
			.where(and(eq(cleanupRules.id, ruleId), eq(cleanupRules.accountId, accountId)));

		// Fetch updated rule
		const [updatedRule] = await db
			.select()
			.from(cleanupRules)
			.where(and(eq(cleanupRules.id, ruleId), eq(cleanupRules.accountId, accountId)));

		if (!updatedRule) {
			return json({ error: 'Rule not found' }, { status: 404 });
		}

		return json({
			rule: {
				...updatedRule,
				matchCriteria: JSON.parse(updatedRule.matchCriteria)
			}
		});
	} catch (error) {
		console.error('Failed to update cleanup rule:', error);
		return json({ error: 'Failed to update cleanup rule' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const { ruleId } = params;
	const accountId = url.searchParams.get('accountId');

	if (!accountId) {
		return json({ error: 'accountId is required' }, { status: 400 });
	}

	try {
		await db
			.delete(cleanupRules)
			.where(and(eq(cleanupRules.id, ruleId), eq(cleanupRules.accountId, accountId)));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete cleanup rule:', error);
		return json({ error: 'Failed to delete cleanup rule' }, { status: 500 });
	}
};
