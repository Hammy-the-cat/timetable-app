import { TimetableData, Weekday, ScheduleCell, Teacher, Subject, ClassGroup, WeeklySlot } from "./types";
import { DAY_CONFIGS, getEffectiveQuota } from "./school";

/**
 * タイムテーブル自動生成エンジン (IdeaEngine AI Scheduler)
 */
export function generateAutoTimetable(data: TimetableData): TimetableData {
    const { classes, teachers, subjects, schedule } = data;
    const newSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy

    // --- 前準備: 各クラスの必要時数を算出 ---
    const classNeeds: Record<string, { subjectId: string; count: number; teacherIds: string[] }[]> = {};

    classes.forEach(cls => {
        classNeeds[cls.id] = subjects.map(sub => {
            const quota = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);

            // 現在のコマ数を引く
            let currentCount = 0;
            Object.values(newSchedule[cls.id] || {}).forEach((day: any) => {
                Object.values(day).forEach((cell: any) => {
                    if (cell.subjectId === sub.id) currentCount++;
                });
            });

            const remaining = Math.max(0, Math.ceil(quota) - currentCount);

            // 担当教師の特定
            let assignedTeacherIds: string[] = [];
            if (sub.name === "道徳" || sub.name === "学活") {
                const hr = teachers.find(t => t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id));
                if (hr) assignedTeacherIds.push(hr.id);
            } else if (sub.name === "総合") {
                // 総合は学年所属の先生全員（または担任）
                const eligible = teachers.filter(t => t.taughtGrades?.includes(cls.grade) || (t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id)));
                assignedTeacherIds = eligible.map(e => e.id);
            } else {
                // 通常教科: subjectAssignments に登録されている先生をすべて抽出 (複数教員対応)
                assignedTeacherIds = teachers
                    .filter(t => t.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id)))
                    .map(t => t.id);

                // もし一人もいない場合は、その教科を教えられる先生から仮で探す（などのフォールバックはここではせず、設定を優先する）
            }

            return { subjectId: sub.id, count: remaining, teacherIds: assignedTeacherIds };
        }).filter(n => n.count > 0);
    });

    // --- ループ: 空きコマを埋めていく ---
    // 並び順をランダム化して偏りを防ぐ
    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);
    const allSlots: { day: Weekday; period: number }[] = DAY_CONFIGS.flatMap(d =>
        Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 }))
    ).sort(() => Math.random() - 0.5);

    // 教師のその日の「休み（授業なし）」を取得済みか管理する
    // 担任設定の教師は1日1回は空きが必要 (制約③)
    const hrTeachers = teachers.filter(t => t.role === "homeroom");

    const checkTeacherFree = (tId: string, day: Weekday, period: number, currentSchedule: any): boolean => {
        // 1. 会議中か？
        const teacher = teachers.find(t => t.id === tId);
        if (teacher?.meetingIds) {
            const isInMeeting = data.meetings.some(m =>
                teacher.meetingIds?.includes(m.id) &&
                m.slots.some(s => s.day === day && s.period === period)
            );
            if (isInMeeting) return false;
        }

        // 2. 授業不可時間か？
        if (teacher?.unavailable.some(s => s.day === day && s.period === period)) return false;

        // 3. 他の学級で授業中か？
        for (const cId of Object.keys(currentSchedule)) {
            if (currentSchedule[cId][day]?.[period]?.teacherIds?.includes(tId) ||
                currentSchedule[cId][day]?.[period]?.teacherId === tId) {
                return false;
            }
        }
        return true;
    };

    const hasPrepPeriod = (tId: string, day: Weekday, currentSchedule: any, exceptSlot?: { period: number }): boolean => {
        const dayConfig = DAY_CONFIGS.find(d => d.key === day);
        if (!dayConfig) return true;

        for (let p = 1; p <= dayConfig.periods; p++) {
            if (exceptSlot && exceptSlot.period === p) continue;

            let isWorking = false;
            // この時間に仕事（授業・会議・不可）があるかチェック
            const teacher = teachers.find(t => t.id === tId);
            if (teacher?.meetingIds?.some(mid => data.meetings.find(m => m.id === mid)?.slots.some(s => s.day === day && s.period === p))) isWorking = true;
            if (teacher?.unavailable.some(s => s.day === day && s.period === p)) isWorking = true;

            if (!isWorking) {
                // 全クラス分回して授業してないか確認
                let inClass = false;
                for (const cId of Object.keys(currentSchedule)) {
                    const cell = currentSchedule[cId][day]?.[p];
                    if (cell?.teacherIds?.includes(tId) || cell?.teacherId === tId) {
                        inClass = true;
                        break;
                    }
                }
                if (!inClass) return true; // 空きがあった！
            }
        }
        return false;
    };

    // 詰め込み処理
    for (const slot of allSlots) {
        for (const cls of shuffledClasses) {
            const currentCell = newSchedule[cls.id]?.[slot.day]?.[slot.period];
            if (currentCell && currentCell.subjectId) continue; // すでに埋まっている

            // この学級の本日既出教科を取得 (制約①)
            const subjectsToday = Object.values(newSchedule[cls.id][slot.day] || {})
                .map((cell: any) => cell.subjectId)
                .filter(Boolean);

            // 候補教科をシャッフル
            const pool = classNeeds[cls.id].filter(n => n.count > 0 && !subjectsToday.includes(n.subjectId));
            pool.sort(() => Math.random() - 0.5);

            for (const candidate of pool) {
                // 全教員が空いているか確認 (制約②)
                const allTeachersFree = candidate.teacherIds.every(tId => checkTeacherFree(tId, slot.day, slot.period, newSchedule));
                if (!allTeachersFree) continue;

                // 担任教官の空き枠確保チェック (制約③)
                // もし今回の候補者に担任が含まれる場合、今日他に空きがあるか（またはこれから作れるか）確認
                let hrViolation = false;
                for (const tId of candidate.teacherIds) {
                    const t = teachers.find(x => x.id === tId);
                    if (t?.role === "homeroom") {
                        // 今日最後のコマ、かつ他に空きがない場合はNG
                        const dayConfig = DAY_CONFIGS.find(d => d.key === slot.day);
                        if (slot.period === dayConfig?.periods) {
                            if (!hasPrepPeriod(tId, slot.day, newSchedule, slot)) {
                                hrViolation = true;
                                break;
                            }
                        }
                    }
                }
                if (hrViolation) continue;

                // 配置！
                if (!newSchedule[cls.id][slot.day]) newSchedule[cls.id][slot.day] = {};
                newSchedule[cls.id][slot.day][slot.period] = {
                    subjectId: candidate.subjectId,
                    teacherIds: candidate.teacherIds,
                    teacherId: candidate.teacherIds[0] || undefined, // 互換性のため一人目を入れておく
                };
                candidate.count--;
                break;
            }
        }
    }

    return {
        ...data,
        schedule: newSchedule,
        lastUpdated: new Date().toISOString()
    };
}
