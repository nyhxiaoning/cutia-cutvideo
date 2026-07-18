export interface GitHubSyncConfig {
	owner: string;
	repo: string;
	path: string;
	token: string;
	lastSyncedAt: string | null;
}

const STORAGE_KEY = "github-sync-config";

export async function getConfig(): Promise<GitHubSyncConfig | null> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as GitHubSyncConfig;
	} catch {
		return null;
	}
}

export async function setConfig(config: GitHubSyncConfig): Promise<void> {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function removeConfig(): Promise<void> {
	localStorage.removeItem(STORAGE_KEY);
}
