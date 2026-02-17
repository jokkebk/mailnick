import { json } from '@sveltejs/kit';
import { getGeminiClient } from '$lib/server/gemini/client';
import type { RequestHandler } from './$types';

const MAX_EMAILS = 100;
const SNIPPET_MAX = 80;

interface EmailInput {
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const { emails } = body as { emails?: EmailInput[] };

		if (!emails || !Array.isArray(emails) || emails.length < 2) {
			return json({ error: 'At least 2 emails required' }, { status: 400 });
		}

		const client = getGeminiClient();
		if (!client) {
			return json({ error: 'Gemini API not configured' }, { status: 503 });
		}

		const truncated = emails.slice(0, MAX_EMAILS);
		const validIds = new Set(truncated.map((e) => e.id));

		const emailList = truncated
			.map(
				(e, i) =>
					`${i + 1}. id="${e.id}" from="${e.from}" subject="${e.subject || '(none)'}" snippet="${(e.snippet || '').slice(0, SNIPPET_MAX)}" category="${e.category || 'unknown'}"`
			)
			.join('\n');

		const prompt = `You are an email triage assistant. Given these emails, create 2-8 logical groups based on sender, topic, or purpose. Assign every email to exactly one group. For each group, suggest a batch action.

Emails:
${emailList}

Respond with valid JSON matching this schema:
{
  "groups": [
    {
      "name": "Short descriptive group name",
      "emailIds": ["id1", "id2"],
      "suggestedAction": "archive|trash|mark_read|label|keep",
      "reason": "Brief explanation of why these are grouped and the suggested action"
    }
  ]
}

Rules:
- Every email must appear in exactly one group
- suggestedAction must be one of: archive, trash, mark_read, label, keep
- Use "keep" for emails that likely need human attention
- Use "trash" sparingly, only for clearly unwanted emails
- Group names should be concise (2-5 words)`;

		const response = await client.models.generateContent({
			model: 'gemini-2.0-flash',
			contents: prompt,
			config: {
				responseMimeType: 'application/json'
			}
		});

		const text = response.text ?? '';
		let parsed: { groups: AIGroup[] };
		try {
			parsed = JSON.parse(text);
		} catch {
			return json({ error: 'Failed to parse AI response' }, { status: 502 });
		}

		if (!parsed.groups || !Array.isArray(parsed.groups)) {
			return json({ error: 'Invalid AI response structure' }, { status: 502 });
		}

		// Validate: only keep valid emailIds, remove empty groups
		const validActions = new Set(['archive', 'trash', 'mark_read', 'label', 'keep']);
		const groups = parsed.groups
			.map((g) => ({
				name: String(g.name || 'Unnamed'),
				emailIds: (g.emailIds || []).filter((id: string) => validIds.has(id)),
				suggestedAction: validActions.has(g.suggestedAction) ? g.suggestedAction : 'keep',
				reason: String(g.reason || '')
			}))
			.filter((g) => g.emailIds.length > 0);

		return json({ groups });
	} catch (error) {
		console.error('AI grouping error:', error);
		return json({ error: 'AI grouping failed' }, { status: 500 });
	}
};
