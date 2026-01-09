"use client";

import { useTimetableStore } from "@/store/timetable-store";

interface SidebarProps {
    activeView: string;
    onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
    const { data } = useTimetableStore();

    return (
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">表示・選択</h2>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* View Selection */}
                <div className="space-y-1">
                    <button
                        onClick={() => onViewChange("matrix")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "matrix" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">📊</span>
                        マトリックス表示
                    </button>
                    <button
                        onClick={() => onViewChange("settings")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "settings" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">⚙️</span>
                        基本設定・マスター
                    </button>
                </div>

                <div className="space-y-1">
                    <button onClick={() => onViewChange("overview")} className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors">
                        <span className="mr-3 text-lg">📈</span>
                        全体俯瞰（統計）
                    </button>
                </div>
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
                <p className="text-[10px] text-slate-400">VIBECORDING Pro</p>
                <p className="text-[10px] text-slate-400">TimeTable AI v2026</p>
            </div>
        </aside>
    );
}
