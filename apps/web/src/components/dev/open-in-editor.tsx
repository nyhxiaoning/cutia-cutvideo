"use client";

interface OpenInEditorProps {
	source: string;
	line?: number;
}

const PROJECT_ROOT = "/Users/henryheng/Code/personCode/cutia-cutvideo";

export function OpenInEditor({ source, line }: OpenInEditorProps) {
	const filePath = `${PROJECT_ROOT}/apps/web/${source}`;
	const url = `vscode://file${filePath}${line ? `:${line}` : ""}`;

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			title={`Open ${source}${line ? `:${line}` : ""}`}
			className="absolute right-1 top-1 z-[9999] cursor-pointer rounded-sm px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground/30 no-underline transition-all hover:bg-accent hover:text-muted-foreground group-hover:text-muted-foreground/70"
			onClick={(e) => e.stopPropagation()}
		>
			{source.split("/").pop()}
			{line ? `:${line}` : ""}
		</a>
	);
}
