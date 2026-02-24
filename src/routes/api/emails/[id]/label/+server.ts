import { json } from '@sveltejs/kit';
import { addLabel, ensureLabelExists } from '$lib/server/gmail/actions';
import { performEmailAction } from '$lib/server/gmail/email-action';
import { getRequiredAccountId } from '$lib/server/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { id } = params;
	const accountId = getRequiredAccountId(url);
	if (accountId instanceof Response) return accountId;

	const { labelName } = await request.json();
	if (!labelName) {
		return json({ error: 'Label name is required' }, { status: 400 });
	}

	return performEmailAction(id, accountId, 'label', async (email) => {
		const labelId = await ensureLabelExists(accountId, labelName);
		await addLabel(accountId, id, labelId);

		const currentLabelIds: string[] = email.labelIds ? JSON.parse(email.labelIds) : [];
		if (!currentLabelIds.includes(labelId)) {
			currentLabelIds.push(labelId);
		}

		return {
			dbUpdate: { labelIds: JSON.stringify(currentLabelIds) },
			extraState: { addedLabelId: labelId },
			extraResponse: { labelId }
		};
	});
};
