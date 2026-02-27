import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
	if (!env.GEMINI_API_KEY) return null;
	if (!client) {
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	}
	return client;
}

export function isGeminiAvailable(): boolean {
	return Boolean(env.GEMINI_API_KEY);
}
