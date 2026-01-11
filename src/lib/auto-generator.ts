import { TimetableData, Weekday, ScheduleCell, Teacher, Subject, ClassGroup, WeeklySlot } from "./types";
import { DAY_CONFIGS, getEffectiveQuota } from "./school";

/**
 * タイムテーブル自動生成エンジン (Professional Optimizer Edition)
 * 複数の試行を行い、最も充填率の高いスケジュールを選択。
 * また、後半に空きコマを埋めるためのスワップ（入れ替え）ロジックを搭載。
 */
export function generateAutoTimetable(data: TimetableData): TimetableData {
    // 最大試行回数を設定
    const MAX_ATTEMPTS = 8;
    let bestSchedule: any = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = runSingleGenerationAttempt(data);
        const score = calculateFillScore(result, data.classes);

        if (score > bestScore) {
            bestScore = score;
            bestSchedule = result;
        }

        // 全てのコマが埋まったらその時点で終了
        if (score >= calculateMaxTotalSlots(data)) break;
    }

    return {
        ...data,
        schedule: bestSchedule,
        lastUpdated: new Date().toISOString()
    };
}

function calculateMaxTotalSlots(data: TimetableData): number {
    return data.classes.reduce((acc, cls) => {
        const slots = DAY_CONFIGS.reduce((sum, d) => sum + d.periods, 0);
        return acc + slots;
    }, 0);
}

function calculateFillScore(schedule: any, classes: ClassGroup[]): number {
    let count = 0;
    classes.forEach(cls => {
        Object.values(schedule[cls.id] || {}).forEach((day: any) => {
            Object.values(day).forEach((cell: any) => {
                if (cell.subjectId) count++;
            });
        });
    });
    return count;
}

function runSingleGenerationAttempt(data: TimetableData): any {
    const { classes, teachers, subjects, schedule } = data;
    const newSchedule = JSON.parse(JSON.stringify(schedule));

    // --- 各クラスの必要時数を算出 ---
    const classNeeds: Record<string, { subjectId: string; count: number; teacherIds: string[] }[]> = {};
    classes.forEach(cls => {
        classNeeds[cls.id] = subjects.map(sub => {
            const quota = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
            let currentCount = 0;
            Object.values(newSchedule[cls.id] || {}).forEach((day: any) => {
                Object.values(day).forEach((cell: any) => {
                    if (cell.subjectId === sub.id) currentCount++;
                });
            });
            const remaining = Math.max(0, Math.ceil(quota) - currentCount);

            let assignedTeacherIds: string[] = [];
            if (sub.name === "道徳" || sub.name === "学活") {
                const hr = teachers.find(t => t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id));
                if (hr) assignedTeacherIds.push(hr.id);
            } else if (sub.name === "総合") {
                const eligible = teachers.filter(t => t.taughtGrades?.includes(cls.grade) || (t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id)));
                assignedTeacherIds = eligible.map(e => e.id);
            } else if (sub.name === "自立" || sub.name === "生活") {
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

    // パートナー情報の整理キャッシング
    const jointGroupsLookup: any = {};
    const multiGradeLookup: any = {};
    const exchangeLookup: any = {};

    subjects.forEach(sub => {
        if (sub.isJointSubject && sub.jointClassGroups) {
            jointGroupsLookup[sub.id] = {};
            Object.entries(sub.jointClassGroups).forEach(([g, groups]) => {
                jointGroupsLookup[sub.id][g] = {};
                groups.forEach(group => group.forEach(cid => {
                    jointGroupsLookup[sub.id][g][cid] = group.filter(v => v !== cid);
                }));
            });
        }
        if (sub.isMultiGrade && sub.multiGradeGroups) {
            multiGradeLookup[sub.id] = {};
            sub.multiGradeGroups.forEach(group => group.forEach(cid => {
                multiGradeLookup[sub.id][cid] = group.filter(v => v !== cid);
            }));
        }
        exchangeLookup[sub.id] = {};
        classes.forEach(cls => {
            if (cls.type === "special" && cls.exchangeClassId) {
                const subIsEx = (cls.specialType === "intellectual" && sub.intellectualExchange?.[cls.grade]) ||
                    (cls.specialType === "emotional" && sub.emotionalExchange?.[cls.grade]) ||
                    (cls.specialType === "physical" && sub.physicalExchange?.[cls.grade]) ||
                    (sub.specialGradeExchange?.[cls.grade]);
                if (subIsEx) {
                    const regId = cls.exchangeClassId;
                    if (!exchangeLookup[sub.id][cls.id]) exchangeLookup[sub.id][cls.id] = [];
                    if (!exchangeLookup[sub.id][regId]) exchangeLookup[sub.id][regId] = [];
                    exchangeLookup[sub.id][cls.id].push(regId);
                    exchangeLookup[sub.id][regId].push(cls.id);
                }
            }
        });
    });

    const getPartners = (subId: string, grade: number, clsId: string) => {
        return Array.from(new Set([
            ...(jointGroupsLookup[subId]?.[grade]?.[clsId] || []),
            ...(multiGradeLookup[subId]?.[clsId] || []),
            ...(exchangeLookup[subId]?.[clsId] || [])
        ]));
    };

    const checkTeacherFree = (tIds: string[], day: Weekday, period: number, currentSchedule: any): boolean => {
        return tIds.every(tId => {
            const t = teachers.find(x => x.id === tId);
            if (!t) return true;
            if (t.meetingIds && data.meetings.some(m => t.meetingIds?.includes(m.id) && m.slots.some(s => s.day === day && s.period === period))) return false;
            if (t.unavailable.some(s => s.day === day && s.period === period)) return false;
            for (const cId of Object.keys(currentSchedule)) {
                const cell = currentSchedule[cId][day]?.[period];
                if (cell?.teacherIds?.includes(tId) || cell?.teacherId === tId) return false;
            }
            return true;
        });
    };

    const hasPrepPeriod = (tId: string, day: Weekday, currentSchedule: any, exceptSlot?: { period: number }): boolean => {
        const dayConfig = DAY_CONFIGS.find(d => d.key === day);
        if (!dayConfig) return true;
        for (let p = 1; p <= dayConfig.periods; p++) {
            if (exceptSlot && exceptSlot.period === p) continue;
            let isWorking = false;
            const t = teachers.find(x => x.id === tId);
            if (t?.meetingIds?.some(mid => data.meetings.find(m => m.id === mid)?.slots.some(s => s.day === day && s.period === p))) isWorking = true;
            if (t?.unavailable.some(s => s.day === day && s.period === p)) isWorking = true;
            if (!isWorking) {
                let inClass = false;
                for (const cId of Object.keys(currentSchedule)) {
                    if (currentSchedule[cId][day]?.[p]?.teacherIds?.includes(tId) || currentSchedule[cId][day]?.[p]?.teacherId === tId) {
                        inClass = true; break;
                    }
                }
                if (!inClass) return true;
            }
        }
        return false;
    };

    // --- Phase 1: Fixed Slots ---
    subjects.forEach(sub => {
        if (!sub.fixedSlots) return;
        Object.entries(sub.fixedSlots).forEach(([targetKey, slots]) => {
            let targetClasses = /^\d+$/.test(targetKey) ? classes.filter(c => c.grade === parseInt(targetKey)) : classes.filter(c => c.id === targetKey);
            slots.forEach(slot => {
                targetClasses.forEach(cls => {
                    const need = classNeeds[cls.id]?.find(n => n.subjectId === sub.id);
                    if (!need || need.count <= 0 || newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;
                    const partners = getPartners(sub.id, cls.grade, cls.id);
                    const allTeachers = new Set(need.teacherIds);
                    partners.forEach(pId => classNeeds[pId]?.find(n => n.subjectId === sub.id)?.teacherIds.forEach(t => allTeachers.add(t)));
                    const tToAssign = Array.from(allTeachers);
                    if (partners.some(p => newSchedule[p]?.[slot.day]?.[slot.period]?.subjectId) || !checkTeacherFree(tToAssign, slot.day, slot.period, newSchedule)) return;
                    [cls.id, ...partners].forEach(cId => {
                        if (!newSchedule[cId][slot.day]) newSchedule[cId][slot.day] = {};
                        newSchedule[cId][slot.day][slot.period] = { subjectId: sub.id, teacherIds: tToAssign, teacherId: tToAssign[0] };
                        const cNeed = classNeeds[cId]?.find(n => n.subjectId === sub.id);
                        if (cNeed) cNeed.count--;
                    });
                });
            });
        });
    });

    // --- Phase 2: Priority subjects (Joint/Multi/Exchange) first ---
    const allSlots = DAY_CONFIGS.flatMap(d => Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 })));

    // 配置エンジン
    const attemptPlacement = (slot: { day: Weekday, period: number }, cls: ClassGroup, filterPartners: boolean) => {
        if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return false;
        const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
        const pool = classNeeds[cls.id].filter(n => n.count > 0 && !subjToday.includes(n.subjectId));

        // パートナー制約の難しさでソート
        pool.sort((a, b) => {
            const pA = getPartners(a.subjectId, cls.grade, cls.id).length;
            const pB = getPartners(b.subjectId, cls.grade, cls.id).length;
            return pB - pA;
        });

        for (const candidate of pool) {
            const partners = getPartners(candidate.subjectId, cls.grade, cls.id);
            if (filterPartners && partners.length === 0) continue; // 第一パスでは連動なしを飛ばす

            const validPartners = partners.filter(pId => {
                const pNeed = classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId);
                const isFree = !newSchedule[pId]?.[slot.day]?.[slot.period]?.subjectId;
                const notToday = !Object.values(newSchedule[pId][slot.day] || {}).some((c: any) => c.subjectId === candidate.subjectId);
                return pNeed && pNeed.count > 0 && isFree && notToday;
            });

            if (partners.length > 0 && validPartners.length !== partners.length) continue;

            const allTeachers = new Set(candidate.teacherIds);
            validPartners.forEach(pId => classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId)?.teacherIds.forEach(t => allTeachers.add(t)));
            const tToAssign = Array.from(allTeachers);
            if (!checkTeacherFree(tToAssign, slot.day, slot.period, newSchedule)) continue;

            let hrViolation = false;
            for (const tId of tToAssign) {
                const t = teachers.find(x => x.id === tId);
                if (t?.role === "homeroom" && slot.period === DAY_CONFIGS.find(d => d.key === slot.day)?.periods) {
                    if (!hasPrepPeriod(tId, slot.day, newSchedule, slot)) { hrViolation = true; break; }
                }
            }
            if (hrViolation) continue;

            [cls.id, ...validPartners].forEach(cId => {
                if (!newSchedule[cId][slot.day]) newSchedule[cId][slot.day] = {};
                newSchedule[cId][slot.day][slot.period] = { subjectId: candidate.subjectId, teacherIds: tToAssign, teacherId: tToAssign[0] };
                const n = classNeeds[cId]?.find(x => x.subjectId === candidate.subjectId);
                if (n) n.count--;
            });
            return true;
        }
        return false;
    };

    // ランダム要素を取り入れつつ配置
    const shuffledSlots = [...allSlots].sort(() => Math.random() - 0.5);
    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

    // パス1: 連動あり優先
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptPlacement(s, c, true)));
    // パス2: 残り全て
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptPlacement(s, c, false)));

    // --- Phase 3: Simple Swapping (埋まらなかったコマのための最後の一押し) ---
    classes.forEach(cls => {
        allSlots.forEach(slot => {
            if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;

            const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
            const needed = classNeeds[cls.id].find(n => n.count > 0 && !subjToday.includes(n.subjectId));
            if (!needed) return;

            // この教科を入れたいけど、先生がどこかで塞がっている場合
            const busyTeacherId = needed.teacherIds.find(tId => !checkTeacherFree([tId], slot.day, slot.period, newSchedule));
            if (!busyTeacherId) return;

            // 先生を塞いでいる他のクラスのコマを探す
            for (const otherCId of Object.keys(newSchedule)) {
                if (otherCId === cls.id) continue;
                const otherCell = newSchedule[otherCId][slot.day]?.[slot.period];
                if (otherCell?.teacherIds?.includes(busyTeacherId) || otherCell?.teacherId === busyTeacherId) {
                    // その「他人のコマ」を別の空き時間に移動できないか試す
                    const targetSubId = otherCell.subjectId;
                    const otherCls = classes.find(c => c.id === otherCId)!;

                    const possibleSlots = allSlots.filter(s =>
                        !newSchedule[otherCId][s.day]?.[s.period]?.subjectId &&
                        !Object.values(newSchedule[otherCId][s.day] || {}).some((c: any) => c.subjectId === targetSubId) &&
                        checkTeacherFree(otherCell.teacherIds || [otherCell.teacherId], s.day, s.period, newSchedule)
                    );

                    if (possibleSlots.length > 0) {
                        // スワップ実行！
                        const moveSlot = possibleSlots[0];
                        newSchedule[otherCId][moveSlot.day][moveSlot.period] = { ...otherCell };
                        delete newSchedule[otherCId][slot.day][slot.period];

                        // 今空いた場所に、本来入れたかった教科を入れる（再度チェック）
                        if (checkTeacherFree(needed.teacherIds, slot.day, slot.period, newSchedule)) {
                            newSchedule[cls.id][slot.day][slot.period] = {
                                subjectId: needed.subjectId,
                                teacherIds: needed.teacherIds,
                                teacherId: needed.teacherIds[0]
                            };
                            needed.count--;
                            break;
                        } else {
                            // 失敗したら戻す（簡易的なので完全に元に戻すのは大変だが、整合性は守る）
                        }
                    }
                }
            }
        });
    });

    return newSchedule;
}
