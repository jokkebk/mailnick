import { STORAGE_KEYS } from '$lib/constants.js';

// Minimal interface to break circular dependency with EmailState
interface IEmailState {
	clearState(): void;
	loadEmails(): Promise<void>;
}

export class AuthState {
	accounts = $state<string[]>([]);
	selectedAccountId = $state<string | null>(null);
	authenticated = $state(false);
	reauthRequired = $state(false);
	reauthMessage = $state<string | null>(null);
	retrying = $state(false);
	error = $state<string | null>(null);
	successMessage = $state<string | null>(null);

	private emailState: IEmailState | null = null;

	bindEmailState(emailState: IEmailState) {
		this.emailState = emailState;
	}

	accountUrl(path: string): string {
		if (!this.selectedAccountId) return path;
		const connector = path.includes('?') ? '&' : '?';
		return `${path}${connector}accountId=${encodeURIComponent(this.selectedAccountId)}`;
	}

	private selectBestAccount(
		preferred: string | null,
		stored: string | null,
		availableAccounts: string[]
	): string {
		if (preferred && availableAccounts.includes(preferred)) return preferred;
		if (stored && availableAccounts.includes(stored)) return stored;
		return availableAccounts[0];
	}

	async loadAccounts(preferredAccountId?: string | null) {
		try {
			const response = await fetch('/api/accounts');
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to load accounts');
			}

			this.accounts = data.accounts || [];
			if (this.accounts.length > 0) {
				this.reauthRequired = false;
				this.reauthMessage = null;
			}
			if (this.accounts.length === 0) {
				this.selectedAccountId = null;
				this.authenticated = false;
				return;
			}

			const storedAccountId = localStorage.getItem(STORAGE_KEYS.accountId);
			const nextAccount = this.selectBestAccount(
				preferredAccountId ?? null,
				storedAccountId,
				this.accounts
			);
			this.selectedAccountId = nextAccount;
			localStorage.setItem(STORAGE_KEYS.accountId, nextAccount);
			this.authenticated = true;
		} catch (e) {
			console.error('Failed to load accounts:', e);
			this.error = e instanceof Error ? e.message : 'Failed to load accounts';
			this.accounts = [];
			this.selectedAccountId = null;
			this.authenticated = false;
		}
	}

	applyReauth(message?: string | null) {
		this.reauthRequired = true;
		this.reauthMessage = message || 'Re-authentication required';
		this.error = null;
		this.successMessage = null;
		this.authenticated = false;
		this.emailState?.clearState();
	}

	handleReauthFromResponse(response: Response, data: unknown): boolean {
		if (response.status !== 401) return false;
		const d = data as Record<string, unknown> | null;
		if (d?.code === 'reauth_required') {
			this.applyReauth(d?.error as string | null);
			return true;
		}
		return false;
	}

	async handleReauthFromResponses(responses: Response[]): Promise<boolean> {
		const authResponse = responses.find((r) => r.status === 401);
		if (!authResponse) return false;
		const data = await authResponse.json().catch(() => ({}));
		return this.handleReauthFromResponse(authResponse, data);
	}

	async setActiveAccount(accountId: string, previousAccountId: string | null) {
		if (accountId === previousAccountId) return;
		this.selectedAccountId = accountId;
		localStorage.setItem(STORAGE_KEYS.accountId, accountId);
		this.successMessage = null;
		this.emailState?.clearState();
		await this.emailState?.loadEmails();
	}

	async handleDeleteAccount() {
		if (!this.selectedAccountId) return;
		const confirmed = window.confirm(
			`Remove account ${this.selectedAccountId}? This deletes stored data.`
		);
		if (!confirmed) return;
		try {
			const response = await fetch(
				`/api/accounts/${encodeURIComponent(this.selectedAccountId)}`,
				{ method: 'DELETE' }
			);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to delete account');
			}
			this.successMessage = `Removed account ${this.selectedAccountId}`;
			await this.loadAccounts();
			if (this.selectedAccountId) {
				await this.emailState?.loadEmails();
			} else {
				this.emailState?.clearState();
			}
		} catch (e) {
			console.error('Delete account error:', e);
			this.error = 'Failed to delete account';
		}
	}

	async handleRetry() {
		this.retrying = true;
		try {
			this.reauthRequired = false;
			this.reauthMessage = null;
			await this.loadAccounts(this.selectedAccountId);
			if (this.selectedAccountId) {
				await this.emailState?.loadEmails();
			}
		} finally {
			this.retrying = false;
		}
	}
}
