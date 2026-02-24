import { json } from '@sveltejs/kit';

/** Returns the accountId from URL params, or a 400 Response if missing. */
export function getRequiredAccountId(url: URL): string | Response {
	const accountId = url.searchParams.get('accountId');
	if (!accountId) {
		return json({ error: 'Account ID is required' }, { status: 400 });
	}
	return accountId;
}
