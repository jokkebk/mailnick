import { redirect } from '@sveltejs/kit';
import { generateAuthUrl } from '$lib/server/gmail/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const authUrl = generateAuthUrl();
	throw redirect(302, authUrl);
};
