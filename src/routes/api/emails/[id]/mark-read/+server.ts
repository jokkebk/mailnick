import { json } from '@sveltejs/kit';
import { markAsRead } from '$lib/server/gmail/actions';
import { performEmailAction } from '$lib/server/gmail/email-action';
import { getRequiredAccountId } from '$lib/server/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	return performEmailAction(id, accountId, 'mark_read', async () => {
		await markAsRead(accountId, id);
		return { dbUpdate: { isUnread: false } };
	});
};
