export interface CleanupRule {
	id: string;
	accountId: string;
	name: string;
	matchCriteria: MatchCriteria;
	color?: string;
	enabled: boolean;
	displayOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface MatchCriteria {
	type: 'all' | 'any';
	conditions: Condition[];
}

export interface Condition {
	field: 'from' | 'fromDomain' | 'to' | 'subject' | 'category' | 'snippet';
	operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in';
	value: string | string[];
	caseSensitive?: boolean;
}

export interface TaskMatch {
	rule: CleanupRule;
	emails: any[]; // Email type from main app
	totalCount: number;
	hidden: boolean;
}
