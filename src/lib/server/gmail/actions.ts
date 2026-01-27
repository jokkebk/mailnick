import { getGmailClient } from './client';
import type { gmail_v1 } from 'googleapis';

/**
 * Mark an email as read by removing the UNREAD label
 */
export async function markAsRead(messageId: string): Promise<void> {
	const gmail = await getGmailClient();
	await gmail.users.messages.modify({
		userId: 'me',
		id: messageId,
		requestBody: {
			removeLabelIds: ['UNREAD']
		}
	});
}

/**
 * Archive an email by removing the INBOX label
 */
export async function archiveEmail(messageId: string): Promise<void> {
	const gmail = await getGmailClient();
	await gmail.users.messages.modify({
		userId: 'me',
		id: messageId,
		requestBody: {
			removeLabelIds: ['INBOX']
		}
	});
}

/**
 * Move email to trash by adding TRASH label
 */
export async function trashEmail(messageId: string): Promise<void> {
	const gmail = await getGmailClient();
	await gmail.users.messages.trash({
		userId: 'me',
		id: messageId
	});
}

/**
 * Add a label to an email
 */
export async function addLabel(messageId: string, labelId: string): Promise<void> {
	const gmail = await getGmailClient();
	await gmail.users.messages.modify({
		userId: 'me',
		id: messageId,
		requestBody: {
			addLabelIds: [labelId]
		}
	});
}

/**
 * Remove a label from an email
 */
export async function removeLabel(messageId: string, labelId: string): Promise<void> {
	const gmail = await getGmailClient();
	await gmail.users.messages.modify({
		userId: 'me',
		id: messageId,
		requestBody: {
			removeLabelIds: [labelId]
		}
	});
}

/**
 * Ensure a label exists, create if it doesn't, and return the label ID
 */
export async function ensureLabelExists(labelName: string): Promise<string> {
	const gmail = await getGmailClient();

	// List all labels
	const { data } = await gmail.users.labels.list({
		userId: 'me'
	});

	// Check if label already exists
	const existingLabel = data.labels?.find(
		(label) => label.name?.toLowerCase() === labelName.toLowerCase()
	);

	if (existingLabel && existingLabel.id) {
		return existingLabel.id;
	}

	// Create the label if it doesn't exist
	const createResponse = await gmail.users.labels.create({
		userId: 'me',
		requestBody: {
			name: labelName,
			labelListVisibility: 'labelShow',
			messageListVisibility: 'show'
		}
	});

	if (!createResponse.data.id) {
		throw new Error('Failed to create label');
	}

	return createResponse.data.id;
}
