import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '$env/static/private';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
	if (!GEMINI_API_KEY) return null;
	if (!client) {
		client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
	}
	return client;
}

export function isGeminiAvailable(): boolean {
	return Boolean(GEMINI_API_KEY);
}
