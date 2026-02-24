import { json } from '@sveltejs/kit';
import { archiveEmail, markAsRead } from '$lib/server/gmail/actions';
import { performEmailAction } from '$lib/server/gmail/email-action';
import { getRequiredAccountId } from '$lib/server/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	return performEmailAction(id, accountId, 'archive', async () => {
		await markAsRead(accountId, id);
		await archiveEmail(accountId, id);
		return { dbUpdate: { isUnread: false } };
	});
};
