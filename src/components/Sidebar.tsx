"use client";

import { useMemo } from "react";

import { runAllChecks } from "@/lib/checks";
import { useTimetableStore } from "@/store/timetable-store";

interface SidebarProps {
    activeView: string;
    onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
    const { data } = useTimetableStore();

    const errorCount = useMemo(
        () => runAllChecks(data).filter((i) => i.severity === "error").length,
        [data]
    );

    return (
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">表示・選択</h2>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* View Selection */}
                <div className="space-y-1">
                    <button
                        onClick={() => onViewChange("home")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "home" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">🏠</span>
                        ホーム
                    </button>
                    <button
                        onClick={() => onViewChange("wizard")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "wizard" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">🧭</span>
                        初期設定ウィザード
                    </button>
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
                    <button
                        onClick={() => onViewChange("jointExchange")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "jointExchange" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">🤝</span>
                        合同・交流設定
                    </button>
                    <button
                        onClick={() => onViewChange("check")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "check" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">🔍</span>
                        チェック結果
                        {errorCount > 0 && (
                            <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                                {errorCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => onViewChange("io")}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "io" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        <span className="mr-3 text-lg">📤</span>
                        入出力・年度更新
                    </button>
                </div>

                <div className="space-y-1">
                    <button onClick={() => onViewChange("overview")} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "overview" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"}`}>
                        <span className="mr-3 text-lg">📈</span>
                        全体俯瞰（統計）
                    </button>
                    <button onClick={() => onViewChange("audit")} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === "audit" ? "bg-brand-50 text-brand-500" : "text-slate-600 hover:bg-slate-50"}`}>
                        <span className="mr-3 text-lg">📋</span>
                        設定進捗レポート
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
