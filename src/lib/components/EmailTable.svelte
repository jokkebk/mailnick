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
		expanded?: boolean;
		processing?: boolean;
	}

	interface Props {
		emails: Email[];
		syncDays: number;
		onMarkRead: (emailId: string) => void;
		onArchive: (emailId: string) => void;
		onTrash: (emailId: string) => void;
		onLabel: (emailId: string) => void;
		onBatchMarkRead?: (emailIds: string[]) => Promise<void>;
		onBatchArchive?: (emailIds: string[]) => Promise<void>;
		onBatchTrash?: (emailIds: string[]) => Promise<void>;
		onBatchLabel?: (emailIds: string[]) => Promise<void>;
	}

	let {
		emails,
		syncDays,
		onMarkRead,
		onArchive,
		onTrash,
		onLabel,
		onBatchMarkRead,
		onBatchArchive,
		onBatchTrash,
		onBatchLabel
	}: Props = $props();

	// Table sorting and filtering
	let sortColumn = $state<'from' | 'to' | 'subject' | 'category' | 'receivedAt'>('receivedAt');
	let sortDirection = $state<'asc' | 'desc'>('desc');
	let filterFrom = $state('');
	let filterTo = $state('');
	let filterSubject = $state('');
	let filterCategory = $state('');

	// Badge filter tracking
	let activeFilterBadge = $state<{type: 'from' | 'to' | 'subject' | 'category', value: string} | null>(null);

	// Clear badge when filters change manually (not via badge click)
	$effect(() => {
		if (activeFilterBadge) {
			const badgeMatchesFilter =
				(activeFilterBadge.type === 'from' && filterFrom === activeFilterBadge.value) ||
				(activeFilterBadge.type === 'to' && filterTo === activeFilterBadge.value) ||
				(activeFilterBadge.type === 'subject' && filterSubject === activeFilterBadge.value) ||
				(activeFilterBadge.type === 'category' && filterCategory === activeFilterBadge.value);

			if (!badgeMatchesFilter) {
				activeFilterBadge = null;
			}
		}
	});

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());
	let lastClickedIndex = $state<number | null>(null);

	// Sorting and filtering logic
	const sortedEmails = $derived.by(() => {
		const sorted = [...emails];
		sorted.sort((a, b) => {
			let aVal = a[sortColumn];
			let bVal = b[sortColumn];

			if (aVal === null) return 1;
			if (bVal === null) return -1;

			if (sortColumn === 'receivedAt') {
				const comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
				return sortDirection === 'asc' ? comparison : -comparison;
			}

			const comparison = String(aVal).localeCompare(String(bVal));
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const filteredAndSortedEmails = $derived.by(() => {
		return sortedEmails.filter((email) => {
			return (
				(!filterFrom || email.from.toLowerCase().includes(filterFrom.toLowerCase())) &&
				(!filterTo || email.to?.toLowerCase().includes(filterTo.toLowerCase())) &&
				(!filterSubject || email.subject?.toLowerCase().includes(filterSubject.toLowerCase())) &&
				(!filterCategory || email.category?.toLowerCase().includes(filterCategory.toLowerCase()))
			);
		});
	});

	// Badge computations
	const fromBadges = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const email of emails) {
			counts.set(email.from, (counts.get(email.from) || 0) + 1);
		}
		return Array.from(counts.entries())
			.filter(([_, count]) => count >= 3)
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count);
	});

	const toBadges = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const email of emails) {
			if (email.to) {
				// Handle comma-separated recipients
				const recipients = email.to.split(',').map(r => r.trim());
				for (const recipient of recipients) {
					counts.set(recipient, (counts.get(recipient) || 0) + 1);
				}
			}
		}
		return Array.from(counts.entries())
			.filter(([_, count]) => count >= 3)
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count);
	});

	const subjectBadges = $derived.by(() => {
		const counts = new Map<string, number>();
		const stopwords = new Set(['about', 'could', 'would', 'should', 'please', 'thank', 'thanks', 'email', 'message', 'regarding', 'concerning']);

		for (const email of emails) {
			if (email.subject) {
				// Tokenize: split by spaces, punctuation
				const words = email.subject
					.split(/[\s\-_\[\](){}'",.;:!?]+/)
					.filter(w => w.length >= 5 && !stopwords.has(w.toLowerCase()));

				for (const word of words) {
					const lower = word.toLowerCase();
					counts.set(lower, (counts.get(lower) || 0) + 1);
				}
			}
		}

		return Array.from(counts.entries())
			.filter(([_, count]) => count >= 3)
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10); // Limit to top 10
	});

	const categoryBadges = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const email of emails) {
			if (email.category) {
				counts.set(email.category, (counts.get(email.category) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count);
	});

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

	function toggleSort(column: typeof sortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function toggleExpand(email: Email) {
		email.expanded = !email.expanded;
		emails = [...emails];
	}

	function stopPropagation(event: MouseEvent) {
		event.stopPropagation();
	}

	function handleCheckboxChange(event: MouseEvent, emailId: string, index: number) {
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
					newSelectedIds.add(filteredAndSortedEmails[i].id);
				} else {
					newSelectedIds.delete(filteredAndSortedEmails[i].id);
				}
			}
			selectedIds = newSelectedIds;
		} else {
			// Regular click: toggle single checkbox
			const newSelectedIds = new Set(selectedIds);
			if (isChecked) {
				newSelectedIds.add(emailId);
			} else {
				newSelectedIds.delete(emailId);
			}
			selectedIds = newSelectedIds;
		}

		lastClickedIndex = index;
	}

	function handleSelectAll(event: Event) {
		const target = event.target as HTMLInputElement;
		const isChecked = target.checked;

		if (isChecked) {
			selectedIds = new Set(filteredAndSortedEmails.map((email) => email.id));
		} else {
			selectedIds = new Set();
		}
		lastClickedIndex = null;
	}

	const allSelected = $derived(
		filteredAndSortedEmails.length > 0 &&
			filteredAndSortedEmails.every((email) => selectedIds.has(email.id))
	);

	const selectedCount = $derived(selectedIds.size);
	const selectedEmailIds = $derived(Array.from(selectedIds));

	let batchProcessing = $state(false);

	function deselectAll() {
		selectedIds = new Set();
		lastClickedIndex = null;
	}

	async function handleBatchAction(
		action: 'markRead' | 'archive' | 'trash' | 'label',
		handler?: (emailIds: string[]) => Promise<void>
	) {
		if (!handler || selectedCount === 0) return;

		batchProcessing = true;
		try {
			await handler(selectedEmailIds);
			deselectAll();
		} catch (error) {
			console.error(`Batch ${action} failed:`, error);
		} finally {
			batchProcessing = false;
		}
	}

	function handleBadgeClick(type: 'from' | 'to' | 'subject' | 'category', value: string) {
		// Toggle: if same badge clicked, clear filter
		if (activeFilterBadge?.type === type && activeFilterBadge?.value === value) {
			clearAllFilters();
			return;
		}

		// Set appropriate filter and clear others
		if (type === 'from') {
			filterFrom = value;
			filterTo = '';
			filterSubject = '';
			filterCategory = '';
		} else if (type === 'to') {
			filterFrom = '';
			filterTo = value;
			filterSubject = '';
			filterCategory = '';
		} else if (type === 'subject') {
			filterFrom = '';
			filterTo = '';
			filterSubject = value;
			filterCategory = '';
		} else {
			filterFrom = '';
			filterTo = '';
			filterSubject = '';
			filterCategory = value;
		}

		activeFilterBadge = { type, value };
	}

	function clearAllFilters() {
		filterFrom = '';
		filterTo = '';
		filterSubject = '';
		filterCategory = '';
		activeFilterBadge = null;
	}
</script>

{#if emails.length === 0}
	<div class="alert alert-info">
		No unhandled emails found in the last {syncDays} days. Click "Sync" to refresh, or use the dropdown
		to fetch a longer period.
	</div>
{:else}
	<!-- Filter badges bar - always visible -->
	<div class="filter-badges-bar">
		<div class="badge-group">
			<span class="badge-label">From:</span>
			{#if fromBadges.length > 0}
				{#each fromBadges as badge}
					<button
						class="badge badge-pill badge-clickable"
						class:badge-primary={activeFilterBadge?.type === 'from' && activeFilterBadge?.value === badge.value}
						class:badge-secondary={!(activeFilterBadge?.type === 'from' && activeFilterBadge?.value === badge.value)}
						onclick={() => handleBadgeClick('from', badge.value)}
					>
						{badge.value} ({badge.count})
					</button>
				{/each}
			{:else}
				<span class="text-muted" style="font-size: 0.875rem;">-</span>
			{/if}
		</div>

		<div class="badge-group">
			<span class="badge-label">To:</span>
			{#if toBadges.length > 0}
				{#each toBadges as badge}
					<button
						class="badge badge-pill badge-clickable"
						class:badge-primary={activeFilterBadge?.type === 'to' && activeFilterBadge?.value === badge.value}
						class:badge-secondary={!(activeFilterBadge?.type === 'to' && activeFilterBadge?.value === badge.value)}
						onclick={() => handleBadgeClick('to', badge.value)}
					>
						{badge.value} ({badge.count})
					</button>
				{/each}
			{:else}
				<span class="text-muted" style="font-size: 0.875rem;">-</span>
			{/if}
		</div>

		<div class="badge-group">
			<span class="badge-label">Keywords:</span>
			{#if subjectBadges.length > 0}
				{#each subjectBadges as badge}
					<button
						class="badge badge-pill badge-clickable"
						class:badge-primary={activeFilterBadge?.type === 'subject' && activeFilterBadge?.value === badge.value}
						class:badge-secondary={!(activeFilterBadge?.type === 'subject' && activeFilterBadge?.value === badge.value)}
						onclick={() => handleBadgeClick('subject', badge.value)}
					>
						{badge.value} ({badge.count})
					</button>
				{/each}
			{:else}
				<span class="text-muted" style="font-size: 0.875rem;">-</span>
			{/if}
		</div>

		<div class="badge-group">
			<span class="badge-label">Category:</span>
			{#if categoryBadges.length > 0}
				{#each categoryBadges as badge}
					<button
						class="badge badge-pill badge-clickable"
						class:badge-primary={activeFilterBadge?.type === 'category' && activeFilterBadge?.value === badge.value}
						class:badge-secondary={!(activeFilterBadge?.type === 'category' && activeFilterBadge?.value === badge.value)}
						onclick={() => handleBadgeClick('category', badge.value)}
					>
						{badge.value} ({badge.count})
					</button>
				{/each}
			{:else}
				<span class="text-muted" style="font-size: 0.875rem;">-</span>
			{/if}
		</div>

		{#if activeFilterBadge}
			<button class="btn btn-sm btn-outline-secondary" onclick={clearAllFilters}>
				Clear filter
			</button>
		{/if}
	</div>

	<!-- Batch toolbar - always visible -->
	<div class="batch-toolbar">
		{#if selectedCount > 0}
			<div class="batch-info">
				<button class="btn btn-sm btn-link p-0" onclick={deselectAll}>
					<strong>{selectedCount}</strong> email{selectedCount !== 1 ? 's' : ''} selected
				</button>
			</div>
			<div class="batch-actions">
				<div class="btn-group btn-group-sm">
					<button
						class="btn btn-outline-secondary"
						onclick={() => handleBatchAction('markRead', onBatchMarkRead)}
						disabled={batchProcessing || !onBatchMarkRead}
						title="Mark read"
					>
						✓ Mark read
					</button>
					<button
						class="btn btn-outline-secondary"
						onclick={() => handleBatchAction('archive', onBatchArchive)}
						disabled={batchProcessing || !onBatchArchive}
						title="Archive"
					>
						📥 Archive
					</button>
					<button
						class="btn btn-outline-secondary"
						onclick={() => handleBatchAction('trash', onBatchTrash)}
						disabled={batchProcessing || !onBatchTrash}
						title="Trash"
					>
						🗑 Trash
					</button>
					<button
						class="btn btn-outline-secondary"
						onclick={() => handleBatchAction('label', onBatchLabel)}
						disabled={batchProcessing || !onBatchLabel}
						title="Add TODO label"
					>
						⚡ Label
					</button>
				</div>
			</div>
		{:else}
			<div class="batch-info">
				<span class="text-muted">Select emails to perform batch actions</span>
			</div>
			<div class="batch-actions"></div>
		{/if}
	</div>

	<div class="table-responsive">
		<table class="table table-sm email-table">
			<thead class="thead-dark">
				<tr>
					<th style="width: 3%;">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={handleSelectAll}
							aria-label="Select all"
						/>
					</th>
					<th style="width: 27%;">
						From
						<button
							class="btn btn-sm btn-link text-white p-0 ml-1"
							onclick={() => toggleSort('from')}
							title="Sort by From"
						>
							{sortColumn === 'from' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
						</button>
						<input
							type="text"
							class="form-control form-control-sm mt-1"
							placeholder="Filter..."
							bind:value={filterFrom}
						/>
					</th>
					<th style="width: 20%;">
						To
						<button
							class="btn btn-sm btn-link text-white p-0 ml-1"
							onclick={() => toggleSort('to')}
							title="Sort by To"
						>
							{sortColumn === 'to' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
						</button>
						<input
							type="text"
							class="form-control form-control-sm mt-1"
							placeholder="Filter..."
							bind:value={filterTo}
						/>
					</th>
					<th style="width: 25%;">
						Subject
						<button
							class="btn btn-sm btn-link text-white p-0 ml-1"
							onclick={() => toggleSort('subject')}
							title="Sort by Subject"
						>
							{sortColumn === 'subject' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
						</button>
						<input
							type="text"
							class="form-control form-control-sm mt-1"
							placeholder="Filter..."
							bind:value={filterSubject}
						/>
					</th>
					<th style="width: 12%;">
						Category
						<button
							class="btn btn-sm btn-link text-white p-0 ml-1"
							onclick={() => toggleSort('category')}
							title="Sort by Category"
						>
							{sortColumn === 'category' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
						</button>
						<input
							type="text"
							class="form-control form-control-sm mt-1"
							placeholder="Filter..."
							bind:value={filterCategory}
						/>
					</th>
					<th style="width: 10%;">
						Date
						<button
							class="btn btn-sm btn-link text-white p-0 ml-1"
							onclick={() => toggleSort('receivedAt')}
							title="Sort by Date"
						>
							{sortColumn === 'receivedAt' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
						</button>
					</th>
					<th style="width: 10%;">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredAndSortedEmails as email, index (email.id)}
					<tr
						onclick={() => toggleExpand(email)}
						class:unread={email.isUnread}
						class:read={!email.isUnread}
						class:alt-row={index % 2 === 1}
						style="cursor: pointer;"
					>
						<td onclick={stopPropagation}>
							<input
								type="checkbox"
								checked={selectedIds.has(email.id)}
								onchange={(e) => handleCheckboxChange(e, email.id, index)}
								aria-label="Select email"
							/>
						</td>
						<td>{email.from}</td>
						<td>{email.to && email.to.length > 128 ? email.to.slice(0, 128) + '...' : (email.to || '-')}</td>
						<td class:font-weight-bold={email.isUnread}>{email.subject || '(No subject)'}</td>
						<td>{email.category || '-'}</td>
						<td>{formatDate(email.receivedAt)}</td>
						<td onclick={stopPropagation}>
							<div class="btn-group btn-group-sm">
								<button
									class="btn btn-outline-secondary"
									onclick={() => onMarkRead(email.id)}
									disabled={!email.isUnread || email.processing}
									title="Mark read"
								>
									✓
								</button>
								<button
									class="btn btn-outline-secondary"
									onclick={() => onArchive(email.id)}
									disabled={email.processing}
									title="Archive"
								>
									📥
								</button>
								<button
									class="btn btn-outline-secondary"
									onclick={() => onTrash(email.id)}
									disabled={email.processing}
									title="Trash"
								>
									🗑
								</button>
								<button
									class="btn btn-outline-secondary"
									onclick={() => onLabel(email.id)}
									disabled={email.processing}
									title="TODO"
								>
									⚡
								</button>
							</div>
						</td>
					</tr>
					{#if email.expanded}
						<tr>
							<td colspan="7" class="bg-light">
								<small class="text-muted">{email.snippet}</small>
							</td>
						</tr>
					{/if}
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

	.email-table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.email-table tbody tr {
		background-color: white;
		border-bottom: 1px solid #dee2e6;
	}

	.email-table tbody tr.alt-row {
		background-color: #f8f9fa;
	}

	.email-table tbody tr.read {
		color: #444;
	}

	.email-table tbody tr.unread {
		color: #000;
	}

	.email-table tbody tr:hover {
		background-color: #e9ecef !important;
	}

	.font-weight-bold {
		font-weight: 600;
	}

	.filter-badges-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background-color: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 0.25rem;
		margin-bottom: 1rem;
	}

	.badge-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.badge-label {
		font-weight: 600;
		color: #495057;
		font-size: 0.875rem;
	}

	.badge-clickable {
		cursor: pointer;
		border: none;
		transition: all 0.2s ease;
	}

	.badge-clickable:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.badge-clickable:active {
		transform: translateY(0);
	}
</style>
