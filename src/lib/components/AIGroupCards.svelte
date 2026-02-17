<script lang="ts">
	interface Email {
		id: string;
		from: string;
		subject: string | null;
		snippet: string | null;
		category: string | null;
	}

	interface AIGroup {
		name: string;
		emailIds: string[];
		suggestedAction: 'archive' | 'trash' | 'mark_read' | 'label' | 'keep';
		reason: string;
	}

	interface Props {
		groups: AIGroup[];
		emails: Email[];
		onBatchAction: (
			emailIds: string[],
			action: 'mark_read' | 'archive' | 'trash' | 'label'
		) => Promise<void>;
		onDismiss: () => void;
	}

	let { groups, emails, onBatchAction, onDismiss }: Props = $props();

	const COLORS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'];

	let expandedGroups = $state<Set<number>>(new Set());
	let processing = $state<Set<number>>(new Set());
	// Per-group selection: Map<groupIndex, Set<emailId>>
	let selections = $state<Map<number, Set<string>>>(new Map());

	const emailMap = $derived.by(() => {
		const map = new Map<string, Email>();
		for (const e of emails) map.set(e.id, e);
		return map;
	});

	function toggleExpanded(index: number) {
		const next = new Set(expandedGroups);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		expandedGroups = next;
	}

	function getSelection(index: number): Set<string> {
		return selections.get(index) ?? new Set();
	}

	function toggleItem(index: number, emailId: string) {
		const current = new Set(getSelection(index));
		if (current.has(emailId)) current.delete(emailId);
		else current.add(emailId);
		const next = new Map(selections);
		next.set(index, current);
		selections = next;
	}

	function selectAll(index: number, activeIds: string[]) {
		const next = new Map(selections);
		next.set(index, new Set(activeIds));
		selections = next;
	}

	function selectNone(index: number) {
		const next = new Map(selections);
		next.delete(index);
		selections = next;
	}

	function getActionIds(index: number, activeIds: string[]): string[] {
		const sel = getSelection(index);
		if (sel.size === 0) return activeIds;
		return activeIds.filter((id) => sel.has(id));
	}

	async function handleAction(index: number, activeIds: string[], action: 'mark_read' | 'archive' | 'trash' | 'label') {
		const ids = getActionIds(index, activeIds);
		if (ids.length === 0) return;

		processing = new Set(processing).add(index);
		try {
			await onBatchAction(ids, action);
			// Clear selection for this group after successful action
			selectNone(index);
		} catch (err) {
			console.error('AI group batch action failed:', err);
		} finally {
			const next = new Set(processing);
			next.delete(index);
			processing = next;
		}
	}
</script>

<div class="ai-groups-section mb-4">
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h4 class="mb-0">AI-Suggested Groups</h4>
		<button class="btn btn-sm btn-outline-secondary" onclick={onDismiss}>
			Dismiss
		</button>
	</div>

	{#each groups as group, index}
		{@const activeIds = group.emailIds.filter((id) => emailMap.has(id))}
		{@const sel = getSelection(index)}
		{@const actionCount = sel.size > 0 ? sel.size : activeIds.length}
		{@const actionLabel = sel.size > 0 ? `(${sel.size})` : 'all'}
		{#if activeIds.length > 0}
			<div
				class="card mb-3 ai-group-card"
				style="border-left: 4px solid {COLORS[index % COLORS.length]}"
			>
				<div class="card-body p-3">
					<div class="d-flex justify-content-between align-items-start mb-2">
						<h5 class="mb-0">
							{group.name}
							<span class="badge badge-secondary ml-2">{activeIds.length}</span>
						</h5>
						<div class="btn-group btn-group-sm">
							<button
								class="btn btn-outline-secondary btn-xs"
								onclick={() => selectAll(index, activeIds)}
								disabled={sel.size === activeIds.length}
							>
								All
							</button>
							<button
								class="btn btn-outline-secondary btn-xs"
								onclick={() => selectNone(index)}
								disabled={sel.size === 0}
							>
								None
							</button>
						</div>
					</div>

					{#if group.reason}
						<p class="text-muted small mb-2">{group.reason}</p>
					{/if}

					<!-- Email preview list -->
					<div class="email-preview-list mb-2">
						{#each activeIds.slice(0, expandedGroups.has(index) ? undefined : 5) as emailId}
							{@const email = emailMap.get(emailId)}
							{#if email}
								<label class="email-preview-item">
									<input
										type="checkbox"
										checked={sel.has(emailId)}
										onchange={() => toggleItem(index, emailId)}
									/>
									<span class="text-muted small ml-1">{email.from}</span>
									<span class="mx-1">|</span>
									<span>{email.subject || '(No subject)'}</span>
								</label>
							{/if}
						{/each}
						{#if activeIds.length > 5 && !expandedGroups.has(index)}
							<button
								class="btn btn-link btn-sm p-0"
								onclick={() => toggleExpanded(index)}
							>
								Show {activeIds.length - 5} more
							</button>
						{:else if expandedGroups.has(index)}
							<button
								class="btn btn-link btn-sm p-0"
								onclick={() => toggleExpanded(index)}
							>
								Show less
							</button>
						{/if}
					</div>

					<!-- Action buttons -->
					<div class="d-flex align-items-center">
						<div class="btn-group btn-group-sm">
							<button
								class="btn"
								class:btn-primary={group.suggestedAction === 'mark_read'}
								class:btn-outline-primary={group.suggestedAction !== 'mark_read'}
								onclick={() => handleAction(index, activeIds, 'mark_read')}
								disabled={processing.has(index) || actionCount === 0}
							>
								Mark read {actionLabel}
							</button>
							<button
								class="btn"
								class:btn-success={group.suggestedAction === 'archive'}
								class:btn-outline-success={group.suggestedAction !== 'archive'}
								onclick={() => handleAction(index, activeIds, 'archive')}
								disabled={processing.has(index) || actionCount === 0}
							>
								Archive {actionLabel}
							</button>
							<button
								class="btn"
								class:btn-danger={group.suggestedAction === 'trash'}
								class:btn-outline-danger={group.suggestedAction !== 'trash'}
								onclick={() => handleAction(index, activeIds, 'trash')}
								disabled={processing.has(index) || actionCount === 0}
							>
								Trash {actionLabel}
							</button>
							<button
								class="btn"
								class:btn-info={group.suggestedAction === 'label'}
								class:btn-outline-info={group.suggestedAction !== 'label'}
								onclick={() => handleAction(index, activeIds, 'label')}
								disabled={processing.has(index) || actionCount === 0}
							>
								TODO {actionLabel}
							</button>
						</div>
						{#if group.suggestedAction === 'keep'}
							<span class="badge badge-light ml-2">AI suggests: keep for review</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/each}
</div>

<style>
	.ai-groups-section {
		background-color: #f0f4ff;
		padding: 1rem;
		border-radius: 4px;
	}

	.ai-group-card {
		border-radius: 4px;
		transition: box-shadow 0.2s;
	}

	.ai-group-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

	.btn-xs {
		padding: 0.1rem 0.4rem;
		font-size: 0.75rem;
	}
</style>
