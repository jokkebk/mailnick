import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { cleanupRules } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { CleanupRule } from '$lib/types/cleanup';
import { getRequiredAccountId } from '$lib/server/utils';

export const GET: RequestHandler = async ({ url }) => {
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	try {
		const rules = await db
			.select()
			.from(cleanupRules)
			.where(eq(cleanupRules.accountId, accountId))
			.orderBy(asc(cleanupRules.displayOrder));

		return json({ rules });
	} catch (error) {
		console.error('Failed to fetch cleanup rules:', error);
		return json({ error: 'Failed to fetch cleanup rules' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { accountId, name, matchCriteria, color } = body;

		if (!accountId || !name || !matchCriteria) {
			return json(
				{ error: 'accountId, name, and matchCriteria are required' },
				{ status: 400 }
			);
		}

		// Get the max display order for this account
		const existingRules = await db
			.select()
			.from(cleanupRules)
			.where(eq(cleanupRules.accountId, accountId));

		const maxOrder = existingRules.reduce(
			(max, rule) => Math.max(max, rule.displayOrder),
			-1
		);

		const now = new Date();
		const newRule = {
			id: crypto.randomUUID(),
			accountId,
			name,
			matchCriteria: JSON.stringify(matchCriteria),
			displayOrder: maxOrder + 1,
			enabled: true,
			createdAt: now,
			updatedAt: now,
			color: color || null
		};

		await db.insert(cleanupRules).values(newRule);

		// Return the rule with parsed matchCriteria
		const rule: CleanupRule = {
			...newRule,
			matchCriteria: JSON.parse(newRule.matchCriteria)
		};

		return json({ rule }, { status: 201 });
	} catch (error) {
		console.error('Failed to create cleanup rule:', error);
		return json({ error: 'Failed to create cleanup rule' }, { status: 500 });
	}
};
