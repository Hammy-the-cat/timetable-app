import { TimetableData, Weekday, ScheduleCell, Teacher, Subject, ClassGroup, WeeklySlot } from "./types";
import { DAY_CONFIGS, getEffectiveQuota } from "./school";

/**
 * タイムテーブル自動生成エンジン (Elite Multi-Pass Optimizer v2)
 * 制約：体育は学校全体で1コマに1グループ（単独または合同）のみ。
 */
export function generateAutoTimetable(data: TimetableData): TimetableData {
    const MAX_ATTEMPTS = 1000;
    let bestSchedule: any = null;
    let bestScore = -1;

    const targetTotalSlots = data.classes.length * DAY_CONFIGS.reduce((sum, d) => sum + d.periods, 0);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = runSingleGenerationAttempt(data);
        const score = calculateFillScore(result, data.classes);

        if (score > bestScore) {
            bestScore = score;
            bestSchedule = result;
        }
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

    // --- Phase 0: Cleanup invalid existing assignments (e.g. conflicting with meetings) ---
    // (この関数内で定義される isTeacherAvailableBase を使用するため、定義の後に移動するか、
    // ここでインラインでチェックを行います。今回は定義を前に持ってくるか検討しましたが、
    // シンプルに counts 算出の前に「現在の schedule 自体」を不整合チェックして書き換えます。)
    classes.forEach(cls => {
        if (!newSchedule[cls.id]) return;
        Object.keys(newSchedule[cls.id]).forEach((dayStr) => {
            const day = dayStr as Weekday;
            Object.keys(newSchedule[cls.id][day]).forEach((periodStr) => {
                const period = parseInt(periodStr);
                const cell = newSchedule[cls.id][day][period];
                if (!cell || !cell.subjectId) return;

                const tIds = cell.teacherIds || (cell.teacherId ? [cell.teacherId] : []);
                // 会議・不可時間の再チェック
                const isInvalid = tIds.some((tId: string) => {
                    const t = teachers.find(x => x.id === tId);
                    if (!t) return false;
                    const inMeeting = t.meetingIds?.some((mid: string) =>
                        data.meetings.some(m => m.id === mid && m.slots.some(s => s.day === day && s.period === period))
                    );
                    const isUnavailable = t.unavailable.some(s => s.day === day && s.period === period);
                    return inMeeting || isUnavailable;
                });

                if (isInvalid) {
                    delete newSchedule[cls.id][day][period];
                }
            });
        });
    });

    // 必要時数の算出
    const classNeeds: Record<string, { subjectId: string; count: number; teacherIds: string[]; isJoint: boolean; name: string }[]> = {};
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
            return { subjectId: sub.id, name: sub.name, count: remaining, teacherIds: assignedTeacherIds, isJoint: !!sub.isJointSubject };
        }).filter(n => n.count > 0);
    });

    // 連動情報の整理
    const jointGroupsLookup: any = {};
    const multiGradeLookup: any = {};
    const exchangeLookup: any = {};

    subjects.forEach(sub => {
        if (sub.isJointSubject && sub.jointClassGroups) {
            jointGroupsLookup[sub.id] = {};
            Object.entries(sub.jointClassGroups).forEach(([gStr, groups]) => {
                jointGroupsLookup[sub.id][gStr] = {};
                groups.forEach(group => group.forEach(cid => {
                    jointGroupsLookup[sub.id][gStr][cid] = group.filter(v => v !== cid);
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

    const getPartners = (subId: string, grade: number, clsId: string): string[] => {
        const result = new Set<string>();
        const queue = [clsId];
        const visited = new Set<string>([clsId]);
        const gradeStr = grade.toString();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const partners = [
                ...(jointGroupsLookup[subId]?.[gradeStr]?.[currentId] || []),
                ...(multiGradeLookup[subId]?.[currentId] || []),
                ...(exchangeLookup[subId]?.[currentId] || [])
            ];
            for (const p of partners) {
                if (!visited.has(p)) {
                    visited.add(p);
                    result.add(p);
                    queue.push(p);
                }
            }
        }
        return Array.from(result);
    };

    // ヘルパー：学校全体の特定スロットでの特定教科（体育など）の使用をチェック
    const isSubjectInSlotSchoolWide = (subName: string, day: Weekday, period: number, currentSchedule: any): boolean => {
        for (const cid of Object.keys(currentSchedule)) {
            const cell = currentSchedule[cid][day]?.[period];
            if (!cell?.subjectId) continue;
            const sub = subjects.find(s => s.id === cell.subjectId);
            if (sub?.name === subName) return true;
        }
        return false;
    };

    // ヘルパー：先生がその時間に空いているか（会議・不可時間のみチェック）
    const isTeacherAvailableBase = (tIds: string[], day: Weekday, period: number): boolean => {
        return tIds.every(tId => {
            const t = teachers.find(x => x.id === tId);
            if (!t) return true;
            if (t.meetingIds && t.meetingIds.length > 0) {
                if (data.meetings.some(m => t.meetingIds?.includes(m.id) && m.slots.some(s => s.day === day && s.period === period))) return false;
            }
            if (t.unavailable.some(s => s.day === day && s.period === period)) return false;
            return true;
        });
    };

    const checkTeacherFree = (tIds: string[], day: Weekday, period: number, currentSchedule: any): boolean => {
        if (!isTeacherAvailableBase(tIds, day, period)) return false;
        for (const tId of tIds) {
            for (const cId of Object.keys(currentSchedule)) {
                const cell = currentSchedule[cId][day]?.[period];
                if (cell?.teacherIds?.includes(tId) || cell?.teacherId === tId) return false;
            }
        }
        return true;
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

    // 1. 固定配置 (Fixed Slots)
    subjects.forEach(sub => {
        if (!sub.fixedSlots) return;
        Object.entries(sub.fixedSlots).forEach(([targetKey, slots]) => {
            let targetClasses = /^\d+$/.test(targetKey) ? classes.filter(c => c.grade === parseInt(targetKey)) : classes.filter(c => c.id === targetKey);
            slots.forEach(slot => {
                targetClasses.forEach(cls => {
                    const need = classNeeds[cls.id]?.find(n => n.subjectId === sub.id);
                    if (!need || need.count <= 0 || newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;

                    // 体育の重複チェック（固定でもチェックするが、固定の自身を誤判定しないように注意。
                    // ここでは単独の配置を進めるループなので、現在の slot に体育があればスキップ）
                    if (sub.name === "体育" && isSubjectInSlotSchoolWide("体育", slot.day, slot.period, newSchedule)) return;

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

    // 2. 教科プールのソート
    classes.forEach(cls => {
        classNeeds[cls.id].sort((a, b) => {
            const pA = getPartners(a.subjectId, cls.grade, cls.id).length;
            const pB = getPartners(b.subjectId, cls.grade, cls.id).length;
            if (pA !== pB) return pB - pA;
            return b.count - a.count;
        });
    });

    // 3. メイン配置ループ
    const allSlots = DAY_CONFIGS.flatMap(d => Array.from({ length: d.periods }, (_, i) => ({ day: d.key as Weekday, period: i + 1 })));
    const shuffledSlots = [...allSlots].sort(() => Math.random() - 0.5);
    const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

    const attemptSlot = (slot: { day: Weekday, period: number }, cls: ClassGroup, filter: (cand: any) => boolean) => {
        if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) return;

        const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
        const candidates = classNeeds[cls.id].filter(n => {
            if (n.count <= 0 || !filter(n)) return false;
            const canDouble = n.teacherIds.some(tId => teachers.find(tx => tx.id === tId)?.allowDoubleSubject);
            return canDouble || !subjToday.includes(n.subjectId);
        });

        for (const candidate of candidates) {
            const partners = getPartners(candidate.subjectId, cls.grade, cls.id);

            // --- ルール：体育は学校全体で1コマに1グループ ---
            if (candidate.name === "体育" && isSubjectInSlotSchoolWide("体育", slot.day, slot.period, newSchedule)) continue;

            const validPartners = partners.filter(pId => {
                const pNeed = classNeeds[pId]?.find(n => n.subjectId === candidate.subjectId);
                if (!pNeed || pNeed.count <= 0) return false;

                const isFree = !newSchedule[pId]?.[slot.day]?.[slot.period]?.subjectId;
                const canDouble = pNeed.teacherIds.some(tId => teachers.find(tx => tx.id === tId)?.allowDoubleSubject);
                const notToday = canDouble || !Object.values(newSchedule[pId][slot.day] || {}).some((c: any) => c.subjectId === candidate.subjectId);

                return isFree && notToday;
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
            return;
        }
    };

    // --- Phase 1: 体育 (優先度：1) ---
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptSlot(s, c, (n) => n.name === "体育")));

    // --- Phase 2: 特別支援学級の交流授業 (優先度：2) ---
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptSlot(s, c, (n) => {
        if (n.name === "体育") return false;
        const partners = getPartners(n.subjectId, c.grade, c.id);
        const hasExchange = partners.some(pId => {
            const pCls = classes.find(x => x.id === pId);
            return (c.type === "special" && pCls?.type === "normal") || (c.type === "normal" && pCls?.type === "special");
        });
        return hasExchange;
    })));

    // --- Phase 3: その他の授業 (優先度：3) ---
    shuffledSlots.forEach(s => shuffledClasses.forEach(c => attemptSlot(s, c, (n) => true)));

    // 4. 高度なスワップ（入れ替え）
    let advancedSwapCount = 0;
    const MAX_ADVANCED_SWAPS = 30;
    for (const cls of classes) {
        for (const slot of allSlots) {
            if (newSchedule[cls.id]?.[slot.day]?.[slot.period]?.subjectId) continue;
            if (advancedSwapCount >= MAX_ADVANCED_SWAPS) break;

            const subjToday = Object.values(newSchedule[cls.id][slot.day] || {}).map((c: any) => c.subjectId);
            const needed = classNeeds[cls.id].find(n => {
                const canDouble = n.teacherIds.some(tId => teachers.find(tx => tx.id === tId)?.allowDoubleSubject);
                return n.count > 0 && (canDouble || !subjToday.includes(n.subjectId));
            });
            if (!needed) continue;

            // 体育制限のために邪魔されているか
            if (needed.name === "体育" && isSubjectInSlotSchoolWide("体育", slot.day, slot.period, newSchedule)) {
                // その時間に体育をしている他クラスを移動させる
                for (const oCid of Object.keys(newSchedule)) {
                    const oCell = newSchedule[oCid][slot.day]?.[slot.period];
                    if (!oCell?.subjectId) continue;
                    const oSub = subjects.find(s => s.id === oCell.subjectId);
                    if (oSub?.name === "体育") {
                        const moveSlots = allSlots.filter(s => !newSchedule[oCid][s.day]?.[s.period]?.subjectId && !Object.values(newSchedule[oCid][s.day] || {}).some((cx: any) => cx.subjectId === oCell.subjectId));
                        if (moveSlots.length > 0) {
                            const mv = moveSlots[0];
                            if (!newSchedule[oCid][mv.day]) newSchedule[oCid][mv.day] = {};
                            newSchedule[oCid][mv.day][mv.period] = { ...oCell };
                            delete newSchedule[oCid][slot.day][slot.period];
                            advancedSwapCount++;
                            break;
                        }
                    }
                }
            }
        }
    }

    return newSchedule;
}
