import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emails, actionHistory } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { handleReauthCleanup, reauthResponse } from '$lib/server/gmail/reauth';
import { ACTION_EXPIRY_HOURS } from '$lib/constants';

type ActionType = 'mark_read' | 'archive' | 'trash' | 'label';
type EmailRow = typeof emails.$inferSelect;

interface ActionResult {
	dbUpdate?: Partial<typeof emails.$inferInsert>;
	extraState?: Record<string, unknown>;
	extraResponse?: Record<string, unknown>;
}

/**
 * Shared handler for email actions. Fetches the email, calls the provided
 * execute function, applies any DB updates, records action history, and
 * handles reauth errors uniformly.
 */
export async function performEmailAction(
	emailId: string,
	accountId: string,
	actionType: ActionType,
	execute: (email: EmailRow) => Promise<ActionResult | void>
): Promise<Response> {
	try {
		const email = await db
			.select()
			.from(emails)
			.where(and(eq(emails.id, emailId), eq(emails.accountId, accountId)))
			.get();

		if (!email) {
			return json({ error: 'Email not found' }, { status: 404 });
		}

		const originalState: Record<string, unknown> = {
			isUnread: email.isUnread,
			labelIds: email.labelIds
		};

		const result = await execute(email);
		const { dbUpdate, extraState, extraResponse } = result ?? {};

		if (dbUpdate) {
			await db
				.update(emails)
				.set(dbUpdate)
				.where(and(eq(emails.id, emailId), eq(emails.accountId, accountId)));
		}

		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + ACTION_EXPIRY_HOURS);

		const actionId = crypto.randomUUID();
		await db.insert(actionHistory).values({
			id: actionId,
			accountId,
			emailId,
			actionType,
			originalState: JSON.stringify({ ...originalState, ...extraState }),
			expiresAt
		});

		return json({ success: true, actionId, ...extraResponse });
	} catch (error) {
		if (await handleReauthCleanup(error, accountId)) {
			return json(reauthResponse(), { status: 401 });
		}
		console.error(`Email action '${actionType}' error:`, error);
		return json({ error: `Failed to perform action: ${actionType}` }, { status: 500 });
	}
}
