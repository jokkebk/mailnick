<script lang="ts">
	import { onMount } from 'svelte';
	import EmailTable from '$lib/components/EmailTable.svelte';
	import ActionsTable from '$lib/components/ActionsTable.svelte';
	import CleanupTasksSection from '$lib/components/CleanupTasksSection.svelte';
	import AIGroupCards from '$lib/components/AIGroupCards.svelte';
	import { formatDate } from '$lib/utils/format';
	import { STORAGE_KEYS } from '$lib/constants';
	import { AuthState } from '$lib/stores/auth.svelte.js';
	import { EmailState } from '$lib/stores/email.svelte.js';
	import { AIState } from '$lib/stores/ai.svelte.js';

	const authState = new AuthState();
	const emailState = new EmailState(authState);
	const aiState = new AIState(authState, emailState);
	authState.bindEmailState(emailState);

	let showSyncOptions = $state(false);

	// Auto-dismiss success toasts after 3 seconds
	$effect(() => {
		const msg = authState.successMessage || emailState.successMessage;
		if (!msg) return;
		const timer = setTimeout(() => {
			authState.successMessage = null;
			emailState.successMessage = null;
		}, 3000);
		return () => clearTimeout(timer);
	});

	// Auto-clear AI groups when all grouped emails have been acted on
	$effect(() => {
		if (aiState.aiGroups.length === 0) return;
		const emailIds = new Set(emailState.emails.map((e) => e.id));
		const hasAny = aiState.aiGroups.some((g) => g.emailIds.some((id) => emailIds.has(id)));
		if (!hasAny) {
			aiState.aiGroups = [];
		}
	});

	onMount(async () => {
		const storedDays = localStorage.getItem(STORAGE_KEYS.syncDays);
		if (storedDays) {
			emailState.syncDays = parseInt(storedDays, 10);
		}

		aiState.checkAIAvailability();

		const params = new URLSearchParams(window.location.search);
		const justAuthenticated = params.get('success') === 'authenticated';
		const accountParam = params.get('accountId');

		if (justAuthenticated) {
			emailState.successMessage = 'Successfully authenticated with Gmail! Syncing emails...';
		} else if (params.get('error')) {
			authState.error = `Authentication error: ${params.get('error')}`;
		}

		await authState.loadAccounts(accountParam);

		if (justAuthenticated && authState.selectedAccountId) {
			window.history.replaceState({}, '', '/');
			await emailState.syncEmails();
		} else if (authState.selectedAccountId) {
			await emailState.loadEmails();
		}
	});

	const error = $derived(authState.error || emailState.error);
	const successMessage = $derived(authState.successMessage || emailState.successMessage);
</script>

<nav class="navbar navbar-expand navbar-dark bg-dark mb-4">
	<div class="container-fluid">
		<span class="navbar-brand mb-0 h1">📧 MailNick</span>
		<div class="ml-auto d-flex align-items-center" style="gap: 0.5rem;">
			{#if authState.accounts.length > 0}
				<select
					class="form-control form-control-sm mr-2"
					style="width: auto; max-width: 250px;"
					value={authState.selectedAccountId}
					onchange={(event) => {
						const previousId = authState.selectedAccountId;
						authState.setActiveAccount(
							(event.currentTarget as HTMLSelectElement).value,
							previousId
						);
					}}
				>
					{#each authState.accounts as account}
						<option value={account}>{account}</option>
					{/each}
				</select>
				<button
					class="btn btn-outline-danger btn-sm mr-2"
					onclick={() => authState.handleDeleteAccount()}
				>
					Delete
				</button>
			{/if}
			<a class="btn btn-outline-light btn-sm mr-2" href="/auth">Add account</a>
			{#if authState.authenticated}
				<div class="btn-group btn-group-sm">
					<button
						class="btn btn-primary btn-sm"
						onclick={() => { showSyncOptions = false; emailState.syncEmails(); }}
						disabled={emailState.syncing}
					>
						{emailState.syncing ? 'Syncing...' : `Sync (${emailState.syncDays}d)`}
					</button>
					<button
						class="btn btn-primary btn-sm dropdown-toggle dropdown-toggle-split"
						onclick={() => (showSyncOptions = !showSyncOptions)}
						disabled={emailState.syncing}
					>
						<span class="sr-only">Toggle Dropdown</span>
					</button>
					{#if showSyncOptions}
						<div class="dropdown-menu show" style="position: absolute; right: 0; top: 100%;">
							<button class="dropdown-item" onclick={() => { showSyncOptions = false; emailState.syncEmails(3); }}>Last 3 days</button>
							<button class="dropdown-item" onclick={() => { showSyncOptions = false; emailState.syncEmails(7); }}>Last 7 days</button>
							<button class="dropdown-item" onclick={() => { showSyncOptions = false; emailState.syncEmails(14); }}>Last 14 days</button>
							<button class="dropdown-item" onclick={() => { showSyncOptions = false; emailState.syncEmails(30); }}>Last 30 days</button>
							<button class="dropdown-item" onclick={() => { showSyncOptions = false; emailState.syncEmails(90); }}>Last 90 days</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</nav>

<div class="container">
	{#if authState.reauthRequired}
		<div class="alert alert-warning alert-dismissible fade show" role="alert">
			<div class="d-flex justify-content-between align-items-center" style="gap: 1rem;">
				<div>{authState.reauthMessage}</div>
				<div class="btn-group btn-group-sm">
					<button
						class="btn btn-outline-secondary"
						onclick={() => authState.handleRetry()}
						disabled={authState.retrying}
					>
						{authState.retrying ? 'Retrying...' : 'Retry'}
					</button>
					<button
						class="btn btn-primary"
						onclick={() => (window.location.href = '/auth')}
						disabled={authState.retrying}
					>
						Re-authenticate
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="toast-fixed">
			<div class="alert alert-danger alert-dismissible fade show mb-0" role="alert">
				{error}
				<button
					type="button"
					class="close"
					onclick={() => { authState.error = null; emailState.error = null; }}
				>
					<span>&times;</span>
				</button>
			</div>
		</div>
	{/if}

	{#if successMessage}
		<div class="toast-fixed">
			<div class="alert alert-success alert-dismissible fade show mb-0" role="alert">
				{successMessage}
				<button
					type="button"
					class="close"
					onclick={() => { authState.successMessage = null; emailState.successMessage = null; }}
				>
					<span>&times;</span>
				</button>
			</div>
		</div>
	{/if}

	{#if !authState.authenticated && !emailState.loading}
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
	{:else if emailState.loading}
		<div class="text-center mt-5">
			<div class="spinner-border" role="status">
				<span class="sr-only">Loading...</span>
			</div>
		</div>
	{:else}
		<!-- Cleanup Tasks Section -->
		{#if authState.selectedAccountId}
			<div class="row mb-4">
				<div class="col-12">
					<CleanupTasksSection
						accountId={authState.selectedAccountId}
						emails={emailState.emails}
						onBatchAction={(ids, action, ruleId) => emailState.handleCleanupBatchAction(ids, action, ruleId)}
						onReloadEmails={() => emailState.loadEmails()}
					/>
				</div>
			</div>
		{/if}

		<!-- AI Groups Section -->
		{#if aiState.aiGroups.length > 0}
			<div class="row mb-4">
				<div class="col-12">
					<AIGroupCards
						groups={aiState.aiGroups}
						emails={emailState.emails}
						onBatchAction={(ids, action) => emailState.handleCleanupBatchAction(ids, action)}
						onDismiss={() => aiState.dismissAIGroups()}
					/>
				</div>
			</div>
		{/if}

		{#if aiState.aiGrouping}
			<div class="row mb-4">
				<div class="col-12">
					<div class="text-center p-4" style="background-color: #f0f4ff; border-radius: 4px;">
						<div class="spinner-border spinner-border-sm text-info mr-2" role="status">
							<span class="sr-only">Grouping...</span>
						</div>
						AI is analyzing your emails...
					</div>
				</div>
			</div>
		{/if}

		<!-- Unhandled Emails Section -->
		<div class="row mb-5">
			<div class="col-12">
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h3>
						Unhandled Emails ({emailState.emails.length})
						<small class="text-muted" style="font-size: 0.6em;">
							from last {emailState.syncDays} days
						</small>
					</h3>
				</div>

				<EmailTable
					emails={emailState.emails}
					syncDays={emailState.syncDays}
					onMarkRead={(id) => emailState.handleMarkRead(id)}
					onArchive={(id) => emailState.handleArchive(id)}
					onTrash={(id) => emailState.handleTrash(id)}
					onLabel={(id) => emailState.handleLabel(id)}
					onBatchMarkRead={(ids) => emailState.handleBatchMarkRead(ids)}
					onBatchArchive={(ids) => emailState.handleBatchArchive(ids)}
					onBatchTrash={(ids) => emailState.handleBatchTrash(ids)}
					onBatchLabel={(ids) => emailState.handleBatchLabel(ids)}
					onAIGroup={(ids) => aiState.handleAIGroup(ids)}
					aiAvailable={aiState.aiAvailable}
					aiGrouping={aiState.aiGrouping}
				/>
			</div>
		</div>

		<!-- Read Emails Section (with actions) -->
		<div class="row">
			<div class="col-12">
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h3>
						Recently Handled ({emailState.emailsWithActions.length})
						<small class="text-muted" style="font-size: 0.6em;">
							actions from last 2 days
						</small>
					</h3>
				</div>

				<ActionsTable
					emailsWithActions={emailState.emailsWithActions}
					onUndo={(id) => emailState.handleUndo(id)}
					onBatchUndo={(ids) => emailState.handleBatchUndo(ids)}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.toast-fixed {
		position: fixed;
		top: 4.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1050;
		width: 90%;
		max-width: 600px;
		pointer-events: auto;
	}
</style>
