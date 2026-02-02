<script lang="ts">
	import { onMount } from 'svelte';
	import type { CleanupRule, TaskMatch } from '$lib/types/cleanup';
	import { groupEmailsByRules } from '$lib/utils/cleanup-matcher';
	import RuleEditorModal from './RuleEditorModal.svelte';

	interface Props {
		accountId: string;
		emails: any[];
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

	const hiddenTaskIds = $derived.by(() => {
		if (typeof window === 'undefined') return [];
		const key = `mailnick.hiddenTasks.${accountId}`;
		const data = localStorage.getItem(key);
		return data ? JSON.parse(data) : [];
	});

	const taskMatches = $derived.by(() => {
		return groupEmailsByRules(emails, rules, hiddenTaskIds);
	});

	const visibleTasks = $derived.by(() => {
		return taskMatches.filter((task) => !task.hidden);
	});

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
		const key = `mailnick.hiddenTasks.${accountId}`;
		const hidden = hiddenTaskIds;
		if (!hidden.includes(ruleId)) {
			localStorage.setItem(key, JSON.stringify([...hidden, ruleId]));
		}
	}

	async function handleBatchAction(task: TaskMatch, action: 'mark_read' | 'archive' | 'trash' | 'label') {
		const emailIds = task.emails.map((e) => e.id);
		processing = new Set(processing).add(task.rule.id);
		try {
			await onBatchAction(emailIds, action);
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
	});

	$effect(() => {
		// Reload rules when account changes
		if (accountId) {
			loadRules();
		}
	});
</script>

{#if visibleTasks.length > 0 || rules.length > 0}
	<div class="cleanup-tasks-section mb-4">
		<div class="d-flex justify-content-between align-items-center mb-3">
			<h4 class="mb-0">Quick Cleanup Tasks</h4>
			<button class="btn btn-sm btn-primary" onclick={() => openEditor()}>
				+ Create New Task
			</button>
		</div>

		{#if visibleTasks.length === 0}
			<div class="alert alert-info">
				No emails match your cleanup rules. Create a new task or adjust existing rules.
			</div>
		{:else}
			{#each visibleTasks as task}
				<div
					class="card mb-3 task-card"
					style={task.rule.color ? `border-left: 4px solid ${task.rule.color}` : ''}
				>
					<div class="card-body p-3">
						<div class="d-flex justify-content-between align-items-start mb-2">
							<h5 class="mb-0">
								{task.rule.name}
								<span class="badge badge-secondary ml-2">{task.totalCount}</span>
							</h5>
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
								<div class="email-preview-item">
									<span class="text-muted small">{email.from}</span>
									<span class="mx-1">|</span>
									<span>{email.subject || '(No subject)'}</span>
								</div>
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
								Mark all read
							</button>
							<button
								class="btn btn-outline-success"
								onclick={() => handleBatchAction(task, 'archive')}
								disabled={processing.has(task.rule.id)}
							>
								Archive all
							</button>
							<button
								class="btn btn-outline-danger"
								onclick={() => handleBatchAction(task, 'trash')}
								disabled={processing.has(task.rule.id)}
							>
								Trash all
							</button>
							<button
								class="btn btn-outline-info"
								onclick={() => handleBatchAction(task, 'label')}
								disabled={processing.has(task.rule.id)}
							>
								TODO all
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
	</div>
{/if}

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

	.email-preview-list {
		max-height: 300px;
		overflow-y: auto;
	}

	.email-preview-item {
		padding: 4px 0;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cleanup-tasks-section {
		background-color: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
	}
</style>
