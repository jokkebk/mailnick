import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { actionHistory } from '$lib/server/db/schema';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { getRequiredAccountId } from '$lib/server/utils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	try {
		const rows = await db
			.select({
				ruleId: actionHistory.ruleId,
				actionType: actionHistory.actionType,
				count: sql<number>`COUNT(*)`.as('count')
			})
			.from(actionHistory)
			.where(
				and(
					eq(actionHistory.accountId, accountId),
					isNotNull(actionHistory.ruleId),
					eq(actionHistory.undone, false)
				)
			)
			.groupBy(actionHistory.ruleId, actionHistory.actionType)
			.all();

		// Group by ruleId: { [ruleId]: { archive: 5, trash: 2, ... } }
		const stats: Record<string, Record<string, number>> = {};
		for (const row of rows) {
			if (!row.ruleId) continue;
			if (!stats[row.ruleId]) stats[row.ruleId] = {};
			stats[row.ruleId][row.actionType] = row.count;
		}

		return json({ stats });
	} catch (error) {
		console.error('Fetch rule stats error:', error);
		return json({ error: 'Failed to fetch rule stats' }, { status: 500 });
	}
};
