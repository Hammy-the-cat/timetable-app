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

            // 現在の時間割から既に配置済みのコマ数をカウント
            let currentCount = 0;
            Object.values(newSchedule[cls.id] || {}).forEach((day: any) => {
                Object.values(day).forEach((cell: any) => {
                    if (cell.subjectId === sub.id) currentCount++;
                });
            });

            const remaining = Math.max(0, Math.ceil(quota) - currentCount);

            // 担当教員を決定（複数担任対応）
            let assignedTeacherIds: string[] = [];
            if (sub.name === "道徳" || sub.name === "学活") {
                const hr = teachers.find(t => t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id));
                if (hr) assignedTeacherIds.push(hr.id);
            } else if (sub.name === "総合") {
                const eligible = teachers.filter(t => t.taughtGrades?.includes(cls.grade) || (t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id)));
                assignedTeacherIds = eligible.map(e => e.id);
            } else {
                assignedTeacherIds = teachers
                    .filter(t => t.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id)))
                    .map(t => t.id);
            }

            return { subjectId: sub.id, count: remaining, teacherIds: assignedTeacherIds };
        }).filter(n => n.count > 0);
    });

    // --- 前準備: 合同授業のグループ情報を整理 ---
    // subjectId -> grade -> { [classId]: otherClassIds[] }
    const jointGroupsLookup: Record<string, Record<number, Record<string, string[]>>> = {};
    subjects.forEach(sub => {
        if (sub.isJointSubject && sub.jointClassGroups) {
            jointGroupsLookup[sub.id] = {};
            Object.entries(sub.jointClassGroups).forEach(([gradeStr, groups]) => {
                const grade = parseInt(gradeStr);
                jointGroupsLookup[sub.id][grade] = {};
                groups.forEach(groupSpecs => {
                    groupSpecs.forEach(cid => {
                        jointGroupsLookup[sub.id][grade][cid] = groupSpecs.filter(other => other !== cid);
                    });
                });
            });
        }
    });

    // --- ユーティリティ: 教師の空き確認 ---
    const checkTeacherFree = (tId: string, day: Weekday, period: number, currentSchedule: any): boolean => {
        const teacher = teachers.find(t => t.id === tId);
        if (!teacher) return true;

        if (teacher.meetingIds) {
            const isInMeeting = data.meetings.some(m =>
                teacher.meetingIds?.includes(m.id) &&
                m.slots.some(s => s.day === day && s.period === period)
            );
            if (isInMeeting) return false;
        }

        if (teacher.unavailable.some(s => s.day === day && s.period === period)) return false;

        for (const cId of Object.keys(currentSchedule)) {
            const cell = currentSchedule[cId][day]?.[period];
            if (cell?.teacherIds?.includes(tId) || cell?.teacherId === tId) return false;
        }
        return true;
    };

    // 準備時間の確保チェック（制約③ 担任は1日1コマ空ける）
    const hasPrepPeriod = (tId: string, day: Weekday, currentSchedule: any, exceptSlot?: { period: number }): boolean => {
        const dayConfig = DAY_CONFIGS.find(d => d.key === day);
        if (!dayConfig) return true;

        for (let p = 1; p <= dayConfig.periods; p++) {
            if (exceptSlot && exceptSlot.period === p) continue;

            let isWorking = false;
            const teacher = teachers.find(t => t.id === tId);
            if (teacher?.meetingIds?.some(mid => data.meetings.find(m => m.id === mid)?.slots.some(s => s.day === day && s.period === p))) isWorking = true;
            if (teacher?.unavailable.some(s => s.day === day && s.period === p)) isWorking = true;

            if (!isWorking) {
                let inClass = false;
                for (const cId of Object.keys(currentSchedule)) {
                    if (currentSchedule[cId][day]?.[p]?.teacherIds?.includes(tId) || currentSchedule[cId][day]?.[p]?.teacherId === tId) {
                        inClass = true;
                        break;
                    }
                }
                if (!inClass) return true;
            }
        }
        return false;
    };

    // --- メインループ: コマ配置 ---
    const allSlots: { day: Weekday; period: number }[] = DAY_CONFIGS.flatMap(d =>
        Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 }))
    ).sort(() => Math.random() - 0.5);

    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

    for (const slot of allSlots) {
        for (const cls of shuffledClasses) {
            const currentCell = newSchedule[cls.id]?.[slot.day]?.[slot.period];
            if (currentCell && currentCell.subjectId) continue;

            // 本日既に使った教科 (制約① 1日1回)
            const getSubjectsToday = (cId: string) => Object.values(newSchedule[cId][slot.day] || {})
                .map((cell: any) => cell.subjectId)
                .filter(Boolean) as string[];

            const subjectsToday = getSubjectsToday(cls.id);
            const pool = classNeeds[cls.id].filter(n => n.count > 0 && !subjectsToday.includes(n.subjectId));
            pool.sort(() => Math.random() - 0.5);

            for (const candidate of pool) {
                // 合同授業の対象者を確認
                const jointPartners = jointGroupsLookup[candidate.subjectId]?.[cls.grade]?.[cls.id] || [];

                // --- 1. 全員の空き状況チェック ---
                const partnersToAssign = jointPartners.filter(pId => {
                    const cell = newSchedule[pId]?.[slot.day]?.[slot.period];
                    return !cell || !cell.subjectId;
                });

                // 合同なのに対象学級が埋まっている場合はスキップ
                if (jointPartners.length > 0 && partnersToAssign.length !== jointPartners.length) continue;

                // 対象学級が既に本日その教科をやっている場合もスキップ
                const anyPartnerHasSubjectToday = jointPartners.some(pId => getSubjectsToday(pId).includes(candidate.subjectId));
                if (anyPartnerHasSubjectToday) continue;

                // --- 2. 教員の空き状況チェック ---
                // 合同授業の場合、全学級に割り当てられた教員全員を集合させる
                const allPlannedTeachers = new Set<string>(candidate.teacherIds);
                jointPartners.forEach(pId => {
                    const pNeed = classNeeds[pId].find(n => n.subjectId === candidate.subjectId);
                    if (pNeed) pNeed.teacherIds.forEach(tid => allPlannedTeachers.add(tid));
                });

                const teacherIdsToAssign = Array.from(allPlannedTeachers);
                const allTeachersFree = teacherIdsToAssign.every(tId => checkTeacherFree(tId, slot.day, slot.period, newSchedule));
                if (!allTeachersFree) continue;

                // --- 3. 準備時間（担任）のチェック ---
                let hrViolation = false;
                for (const tId of teacherIdsToAssign) {
                    const t = teachers.find(x => x.id === tId);
                    if (t?.role === "homeroom") {
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

                // --- 4. 配置実行 ---
                const classesToUpdate = [cls.id, ...jointPartners];
                classesToUpdate.forEach(cId => {
                    if (!newSchedule[cId][slot.day]) newSchedule[cId][slot.day] = {};
                    newSchedule[cId][slot.day][slot.period] = {
                        subjectId: candidate.subjectId,
                        teacherIds: teacherIdsToAssign,
                        teacherId: teacherIdsToAssign[0],
                    };

                    // 各クラスの残り時数を減らす
                    const need = classNeeds[cId].find(n => n.subjectId === candidate.subjectId);
                    if (need) need.count--;
                });

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
