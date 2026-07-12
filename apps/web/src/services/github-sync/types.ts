export interface GitHubSyncConfig {
	owner: string;
	repo: string;
	path: string;
	token: string;
	lastSyncedAt: string | null;
}

export const GITHUB_SYNC_STORAGE_KEY = "github-sync-config";
