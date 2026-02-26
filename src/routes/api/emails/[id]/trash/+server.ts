import { json } from '@sveltejs/kit';
import { trashEmail } from '$lib/server/gmail/actions';
import { performEmailAction } from '$lib/server/gmail/email-action';
import { getRequiredAccountId } from '$lib/server/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;
	const ruleId = url.searchParams.get('ruleId') || undefined;

	return performEmailAction(id, accountId, 'trash', async () => {
		await trashEmail(accountId, id);
	}, ruleId);
};
