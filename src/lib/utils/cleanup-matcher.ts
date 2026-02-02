import type { CleanupRule, MatchCriteria, Condition, TaskMatch } from '$lib/types/cleanup';

export function matchesRule(email: any, criteria: MatchCriteria): boolean {
	if (criteria.type === 'all') {
		return criteria.conditions.every((cond) => matchesCondition(email, cond));
	} else {
		return criteria.conditions.some((cond) => matchesCondition(email, cond));
	}
}

function matchesCondition(email: any, condition: Condition): boolean {
	const fieldValue = email[condition.field] || '';
	const targetValue = condition.caseSensitive
		? fieldValue
		: String(fieldValue).toLowerCase();

	switch (condition.operator) {
		case 'equals': {
			const compareValue = condition.caseSensitive
				? condition.value
				: String(condition.value).toLowerCase();
			return targetValue === compareValue;
		}

		case 'contains': {
			const searchValue = condition.caseSensitive
				? condition.value
				: String(condition.value).toLowerCase();
			return targetValue.includes(searchValue);
		}

		case 'startsWith': {
			const startValue = condition.caseSensitive
				? condition.value
				: String(condition.value).toLowerCase();
			return targetValue.startsWith(startValue);
		}

		case 'endsWith': {
			const endValue = condition.caseSensitive
				? condition.value
				: String(condition.value).toLowerCase();
			return targetValue.endsWith(endValue);
		}

		case 'in': {
			const valueArray = Array.isArray(condition.value) ? condition.value : [condition.value];
			if (condition.caseSensitive) {
				return valueArray.includes(fieldValue);
			} else {
				return valueArray.some((v) => String(v).toLowerCase() === targetValue);
			}
		}

		default:
			return false;
	}
}

export function groupEmailsByRules(
	emails: any[],
	rules: CleanupRule[],
	hiddenTaskIds: string[]
): TaskMatch[] {
	const matches: TaskMatch[] = [];

	for (const rule of rules.filter((r) => r.enabled)) {
		const matchingEmails = emails.filter((email) => matchesRule(email, rule.matchCriteria));

		if (matchingEmails.length > 0) {
			matches.push({
				rule,
				emails: matchingEmails,
				totalCount: matchingEmails.length,
				hidden: hiddenTaskIds.includes(rule.id)
			});
		}
	}

	return matches.sort((a, b) => a.rule.displayOrder - b.rule.displayOrder);
}
