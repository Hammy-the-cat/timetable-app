"use client";

import { useMemo } from "react";
import { TimetableData, Teacher, ClassGroup, Subject } from "@/lib/types";
import { getEffectiveQuota } from "@/lib/school";

interface AssignmentAuditViewProps {
    data: TimetableData;
}

export function AssignmentAuditView({ data }: AssignmentAuditViewProps) {
    const { classes, teachers, subjects, schedule } = data;

    const isHomeroomForClass = (teacher: Teacher, cls: ClassGroup) =>
        teacher.id === cls.homeroomTeacherId ||
        (teacher.role === "homeroom" && !!teacher.homeroomClassIds?.includes(cls.id));

    const getExchangeClassForSubject = (sub: Subject, cls: ClassGroup) => {
        if (cls.type !== "special" || !cls.exchangeClassId) return undefined;
        const usesExchange =
            (cls.specialType === "intellectual" && !!sub.intellectualExchange?.[cls.grade]) ||
            (cls.specialType === "emotional" && !!sub.emotionalExchange?.[cls.grade]) ||
            (cls.specialType === "physical" && !!sub.physicalExchange?.[cls.grade]) ||
            !!sub.specialGradeExchange?.[cls.grade];
        return usesExchange ? classes.find(c => c.id === cls.exchangeClassId) : undefined;
    };

    const getPlannedTeachers = (sub: Subject, cls: ClassGroup) => {
        const assigned = teachers.filter(t =>
            t.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id))
        );
        if (assigned.length === 0 && getExchangeClassForSubject(sub, cls)) return [];
        return assigned.length > 0 ? assigned : teachers.filter(t => t.subjects.includes(sub.name));
    };

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

                // 誰がこの学級のこの教科を教えるはずか特定
                let plannedTeacherName = "未定";
                if (sub.name === "道徳" || sub.name === "学活") {
                    const hr = teachers.find(t => isHomeroomForClass(t, cls));
                    plannedTeacherName = hr ? hr.name : "未定";
                } else if (sub.name === "総合") {
                    const eligible = teachers.filter(t => t.taughtGrades?.includes(cls.grade) || isHomeroomForClass(t, cls));
                    plannedTeacherName = eligible.length > 0 ? eligible.map(e => e.name).join("/") : "学年所属未設定";
                } else {
                    const exchangeClass = getExchangeClassForSubject(sub, cls);
                    if (exchangeClass) {
                        plannedTeacherName = `(交流)${exchangeClass.label}組`;
                        return { name: sub.name, target, current, diff: target - current, plannedTeacherName };
                    }
                    const assigned = getPlannedTeachers(sub, cls);
                    plannedTeacherName = assigned.length > 0 ? assigned.map(t => t.name).join("/") : "未設定";
                }

                return { name: sub.name, target, current, diff: target - current, plannedTeacherName };
            }).filter(s => s.target > 0);

            return {
                id: cls.id,
                label: `${cls.grade}-${cls.label}`,
                shortages: shortages.filter(s => s.diff > 0),
                allSubjects: shortages,
                pendingTeacherCount: pendingSlots.length,
                pendingSlots,
                homeroomTeacher: teachers.find(t => t.id === cls.homeroomTeacherId)?.name || "未設定"
            };
        });
    }, [classes, teachers, subjects, schedule]);

    // 各教員の稼働状況サマリー
    const teacherStatus = useMemo(() => {
        return teachers.map((teacher) => {
            let actualCount = 0;
            const classAssignments: Record<string, string[]> = {};

            // 実績の集計
            Object.entries(schedule).forEach(([classId, week]) => {
                Object.values(week).forEach((periods) => {
                    Object.values(periods).forEach((cell) => {
                        if (cell.teacherId === teacher.id || cell.teacherIds?.includes(teacher.id)) {
                            actualCount++;
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

            // 計画（想定）時数の計算
            let plannedHours = 0;
            const plannedDetails: string[] = [];

            classes.forEach(cls => {
                subjects.forEach(sub => {
                    const target = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
                    if (target <= 0) return;

                    let isAssigned = false;
                    if (sub.name === "道徳" || sub.name === "学活") {
                        if (isHomeroomForClass(teacher, cls)) isAssigned = true;
                    } else if (sub.name === "総合") {
                        // 総合は「学年所属」または「担任」が担当可能。ここでは「学年所属」を主として計算に含める
                        if (teacher.taughtGrades?.includes(cls.grade) || isHomeroomForClass(teacher, cls)) isAssigned = true;
                    } else {
                        const assigned = teachers.some(t =>
                            t.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id))
                        );
                        if (assigned) {
                            if (teacher.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id))) isAssigned = true;
                        } else if (!getExchangeClassForSubject(sub, cls) && teacher.subjects.includes(sub.name)) {
                            isAssigned = true;
                        }
                    }

                    if (isAssigned) {
                        plannedHours += target;
                        plannedDetails.push(`${cls.grade}-${cls.label}(${sub.name})`);
                    }
                });
            });

            return {
                id: teacher.id,
                name: teacher.name,
                actualCount,
                plannedHours,
                plannedDetails,
                classAssignments,
                role: teacher.role === "homeroom" ? "担任" : "専科/副担",
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
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">主な担当配置 (計画)</th>
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
                                        <div className="text-[10px] font-bold text-slate-400 mt-1">担任: {cls.homeroomTeacher}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {cls.allSubjects.slice(0, 6).map((s, i) => (
                                                <div key={i} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                                                    <span className="text-[9px] font-bold text-slate-500">{s.name}</span>
                                                    <span className={`text-[9px] font-black ${s.plannedTeacherName === "未設定" ? "text-rose-400" : "text-indigo-600"}`}>
                                                        {s.plannedTeacherName}
                                                    </span>
                                                </div>
                                            ))}
                                            {cls.allSubjects.length > 6 && <span className="text-[8px] text-slate-300 font-bold ml-2">...ほか</span>}
                                        </div>
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
                                            <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Completed</span>
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
                                            <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">All Assigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(cls.shortages.length === 0 && cls.pendingTeacherCount === 0) ? (
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-xs font-black">正常</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-rose-500">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full" />
                                                <span className="text-xs font-black">調整中</span>
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
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">教員別・負荷及び設定進捗一覧</h3>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                    <table className="w-full border-separate border-spacing-0 text-left">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">氏名</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">役割</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">設定進捗 (実績 / 計画)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">主な担当学級</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">状態</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {teacherStatus.map((t) => {
                                const isComplete = t.actualCount >= t.plannedHours && t.plannedHours > 0;
                                const isOverLoaded = t.actualCount > 24;
                                const progress = t.plannedHours > 0 ? (t.actualCount / t.plannedHours) * 100 : 0;

                                return (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-base font-black text-slate-800">{t.name}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${t.role === "担任" ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}>
                                                {t.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-2 min-w-[150px]">
                                                <div className="flex items-baseline justify-between">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-lg font-black ${isComplete ? "text-emerald-600" : "text-slate-800"}`}>{t.actualCount}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">/ {t.plannedHours} コマ</span>
                                                    </div>
                                                    <span className={`text-[10px] font-black ${progress >= 100 ? "text-emerald-500" : "text-slate-400"}`}>
                                                        {Math.round(progress)}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${progress >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(t.classAssignments).length > 0 ? Object.entries(t.classAssignments).map(([cls, subs]) => (
                                                    <div key={cls} className="flex flex-col p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                                        <span className="text-[9px] font-black text-indigo-600 leading-none mb-1">{cls}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 leading-none">{subs.slice(0, 3).join(", ")}{subs.length > 3 ? "..." : ""}</span>
                                                    </div>
                                                )) : (
                                                    <span className="text-[9px] text-slate-300 font-bold uppercase italic tracking-widest">No assigned yet</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {isOverLoaded ? (
                                                    <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 text-center uppercase">Overloaded</span>
                                                ) : isComplete ? (
                                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-center uppercase">Complete</span>
                                                ) : t.plannedHours > 0 ? (
                                                    <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-center uppercase">In Progress</span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-center uppercase">Idle</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
