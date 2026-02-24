import type { AuthState } from './auth.svelte.js';
import { STORAGE_KEYS } from '$lib/constants.js';

export interface Email {
	id: string;
	from: string;
	fromDomain: string;
	to: string | null;
	subject: string | null;
	snippet: string | null;
	receivedAt: string;
	isUnread: boolean;
	labelIds: string;
	category: string | null;
	expanded?: boolean;
	processing?: boolean;
	[key: string]: unknown;
}

export interface ActionHistory {
	id: string;
	emailId: string;
	actionType: string;
	originalState: string;
	timestamp: string;
	undone: boolean;
	expiresAt: string;
}

export interface EmailWithAction {
	email: Email;
	action: ActionHistory;
}

export class EmailState {
	emails = $state<Email[]>([]);
	emailsWithActions = $state<EmailWithAction[]>([]);
	loading = $state(false);
	syncing = $state(false);
	syncDays = $state(7);
	error = $state<string | null>(null);
	successMessage = $state<string | null>(null);

	constructor(private auth: AuthState) {}

	clearState() {
		this.emails = [];
		this.emailsWithActions = [];
	}

	async loadEmails() {
		if (!this.auth.selectedAccountId) {
			this.clearState();
			this.auth.authenticated = false;
			return;
		}

		this.loading = true;
		this.error = null;
		try {
			const unreadResponse = await fetch(
				this.auth.accountUrl(`/api/emails?unreadOnly=true&days=${this.syncDays}`)
			);
			const unreadData = await unreadResponse.json().catch(() => ({}));

			const actionsResponse = await fetch(this.auth.accountUrl('/api/emails/with-actions'));
			const actionsData = await actionsResponse.json().catch(() => ({}));

			if (
				this.auth.handleReauthFromResponse(unreadResponse, unreadData) ||
				this.auth.handleReauthFromResponse(actionsResponse, actionsData)
			) {
				return;
			}

			if (unreadResponse.ok && actionsResponse.ok) {
				this.emails = unreadData.emails;
				this.emailsWithActions = actionsData.emailsWithActions;
				this.auth.authenticated = true;
				this.auth.reauthRequired = false;
				this.auth.reauthMessage = null;
			} else {
				this.error = unreadData.error || actionsData.error || 'Failed to load emails';
				this.auth.authenticated = Boolean(this.auth.selectedAccountId);
			}
		} catch (e) {
			console.error('Failed to load emails:', e);
			this.auth.authenticated = Boolean(this.auth.selectedAccountId);
		} finally {
			this.loading = false;
		}
	}

	async syncEmails(days?: number) {
		if (!this.auth.selectedAccountId) {
			this.error = 'Select an account before syncing.';
			return;
		}

		const daysToSync = days || this.syncDays;
		this.syncing = true;
		this.error = null;
		this.successMessage = null;
		try {
			const response = await fetch('/api/emails/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ days: daysToSync, accountId: this.auth.selectedAccountId })
			});
			const data = await response.json().catch(() => ({}));

			if (this.auth.handleReauthFromResponse(response, data)) return;

			if (response.ok) {
				this.auth.reauthRequired = false;
				this.auth.reauthMessage = null;
				this.syncDays = daysToSync;
				localStorage.setItem(STORAGE_KEYS.syncDays, daysToSync.toString());
				this.successMessage = `Synced ${data.syncedCount} new emails from last ${daysToSync} days (${data.totalUnread} total found)`;
				this.clearHiddenTasks();
				await this.loadEmails();
			} else {
				this.error = data.error || 'Failed to sync emails';
			}
		} catch (e) {
			this.error = 'Failed to sync emails';
			console.error('Sync error:', e);
		} finally {
			this.syncing = false;
		}
	}

	clearHiddenTasks() {
		if (!this.auth.selectedAccountId) return;
		localStorage.removeItem(STORAGE_KEYS.hiddenTasks(this.auth.selectedAccountId));
	}

	async handleMarkRead(emailId: string) {
		if (!this.auth.selectedAccountId) return;
		const email = this.emails.find((e) => e.id === emailId);
		if (!email || !email.isUnread) return;

		this.emails = this.emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(this.auth.accountUrl(`/api/emails/${emailId}/mark-read`), {
				method: 'POST'
			});
			const data = await response.json().catch(() => ({}));
			if (this.auth.handleReauthFromResponse(response, data)) return;
			if (!response.ok) throw new Error('Failed');

			await this.loadEmails();
			this.successMessage = 'Email marked as read';
		} catch {
			this.error = 'Failed to mark as read';
			await this.loadEmails();
		}
	}

	async handleArchive(emailId: string) {
		if (!this.auth.selectedAccountId) return;
		const email = this.emails.find((e) => e.id === emailId);
		if (!email) return;

		this.emails = this.emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(this.auth.accountUrl(`/api/emails/${emailId}/archive`), {
				method: 'POST'
			});
			const data = await response.json().catch(() => ({}));
			if (this.auth.handleReauthFromResponse(response, data)) return;
			if (!response.ok) throw new Error('Failed');

			await this.loadEmails();
			this.successMessage = 'Email archived';
		} catch {
			this.error = 'Failed to archive email';
			await this.loadEmails();
		}
	}

	async handleTrash(emailId: string) {
		if (!this.auth.selectedAccountId) return;
		const email = this.emails.find((e) => e.id === emailId);
		if (!email) return;

		this.emails = this.emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(this.auth.accountUrl(`/api/emails/${emailId}/trash`), {
				method: 'POST'
			});
			const data = await response.json().catch(() => ({}));
			if (this.auth.handleReauthFromResponse(response, data)) return;
			if (!response.ok) throw new Error('Failed');

			await this.loadEmails();
			this.successMessage = 'Email moved to trash';
		} catch {
			this.error = 'Failed to trash email';
			await this.loadEmails();
		}
	}

	async handleLabel(emailId: string) {
		if (!this.auth.selectedAccountId) return;
		const email = this.emails.find((e) => e.id === emailId);
		if (!email) return;

		this.emails = this.emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(this.auth.accountUrl(`/api/emails/${emailId}/label`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labelName: 'TODO' })
			});
			const data = await response.json().catch(() => ({}));
			if (this.auth.handleReauthFromResponse(response, data)) return;
			if (!response.ok) throw new Error('Failed');

			await this.loadEmails();
			this.successMessage = 'TODO label added';
		} catch {
			this.error = 'Failed to add label';
			await this.loadEmails();
		}
	}

	async handleBatchMarkRead(emailIds: string[]) {
		if (!this.auth.selectedAccountId) return;

		this.emails = this.emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(this.auth.accountUrl(`/api/emails/${id}/mark-read`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			if (await this.auth.handleReauthFromResponses(results)) return;
			const failedCount = results.filter((r) => !r.ok).length;
			if (failedCount > 0) throw new Error(`${failedCount} email(s) failed`);

			await this.loadEmails();
			this.successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} marked as read`;
		} catch (err) {
			this.error = 'Failed to mark emails as read';
			await this.loadEmails();
			throw err;
		}
	}

	async handleBatchArchive(emailIds: string[]) {
		if (!this.auth.selectedAccountId) return;

		this.emails = this.emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(this.auth.accountUrl(`/api/emails/${id}/archive`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			if (await this.auth.handleReauthFromResponses(results)) return;
			const failedCount = results.filter((r) => !r.ok).length;
			if (failedCount > 0) throw new Error(`${failedCount} email(s) failed`);

			await this.loadEmails();
			this.successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} archived`;
		} catch (err) {
			this.error = 'Failed to archive emails';
			await this.loadEmails();
			throw err;
		}
	}

	async handleBatchTrash(emailIds: string[]) {
		if (!this.auth.selectedAccountId) return;

		this.emails = this.emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(this.auth.accountUrl(`/api/emails/${id}/trash`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			if (await this.auth.handleReauthFromResponses(results)) return;
			const failedCount = results.filter((r) => !r.ok).length;
			if (failedCount > 0) throw new Error(`${failedCount} email(s) failed`);

			await this.loadEmails();
			this.successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} moved to trash`;
		} catch (err) {
			this.error = 'Failed to trash emails';
			await this.loadEmails();
			throw err;
		}
	}

	async handleBatchLabel(emailIds: string[]) {
		if (!this.auth.selectedAccountId) return;

		this.emails = this.emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(this.auth.accountUrl(`/api/emails/${id}/label`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labelName: 'TODO' })
			})
		);

		try {
			const results = await Promise.all(promises);
			if (await this.auth.handleReauthFromResponses(results)) return;
			const failedCount = results.filter((r) => !r.ok).length;
			if (failedCount > 0) throw new Error(`${failedCount} email(s) failed`);

			await this.loadEmails();
			this.successMessage = `TODO label added to ${emailIds.length} email${emailIds.length !== 1 ? 's' : ''}`;
		} catch (err) {
			this.error = 'Failed to add labels';
			await this.loadEmails();
			throw err;
		}
	}

	async handleCleanupBatchAction(
		emailIds: string[],
		action: 'mark_read' | 'archive' | 'trash' | 'label'
	) {
		switch (action) {
			case 'mark_read':
				return this.handleBatchMarkRead(emailIds);
			case 'archive':
				return this.handleBatchArchive(emailIds);
			case 'trash':
				return this.handleBatchTrash(emailIds);
			case 'label':
				return this.handleBatchLabel(emailIds);
		}
	}

	async handleUndo(actionId: string) {
		if (!this.auth.selectedAccountId) return;
		try {
			const response = await fetch(this.auth.accountUrl(`/api/actions/${actionId}/undo`), {
				method: 'POST'
			});
			const data = await response.json().catch(() => ({}));
			if (this.auth.handleReauthFromResponse(response, data)) return;
			if (!response.ok) throw new Error('Failed to undo');

			await this.loadEmails();
			this.successMessage = 'Action undone';
		} catch {
			this.error = 'Failed to undo action';
		}
	}

	async handleBatchUndo(actionIds: string[]) {
		if (!this.auth.selectedAccountId) return;

		const promises = actionIds.map((id) =>
			fetch(this.auth.accountUrl(`/api/actions/${id}/undo`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			if (await this.auth.handleReauthFromResponses(results)) return;
			const failedCount = results.filter((r) => !r.ok).length;
			if (failedCount > 0) throw new Error(`${failedCount} action(s) failed`);

			await this.loadEmails();
			this.successMessage = `${actionIds.length} action${actionIds.length !== 1 ? 's' : ''} undone`;
		} catch (err) {
			this.error = 'Failed to undo actions';
			await this.loadEmails();
			throw err;
		}
	}
}
