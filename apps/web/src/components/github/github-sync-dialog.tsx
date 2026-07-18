"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { toast } from "sonner";
import { Github, Eye, EyeOff, Trash2, Download, Upload } from "lucide-react";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getConfig, setConfig, removeConfig } from "@/services/github-sync/config-storage";

export function GitHubSyncDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const [owner, setOwner] = useState("");
	const [repo, setRepo] = useState("");
	const [path, setPath] = useState("");
	const [token, setToken] = useState("");
	const [showToken, setShowToken] = useState(false);
	const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
	const [hasConfig, setHasConfig] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		setShowToken(false);
		getConfig().then((config) => {
			if (config) {
				setOwner(config.owner);
				setRepo(config.repo);
				setPath(config.path);
				setToken("");
				setLastSyncedAt(config.lastSyncedAt);
				setHasConfig(true);
			} else {
				setOwner("");
				setRepo("");
				setPath("data/projects.json");
				setToken("");
				setLastSyncedAt(null);
				setHasConfig(false);
			}
		});
	}, [isOpen]);

	const handleSave = async () => {
		if (!owner.trim() || !repo.trim() || !path.trim() || !token.trim()) {
			toast.warning(t("Please fill in all fields"));
			return;
		}
		try {
			const existing = await getConfig();
			await setConfig({
				owner: owner.trim(),
				repo: repo.trim(),
				path: path.trim(),
				token: token.trim(),
				lastSyncedAt: existing?.lastSyncedAt ?? null,
			});
			setHasConfig(true);
			toast.success(t("GitHub sync configuration saved"));
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t("Failed to save configuration"),
			);
		}
	};

	const handleClear = async () => {
		try {
			await removeConfig();
			setOwner("");
			setRepo("");
			setPath("data/projects.json");
			setToken("");
			setLastSyncedAt(null);
			setHasConfig(false);
			toast.success(t("Sync configuration cleared"));
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t("Failed to clear configuration"),
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[500px]"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Github className="size-5" />
						{t("GitHub Sync")}
					</DialogTitle>
				</DialogHeader>

				<DialogBody>
					{/* Status banner */}
					{hasConfig && lastSyncedAt && (
						<div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
							<div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
							<div className="flex-1">
								<p className="font-medium text-emerald-700 dark:text-emerald-400">
									{t("Sync configured")}
								</p>
								<p className="text-emerald-600/70 dark:text-emerald-500/70 text-xs">
									{t("Last synced")}:{" "}
									{new Date(lastSyncedAt).toLocaleString()}
								</p>
							</div>
						</div>
					)}

					{/* Repository section */}
					<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{t("Repository")}
						</p>
						<div className="flex gap-3">
							<div className="flex-1 space-y-1.5">
								<label
									className="text-xs font-medium text-muted-foreground"
									htmlFor="github-owner"
								>
									{t("Owner")}
								</label>
								<Input
									id="github-owner"
									value={owner}
									onChange={(e) => setOwner(e.target.value)}
									placeholder={t("e.g. nyhxiaoning")}
								/>
							</div>
							<div className="flex-[2] space-y-1.5">
								<label
									className="text-xs font-medium text-muted-foreground"
									htmlFor="github-repo"
								>
									{t("Repository name")}
								</label>
								<Input
									id="github-repo"
									value={repo}
									onChange={(e) => setRepo(e.target.value)}
									placeholder={t("e.g. jsongallary")}
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<label
								className="text-xs font-medium text-muted-foreground"
								htmlFor="github-path"
							>
								{t("File path")}
							</label>
							<Input
								id="github-path"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder={t("e.g.cutvideo/projects.json")}
							/>
							<p className="text-xs text-muted-foreground">
								{t("Path within the repository where data is stored")}
							</p>
						</div>
					</div>

					{/* Token section */}
					<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{t("Authentication")}
						</p>
						<div className="space-y-1.5">
							<label
								className="text-xs font-medium text-muted-foreground"
								htmlFor="github-token"
							>
								{t("Personal Access Token")}
							</label>
							<div className="relative">
								<Input
									id="github-token"
									type={showToken ? "text" : "password"}
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder="ghp_..."
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowToken(!showToken)}
									className="text-muted-foreground hover:text-foreground absolute right-0 top-0 flex h-full items-center px-3"
									tabIndex={-1}
								>
									{showToken ? (
										<EyeOff className="size-4" />
									) : (
										<Eye className="size-4" />
									)}
								</button>
							</div>
							<p className="text-xs text-muted-foreground">
								{t("Requires")}{" "}
								<code className="rounded bg-muted px-1 py-0.5 text-xs">repo</code>{" "}
								{t("scope.")}{" "}
								<a
									href="https://github.com/settings/tokens"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-primary hover:underline"
								>
									{t("Create token")} &rarr;
								</a>
							</p>
						</div>
					</div>

					{/* Actions */}
					<div className="flex items-center justify-between gap-3 border-t pt-4">
						{hasConfig ? (
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={handleClear}
							>
								<Trash2 className="size-4" />
								{t("Clear config")}
							</Button>
						) : (
							<div />
						)}
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								{t("Cancel")}
							</Button>
							<Button type="button" onClick={handleSave}>
								{t("Save config")}
							</Button>
						</div>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
