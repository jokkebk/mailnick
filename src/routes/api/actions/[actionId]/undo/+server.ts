import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getGmailClient } from '$lib/server/gmail/client';
import { removeLabel } from '$lib/server/gmail/actions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url }) => {
	const { actionId } = params;
	const accountId = url.searchParams.get('accountId');

	try {
		if (!accountId) {
			return json({ error: 'Account ID is required' }, { status: 400 });
		}

		// Fetch action from actionHistory
		const action = await db
			.select()
			.from(actionHistory)
			.where(and(eq(actionHistory.id, actionId), eq(actionHistory.accountId, accountId)))
			.get();

		if (!action) {
			return json({ error: 'Action not found' }, { status: 404 });
		}

		// Verify: not undone, not expired
		if (action.undone) {
			return json({ error: 'Action already undone' }, { status: 400 });
		}

		if (action.expiresAt < new Date()) {
			return json({ error: 'Action expired' }, { status: 400 });
		}

		// Parse originalState JSON
		const originalState = JSON.parse(action.originalState);

		const gmail = await getGmailClient(accountId);

		// Reverse Gmail API call based on action type
		switch (action.actionType) {
			case 'mark_read':
				// Add UNREAD label back
				if (originalState.isUnread) {
					await gmail.users.messages.modify({
						userId: 'me',
						id: action.emailId,
						requestBody: {
							addLabelIds: ['UNREAD']
						}
					});
					await db
						.update(emails)
						.set({ isUnread: true })
						.where(and(eq(emails.id, action.emailId), eq(emails.accountId, accountId)));
				}
				break;

			case 'archive':
				// Add INBOX label back and restore unread status
				const labelsToAdd = ['INBOX'];
				if (originalState.isUnread) {
					labelsToAdd.push('UNREAD');
				}
				await gmail.users.messages.modify({
					userId: 'me',
					id: action.emailId,
					requestBody: {
						addLabelIds: labelsToAdd
					}
				});
				await db
					.update(emails)
					.set({ isUnread: originalState.isUnread })
					.where(and(eq(emails.id, action.emailId), eq(emails.accountId, accountId)));
				break;

			case 'trash':
				// Remove TRASH label (untrash)
				await gmail.users.messages.untrash({
					userId: 'me',
					id: action.emailId
				});
				break;

			case 'label':
				// Remove the added label
				if (originalState.addedLabelId) {
					await removeLabel(accountId, action.emailId, originalState.addedLabelId);

					// Update local DB
					const email = await db
						.select()
						.from(emails)
						.where(and(eq(emails.id, action.emailId), eq(emails.accountId, accountId)))
						.get();
					if (email && email.labelIds) {
						const currentLabelIds = JSON.parse(email.labelIds);
						const updatedLabelIds = currentLabelIds.filter(
							(id: string) => id !== originalState.addedLabelId
						);
						await db
							.update(emails)
							.set({ labelIds: JSON.stringify(updatedLabelIds) })
							.where(and(eq(emails.id, action.emailId), eq(emails.accountId, accountId)));
					}
				}
				break;

			default:
				return json({ error: 'Unknown action type' }, { status: 400 });
		}

		// Mark action as undone
		await db
			.update(actionHistory)
			.set({ undone: true })
			.where(and(eq(actionHistory.id, actionId), eq(actionHistory.accountId, accountId)));

		return json({ success: true });
	} catch (error) {
		console.error('Undo error:', error);
		return json({ error: 'Failed to undo action' }, { status: 500 });
	}
};
