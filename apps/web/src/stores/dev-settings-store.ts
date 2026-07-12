"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevSettingsState {
	showOpenInEditor: boolean;
	toggleOpenInEditor: () => void;
	setShowOpenInEditor: (show: boolean) => void;
}

export const useDevSettingsStore = create<DevSettingsState>()(
	persist(
		(set) => ({
			showOpenInEditor: true,
			toggleOpenInEditor: () =>
				set((state) => ({ showOpenInEditor: !state.showOpenInEditor })),
			setShowOpenInEditor: (show: boolean) =>
				set({ showOpenInEditor: show }),
		}),
		{
			name: "cutia-dev-settings",
			partialize: (state) => ({
				showOpenInEditor: state.showOpenInEditor,
			}),
		},
	),
);
