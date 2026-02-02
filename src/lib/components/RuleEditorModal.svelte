<script lang="ts">
	import type { CleanupRule, MatchCriteria, Condition } from '$lib/types/cleanup';
	import { matchesRule } from '$lib/utils/cleanup-matcher';

	interface Props {
		rule?: CleanupRule;
		accountId: string;
		emails: any[];
		onSave: (rule: Partial<CleanupRule>) => void;
		onCancel: () => void;
		show: boolean;
	}

	let { rule, accountId, emails, onSave, onCancel, show }: Props = $props();

	let name = $state('');
	let color = $state('#6C757D');
	let matchType = $state<'all' | 'any'>('all');
	let conditions = $state<Condition[]>([
		{ field: 'fromDomain', operator: 'equals', value: '', caseSensitive: false }
	]);

	// Update state when rule prop changes
	$effect(() => {
		if (rule) {
			name = rule.name;
			color = rule.color || '#6C757D';
			matchType = rule.matchCriteria.type;
			conditions = rule.matchCriteria.conditions;
		} else {
			name = '';
			color = '#6C757D';
			matchType = 'all';
			conditions = [{ field: 'fromDomain', operator: 'equals', value: '', caseSensitive: false }];
		}
	});

	const matchCount = $derived.by(() => {
		const criteria: MatchCriteria = { type: matchType, conditions };
		return emails.filter((email) => matchesRule(email, criteria)).length;
	});

	function addCondition() {
		conditions = [
			...conditions,
			{ field: 'fromDomain', operator: 'equals', value: '', caseSensitive: false }
		];
	}

	function removeCondition(index: number) {
		conditions = conditions.filter((_, i) => i !== index);
	}

	function updateCondition(index: number, updates: Partial<Condition>) {
		conditions = conditions.map((cond, i) =>
			i === index ? { ...cond, ...updates } : cond
		);
	}

	function handleSave() {
		const matchCriteria: MatchCriteria = {
			type: matchType,
			conditions
		};

		onSave({
			name,
			matchCriteria,
			color
		});
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={onCancel}></div>
	<div class="modal d-block" tabindex="-1" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-dialog modal-lg" role="document" onclick={(e) => e.stopPropagation()}>
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{rule ? 'Edit' : 'Create'} Cleanup Rule</h5>
					<button type="button" class="close" onclick={onCancel}>
						<span>&times;</span>
					</button>
				</div>
				<div class="modal-body">
					<!-- Rule Name -->
					<div class="form-group">
						<label for="rule-name">Rule Name</label>
						<input
							id="rule-name"
							type="text"
							class="form-control"
							bind:value={name}
							placeholder="e.g., GitHub Notifications"
						/>
					</div>

					<!-- Color Picker -->
					<div class="form-group">
						<label for="rule-color">Color (optional)</label>
						<div class="d-flex align-items-center">
							<input
								id="rule-color"
								type="color"
								class="form-control mr-2"
								bind:value={color}
								style="width: 60px; height: 38px;"
							/>
							<small class="text-muted">Visual indicator for this task</small>
						</div>
					</div>

					<!-- Match Type -->
					<div class="form-group">
						<label>Match Type</label>
						<div class="btn-group btn-group-toggle d-flex" role="group">
							<button
								type="button"
								class="btn btn-outline-secondary"
								class:active={matchType === 'all'}
								onclick={() => (matchType = 'all')}
							>
								Match ALL conditions
							</button>
							<button
								type="button"
								class="btn btn-outline-secondary"
								class:active={matchType === 'any'}
								onclick={() => (matchType = 'any')}
							>
								Match ANY condition
							</button>
						</div>
					</div>

					<!-- Conditions -->
					<div class="form-group">
						<label>Conditions</label>
						{#each conditions as condition, index}
							<div class="condition-row mb-2">
								<div class="row">
									<div class="col-3">
										<select
											class="form-control form-control-sm"
											value={condition.field}
											onchange={(e) =>
												updateCondition(index, {
													field: (e.target as HTMLSelectElement).value as any
												})}
										>
											<option value="from">From</option>
											<option value="fromDomain">From Domain</option>
											<option value="to">To</option>
											<option value="subject">Subject</option>
											<option value="category">Category</option>
											<option value="snippet">Snippet</option>
										</select>
									</div>
									<div class="col-3">
										<select
											class="form-control form-control-sm"
											value={condition.operator}
											onchange={(e) =>
												updateCondition(index, {
													operator: (e.target as HTMLSelectElement).value as any
												})}
										>
											<option value="equals">Equals</option>
											<option value="contains">Contains</option>
											<option value="startsWith">Starts with</option>
											<option value="endsWith">Ends with</option>
											<option value="in">In list</option>
										</select>
									</div>
									<div class="col-5">
										<input
											type="text"
											class="form-control form-control-sm"
											value={condition.value}
											oninput={(e) =>
												updateCondition(index, {
													value: (e.target as HTMLInputElement).value
												})}
											placeholder="Value"
										/>
									</div>
									<div class="col-1">
										<button
											type="button"
											class="btn btn-sm btn-danger"
											onclick={() => removeCondition(index)}
											disabled={conditions.length === 1}
										>
											×
										</button>
									</div>
								</div>
							</div>
						{/each}
						<button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick={addCondition}>
							+ Add Condition
						</button>
					</div>

					<!-- Live Preview -->
					<div class="alert alert-info">
						<strong>Live Preview:</strong> {matchCount} email(s) currently match this rule
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={handleSave}
						disabled={!name || conditions.length === 0}
					>
						{rule ? 'Save Changes' : 'Create Rule'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1040;
	}

	.modal {
		z-index: 1050;
	}

	.condition-row {
		padding: 8px;
		border: 1px solid #dee2e6;
		border-radius: 4px;
		background-color: #f8f9fa;
	}
</style>
