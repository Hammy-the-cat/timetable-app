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
            } else if (sub.name === "自立" || sub.name === "生活") {
                // 特別支援学級向けの自立活動・生活は担任
                const hr = teachers.find(t => t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id));
                if (hr) assignedTeacherIds.push(hr.id);
            } else {
                assignedTeacherIds = teachers
                    .filter(t => t.subjectAssignments?.some(a => a.subjectName === sub.name && a.classIds.includes(cls.id)))
                    .map(t => t.id);
            }

            return { subjectId: sub.id, count: remaining, teacherIds: assignedTeacherIds };
        }).filter(n => n.count > 0);
    });

    // --- 前準備: 合同授業のグループ情報を整理 ---
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

    // --- 前準備: 複式授業 (Multi-Grade) のグループ情報を整理 ---
    const multiGradeLookup: Record<string, Record<string, string[]>> = {};
    subjects.forEach(sub => {
        if (sub.isMultiGrade && sub.multiGradeGroups) {
            multiGradeLookup[sub.id] = {};
            sub.multiGradeGroups.forEach(groupSpecs => {
                groupSpecs.forEach(cid => {
                    multiGradeLookup[sub.id][cid] = groupSpecs.filter(other => other !== cid);
                });
            });
        }
    });

    // --- 前準備: 交流学級 (Exchange Class) のパートナー情報を整理 ---
    const exchangeLookup: Record<string, Record<string, string[]>> = {};
    subjects.forEach(sub => {
        exchangeLookup[sub.id] = {};
        classes.forEach(cls => {
            if (cls.type === "special" && cls.exchangeClassId) {
                let isExchange = false;
                if (cls.specialType === "intellectual" && sub.intellectualExchange?.[cls.grade]) isExchange = true;
                if (cls.specialType === "emotional" && sub.emotionalExchange?.[cls.grade]) isExchange = true;
                if (cls.specialType === "physical" && sub.physicalExchange?.[cls.grade]) isExchange = true;
                if (sub.specialGradeExchange?.[cls.grade]) isExchange = true;

                if (isExchange) {
                    const regId = cls.exchangeClassId;
                    if (!exchangeLookup[sub.id][cls.id]) exchangeLookup[sub.id][cls.id] = [];
                    if (!exchangeLookup[sub.id][regId]) exchangeLookup[sub.id][regId] = [];
                    if (!exchangeLookup[sub.id][cls.id].includes(regId)) exchangeLookup[sub.id][cls.id].push(regId);
                    if (!exchangeLookup[sub.id][regId].includes(cls.id)) exchangeLookup[sub.id][regId].push(cls.id);
                }
            }
        });
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

    // --- 特殊処理: 固定配置 (Fixed Slots) の処理 ---
    subjects.forEach(sub => {
        if (!sub.fixedSlots) return;

        Object.entries(sub.fixedSlots).forEach(([targetKey, slots]) => {
            let targetClasses: ClassGroup[] = [];
            if (/^\d+$/.test(targetKey)) {
                const grade = parseInt(targetKey);
                targetClasses = classes.filter(c => c.grade === grade);
            } else {
                const cls = classes.find(c => c.id === targetKey);
                if (cls) targetClasses = [cls];
            }

            slots.forEach(slot => {
                targetClasses.forEach(cls => {
                    const need = classNeeds[cls.id]?.find(n => n.subjectId === sub.id);
                    if (!need || need.count <= 0) return;
                    if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;

                    const allTeachersFree = need.teacherIds.every(tId => checkTeacherFree(tId, slot.day, slot.period, newSchedule));
                    if (!allTeachersFree) return;

                    if (!newSchedule[cls.id][slot.day]) newSchedule[cls.id][slot.day] = {};
                    newSchedule[cls.id][slot.day][slot.period] = {
                        subjectId: sub.id,
                        teacherIds: need.teacherIds,
                        teacherId: need.teacherIds[0],
                    };
                    need.count--;
                });
            });
        });
    });

    // --- メインループ: コマ配置 ---
    const allSlots: { day: Weekday; period: number }[] = DAY_CONFIGS.flatMap(d =>
        Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 }))
    ).sort(() => Math.random() - 0.5);

    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

    for (const slot of allSlots) {
        for (const cls of shuffledClasses) {
            const currentCell = newSchedule[cls.id]?.[slot.day]?.[slot.period];
            if (currentCell && currentCell.subjectId) continue;

            const getSubjectsToday = (cId: string) => Object.values(newSchedule[cId][slot.day] || {})
                .map((cell: any) => cell.subjectId)
                .filter(Boolean) as string[];

            const subjectsToday = getSubjectsToday(cls.id);
            const pool = classNeeds[cls.id].filter(n => n.count > 0 && !subjectsToday.includes(n.subjectId));
            pool.sort(() => Math.random() - 0.5);

            for (const candidate of pool) {
                // パートナー特定
                const partners = Array.from(new Set([
                    ...(jointGroupsLookup[candidate.subjectId]?.[cls.grade]?.[cls.id] || []),
                    ...(multiGradeLookup[candidate.subjectId]?.[cls.id] || []),
                    ...(exchangeLookup[candidate.subjectId]?.[cls.id] || [])
                ]));

                // CHECK: パートナーもこの教科を必要としており、かつ空いているか
                const validPartners = partners.filter(pId => {
                    const pNeed = classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId);
                    const isFree = !newSchedule[pId]?.[slot.day]?.[slot.period]?.subjectId;
                    const notToday = !getSubjectsToday(pId).includes(candidate.subjectId);
                    return pNeed && pNeed.count > 0 && isFree && notToday;
                });

                // 契約上全員参加が必要な場合（合同・複式・交流）に誰か欠けていたらスキップ
                if (partners.length > 0 && validPartners.length !== partners.length) continue;

                // 教員の算出
                const allPlannedTeachers = new Set<string>(candidate.teacherIds);
                validPartners.forEach(pId => {
                    const pNeed = classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId);
                    if (pNeed) pNeed.teacherIds.forEach(tid => allPlannedTeachers.add(tid));
                });

                const teacherIdsToAssign = Array.from(allPlannedTeachers);
                const allTeachersFree = teacherIdsToAssign.every(tId => checkTeacherFree(tId, slot.day, slot.period, newSchedule));
                if (!allTeachersFree) continue;

                // 担任の準備時間
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

                // 配置
                const classesToUpdate = [cls.id, ...validPartners];
                classesToUpdate.forEach(cId => {
                    if (!newSchedule[cId][slot.day]) newSchedule[cId][slot.day] = {};
                    newSchedule[cId][slot.day][slot.period] = {
                        subjectId: candidate.subjectId,
                        teacherIds: teacherIdsToAssign,
                        teacherId: teacherIdsToAssign[0],
                    };
                    const need = classNeeds[cId]?.find(n => n.subjectId === candidate.subjectId);
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
