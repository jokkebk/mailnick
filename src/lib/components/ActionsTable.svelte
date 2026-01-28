<script lang="ts">
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

	interface Props {
		emailsWithActions: EmailWithAction[];
		onUndo: (actionId: string) => void;
		onBatchUndo?: (actionIds: string[]) => Promise<void>;
	}

	let { emailsWithActions, onUndo, onBatchUndo }: Props = $props();

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());
	let lastClickedIndex = $state<number | null>(null);

	const selectedCount = $derived(selectedIds.size);
	const selectedActionIds = $derived(Array.from(selectedIds));

	let batchProcessing = $state(false);

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

	function getActionLabel(actionType: string): string {
		switch (actionType) {
			case 'mark_read':
				return 'Marked as read';
			case 'archive':
				return 'Archived';
			case 'trash':
				return 'Trashed';
			case 'label':
				return 'Labeled';
			default:
				return actionType;
		}
	}

	function stopPropagation(event: MouseEvent) {
		event.stopPropagation();
	}

	function handleCheckboxChange(event: MouseEvent, actionId: string, index: number) {
		event.stopPropagation();
		const target = event.target as HTMLInputElement;
		const isChecked = target.checked;

		if (event.shiftKey && lastClickedIndex !== null) {
			// Shift-click: select/unselect range
			const start = Math.min(lastClickedIndex, index);
			const end = Math.max(lastClickedIndex, index);
			const newSelectedIds = new Set(selectedIds);

			for (let i = start; i <= end; i++) {
				if (isChecked) {
					newSelectedIds.add(emailsWithActions[i].action.id);
				} else {
					newSelectedIds.delete(emailsWithActions[i].action.id);
				}
			}
			selectedIds = newSelectedIds;
		} else {
			// Regular click: toggle single checkbox
			const newSelectedIds = new Set(selectedIds);
			if (isChecked) {
				newSelectedIds.add(actionId);
			} else {
				newSelectedIds.delete(actionId);
			}
			selectedIds = newSelectedIds;
		}

		lastClickedIndex = index;
	}

	function handleSelectAll(event: Event) {
		const target = event.target as HTMLInputElement;
		const isChecked = target.checked;

		if (isChecked) {
			selectedIds = new Set(emailsWithActions.map((item) => item.action.id));
		} else {
			selectedIds = new Set();
		}
		lastClickedIndex = null;
	}

	const allSelected = $derived(
		emailsWithActions.length > 0 &&
			emailsWithActions.every((item) => selectedIds.has(item.action.id))
	);

	function deselectAll() {
		selectedIds = new Set();
		lastClickedIndex = null;
	}

	async function handleBatchUndo() {
		if (!onBatchUndo || selectedCount === 0) return;

		batchProcessing = true;
		try {
			await onBatchUndo(selectedActionIds);
			deselectAll();
		} catch (error) {
			console.error('Batch undo failed:', error);
		} finally {
			batchProcessing = false;
		}
	}
</script>

{#if emailsWithActions.length === 0}
	<div class="alert alert-info">
		No recent actions. Mark emails as read, archive, or take other actions to see them here.
	</div>
{:else}
	{#if selectedCount > 0}
		<div class="batch-toolbar">
			<div class="batch-info">
				<button class="btn btn-sm btn-link p-0" onclick={deselectAll}>
					<strong>{selectedCount}</strong> action{selectedCount !== 1 ? 's' : ''} selected
				</button>
			</div>
			<div class="batch-actions">
				<button
					class="btn btn-sm btn-outline-primary"
					onclick={handleBatchUndo}
					disabled={batchProcessing || !onBatchUndo}
					title="Undo selected actions"
				>
					↶ Undo selected
				</button>
			</div>
		</div>
	{/if}
	<div class="table-responsive">
		<table class="table table-sm actions-table">
			<thead class="thead-light">
				<tr>
					<th style="width: 3%;">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={handleSelectAll}
							aria-label="Select all"
						/>
					</th>
					<th style="width: 22%;">From</th>
					<th style="width: 20%;">To</th>
					<th style="width: 25%;">Subject</th>
					<th style="width: 15%;">Action</th>
					<th style="width: 10%;">When</th>
					<th style="width: 5%;">Undo</th>
				</tr>
			</thead>
			<tbody>
				{#each emailsWithActions as { email, action }, index (action.id)}
					<tr class:alt-row={index % 2 === 1}>
						<td onclick={stopPropagation}>
							<input
								type="checkbox"
								checked={selectedIds.has(action.id)}
								onchange={(e) => handleCheckboxChange(e, action.id, index)}
								aria-label="Select action"
							/>
						</td>
						<td>{email.from}</td>
						<td>{email.to || '-'}</td>
						<td>{email.subject || '(No subject)'}</td>
						<td>
							<span class="badge badge-secondary">
								{getActionLabel(action.actionType)}
							</span>
						</td>
						<td>{formatDate(action.timestamp)}</td>
						<td>
							<button
								class="btn btn-sm btn-outline-primary"
								onclick={() => onUndo(action.id)}
								title="Undo this action"
							>
								↶
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.batch-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: #e7f3ff;
		border: 1px solid #b3d9ff;
		border-radius: 0.25rem;
		margin-bottom: 1rem;
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.batch-info button {
		color: #004085;
		text-decoration: none;
	}

	.batch-info button:hover {
		text-decoration: underline;
	}

	.batch-actions {
		display: flex;
		gap: 0.5rem;
	}

	.actions-table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.actions-table tbody tr {
		background-color: white;
		border-bottom: 1px solid #dee2e6;
	}

	.actions-table tbody tr.alt-row {
		background-color: #f8f9fa;
	}

	.actions-table tbody tr:hover {
		background-color: #e9ecef !important;
	}
</style>
