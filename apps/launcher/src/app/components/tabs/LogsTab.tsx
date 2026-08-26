import { useEffect, useState, useRef } from "react";
import { Copy, Trash2, Check, RefreshCw } from "lucide-react";
import { getGameLogs, clearGameLogs } from "../../../shared/api/launcherClient";

export function LogsTab() {
	const [logs, setLogs] = useState<string[]>([]);
	const [autoScroll, setAutoScroll] = useState(true);
	const [copied, setCopied] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const fetchLogs = async (showSpinner = false) => {
		if (showSpinner) setRefreshing(true);
		try {
			const data = await getGameLogs();
			setLogs(data.logs);
		} catch (err) {
			console.error("Failed to fetch logs", err);
		} finally {
			if (showSpinner) setRefreshing(false);
		}
	};

	useEffect(() => {
		fetchLogs();
		const interval = setInterval(() => fetchLogs(false), 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (autoScroll && containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [logs, autoScroll]);

	const handleCopy = async () => {
		if (logs.length === 0) return;
		try {
			await navigator.clipboard.writeText(logs.join("\n"));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy logs", err);
		}
	};

	const handleClear = async () => {
		try {
			await clearGameLogs();
			setLogs([]);
		} catch (err) {
			console.error("Failed to clear logs", err);
		}
	};

	// Helper to colorize log lines
	const getLineColor = (line: string) => {
		const upper = line.toUpperCase();
		if (upper.includes("ERROR") || upper.includes("ERR") || upper.includes("EXCEPTION") || upper.includes("FATAL")) {
			return "text-red-400 font-medium";
		}
		if (upper.includes("WARN") || upper.includes("WARNING")) {
			return "text-amber-400 font-medium";
		}
		if (upper.includes("[LAUNCHER]") || upper.includes("STARTING") || upper.includes("LAUNCHING")) {
			return "text-purple-400 font-medium";
		}
		if (upper.includes("DEBUG") || upper.includes("[🔍 DEBUG]")) {
			return "text-zinc-500 text-xs";
		}
		return "text-zinc-300";
	};

	return (
		<div className="flex flex-col h-[420px] w-full text-sm animate-in fade-in duration-300">
			{/* Controls Header */}
			<div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 shrink-0">
				<div className="flex items-center gap-4">
					<label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none text-xs">
						<input
							type="checkbox"
							checked={autoScroll}
							onChange={(e) => setAutoScroll(e.target.checked)}
							className="rounded bg-zinc-900 border-zinc-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-zinc-900 size-3.5 hover:border-purple-500 transition-colors"
						/>
						Défilement automatique
					</label>
					<button
						onClick={() => fetchLogs(true)}
						className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
						title="Actualiser"
					>
						<RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
					</button>
				</div>
				
				<div className="flex items-center gap-2">
					<button
						onClick={handleCopy}
						disabled={logs.length === 0}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
					>
						{copied ? (
							<>
								<Check className="size-3.5 text-emerald-400 animate-in zoom-in duration-200" />
								<span className="text-emerald-400">Copié !</span>
							</>
						) : (
							<>
								<Copy className="size-3.5" />
								<span>Copier</span>
							</>
						)}
					</button>
					<button
						onClick={handleClear}
						disabled={logs.length === 0}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700/60 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
					>
						<Trash2 className="size-3.5" />
						<span>Effacer</span>
					</button>
				</div>
			</div>

			{/* Terminal Display */}
			<div
				ref={containerRef}
				className="flex-1 min-h-0 bg-black/75 rounded-lg border border-zinc-800 p-4 font-mono overflow-y-auto no-scrollbar scroll-smooth relative"
			>
				{logs.length === 0 ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
						<div className="size-8 rounded-full border border-dashed border-zinc-700 flex items-center justify-center animate-pulse">
							$
						</div>
						<p className="text-xs">Aucun log pour le moment.</p>
						<p className="text-[10px] text-zinc-600 max-w-[250px]">
							Lancez le jeu ou effectuez une action pour voir les messages de diagnostic s'afficher ici.
						</p>
					</div>
				) : (
					<div className="space-y-1 text-xs select-text">
						{logs.map((log, index) => (
							<div key={index} className={`whitespace-pre-wrap leading-relaxed break-all ${getLineColor(log)}`}>
								{log}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
