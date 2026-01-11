"use client";

import { DAY_CONFIGS, formatSlot } from "@/lib/school";
import { TimetableData, WeeklySlot, ScheduleCell, Weekday, ClassGroup, Teacher } from "@/lib/types";
import { useMemo } from "react";

interface MatrixViewProps {
    data: TimetableData;
    selectedSlot: { classId: string; slot: WeeklySlot } | null;
    onSelectSlot: (classId: string, slot: WeeklySlot) => void;
}

export function MatrixView({ data, selectedSlot, onSelectSlot }: MatrixViewProps) {
    const allSlots = useMemo(() => {
        return DAY_CONFIGS.flatMap((day) =>
            Array.from({ length: day.periods }, (_, i) => ({
                day: day.key as Weekday,
                period: i + 1,
            }))
        );
    }, []);

    const getClassLabel = (c: ClassGroup) => `${c.grade}-${c.label}`;

    const getSubjectName = (subjectId: string) => {
        return data.subjects.find((s) => s.id === subjectId)?.name || "";
    };

    const getTeacherLabel = (t: Teacher) => {
        const mainSubject = t.subjects[0] || "";
        return `${mainSubject} ${t.name}`;
    };

    const getMeetingName = (day: string, period: number) =>
        data.meetings.find((m) =>
            m.slots.some((s) => s.day === day && s.period === period)
        )?.name;

    const SUBJECT_ORDER = ["国語", "社会", "数学", "理科", "英語", "体育", "音楽", "美術", "技術", "家庭"];

    const sortedTeachers = useMemo(() => {
        const getSubjectScore = (s: string) => {
            const idx = SUBJECT_ORDER.indexOf(s);
            return idx === -1 ? 999 : idx;
        };

        return [...data.teachers].sort((a, b) => {
            const getPrimaryGrade = (t: Teacher) => {
                // 「所属学年(総合向け)」設定を尊重（複数ある場合は最高学年をメインとみなす）
                if (t.taughtGrades && t.taughtGrades.length > 0) {
                    return Math.max(...t.taughtGrades);
                }
                // 設定がない場合は担任学級から判定
                if (t.homeroomClassIds && t.homeroomClassIds.length > 0) {
                    const cls = data.classes.find(c => c.id === t.homeroomClassIds![0]);
                    if (cls) return cls.grade;
                }
                return 999; // 学年所属なし (専科など)
            };

            const gradeA = getPrimaryGrade(a);
            const gradeB = getPrimaryGrade(b);
            if (gradeA !== gradeB) return gradeA - gradeB;

            // 2. 同一学年内では「担任」を「副担（助手）」より先に
            if (a.role !== b.role) {
                return a.role === "homeroom" ? -1 : 1;
            }

            // 3. 教科順 (国語 -> 社会 ... )
            const subA = a.subjects[0] || "";
            const subB = b.subjects[0] || "";
            const scoreA = getSubjectScore(subA);
            const scoreB = getSubjectScore(subB);
            if (scoreA !== scoreB) return scoreA - scoreB;

            // 4. 名前順
            return a.name.localeCompare(b.name, "ja");
        });
    }, [data.teachers, data.classes]);

    return (
        <div className="flex flex-col gap-8 p-6 bg-slate-50 min-h-screen">
            {/* Header Info */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">全校時間割マトリックス</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase">IdeaEngine Timetable Professional Module</p>
                </div>
                <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-full text-xs font-bold border border-brand-100 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                    </span>
                    リアルタイム編集中
                </div>
            </div>

            {/* Top Part: Classes */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-brand-500 text-white rounded-lg shadow-lg shadow-brand-200">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </span>
                    <h3 className="text-lg font-black text-slate-800">学級別時間割</h3>
                </div>
                <div className="overflow-hidden shadow-2xl shadow-slate-200 border border-slate-200 rounded-2xl bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-30">
                                    <th className="border border-slate-200 p-4 sticky left-0 z-40 bg-slate-50 text-slate-400 font-black uppercase text-[10px] w-24">Grade-Class</th>
                                    {DAY_CONFIGS.map((day) => (
                                        <th
                                            key={day.key}
                                            colSpan={day.periods}
                                            className="border border-slate-200 p-2 text-center font-black text-slate-700 border-b-2 border-b-slate-400 border-r-4 border-r-slate-200 last:border-r-0"
                                        >
                                            {day.shortLabel}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50/50 sticky top-12 z-20">
                                    <th className="border border-slate-200 p-1 sticky left-0 z-40 bg-slate-50 border-r-2 border-r-slate-200"></th>
                                    {allSlots.map((s, i) => {
                                        const isLastOfData = i < allSlots.length - 1 && allSlots[i + 1].day !== s.day;
                                        return (
                                            <th key={i} className={`border border-slate-200 p-1 text-center w-14 font-mono font-black text-slate-400 ${isLastOfData ? 'border-r-4 border-r-slate-200' : ''}`}>
                                                {s.period}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {data.classes.map((cls) => (
                                    <tr key={cls.id} className="hover:bg-brand-50/30 transition-colors group">
                                        <td className="border border-slate-200 p-3 font-black text-slate-800 sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-center border-r-2 border-r-slate-300">
                                            {getClassLabel(cls)}
                                        </td>
                                        {allSlots.map((slot, i) => {
                                            const cell = data.schedule[cls.id]?.[slot.day]?.[slot.period];
                                            const subjectName = cell?.subjectId ? getSubjectName(cell.subjectId) : "";
                                            const meetingName = getMeetingName(slot.day, slot.period);
                                            const isSelected = selectedSlot?.classId === cls.id &&
                                                selectedSlot.slot.day === slot.day &&
                                                selectedSlot.slot.period === slot.period;

                                            const isLastOfData = i < allSlots.length - 1 && allSlots[i + 1].day !== slot.day;

                                            return (
                                                <td
                                                    key={i}
                                                    onClick={() => onSelectSlot(cls.id, slot)}
                                                    className={`border border-slate-200 p-1 text-center cursor-pointer transition-all h-14 min-w-[3.5rem] relative ${isSelected ? "bg-brand-50 ring-4 ring-inset ring-brand-500 z-10" : "hover:bg-brand-50"
                                                        } ${isLastOfData ? 'border-r-4 border-r-slate-200' : ''} ${meetingName ? 'bg-amber-50/20' : ''}`}
                                                >
                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                        <span className="font-bold text-slate-900 line-clamp-2 leading-tight">
                                                            {subjectName}
                                                        </span>
                                                        {cell?.teacherId && (() => {
                                                            const teacher = data.teachers.find(t => t.id === cell.teacherId);
                                                            const meeting = data.meetings.find(m =>
                                                                teacher?.meetingIds?.includes(m.id) &&
                                                                m.slots.some(s => s.day === slot.day && s.period === slot.period)
                                                            );
                                                            return meeting ? (
                                                                <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 uppercase tracking-tighter">
                                                                    {meeting.name}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Part: Teachers */}
            <div className="space-y-4 pb-24">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-200">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </span>
                    <h3 className="text-lg font-black text-slate-800">教員別・授業担当一覧</h3>
                </div>
                <div className="overflow-hidden shadow-2xl shadow-slate-200 border border-slate-200 rounded-2xl bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-30">
                                    <th className="border border-slate-200 p-4 sticky left-0 z-40 bg-slate-50 text-slate-400 font-black uppercase text-[10px] w-32 text-left">Teacher Name</th>
                                    {DAY_CONFIGS.map((day) => (
                                        <th
                                            key={day.key}
                                            colSpan={day.periods}
                                            className="border border-slate-200 p-2 text-center font-black text-slate-700 border-b-2 border-b-slate-400 border-r-4 border-r-slate-200 last:border-r-0"
                                        >
                                            {day.shortLabel}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50/50 sticky top-12 z-20">
                                    <th className="border border-slate-200 p-1 sticky left-0 z-40 bg-slate-50 border-r-2 border-r-slate-200"></th>
                                    {allSlots.map((s, i) => {
                                        const isLastOfData = i < allSlots.length - 1 && allSlots[i + 1].day !== s.day;
                                        return (
                                            <th key={i} className={`border border-slate-200 p-1 text-center w-14 font-mono font-black text-slate-400 ${isLastOfData ? 'border-r-4 border-r-slate-200' : ''}`}>
                                                {s.period}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTeachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="border border-slate-200 p-3 font-black text-slate-700 sticky left-0 z-10 bg-white group-hover:bg-slate-50 whitespace-nowrap border-r-2 border-r-slate-300">
                                            {getTeacherLabel(teacher)}
                                        </td>
                                        {allSlots.map((slot, i) => {
                                            const assignedClassLabels: string[] = [];
                                            for (const classId of Object.keys(data.schedule)) {
                                                const cell = data.schedule[classId]?.[slot.day]?.[slot.period];
                                                if (cell?.teacherId === teacher.id || cell?.teacherIds?.includes(teacher.id)) {
                                                    const cls = data.classes.find(c => c.id === classId);
                                                    if (cls) assignedClassLabels.push(getClassLabel(cls));
                                                }
                                            }
                                            const assignedClassLabel = assignedClassLabels.join(", ");
                                            const isLastOfData = i < allSlots.length - 1 && allSlots[i + 1].day !== slot.day;
                                            const isUnavailable = teacher.unavailable.some(us => us.day === slot.day && us.period === slot.period);
                                            const isParticipatingMeeting = teacher.meetingIds?.some(mid =>
                                                data.meetings.find(m => m.id === mid && m.slots.some(s => s.day === slot.day && s.period === slot.period))
                                            );

                                            return (
                                                <td
                                                    key={i}
                                                    className={`border border-slate-200 p-1 text-center h-14 min-w-[3.5rem] ${isUnavailable ? "bg-slate-100/50 slanted-stripes" : ""} ${isLastOfData ? 'border-r-4 border-r-slate-200' : ''} ${isParticipatingMeeting ? 'bg-amber-50/20' : ''}`}
                                                >
                                                    {isParticipatingMeeting ? (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 uppercase tracking-tighter">
                                                            会議
                                                        </span>
                                                    ) : (
                                                        <span className={`font-black text-indigo-700 ${assignedClassLabel.length > 4 ? 'text-[9px] tracking-tighter block leading-tight' : ''}`}>
                                                            {assignedClassLabel}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Part: Summary Statistics */}
            <div className="space-y-4 pb-24">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-200">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </span>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-black text-slate-800">授業時数・担当者集計表</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Weekly Lesson Count & Teacher Assignment Summary</p>
                    </div>
                </div>

                <div className="overflow-hidden shadow-2xl shadow-slate-200 border border-slate-200 rounded-2xl bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[10px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="border-r border-slate-200 p-3 sticky left-0 z-40 bg-slate-50 text-slate-500 font-black uppercase w-24">学級</th>
                                    {data.subjects.map(s => (
                                        <th key={s.id} className="border-r border-slate-200 p-2 text-slate-600 font-black min-w-[80px]">
                                            {s.name}
                                        </th>
                                    ))}
                                    <th className="p-3 bg-slate-800 text-white font-black uppercase w-20">合計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.classes.map(cls => {
                                    const classSchedule = data.schedule[cls.id] || {};
                                    let totalHours = 0;

                                    // 時数計算と担当者特定
                                    const stats = data.subjects.map(subject => {
                                        let count = 0;
                                        const teachers = new Set<string>();

                                        Object.values(classSchedule).forEach(day => {
                                            Object.values(day).forEach(cell => {
                                                if (cell.subjectId === subject.id) {
                                                    count++;
                                                    totalHours++;
                                                    if (cell.teacherId) {
                                                        const t = data.teachers.find(teacher => teacher.id === cell.teacherId);
                                                        if (t) teachers.add(t.name);
                                                    }
                                                    if (cell.teacherIds) {
                                                        cell.teacherIds.forEach(tId => {
                                                            const t = data.teachers.find(teacher => teacher.id === tId);
                                                            if (t) teachers.add(t.name);
                                                        });
                                                    }
                                                }
                                            });
                                        });

                                        return {
                                            count,
                                            teacherNames: Array.from(teachers).join(", ")
                                        };
                                    });

                                    return (
                                        <tr key={cls.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                            <td className="border-r border-slate-200 p-3 font-black text-slate-800 sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-center">
                                                {getClassLabel(cls)}
                                            </td>
                                            {stats.map((stat, idx) => (
                                                <td key={idx} className="border-r border-slate-100 p-2 text-center align-middle">
                                                    {stat.count > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-slate-900">{stat.count}h</span>
                                                            <span className="text-[8px] text-slate-400 font-medium truncate max-w-[70px] mx-auto" title={stat.teacherNames}>
                                                                {stat.teacherNames}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-200">-</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className={`p-3 text-center font-black text-sm ${totalHours !== 29 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {totalHours}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                        <span className="text-[10px] font-bold text-slate-500">29時間以外</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                        <span className="text-[10px] font-bold text-slate-500">29時間（正常）</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .slanted-stripes {
                    background-image: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 5px,
                        rgba(0, 0, 0, 0.05) 5px,
                        rgba(0, 0, 0, 0.05) 10px
                    );
                }
            `}</style>
        </div>
    );
}
