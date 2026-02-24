export const ACTION_EXPIRY_HOURS = 24;
export const MAX_EMAIL_RESULTS = 200;

export const STORAGE_KEYS = {
	accountId: 'mailnick.accountId',
	syncDays: 'mailnick.syncDays',
	hiddenTasks: (accountId: string) => `mailnick.hiddenTasks.${accountId}`
} as const;
