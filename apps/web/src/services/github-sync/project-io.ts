import { storageService } from "@/services/storage/service";
import type { TProject } from "@/types/project";

export async function exportAllProjects(): Promise<string> {
	const projects = await storageService.loadAllProjects();
	return JSON.stringify(projects, null, 2);
}

export async function importProjects(json: string): Promise<{ imported: number; updated: number; skipped: number }> {
	let parsed: TProject[];
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new Error("Invalid JSON format");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Expected an array of projects");
	}

	let imported = 0;
	let updated = 0;
	let skipped = 0;

	for (const project of parsed) {
		if (!project?.metadata?.id) {
			skipped++;
			continue;
		}

		const existing = await storageService.loadProject({ id: project.metadata.id });
		if (existing) {
			await storageService.saveProject({ project });
			updated++;
		} else {
			await storageService.saveProject({ project });
			imported++;
		}
	}

	return { imported, updated, skipped };
}
