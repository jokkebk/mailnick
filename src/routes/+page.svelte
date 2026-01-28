<script lang="ts">
	import { onMount } from 'svelte';
	import EmailTable from '$lib/components/EmailTable.svelte';
	import ActionsTable from '$lib/components/ActionsTable.svelte';

	interface Email {
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
	}

	interface ActionHistory {
		id: string;
		emailId: string;
		actionType: string;
		originalState: string;
		timestamp: string;
		undone: boolean;
		expiresAt: string;
	}

	interface EmailWithAction {
		email: Email;
		action: ActionHistory;
	}

	let accounts = $state<string[]>([]);
	let selectedAccountId = $state<string | null>(null);
	let authenticated = $state(false);
	let emails = $state<Email[]>([]);
	let emailsWithActions = $state<EmailWithAction[]>([]);
	let loading = $state(false);
	let syncing = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let syncDays = $state(7); // Default to 7 days
	let showSyncOptions = $state(false);

	function accountUrl(path: string): string {
		if (!selectedAccountId) {
			return path;
		}
		const connector = path.includes('?') ? '&' : '?';
		return `${path}${connector}accountId=${encodeURIComponent(selectedAccountId)}`;
	}

	function selectBestAccount(
		preferred: string | null,
		stored: string | null,
		availableAccounts: string[]
	): string {
		if (preferred && availableAccounts.includes(preferred)) return preferred;
		if (stored && availableAccounts.includes(stored)) return stored;
		return availableAccounts[0];
	}

	async function loadAccounts(preferredAccountId?: string | null) {
		try {
			const response = await fetch('/api/accounts');
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to load accounts');
			}

			accounts = data.accounts || [];
			if (accounts.length === 0) {
				selectedAccountId = null;
				authenticated = false;
				return;
			}

			const storedAccountId = localStorage.getItem('mailnick.accountId');
			const nextAccount = selectBestAccount(preferredAccountId, storedAccountId, accounts);

			selectedAccountId = nextAccount;
			localStorage.setItem('mailnick.accountId', nextAccount);
			authenticated = true;
		} catch (e) {
			console.error('Failed to load accounts:', e);
			error = e instanceof Error ? e.message : 'Failed to load accounts';
			accounts = [];
			selectedAccountId = null;
			authenticated = false;
		}
	}

	onMount(async () => {
		// Load syncDays from localStorage
		const storedDays = localStorage.getItem('mailnick.syncDays');
		if (storedDays) {
			syncDays = parseInt(storedDays, 10);
		}

		// Check URL params for auth status
		const params = new URLSearchParams(window.location.search);
		const justAuthenticated = params.get('success') === 'authenticated';
		const accountParam = params.get('accountId');

		if (justAuthenticated) {
			successMessage = 'Successfully authenticated with Gmail! Syncing emails...';
		} else if (params.get('error')) {
			error = `Authentication error: ${params.get('error')}`;
		}

		await loadAccounts(accountParam);

		if (justAuthenticated && selectedAccountId) {
			// Clean up URL
			window.history.replaceState({}, '', '/');
			// Automatically sync emails after authentication
			await syncEmails();
		} else if (selectedAccountId) {
			await loadEmails();
		}
	});

	async function loadEmails() {
		if (!selectedAccountId) {
			emails = [];
			emailsWithActions = [];
			authenticated = false;
			return;
		}

		loading = true;
		error = null;
		try {
			// Fetch unhandled emails (unread emails without any actions)
			const unreadResponse = await fetch(
				accountUrl(`/api/emails?unreadOnly=true&days=${syncDays}`)
			);
			const unreadData = await unreadResponse.json();

			// Fetch emails with actions
			const actionsResponse = await fetch(accountUrl('/api/emails/with-actions'));
			const actionsData = await actionsResponse.json();

			if (unreadResponse.ok && actionsResponse.ok) {
				emails = unreadData.emails;
				emailsWithActions = actionsData.emailsWithActions;
				authenticated = true;
			} else {
				error = unreadData.error || actionsData.error || 'Failed to load emails';
				authenticated = Boolean(selectedAccountId);
			}
		} catch (e) {
			console.error('Failed to load emails:', e);
			authenticated = Boolean(selectedAccountId);
		} finally {
			loading = false;
		}
	}

	async function syncEmails(days?: number) {
		if (!selectedAccountId) {
			error = 'Select an account before syncing.';
			return;
		}

		const daysToSync = days || syncDays;
		syncing = true;
		error = null;
		successMessage = null;
		showSyncOptions = false;
		try {
			const response = await fetch('/api/emails/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ days: daysToSync, accountId: selectedAccountId })
			});
			const data = await response.json();

			if (response.ok) {
				syncDays = daysToSync; // Update current sync period
				localStorage.setItem('mailnick.syncDays', daysToSync.toString());
				successMessage = `Synced ${data.syncedCount} new emails from last ${daysToSync} days (${data.totalUnread} total found)`;
				await loadEmails();
			} else {
				error = data.error || 'Failed to sync emails';
			}
		} catch (e) {
			error = 'Failed to sync emails';
			console.error('Sync error:', e);
		} finally {
			syncing = false;
		}
	}

	async function setActiveAccount(accountId: string) {
		if (accountId === selectedAccountId) {
			return;
		}
		selectedAccountId = accountId;
		localStorage.setItem('mailnick.accountId', accountId);
		emails = [];
		emailsWithActions = [];
		successMessage = null;
		showSyncOptions = false;
		await loadEmails();
	}

	async function handleDeleteAccount() {
		if (!selectedAccountId) {
			return;
		}
		const confirmed = window.confirm(`Remove account ${selectedAccountId}? This deletes stored data.`);
		if (!confirmed) {
			return;
		}
		try {
			const response = await fetch(
				`/api/accounts/${encodeURIComponent(selectedAccountId)}`,
				{ method: 'DELETE' }
			);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to delete account');
			}
			successMessage = `Removed account ${selectedAccountId}`;
			await loadAccounts();
			if (selectedAccountId) {
				await loadEmails();
			} else {
				emails = [];
				emailsWithActions = [];
			}
		} catch (e) {
			console.error('Delete account error:', e);
			error = 'Failed to delete account';
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));

		if (hours < 1) {
			const minutes = Math.floor(diff / (1000 * 60));
			return `${minutes}m ago`;
		} else if (hours < 24) {
			return `${hours}h ago`;
		} else {
			const days = Math.floor(hours / 24);
			return `${days}d ago`;
		}
	}

	// Action handlers
	async function handleMarkRead(emailId: string) {
		if (!selectedAccountId) return;
		const email = emails.find((e) => e.id === emailId);
		if (!email || !email.isUnread) return;

		// Optimistically remove from list
		emails = emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(accountUrl(`/api/emails/${emailId}/mark-read`), {
				method: 'POST'
			});
			if (!response.ok) throw new Error('Failed');

			// Reload both unhandled and action lists
			await loadEmails();
			successMessage = 'Email marked as read';
		} catch (err) {
			error = 'Failed to mark as read';
			// Reload to restore state on error
			await loadEmails();
		}
	}

	async function handleArchive(emailId: string) {
		if (!selectedAccountId) return;
		const email = emails.find((e) => e.id === emailId);
		if (!email) return;

		// Optimistically remove from list
		emails = emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(accountUrl(`/api/emails/${emailId}/archive`), {
				method: 'POST'
			});
			if (!response.ok) throw new Error('Failed');

			await loadEmails();
			successMessage = 'Email archived';
		} catch (err) {
			error = 'Failed to archive email';
			await loadEmails();
		}
	}

	async function handleTrash(emailId: string) {
		if (!selectedAccountId) return;
		const email = emails.find((e) => e.id === emailId);
		if (!email) return;

		// Optimistically remove from list
		emails = emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(accountUrl(`/api/emails/${emailId}/trash`), { method: 'POST' });
			if (!response.ok) throw new Error('Failed');

			await loadEmails();
			successMessage = 'Email moved to trash';
		} catch (err) {
			error = 'Failed to trash email';
			await loadEmails();
		}
	}

	async function handleLabel(emailId: string) {
		if (!selectedAccountId) return;
		const email = emails.find((e) => e.id === emailId);
		if (!email) return;

		// Optimistically remove from list (label action marks as "handled")
		emails = emails.filter((e) => e.id !== emailId);

		try {
			const response = await fetch(accountUrl(`/api/emails/${emailId}/label`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labelName: 'TODO' })
			});
			if (!response.ok) throw new Error('Failed');

			await loadEmails();
			successMessage = 'TODO label added';
		} catch (err) {
			error = 'Failed to add label';
			await loadEmails();
		}
	}

	// Batch action handlers
	async function handleBatchMarkRead(emailIds: string[]) {
		if (!selectedAccountId) return;

		// Optimistically remove from list
		emails = emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(accountUrl(`/api/emails/${id}/mark-read`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			const failedCount = results.filter((r) => !r.ok).length;

			if (failedCount > 0) {
				throw new Error(`${failedCount} email(s) failed`);
			}

			await loadEmails();
			successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} marked as read`;
		} catch (err) {
			error = `Failed to mark emails as read`;
			await loadEmails();
			throw err;
		}
	}

	async function handleBatchArchive(emailIds: string[]) {
		if (!selectedAccountId) return;

		// Optimistically remove from list
		emails = emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(accountUrl(`/api/emails/${id}/archive`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			const failedCount = results.filter((r) => !r.ok).length;

			if (failedCount > 0) {
				throw new Error(`${failedCount} email(s) failed`);
			}

			await loadEmails();
			successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} archived`;
		} catch (err) {
			error = `Failed to archive emails`;
			await loadEmails();
			throw err;
		}
	}

	async function handleBatchTrash(emailIds: string[]) {
		if (!selectedAccountId) return;

		// Optimistically remove from list
		emails = emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(accountUrl(`/api/emails/${id}/trash`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			const failedCount = results.filter((r) => !r.ok).length;

			if (failedCount > 0) {
				throw new Error(`${failedCount} email(s) failed`);
			}

			await loadEmails();
			successMessage = `${emailIds.length} email${emailIds.length !== 1 ? 's' : ''} moved to trash`;
		} catch (err) {
			error = `Failed to trash emails`;
			await loadEmails();
			throw err;
		}
	}

	async function handleBatchLabel(emailIds: string[]) {
		if (!selectedAccountId) return;

		// Optimistically remove from list (label action marks as "handled")
		emails = emails.filter((e) => !emailIds.includes(e.id));

		const promises = emailIds.map((id) =>
			fetch(accountUrl(`/api/emails/${id}/label`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labelName: 'TODO' })
			})
		);

		try {
			const results = await Promise.all(promises);
			const failedCount = results.filter((r) => !r.ok).length;

			if (failedCount > 0) {
				throw new Error(`${failedCount} email(s) failed`);
			}

			await loadEmails();
			successMessage = `TODO label added to ${emailIds.length} email${emailIds.length !== 1 ? 's' : ''}`;
		} catch (err) {
			error = `Failed to add labels`;
			await loadEmails();
			throw err;
		}
	}

	async function handleUndo(actionId: string) {
		if (!selectedAccountId) return;
		try {
			const response = await fetch(accountUrl(`/api/actions/${actionId}/undo`), {
				method: 'POST'
			});
			if (!response.ok) throw new Error('Failed to undo');

			await loadEmails();
			successMessage = 'Action undone';
		} catch (err) {
			error = 'Failed to undo action';
		}
	}

	async function handleBatchUndo(actionIds: string[]) {
		if (!selectedAccountId) return;

		const promises = actionIds.map((id) =>
			fetch(accountUrl(`/api/actions/${id}/undo`), { method: 'POST' })
		);

		try {
			const results = await Promise.all(promises);
			const failedCount = results.filter((r) => !r.ok).length;

			if (failedCount > 0) {
				throw new Error(`${failedCount} action(s) failed`);
			}

			await loadEmails();
			successMessage = `${actionIds.length} action${actionIds.length !== 1 ? 's' : ''} undone`;
		} catch (err) {
			error = `Failed to undo actions`;
			await loadEmails();
			throw err;
		}
	}

</script>

<nav class="navbar navbar-expand navbar-dark bg-dark mb-4">
	<div class="container-fluid">
		<span class="navbar-brand mb-0 h1">📧 MailNick</span>
		<div class="ml-auto d-flex align-items-center" style="gap: 0.5rem;">
			{#if accounts.length > 0}
				<select
					class="form-control form-control-sm mr-2"
					style="width: auto; max-width: 250px;"
					bind:value={selectedAccountId}
					onchange={(event) =>
						setActiveAccount((event.currentTarget as HTMLSelectElement).value)
					}
				>
					{#each accounts as account}
						<option value={account}>{account}</option>
					{/each}
				</select>
				<button class="btn btn-outline-danger btn-sm mr-2" onclick={handleDeleteAccount}>
					Delete
				</button>
			{/if}
			<a class="btn btn-outline-light btn-sm mr-2" href="/auth">Add account</a>
			{#if authenticated}
				<div class="btn-group btn-group-sm">
					<button class="btn btn-primary btn-sm" onclick={() => syncEmails()} disabled={syncing}>
						{syncing ? 'Syncing...' : `Sync (${syncDays}d)`}
					</button>
					<button
						class="btn btn-primary btn-sm dropdown-toggle dropdown-toggle-split"
						onclick={() => (showSyncOptions = !showSyncOptions)}
						disabled={syncing}
					>
						<span class="sr-only">Toggle Dropdown</span>
					</button>
					{#if showSyncOptions}
						<div class="dropdown-menu show" style="position: absolute; right: 0; top: 100%;">
							<button class="dropdown-item" onclick={() => syncEmails(3)}>Last 3 days</button>
							<button class="dropdown-item" onclick={() => syncEmails(7)}>Last 7 days</button>
							<button class="dropdown-item" onclick={() => syncEmails(14)}>Last 14 days</button>
							<button class="dropdown-item" onclick={() => syncEmails(30)}>Last 30 days</button>
							<button class="dropdown-item" onclick={() => syncEmails(90)}>Last 90 days</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</nav>

<div class="container">
		{#if error}
			<div class="alert alert-danger alert-dismissible fade show" role="alert">
				{error}
				<button type="button" class="close" onclick={() => (error = null)}>
					<span>&times;</span>
				</button>
			</div>
		{/if}

		{#if successMessage}
			<div class="alert alert-success alert-dismissible fade show" role="alert">
				{successMessage}
				<button type="button" class="close" onclick={() => (successMessage = null)}>
					<span>&times;</span>
				</button>
			</div>
		{/if}

		{#if !authenticated && !loading}
			<div class="row justify-content-center mt-5">
				<div class="col-md-6 text-center">
					<div class="card">
						<div class="card-body">
							<h2 class="card-title">Welcome to MailNick</h2>
							<p class="card-text">
								Connect your Gmail account to start managing your inbox with intelligent
								categorization.
							</p>
							<a href="/auth" class="btn btn-primary btn-lg"> Connect Gmail Account </a>
						</div>
					</div>
				</div>
			</div>
		{:else if loading}
			<div class="text-center mt-5">
				<div class="spinner-border" role="status">
					<span class="sr-only">Loading...</span>
				</div>
			</div>
		{:else}
			<!-- Unhandled Emails Section -->
			<div class="row mb-5">
				<div class="col-12">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h3>
							Unhandled Emails ({emails.length})
							<small class="text-muted" style="font-size: 0.6em;">
								from last {syncDays} days
							</small>
						</h3>
					</div>

					<EmailTable
						{emails}
						{syncDays}
						onMarkRead={handleMarkRead}
						onArchive={handleArchive}
						onTrash={handleTrash}
						onLabel={handleLabel}
						onBatchMarkRead={handleBatchMarkRead}
						onBatchArchive={handleBatchArchive}
						onBatchTrash={handleBatchTrash}
						onBatchLabel={handleBatchLabel}
					/>
				</div>
			</div>

			<!-- Read Emails Section (with actions) -->
			<div class="row">
				<div class="col-12">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h3>
							Recently Handled ({emailsWithActions.length})
							<small class="text-muted" style="font-size: 0.6em;">
								actions from last 2 days
							</small>
						</h3>
					</div>

					<ActionsTable
						{emailsWithActions}
						onUndo={handleUndo}
						onBatchUndo={handleBatchUndo}
					/>
				</div>
			</div>
		{/if}
	</div>
