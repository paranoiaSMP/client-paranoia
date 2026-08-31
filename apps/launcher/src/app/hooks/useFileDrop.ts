import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { apiRequest } from "../../shared/api/http";

export function useFileDrop(onImport: () => void) {
	const [isHovering, setIsHovering] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const onImportRef = useRef(onImport);
	onImportRef.current = onImport;

	useEffect(() => {
		let unlistenEnter: (() => void) | undefined;
		let unlistenLeave: (() => void) | undefined;
		let unlistenDrop: (() => void) | undefined;

		async function setup() {
			unlistenEnter = await listen("tauri://drag-enter", () => {
				setIsHovering(true);
			});

			unlistenLeave = await listen("tauri://drag-leave", () => {
				setIsHovering(false);
			});

			unlistenDrop = await listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
				setIsHovering(false);
				const paths = event.payload.paths;
				if (!paths || paths.length === 0) return;

				setIsProcessing(true);
				try {
					await apiRequest("/v1/profiles/import-paths", {
						method: "POST",
						body: JSON.stringify({ paths }),
					});
					onImportRef.current();
				} catch (e) {
					console.error("Import failed:", e);
				} finally {
					setIsProcessing(false);
				}
			});
		}

		setup();

		return () => {
			unlistenEnter?.();
			unlistenLeave?.();
			unlistenDrop?.();
		};
	}, []);

	return { isDragging: isHovering, isProcessing };
}