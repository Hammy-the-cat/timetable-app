"use client";

import { useMemo } from "react";
import { TimetableData, Teacher, ClassGroup, Subject } from "@/lib/types";
import { getEffectiveQuota } from "@/lib/school";

interface AssignmentAuditViewProps {
    data: TimetableData;
}

export function AssignmentAuditView({ data }: AssignmentAuditViewProps) {
    const { classes, teachers, subjects, schedule } = data;

    // 各クラスの未設定コマのサマリー
    const classStatus = useMemo(() => {
        return classes.map((cls) => {
            const week = schedule[cls.id] || {};
            const subjectCounts: Record<string, number> = {};
            const pendingSlots: string[] = [];

            // 現在の時間割を集計
            Object.entries(week).forEach(([day, periods]) => {
                Object.entries(periods).forEach(([period, cell]) => {
                    if (cell.subjectId) {
                        subjectCounts[cell.subjectId] = (subjectCounts[cell.subjectId] || 0) + 1;
                        if (!cell.teacherId) {
                            pendingSlots.push(`${day.toUpperCase().slice(0, 1)}${period}`);
                        }
                    }
                });
            });

            // 目標コマ数との比較
            const shortages = subjects.map(sub => {
                const target = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
                const current = subjectCounts[sub.id] || 0;
                return { name: sub.name, target, current, diff: target - current };
            }).filter(s => s.diff > 0);

            return {
                id: cls.id,
                label: `${cls.grade}-${cls.label}`,
                shortages,
                pendingTeacherCount: pendingSlots.length,
                pendingSlots,
                homeroomTeacher: teachers.find(t => t.id === cls.homeroomTeacherId)?.name || "未設定"
            };
        });
    }, [classes, teachers, subjects, schedule]);

    // 各教員の稼働状況サマリー
    const teacherStatus = useMemo(() => {
        return teachers.map((teacher) => {
            let assignedCount = 0;
            const classAssignments: Record<string, string[]> = {};

            Object.entries(schedule).forEach(([classId, week]) => {
                Object.values(week).forEach((periods) => {
                    Object.values(periods).forEach((cell) => {
                        if (cell.teacherId === teacher.id) {
                            assignedCount++;
                            const cls = classes.find(c => c.id === classId);
                            if (cls) {
                                const label = `${cls.grade}-${cls.label}`;
                                if (!classAssignments[label]) classAssignments[label] = [];
                                const sub = subjects.find(s => s.id === cell.subjectId)?.name || "不明";
                                if (!classAssignments[label].includes(sub)) classAssignments[label].push(sub);
                            }
                        }
                    });
                });
            });

            return {
                id: teacher.id,
                name: teacher.name,
                assignedCount,
                classAssignments,
                role: teacher.role === "homeroom" ? "担任" : "専科/副担",
                subjects: teacher.subjects,
            };
        });
    }, [teachers, classes, subjects, schedule]);

    return (
        <div className="space-y-10 pb-20">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Classes</p>
                    <p className="text-3xl font-black text-slate-800">{classes.length} <span className="text-sm font-bold text-slate-400">学級</span></p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Teachers</p>
                    <p className="text-3xl font-black text-slate-800">{teachers.length} <span className="text-sm font-bold text-slate-400">名</span></p>
                </div>
                <div className="bg-indigo-500 p-6 rounded-2xl shadow-lg shadow-indigo-200">
                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Unassigned Teacher Slots</p>
                    <p className="text-3xl font-black text-white">
                        {classStatus.reduce((acc, c) => acc + c.pendingTeacherCount, 0)} <span className="text-sm font-bold text-white/70">コマ未定</span>
                    </p>
                </div>
            </div>

            {/* Class Status Table */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-brand-500 rounded-full" />
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">学級別・設定状況チェック一覧</h3>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                    <table className="w-full border-separate border-spacing-0 text-left">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">クラス</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">担任</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">不足コマ数 (配当コマ未達)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">教官未設定のコマ</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">ステータス</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {classStatus.map((cls) => (
                                <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-lg font-black text-slate-800">{cls.label}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-bold text-slate-600">{cls.homeroomTeacher}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {cls.shortages.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {cls.shortages.map((s, i) => (
                                                    <span key={i} className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-black border border-rose-100">
                                                        {s.name}: 不足{s.diff}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-emerald-500 font-black uppercase">Complete</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {cls.pendingTeacherCount > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-black text-amber-600">計 {cls.pendingTeacherCount} コマ</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {cls.pendingSlots.map((s, i) => (
                                                        <span key={i} className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded font-bold border border-amber-100">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-emerald-500 font-black uppercase">All Set</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(cls.shortages.length === 0 && cls.pendingTeacherCount === 0) ? (
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                <span className="text-xs font-black">正常</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-rose-500">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                <span className="text-xs font-black">未完了</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Teacher Status Table */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">教員別・負荷及び設定状況一覧</h3>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                    <table className="w-full border-separate border-spacing-0 text-left">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">氏名</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">役割</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">週当たり時数</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">主な担当学級</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">状態</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {teacherStatus.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-base font-black text-slate-800">{t.name}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${t.role === "担任" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                            {t.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-black text-slate-800">{t.assignedCount}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">コマ / 週</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(t.classAssignments).map(([cls, subs]) => (
                                                <div key={cls} className="flex flex-col p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                                    <span className="text-[9px] font-black text-indigo-600 leading-none mb-1">{cls}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 leading-none">{subs.slice(0, 3).join(", ")}{subs.length > 3 ? "..." : ""}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.assignedCount === 0 ? (
                                            <span className="text-xs font-black text-slate-300 uppercase italic">Idle</span>
                                        ) : t.assignedCount > 24 ? (
                                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">負荷過多</span>
                                        ) : (
                                            <span className="text-xs font-black text-emerald-500">稼働中</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
