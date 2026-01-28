import { redirect } from '@sveltejs/kit';
import { getAccountEmail, getTokensFromCode } from '$lib/server/gmail/oauth';
import { db } from '$lib/server/db';
import { actionHistory, emails, tokens } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	let accountEmail = '';

	if (!code) {
		throw redirect(302, '/?error=no_code');
	}

	try {
		const tokensData = await getTokensFromCode(code);

		if (!tokensData.access_token || !tokensData.refresh_token || !tokensData.expiry_date) {
			throw redirect(302, '/?error=invalid_tokens');
		}

		accountEmail = await getAccountEmail(tokensData);

		// Store tokens in database
		const existing = await db.select().from(tokens).where(eq(tokens.id, accountEmail)).get();
		const defaultAccount = await db.select().from(tokens).where(eq(tokens.id, 'default')).get();

		if (existing) {
			await db
				.update(tokens)
				.set({
					accessToken: tokensData.access_token,
					refreshToken: tokensData.refresh_token,
					expiresAt: new Date(tokensData.expiry_date)
				})
				.where(eq(tokens.id, accountEmail));
		} else if (defaultAccount) {
			await db
				.update(tokens)
				.set({
					id: accountEmail,
					accessToken: tokensData.access_token,
					refreshToken: tokensData.refresh_token,
					expiresAt: new Date(tokensData.expiry_date)
				})
				.where(eq(tokens.id, 'default'));
			await db
				.update(emails)
				.set({ accountId: accountEmail })
				.where(eq(emails.accountId, 'default'));
			await db
				.update(actionHistory)
				.set({ accountId: accountEmail })
				.where(eq(actionHistory.accountId, 'default'));
		} else {
			await db.insert(tokens).values({
				id: accountEmail,
				accessToken: tokensData.access_token,
				refreshToken: tokensData.refresh_token,
				expiresAt: new Date(tokensData.expiry_date)
			});
		}
	} catch (error) {
		console.error('Auth callback error:', error);
		throw redirect(302, '/?error=auth_failed');
	}

	throw redirect(302, `/?success=authenticated&accountId=${encodeURIComponent(accountEmail)}`);
};
