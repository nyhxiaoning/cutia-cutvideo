import type { GitHubSyncConfig } from "./types";

interface GitHubContentResponse {
	name: string;
	path: string;
	sha: string;
	size: number;
	content: string;
	encoding: string;
}

interface GitHubError {
	message: string;
	documentation_url?: string;
}

class GitHubApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "GitHubApiError";
		this.status = status;
	}
}

const GITHUB_API = "https://api.github.com";

async function request<T>({
	url,
	token,
	method = "GET",
	body,
}: {
	url: string;
	token: string;
	method?: string;
	body?: unknown;
}): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"Content-Type": "application/json",
			"User-Agent": "cutia-video-editor",
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const error: GitHubError = await response.json().catch(() => ({
			message: `HTTP ${response.status}`,
		}));
		throw new GitHubApiError(error.message, response.status);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

export async function fetchFileContent({
	config,
}: {
	config: GitHubSyncConfig;
}): Promise<string | null> {
	try {
		const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${config.path}`;
		const data = await request<GitHubContentResponse>({
			url,
			token: config.token,
		});
		if (data.encoding === "base64") {
			return atob(data.content);
		}
		return data.content;
	} catch (error) {
		if (error instanceof GitHubApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

export async function pushFileContent({
	config,
	content,
	commitMessage,
}: {
	config: GitHubSyncConfig;
	content: string;
	commitMessage?: string;
}): Promise<void> {
	const getUrl = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${config.path}`;
	let sha: string | undefined;

	// Get existing file SHA if it exists
	try {
		const existing = await request<GitHubContentResponse>({
			url: getUrl,
			token: config.token,
		});
		sha = existing.sha;
	} catch {
		// File doesn't exist yet, no SHA needed
	}

	const encoded = btoa(content);
	await request({
		url: getUrl,
		token: config.token,
		method: "PUT",
		body: {
			message: commitMessage ?? "Update project data from Cutia",
			content: encoded,
			sha,
		},
	});
}

export { GitHubApiError };
