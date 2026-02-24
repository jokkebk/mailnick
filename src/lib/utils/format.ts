export function formatDate(dateString: string): string {
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
