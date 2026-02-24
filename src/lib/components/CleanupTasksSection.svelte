<script lang="ts">
	import { onMount } from 'svelte';
	import type { CleanupRule, TaskMatch } from '$lib/types/cleanup';
	import { groupEmailsByRules } from '$lib/utils/cleanup-matcher';
	import RuleEditorModal from './RuleEditorModal.svelte';
	import { STORAGE_KEYS } from '$lib/constants';

	interface Email {
		id: string;
		from: string;
		subject: string | null;
		[key: string]: unknown;
	}

	interface Props {
		accountId: string;
		emails: Email[];
		onBatchAction: (
			emailIds: string[],
			action: 'mark_read' | 'archive' | 'trash' | 'label'
		) => Promise<void>;
		onReloadEmails: () => Promise<void>;
	}

	let { accountId, emails, onBatchAction, onReloadEmails }: Props = $props();

	let rules = $state<CleanupRule[]>([]);
	let expandedTasks = $state<Set<string>>(new Set());
	let editingRuleId = $state<string | null>(null);
	let showEditor = $state(false);
	let processing = $state<Set<string>>(new Set());
	// Per-task selection: Map<ruleId, Set<emailId>>
	let selections = $state<Map<string, Set<string>>>(new Map());
	let hiddenTaskIds = $state<string[]>([]);

	function getSelection(ruleId: string): Set<string> {
		return selections.get(ruleId) ?? new Set();
	}

	function toggleItem(ruleId: string, emailId: string) {
		const current = new Set(getSelection(ruleId));
		if (current.has(emailId)) current.delete(emailId);
		else current.add(emailId);
		const next = new Map(selections);
		next.set(ruleId, current);
		selections = next;
	}

	function selectAll(ruleId: string, emailIds: string[]) {
		const next = new Map(selections);
		next.set(ruleId, new Set(emailIds));
		selections = next;
	}

	function selectNone(ruleId: string) {
		const next = new Map(selections);
		next.delete(ruleId);
		selections = next;
	}

	function getActionIds(ruleId: string, allIds: string[]): string[] {
		const sel = getSelection(ruleId);
		if (sel.size === 0) return allIds;
		return allIds.filter((id) => sel.has(id));
	}

	// Svelte action to set the indeterminate property on a checkbox
	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;
		return {
			update(value: boolean) {
				node.indeterminate = value;
			}
		};
	}

	const taskMatches = $derived.by(() => {
		return groupEmailsByRules(emails, rules, hiddenTaskIds);
	});

	const visibleTasks = $derived.by(() => {
		return taskMatches.filter((task) => !task.hidden);
	});

	// Tasks that have matching emails but are hidden from the main list
	const hiddenTasks = $derived(taskMatches.filter((t) => t.hidden));

	// Enabled rules with no matching emails at all (not in taskMatches)
	const noMatchRules = $derived(
		rules.filter((r) => r.enabled && !taskMatches.some((t) => t.rule.id === r.id))
	);

	const hasInactive = $derived(hiddenTasks.length > 0 || noMatchRules.length > 0);
	let showInactive = $state(false);

	function loadHiddenTasks() {
		if (typeof window === 'undefined') return;
		const data = localStorage.getItem(STORAGE_KEYS.hiddenTasks(accountId));
		hiddenTaskIds = data ? JSON.parse(data) : [];
	}

	async function loadRules() {
		try {
			const response = await fetch(`/api/cleanup-rules?accountId=${accountId}`);
			const data = await response.json();
			if (data.rules) {
				rules = data.rules.map((r: any) => ({
					...r,
					matchCriteria:
						typeof r.matchCriteria === 'string' ? JSON.parse(r.matchCriteria) : r.matchCriteria,
					createdAt: new Date(r.createdAt),
					updatedAt: new Date(r.updatedAt)
				}));
			}
		} catch (error) {
			console.error('Failed to load cleanup rules:', error);
		}
	}

	function toggleExpanded(ruleId: string) {
		const newExpanded = new Set(expandedTasks);
		if (newExpanded.has(ruleId)) {
			newExpanded.delete(ruleId);
		} else {
			newExpanded.add(ruleId);
		}
		expandedTasks = newExpanded;
	}

	function hideTask(ruleId: string) {
		if (!hiddenTaskIds.includes(ruleId)) {
			hiddenTaskIds = [...hiddenTaskIds, ruleId];
			localStorage.setItem(STORAGE_KEYS.hiddenTasks(accountId), JSON.stringify(hiddenTaskIds));
		}
	}

	function unhideTask(ruleId: string) {
		hiddenTaskIds = hiddenTaskIds.filter((id) => id !== ruleId);
		localStorage.setItem(STORAGE_KEYS.hiddenTasks(accountId), JSON.stringify(hiddenTaskIds));
	}

	async function handleBatchAction(task: TaskMatch, action: 'mark_read' | 'archive' | 'trash' | 'label') {
		const allIds = task.emails.map((e) => e.id);
		const emailIds = getActionIds(task.rule.id, allIds);
		if (emailIds.length === 0) return;
		processing = new Set(processing).add(task.rule.id);
		try {
			await onBatchAction(emailIds, action);
			selectNone(task.rule.id);
			await onReloadEmails();
		} catch (error) {
			console.error('Batch action failed:', error);
		} finally {
			const newProcessing = new Set(processing);
			newProcessing.delete(task.rule.id);
			processing = newProcessing;
		}
	}

	function openEditor(ruleId?: string) {
		editingRuleId = ruleId || null;
		showEditor = true;
	}

	function closeEditor() {
		showEditor = false;
		editingRuleId = null;
	}

	async function handleSaveRule(ruleData: Partial<CleanupRule>) {
		try {
			if (editingRuleId) {
				// Update existing rule
				const response = await fetch(`/api/cleanup-rules/${editingRuleId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ accountId, ...ruleData })
				});
				if (!response.ok) throw new Error('Failed to update rule');
			} else {
				// Create new rule
				const response = await fetch('/api/cleanup-rules', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ accountId, ...ruleData })
				});
				if (!response.ok) throw new Error('Failed to create rule');
			}
			await loadRules();
			closeEditor();
		} catch (error) {
			console.error('Failed to save rule:', error);
			alert('Failed to save rule. Please try again.');
		}
	}

	async function handleDeleteRule(ruleId: string) {
		if (!confirm('Are you sure you want to delete this cleanup rule?')) return;

		try {
			const response = await fetch(`/api/cleanup-rules/${ruleId}?accountId=${accountId}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error('Failed to delete rule');
			await loadRules();
		} catch (error) {
			console.error('Failed to delete rule:', error);
			alert('Failed to delete rule. Please try again.');
		}
	}

	onMount(() => {
		loadRules();
		loadHiddenTasks();
	});

	$effect(() => {
		// Reload rules and hidden tasks when account changes
		if (accountId) {
			loadRules();
			loadHiddenTasks();
		}
	});
</script>

<div class="cleanup-tasks-section mb-4">
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h4 class="mb-0">Quick Cleanup Tasks</h4>
		<button class="btn btn-sm btn-primary" onclick={() => openEditor()}>
			+ Create New Task
		</button>
	</div>

	{#if rules.length === 0}
		<div class="alert alert-info">
			No cleanup tasks configured yet. Click "+ Create New Task" to get started.
		</div>
	{:else}
		{#if visibleTasks.length === 0}
			<div class="alert alert-info">
				No emails match your cleanup rules. Create a new task or adjust existing rules.
			</div>
		{:else}
			{#each visibleTasks as task}
				{@const allIds = task.emails.map((e) => e.id)}
				{@const sel = getSelection(task.rule.id)}
				{@const allSelected = allIds.length > 0 && sel.size === allIds.length}
				{@const someSelected = sel.size > 0 && sel.size < allIds.length}
				{@const actionLabel = sel.size > 0 ? `(${sel.size})` : 'all'}
				<div
					class="card mb-3 task-card"
					style={task.rule.color ? `border-left: 4px solid ${task.rule.color}` : ''}
				>
					<div class="card-body p-3">
						<div class="d-flex justify-content-between align-items-start mb-2">
							<label class="master-checkbox-label mb-0">
								<input
									type="checkbox"
									class="master-checkbox"
									use:indeterminate={someSelected}
									checked={allSelected}
									onchange={() => allSelected || someSelected ? selectNone(task.rule.id) : selectAll(task.rule.id, allIds)}
								/>
								<h5 class="mb-0 d-inline">{task.rule.name}</h5>
								<span class="badge badge-secondary ml-2">{task.totalCount}</span>
							</label>
							<div class="btn-group btn-group-sm">
								<button
									class="btn btn-outline-secondary"
									onclick={() => openEditor(task.rule.id)}
									disabled={processing.has(task.rule.id)}
								>
									Edit
								</button>
								<button
									class="btn btn-outline-danger"
									onclick={() => handleDeleteRule(task.rule.id)}
									disabled={processing.has(task.rule.id)}
								>
									Delete
								</button>
							</div>
						</div>

						<!-- Email preview list -->
						<div class="email-preview-list mb-2">
							{#each task.emails.slice(0, expandedTasks.has(task.rule.id) ? undefined : 5) as email}
								<label class="email-preview-item">
									<input
										type="checkbox"
										checked={sel.has(email.id)}
										onchange={() => toggleItem(task.rule.id, email.id)}
									/>
									<span class="text-muted small ml-1">{email.from}</span>
									<span class="mx-1">|</span>
									<span>{email.subject || '(No subject)'}</span>
								</label>
							{/each}
							{#if task.emails.length > 5 && !expandedTasks.has(task.rule.id)}
								<button
									class="btn btn-link btn-sm p-0"
									onclick={() => toggleExpanded(task.rule.id)}
								>
									Show {task.emails.length - 5} more
								</button>
							{:else if expandedTasks.has(task.rule.id)}
								<button
									class="btn btn-link btn-sm p-0"
									onclick={() => toggleExpanded(task.rule.id)}
								>
									Show less
								</button>
							{/if}
						</div>

						<!-- Action buttons -->
						<div class="btn-group btn-group-sm">
							<button
								class="btn btn-outline-primary"
								onclick={() => handleBatchAction(task, 'mark_read')}
								disabled={processing.has(task.rule.id)}
							>
								Mark read {actionLabel}
							</button>
							<button
								class="btn btn-outline-success"
								onclick={() => handleBatchAction(task, 'archive')}
								disabled={processing.has(task.rule.id)}
							>
								Archive {actionLabel}
							</button>
							<button
								class="btn btn-outline-danger"
								onclick={() => handleBatchAction(task, 'trash')}
								disabled={processing.has(task.rule.id)}
							>
								Trash {actionLabel}
							</button>
							<button
								class="btn btn-outline-info"
								onclick={() => handleBatchAction(task, 'label')}
								disabled={processing.has(task.rule.id)}
							>
								TODO {actionLabel}
							</button>
							<button
								class="btn btn-outline-secondary"
								onclick={() => hideTask(task.rule.id)}
								disabled={processing.has(task.rule.id)}
							>
								Hide task
							</button>
						</div>
					</div>
				</div>
			{/each}
		{/if}

		{#if hasInactive}
			<div class="inactive-section">
				<button
					class="btn btn-link btn-sm p-0 text-muted"
					onclick={() => (showInactive = !showInactive)}
				>
					{showInactive ? '▲' : '▼'}
					{hiddenTasks.length + noMatchRules.length} hidden/inactive task{hiddenTasks.length + noMatchRules.length !== 1 ? 's' : ''}
				</button>
				{#if showInactive}
					<div class="mt-2">
						{#each hiddenTasks as task}
							<div class="inactive-task-row">
								<span>
									{task.rule.name}
									<span class="badge badge-secondary ml-1">{task.totalCount}</span>
									<span class="badge badge-light ml-1">hidden</span>
								</span>
								<div class="btn-group btn-group-sm">
									<button class="btn btn-outline-secondary btn-xs" onclick={() => unhideTask(task.rule.id)}>Unhide</button>
									<button class="btn btn-outline-secondary btn-xs" onclick={() => openEditor(task.rule.id)}>Edit</button>
									<button class="btn btn-outline-danger btn-xs" onclick={() => handleDeleteRule(task.rule.id)}>Delete</button>
								</div>
							</div>
						{/each}
						{#each noMatchRules as rule}
							<div class="inactive-task-row">
								<span class="text-muted">
									{rule.name}
									<span class="badge badge-light ml-1">no matches</span>
								</span>
								<div class="btn-group btn-group-sm">
									<button class="btn btn-outline-secondary btn-xs" onclick={() => openEditor(rule.id)}>Edit</button>
									<button class="btn btn-outline-danger btn-xs" onclick={() => handleDeleteRule(rule.id)}>Delete</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<RuleEditorModal
	rule={editingRuleId ? rules.find((r) => r.id === editingRuleId) : undefined}
	{accountId}
	{emails}
	onSave={handleSaveRule}
	onCancel={closeEditor}
	show={showEditor}
/>

<style>
	.task-card {
		border-radius: 4px;
		transition: box-shadow 0.2s;
	}

	.task-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.master-checkbox-label {
		display: flex;
		align-items: center;
		cursor: pointer;
		gap: 0.5rem;
	}

	.master-checkbox {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		cursor: pointer;
	}

	.email-preview-list {
		max-height: 300px;
		overflow-y: auto;
	}

	.email-preview-item {
		display: flex;
		align-items: center;
		padding: 4px 0;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		margin: 0;
	}

	.email-preview-item:hover {
		background-color: #e9ecef;
	}

	.cleanup-tasks-section {
		background-color: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
	}

	.inactive-section {
		margin-top: 0.5rem;
	}

	.inactive-task-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.35rem 0;
		font-size: 0.875rem;
		border-top: 1px solid #dee2e6;
	}

	.btn-xs {
		padding: 0.1rem 0.4rem;
		font-size: 0.75rem;
	}
</style>
