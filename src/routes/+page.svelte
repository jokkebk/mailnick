<script lang="ts">
	import { onMount } from 'svelte';

	interface Email {
		id: string;
		from: string;
		fromDomain: string;
		subject: string | null;
		snippet: string | null;
		receivedAt: string;
		isUnread: boolean;
		category: string | null;
	}

	let authenticated = $state(false);
	let emails = $state<Email[]>([]);
	let loading = $state(false);
	let syncing = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	onMount(async () => {
		// Check URL params for auth status
		const params = new URLSearchParams(window.location.search);
		if (params.get('success') === 'authenticated') {
			successMessage = 'Successfully authenticated with Gmail!';
			authenticated = true;
			// Clean up URL
			window.history.replaceState({}, '', '/');
		} else if (params.get('error')) {
			error = `Authentication error: ${params.get('error')}`;
		}

		// Try to fetch emails to check if authenticated
		await loadEmails();
	});

	async function loadEmails() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/emails?unreadOnly=true');
			const data = await response.json();

			if (response.ok) {
				emails = data.emails;
				authenticated = true;
			} else {
				authenticated = false;
			}
		} catch (e) {
			console.error('Failed to load emails:', e);
			authenticated = false;
		} finally {
			loading = false;
		}
	}

	async function syncEmails() {
		syncing = true;
		error = null;
		successMessage = null;
		try {
			const response = await fetch('/api/emails/sync', { method: 'POST' });
			const data = await response.json();

			if (response.ok) {
				successMessage = `Synced ${data.syncedCount} new emails (${data.totalUnread} total unread)`;
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
</script>

<div class="container-fluid">
	<nav class="navbar navbar-dark bg-dark mb-4">
		<div class="container-fluid">
			<span class="navbar-brand mb-0 h1">📧 MailNick</span>
			{#if authenticated}
				<div>
					<button class="btn btn-primary" onclick={syncEmails} disabled={syncing}>
						{syncing ? 'Syncing...' : 'Sync Emails'}
					</button>
				</div>
			{/if}
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
			<div class="row">
				<div class="col-12">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h3>Unread Emails ({emails.length})</h3>
					</div>

					{#if emails.length === 0}
						<div class="alert alert-info">
							No unread emails found. Click "Sync Emails" to fetch the latest emails from Gmail.
						</div>
					{:else}
						<div class="list-group">
							{#each emails as email (email.id)}
								<div class="list-group-item list-group-item-action">
									<div class="d-flex w-100 justify-content-between">
										<h5 class="mb-1">
											{email.subject || '(No subject)'}
											{#if email.isUnread}
												<span class="badge badge-primary ml-2">Unread</span>
											{/if}
										</h5>
										<small>{formatDate(email.receivedAt)}</small>
									</div>
									<p class="mb-1">
										<strong>From:</strong>
										{email.from}
										<span class="badge badge-secondary ml-2">{email.fromDomain}</span>
									</p>
									<p class="mb-1 text-muted">{email.snippet}</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
