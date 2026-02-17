import { json } from '@sveltejs/kit';
import { isGeminiAvailable } from '$lib/server/gemini/client';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ available: isGeminiAvailable() });
};
