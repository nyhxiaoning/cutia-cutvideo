import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { i18nConfig } from "../../i18n.config";
import fs from "fs";
import path from "path";

export function generateStaticParams() {
	return i18nConfig.locales.map((locale) => ({ locale }));
}

function loadMessages(locale: string) {
	const messages: Record<string, Record<string, string>> = {};
	const localeDir = path.resolve(process.cwd(), i18nConfig.localeDir);
	for (const ns of i18nConfig.namespaces) {
		const filePath = path.join(localeDir, locale, `${ns}.json`);
		try {
			const content = fs.readFileSync(filePath, "utf-8");
			messages[ns] = JSON.parse(content);
		} catch {
			messages[ns] = {};
		}
	}
	return messages;
}

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const messages = loadMessages(locale);

	return (
		<I18nProvider
			locale={locale}
			locales={i18nConfig.locales}
			defaultLocale={i18nConfig.defaultLocale}
			messages={messages}
			routingStrategy={i18nConfig.routingStrategy}
		>
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange={true}
			>
				<TooltipProvider>
					<Toaster />
					{children}
				</TooltipProvider>
			</ThemeProvider>
		</I18nProvider>
	);
}
