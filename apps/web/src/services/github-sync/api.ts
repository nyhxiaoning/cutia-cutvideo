import type { GitHubSyncConfig } from "./config-storage";
import { getConfig, setConfig } from "./config-storage";

export interface GitHubFileContent {
	sha: string;
	content: string;
}

export async function fetchFile({
	owner,
	repo,
	path,
	token,
}: {
	owner: string;
	repo: string;
	path: string;
	token: string;
}): Promise<GitHubFileContent | null> {
	const res = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
			},
		},
	);

	if (!res.ok) {
		if (res.status === 404) return null;
		const text = await res.text();
		throw new Error(`GitHub API error (${res.status}): ${text}`);
	}

	const data = await res.json();
	return {
		sha: data.sha,
		content: decodeBase64(data.content),
	};
}

export async function updateFile({
	owner,
	repo,
	path,
	token,
	content,
	sha,
	message,
}: {
	owner: string;
	repo: string;
	path: string;
	token: string;
	content: string;
	sha: string;
	message: string;
}): Promise<void> {
	const res = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message,
				content: encodeBase64(content),
				sha,
			}),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub API error (${res.status}): ${text}`);
	}
}

export async function createFile({
	owner,
	repo,
	path,
	token,
	content,
	message,
}: {
	owner: string;
	repo: string;
	path: string;
	token: string;
	content: string;
	message: string;
}): Promise<void> {
	const res = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message,
				content: encodeBase64(content),
			}),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub API error (${res.status}): ${text}`);
	}
}

export async function pullFromGitHub(): Promise<string> {
	const config = await getConfig();
	if (!config) throw new Error("GitHub sync not configured");

	const file = await fetchFile({
		owner: config.owner,
		repo: config.repo,
		path: config.path,
		token: config.token,
	});

	if (!file) throw new Error("File not found on remote");

	config.lastSyncedAt = new Date().toISOString();
	await setConfig(config);

	return file.content;
}

export async function pushToGitHub(content: string): Promise<void> {
	const config = await getConfig();
	if (!config) throw new Error("GitHub sync not configured");

	const existing = await fetchFile({
		owner: config.owner,
		repo: config.repo,
		path: config.path,
		token: config.token,
	});

	if (existing?.sha) {
		await updateFile({
			owner: config.owner,
			repo: config.repo,
			path: config.path,
			token: config.token,
			content,
			sha: existing.sha,
			message: `Update ${config.path}`,
		});
	} else {
		await createFile({
			owner: config.owner,
			repo: config.repo,
			path: config.path,
			token: config.token,
			content,
			message: `Add ${config.path}`,
		});
	}

	config.lastSyncedAt = new Date().toISOString();
	await setConfig(config);
}

function encodeBase64(str: string): string {
	if (typeof btoa === "undefined") {
		return Buffer.from(str).toString("base64");
	}
	return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str: string): string {
	if (typeof atob === "undefined") {
		return Buffer.from(str, "base64").toString("utf-8");
	}
	return decodeURIComponent(escape(atob(str)));
}
