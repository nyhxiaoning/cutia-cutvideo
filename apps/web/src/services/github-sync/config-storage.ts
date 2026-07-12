import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { GitHubSyncConfig } from "./types";

const STORAGE_KEY = "github-sync-config";

class GitHubConfigStorage {
	private adapter: IndexedDBAdapter<GitHubSyncConfig>;

	constructor() {
		this.adapter = new IndexedDBAdapter<GitHubSyncConfig>(
			"video-editor-github-sync",
			"github-config",
			1,
		);
	}

	async get(): Promise<GitHubSyncConfig | null> {
		try {
			return await this.adapter.get(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	async set(config: GitHubSyncConfig): Promise<void> {
		await this.adapter.set(STORAGE_KEY, config);
	}

	async remove(): Promise<void> {
		await this.adapter.remove(STORAGE_KEY);
	}
}

export const githubConfigStorage = new GitHubConfigStorage();
