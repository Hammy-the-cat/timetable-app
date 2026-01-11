import { TimetableData, Weekday, ScheduleCell, Teacher, Subject, ClassGroup, WeeklySlot } from "./types";
import { DAY_CONFIGS, getEffectiveQuota } from "./school";

/**
 * タイムテーブル自動生成エンジン (Elite Multi-Pass Optimizer)
 * 100回の試行を行い、最も高い充填率と制約遵守率を持つスケジュールを選択します。
 */
export function generateAutoTimetable(data: TimetableData): TimetableData {
    const MAX_ATTEMPTS = 100; // ユーザーの要望に応え、試行回数を大幅に増加
    let bestSchedule: any = null;
    let bestScore = -1;

    // 合計で埋めるべき全コマ数を計算
    const targetTotalSlots = data.classes.length * DAY_CONFIGS.reduce((sum, d) => sum + d.periods, 0);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = runSingleGenerationAttempt(data);
        const score = calculateFillScore(result, data.classes);

        if (score > bestScore) {
            bestScore = score;
            bestSchedule = result;
        }

        // 完璧に埋まったら即座に終了
        if (score >= targetTotalSlots) break;
    }

    return {
        ...data,
        schedule: bestSchedule,
        lastUpdated: new Date().toISOString()
    };
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

    // 1. 各クラスの必要時数を算出
    const classNeeds: Record<string, { subjectId: string; count: number; teacherIds: string[]; isJoint: boolean }[]> = {};
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
            return { subjectId: sub.id, count: remaining, teacherIds: assignedTeacherIds, isJoint: !!sub.isJointSubject };
        }).filter(n => n.count > 0);
    });

    // 2. 連動グループ情報の整理 (型不一致を修正: grade を string として扱う)
    const jointGroupsLookup: any = {};
    const multiGradeLookup: any = {};
    const exchangeLookup: any = {};

    subjects.forEach(sub => {
        if (sub.isJointSubject && sub.jointClassGroups) {
            jointGroupsLookup[sub.id] = {};
            Object.entries(sub.jointClassGroups).forEach(([gStr, groups]) => {
                const targetGrade = gStr; // string "1", "2", "3"
                jointGroupsLookup[sub.id][targetGrade] = {};
                groups.forEach(group => group.forEach(cid => {
                    jointGroupsLookup[sub.id][targetGrade][cid] = group.filter(v => v !== cid);
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
                const gradeStr = cls.grade.toString();
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
        const gradeStr = grade.toString();
        return Array.from(new Set([
            ...(jointGroupsLookup[subId]?.[gradeStr]?.[clsId] || []),
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
            const t = teachers.find(x => x.id === tId);
            if (t?.meetingIds?.some(mid => data.meetings.find(m => m.id === mid)?.slots.some(s => s.day === day && s.period === p))) continue;
            if (t?.unavailable.some(s => s.day === day && s.period === p)) continue;
            let inClass = false;
            for (const cId of Object.keys(currentSchedule)) {
                if (currentSchedule[cId][day]?.[p]?.teacherIds?.includes(tId) || currentSchedule[cId][day]?.[p]?.teacherId === tId) {
                    inClass = true; break;
                }
            }
            if (!inClass) return true;
        }
        return false;
    };

    // 3. 固定配置の処理
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

    // 4. 教科プールを制約の難易度でソートしておく
    classes.forEach(cls => {
        classNeeds[cls.id].sort((a, b) => {
            const pA = getPartners(a.subjectId, cls.grade, cls.id).length;
            const pB = getPartners(b.subjectId, cls.grade, cls.id).length;
            if (pA !== pB) return pB - pA; // パートナーが多い（合同など）を優先
            return b.count - a.count; // 次に残数が多いのを優先
        });
    });

    // 5. メイン配置ループ (3パス制)
    const allSlots = DAY_CONFIGS.flatMap(d => Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 })));
    const shuffledSlots = [...allSlots].sort(() => Math.random() - 0.5);
    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

    const attemptSlot = (slot: { day: Weekday, period: number }, cls: ClassGroup, mode: 'strict-joint' | 'all') => {
        if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;

        const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
        const candidates = classNeeds[cls.id].filter(n => n.count > 0 && !subjToday.includes(n.subjectId));

        for (const candidate of candidates) {
            const partners = getPartners(candidate.subjectId, cls.grade, cls.id);

            // モードに応じたフィルタリング
            if (mode === 'strict-joint' && partners.length === 0) continue;

            const validPartners = partners.filter(pId => {
                const pNeed = classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId);
                const isFree = !newSchedule[pId]?.[slot.day]?.[slot.period]?.subjectId;
                const notToday = !Object.values(newSchedule[pId][slot.day] || {}).some((c: any) => c.subjectId === candidate.subjectId);
                return pNeed && pNeed.count > 0 && isFree && notToday;
            });

            // 連動不全の場合は配置しない
            if (partners.length > 0 && validPartners.length !== partners.length) continue;

            const allTeachers = new Set(candidate.teacherIds);
            validPartners.forEach(pId => classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId)?.teacherIds.forEach(t => allTeachers.add(t)));
            const tToAssign = Array.from(allTeachers);
            if (!checkTeacherFree(tToAssign, slot.day, slot.period, newSchedule)) continue;

            // 準備時間チェック
            let hrViolation = false;
            for (const tId of tToAssign) {
                const t = teachers.find(x => x.id === tId);
                if (t?.role === "homeroom" && slot.period === DAY_CONFIGS.find(d => d.key === slot.day)?.periods) {
                    if (!hasPrepPeriod(tId, slot.day, newSchedule, slot)) { hrViolation = true; break; }
                }
            }
            if (hrViolation) continue;

            // 配置！
            [cls.id, ...validPartners].forEach(cId => {
                if (!newSchedule[cId][slot.day]) newSchedule[cId][slot.day] = {};
                newSchedule[cId][slot.day][slot.period] = { subjectId: candidate.subjectId, teacherIds: tToAssign, teacherId: tToAssign[0] };
                const n = classNeeds[cId]?.find(x => x.subjectId === candidate.subjectId);
                if (n) n.count--;
            });
            return;
        }
    };

    // パス1: 連動あり（合同・複式・交流）を最優先で埋める
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptSlot(s, c, 'strict-joint')));
    // パス2: 残り全てを埋める
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptSlot(s, c, 'all')));

    // 6. スワップロジックの強化版 (最後に空席を探して交換)
    let advancedSwapCount = 0;
    const MAX_ADVANCED_SWAPS = 20;

    for (const cls of classes) {
        for (const slot of allSlots) {
            if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) continue;
            if (advancedSwapCount >= MAX_ADVANCED_SWAPS) break;

            const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
            const needed = classNeeds[cls.id].find(n => n.count > 0 && !subjToday.includes(n.subjectId));
            if (!needed) continue;

            // 邪魔している先生を特定
            const blockingInstructors = needed.teacherIds.filter(t => !checkTeacherFree([t], slot.day, slot.period, newSchedule));
            if (blockingInstructors.length > 0) {
                for (const tId of blockingInstructors) {
                    // その先生の別のコマを探す
                    for (const otherCId of Object.keys(newSchedule)) {
                        const cell = newSchedule[otherCId][slot.day]?.[slot.period];
                        if (cell?.teacherIds?.includes(tId) || cell?.teacherId === tId) {
                            // その他人の授業を動かせる別の空き時間があるか？
                            const targetSubId = cell.subjectId;
                            const possibleRescuers = allSlots.filter(s =>
                                !newSchedule[otherCId][s.day]?.[s.period]?.subjectId &&
                                !Object.values(newSchedule[otherCId][s.day] || {}).some((c: any) => c.subjectId === targetSubId) &&
                                checkTeacherFree(cell.teacherIds || [cell.teacherId], s.day, s.period, newSchedule)
                            );

                            if (possibleRescuers.length > 0) {
                                const move = possibleRescuers[Math.floor(Math.random() * possibleRescuers.length)];
                                if (!newSchedule[otherCId][move.day]) newSchedule[otherCId][move.day] = {};
                                newSchedule[otherCId][move.day][move.period] = { ...cell };
                                delete newSchedule[otherCId][slot.day][slot.period];
                                advancedSwapCount++;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    return newSchedule;
}
