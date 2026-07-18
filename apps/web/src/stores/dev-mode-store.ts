import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevModeState {
	isEnabled: boolean;
	toggle: () => void;
}

export const useDevModeStore = create<DevModeState>()(
	persist(
		(set) => ({
			isEnabled: false,
			toggle: () => set((prev) => ({ isEnabled: !prev.isEnabled })),
		}),
		{
			name: "dev-mode",
		},
	),
);
