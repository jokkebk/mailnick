import { google } from 'googleapis';
import {
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GOOGLE_REDIRECT_URI
} from '$env/static/private';

const SCOPES = [
	'https://www.googleapis.com/auth/gmail.readonly', // Read emails
	'https://www.googleapis.com/auth/gmail.modify', // Mark as read, archive
	'https://www.googleapis.com/auth/gmail.labels' // Manage labels
];

export function getOAuth2Client() {
	return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function generateAuthUrl() {
	const oauth2Client = getOAuth2Client();
	return oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
		prompt: 'consent'
	});
}

export async function getTokensFromCode(code: string) {
	const oauth2Client = getOAuth2Client();
	const { tokens } = await oauth2Client.getToken(code);
	return tokens;
}
