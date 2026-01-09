"use client";

import { useMemo } from "react";
import { useTimetableStore } from "@/store/timetable-store";
import { summarizeSubjectUsage } from "@/lib/validation";
import { getEffectiveQuota } from "@/lib/school";

export function LessonPalette() {
    const { data, selectedClassId } = useTimetableStore();

    const selectedClass = data.classes.find((c: any) => c.id === selectedClassId);
    const currentWeek = data.schedule[selectedClassId];

    const subjectSummary = useMemo(() => {
        if (!currentWeek) return [];
        const baseSummary = summarizeSubjectUsage(currentWeek, data.subjects);

        // 学年に応じた法定時数を適用する
        return baseSummary.map((item: any) => {
            if (selectedClass) {
                const target = getEffectiveQuota(
                    item.subject,
                    selectedClass.grade,
                    selectedClass.type || "normal",
                    selectedClass.specialType
                );
                return { ...item, target };
            }
            return { ...item, target: item.subject.weeklyQuota };
        });
    }, [currentWeek, data.subjects, selectedClass]);

    const totalRemaining = useMemo(() => {
        return subjectSummary.reduce((acc: number, s: any) => acc + Math.max(0, s.target - s.count), 0);
    }, [subjectSummary]);

    return (
        <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">配当駒 (残り)</h2>
                    <p className="text-[10px] text-slate-400 font-medium">{selectedClass?.grade}年生の標準時数</p>
                </div>
                <span className="bg-brand-100 text-brand-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {totalRemaining.toFixed(1)} コマ
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {subjectSummary.map(({ subject, count, target }: any) => {
                    const remaining = target - count;
                    const isComplete = remaining <= 0;

                    return (
                        <div
                            key={subject.id}
                            className={`p-2 rounded border transition-all ${!isComplete
                                ? "border-brand-200 bg-brand-50/30 hover:shadow-md"
                                : "border-slate-100 bg-slate-50 opacity-60"
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-700">{subject.name}</span>
                                <span className={`text-[10px] font-mono ${!isComplete ? "text-brand-600" : "text-slate-400"}`}>
                                    {count} / {target}
                                </span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-1">
                                <div
                                    className={`h-1 rounded-full ${!isComplete ? "bg-brand-500" : "bg-slate-400"}`}
                                    style={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                                ></div>
                            </div>

                            {!isComplete && (
                                <p className="mt-1 text-[9px] text-brand-600 font-medium">残り {remaining.toFixed(1)} コマ</p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[9px] text-slate-400 leading-relaxed uppercase font-bold text-center tracking-widest">
                    Statutory Progress Check
                </p>
            </div>
        </aside>
    );
}
