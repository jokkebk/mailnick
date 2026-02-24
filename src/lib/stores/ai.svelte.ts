import type { AuthState } from './auth.svelte.js';
import type { EmailState } from './email.svelte.js';

export interface AIGroup {
	name: string;
	emailIds: string[];
	suggestedAction: 'archive' | 'trash' | 'mark_read' | 'label' | 'keep';
	reason: string;
}

export class AIState {
	aiGroups = $state<AIGroup[]>([]);
	aiGrouping = $state(false);
	aiGroupError = $state<string | null>(null);
	aiAvailable = $state(false);

	constructor(
		private auth: AuthState,
		private emailState: EmailState
	) {}

	async checkAIAvailability() {
		try {
			const response = await fetch('/api/ai/status');
			const data = await response.json();
			this.aiAvailable = data.available === true;
		} catch {
			this.aiAvailable = false;
		}
	}

	async handleAIGroup(emailIds: string[]) {
		if (emailIds.length < 2) return;

		this.aiGrouping = true;
		this.aiGroupError = null;
		this.aiGroups = [];

		try {
			const emailData = this.emailState.emails
				.filter((e) => emailIds.includes(e.id))
				.map((e) => ({
					id: e.id,
					from: e.from,
					subject: e.subject,
					snippet: e.snippet,
					category: e.category
				}));

			const response = await fetch('/api/emails/ai-group', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: emailData })
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'AI grouping failed');
			}

			this.aiGroups = data.groups || [];
		} catch (e) {
			this.aiGroupError = e instanceof Error ? e.message : 'AI grouping failed';
			this.emailState.error = this.aiGroupError;
		} finally {
			this.aiGrouping = false;
		}
	}

	dismissAIGroups() {
		this.aiGroups = [];
		this.aiGroupError = null;
	}
}
