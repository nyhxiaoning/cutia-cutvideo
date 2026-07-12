import { IS_DEV } from "@/constants/editor-constants";
import { DevPlayground } from "./dev-playground";

export default function PlaygroundPage() {
	if (!IS_DEV) return null;
	return <DevPlayground />;
}
