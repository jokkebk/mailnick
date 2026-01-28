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
	}

	let { emails, syncDays, onMarkRead, onArchive, onTrash, onLabel }: Props = $props();

	// Table sorting and filtering
	let sortColumn = $state<'from' | 'to' | 'subject' | 'receivedAt'>('receivedAt');
	let sortDirection = $state<'asc' | 'desc'>('desc');
	let filterFrom = $state('');
	let filterTo = $state('');
	let filterSubject = $state('');

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
				(!filterSubject || email.subject?.toLowerCase().includes(filterSubject.toLowerCase()))
			);
		});
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
</script>

{#if emails.length === 0}
	<div class="alert alert-info">
		No unread emails found in the last {syncDays} days. Click "Sync" to refresh, or use the dropdown
		to fetch a longer period.
	</div>
{:else}
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
					<th style="width: 30%;">
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
						<td>{email.to || '-'}</td>
						<td class:font-weight-bold={email.isUnread}>{email.subject || '(No subject)'}</td>
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
							<td colspan="6" class="bg-light">
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
</style>
