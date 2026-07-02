import {
    ClassGroup,
    DayConfig,
    ScheduleCell,
    Subject,
    Teacher,
    TimetableData,
    Weekday,
    WeeklySlot,
} from "./types";
import { getDays, getEffectiveQuota } from "./school";

/**
 * 空きコマ自動配置エンジン v3
 *
 * - 教員の使用状況・保体の同時実施数をインデックスで管理し、判定を高速化
 * - 時間予算内で複数回試行し、最も埋まった結果を採用
 * - 配置できなかったコマについて「なぜ置けなかったか」を集計して返す
 */

// ================= オプション・レポート =================

export interface GenerationOptions {
    /** 保体（体育館を使う教科）の同時実施グループ数の上限 */
    peConcurrencyLimit: number;
    /** 同じ教科を同じ日に重ねない（「1日複数可」設定のある教科は除く） */
    avoidSameDayDuplicate: boolean;
    /** 担任の空きコマ（最終限の授業準備時間）を確保する */
    ensureHomeroomPrep: boolean;
    /** 試行時間の上限（ミリ秒） */
    timeBudgetMs: number;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
    peConcurrencyLimit: 1,
    avoidSameDayDuplicate: true,
    ensureHomeroomPrep: true,
    timeBudgetMs: 3000,
};

export interface UnplacedReason {
    reason: string;
    count: number;
}

export interface UnplacedItem {
    classId: string;
    subjectId: string;
    remaining: number;
    reasons: UnplacedReason[];
}

export interface GenerationReport {
    /** 配置対象だったコマ数（既存配置を除く不足分） */
    totalTarget: number;
    /** 今回配置できたコマ数 */
    totalPlaced: number;
    /** 配置できなかったコマの内訳と理由 */
    unplaced: UnplacedItem[];
    attempts: number;
    elapsedMs: number;
}

// ================= 内部構造 =================

type SlotKey = string;
const slotKey = (day: Weekday, period: number): SlotKey => `${day}:${period}`;

interface Need {
    subjectId: string;
    name: string;
    count: number;
    teacherIds: string[];
    partnerCount: number;
}

interface GenContext {
    data: TimetableData;
    options: GenerationOptions;
    days: DayConfig[];
    allSlots: WeeklySlot[];
    subjectById: Map<string, Subject>;
    teacherById: Map<string, Teacher>;
    classById: Map<string, ClassGroup>;
    /** 教員ごとの「授業に使えない」コマ（不可時間 + 会議） */
    teacherBlocked: Map<string, Set<SlotKey>>;
    /** `${subjectId}|${classId}` -> 同じ時間にそろえるべき学級（合同・交流・複式） */
    partnersCache: Map<string, string[]>;
    /** `${classId}|${subjectId}` -> 担当教員ID */
    needTeachers: Map<string, string[]>;
    isPe: (subjectId: string | undefined) => boolean;
}

interface AttemptState {
    schedule: Record<string, Record<Weekday, Record<number, ScheduleCell>>>;
    teacherBusy: Map<SlotKey, Set<string>>;
    peCount: Map<SlotKey, number>;
    needs: Map<string, Need[]>; // classId -> 残り必要数
}

const isPeName = (name?: string) => name === "体育" || name === "保体";

// ================= コンテキスト構築（1回だけ） =================

function buildContext(data: TimetableData, options: GenerationOptions): GenContext {
    const days = getDays(data);
    const allSlots: WeeklySlot[] = days.flatMap((d) =>
        Array.from({ length: d.periods }, (_, i) => ({ day: d.key, period: i + 1 }))
    );
    const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
    const teacherById = new Map(data.teachers.map((t) => [t.id, t]));
    const classById = new Map(data.classes.map((c) => [c.id, c]));

    // 教員の不可時間 + 会議参加コマ
    const teacherBlocked = new Map<string, Set<SlotKey>>();
    data.teachers.forEach((t) => {
        const blocked = new Set<SlotKey>();
        t.unavailable.forEach((s) => blocked.add(slotKey(s.day, s.period)));
        (t.meetingIds ?? []).forEach((mid) => {
            const meeting = data.meetings.find((m) => m.id === mid);
            meeting?.slots.forEach((s) => blocked.add(slotKey(s.day, s.period)));
        });
        teacherBlocked.set(t.id, blocked);
    });

    // 連動学級（合同・交流・複式）の直接パートナー
    const directPartners = (subjectId: string, classId: string): string[] => {
        const result = new Set<string>();
        const cls = classById.get(classId);
        data.jointRules
            .filter((r) => r.subjectId === subjectId && r.grade === cls?.grade)
            .forEach((r) =>
                r.classGroups.forEach((group) => {
                    if (group.includes(classId)) {
                        group.forEach((id) => id !== classId && result.add(id));
                    }
                })
            );
        data.exchangeRules
            .filter((r) => r.subjectIds.includes(subjectId))
            .forEach((r) => {
                if (r.specialClassId === classId) result.add(r.exchangeClassId);
                if (r.exchangeClassId === classId) result.add(r.specialClassId);
            });
        const sub = subjectById.get(subjectId);
        if (sub?.isMultiGrade && sub.multiGradeGroups) {
            sub.multiGradeGroups.forEach((group) => {
                if (group.includes(classId)) {
                    group.forEach((id) => id !== classId && result.add(id));
                }
            });
        }
        return Array.from(result);
    };

    // 芋づる式にすべてのパートナーを取得（キャッシュ付き）
    const partnersCache = new Map<string, string[]>();
    const getPartners = (subjectId: string, classId: string): string[] => {
        const key = `${subjectId}|${classId}`;
        const cached = partnersCache.get(key);
        if (cached) return cached;
        const visited = new Set<string>([classId]);
        const queue = [classId];
        while (queue.length > 0) {
            const current = queue.shift()!;
            directPartners(subjectId, current).forEach((p) => {
                if (!visited.has(p)) {
                    visited.add(p);
                    queue.push(p);
                }
            });
        }
        visited.delete(classId);
        const result = Array.from(visited);
        partnersCache.set(key, result);
        return result;
    };
    // すべての組み合わせを事前計算
    data.subjects.forEach((sub) =>
        data.classes.forEach((cls) => getPartners(sub.id, cls.id))
    );

    // 担当教員の決定（スケジュールに依存しないため事前計算できる）
    const isHomeroomForClass = (teacher: Teacher, cls: ClassGroup) =>
        teacher.id === cls.homeroomTeacherId ||
        (teacher.role === "homeroom" && !!teacher.homeroomClassIds?.includes(cls.id));

    const isExchangeSubjectForClass = (sub: Subject, cls: ClassGroup) =>
        cls.type === "special" &&
        data.exchangeRules.some(
            (r) => r.specialClassId === cls.id && r.subjectIds.includes(sub.id)
        );

    const needTeachers = new Map<string, string[]>();
    data.classes.forEach((cls) => {
        data.subjects.forEach((sub) => {
            let teacherIds: string[] = [];
            if (sub.name === "道徳" || sub.name === "学活" || sub.name === "自立" || sub.name === "生活") {
                const hr = data.teachers.find((t) => isHomeroomForClass(t, cls));
                if (hr) teacherIds = [hr.id];
            } else if (sub.name === "総合" || sub.name === "総合的な学習") {
                teacherIds = data.teachers
                    .filter((t) => t.taughtGrades?.includes(cls.grade) || isHomeroomForClass(t, cls))
                    .map((t) => t.id);
            } else {
                const assigned = data.teachers.filter((t) =>
                    t.subjectAssignments?.some(
                        (a) => a.subjectName === sub.name && a.classIds.includes(cls.id)
                    )
                );
                if (assigned.length > 0) {
                    teacherIds = assigned.map((t) => t.id);
                } else if (!isExchangeSubjectForClass(sub, cls)) {
                    // 交流教科でなければ、教科担当者全員を候補にする
                    teacherIds = data.teachers
                        .filter((t) => t.subjects.includes(sub.name))
                        .map((t) => t.id);
                }
                // 交流教科で担当割当が無い場合は空（交流先の教員が担当する）
            }
            needTeachers.set(`${cls.id}|${sub.id}`, teacherIds);
        });
    });

    return {
        data,
        options,
        days,
        allSlots,
        subjectById,
        teacherById,
        classById,
        teacherBlocked,
        partnersCache,
        needTeachers,
        isPe: (subjectId) => isPeName(subjectById.get(subjectId ?? "")?.name),
    };
}

const partnersOf = (ctx: GenContext, subjectId: string, classId: string): string[] =>
    ctx.partnersCache.get(`${subjectId}|${classId}`) ?? [];

// ================= 試行状態の構築 =================

const cellTeacherIds = (cell?: ScheduleCell): string[] =>
    cell?.teacherIds && cell.teacherIds.length > 0
        ? cell.teacherIds
        : cell?.teacherId
            ? [cell.teacherId]
            : [];

function buildAttemptState(ctx: GenContext): AttemptState {
    const { data } = ctx;
    // 既存スケジュールをコピー（曜日構成に合わせた空週をベースにする）
    const schedule: AttemptState["schedule"] = {};
    data.classes.forEach((cls) => {
        const week: Record<Weekday, Record<number, ScheduleCell>> = {} as any;
        ctx.days.forEach((day) => {
            week[day.key] = {};
            for (let p = 1; p <= day.periods; p += 1) {
                const cell = data.schedule[cls.id]?.[day.key]?.[p];
                week[day.key][p] = cell ? { ...cell } : {};
            }
        });
        schedule[cls.id] = week;
    });

    // 既存配置のうち、教員の不可時間・会議と重なるものは外す
    data.classes.forEach((cls) => {
        ctx.allSlots.forEach((slot) => {
            const cell = schedule[cls.id][slot.day][slot.period];
            if (!cell.subjectId) return;
            const invalid = cellTeacherIds(cell).some((tId) =>
                ctx.teacherBlocked.get(tId)?.has(slotKey(slot.day, slot.period))
            );
            if (invalid) schedule[cls.id][slot.day][slot.period] = {};
        });
    });

    // 教員の使用状況インデックス
    const teacherBusy = new Map<SlotKey, Set<string>>();
    // 保体の同時実施グループ数インデックス
    const peCount = new Map<SlotKey, number>();

    ctx.allSlots.forEach((slot) => {
        const key = slotKey(slot.day, slot.period);
        const busy = new Set<string>();
        const peClasses: { classId: string; subjectId: string }[] = [];
        data.classes.forEach((cls) => {
            const cell = schedule[cls.id][slot.day][slot.period];
            if (!cell.subjectId) return;
            cellTeacherIds(cell).forEach((tId) => busy.add(tId));
            if (ctx.isPe(cell.subjectId)) {
                peClasses.push({ classId: cls.id, subjectId: cell.subjectId });
            }
        });
        teacherBusy.set(key, busy);
        // 既存の保体配置を「連動グループ単位」で数える
        const visited = new Set<string>();
        let groups = 0;
        peClasses.forEach((entry) => {
            if (visited.has(entry.classId)) return;
            groups += 1;
            visited.add(entry.classId);
            const queue = [entry.classId];
            while (queue.length > 0) {
                const current = queue.shift()!;
                partnersOf(ctx, entry.subjectId, current).forEach((p) => {
                    if (!visited.has(p) && peClasses.some((x) => x.classId === p)) {
                        visited.add(p);
                        queue.push(p);
                    }
                });
            }
        });
        peCount.set(key, groups);
    });

    // 残り必要コマ数
    const needs = new Map<string, Need[]>();
    data.classes.forEach((cls) => {
        const list: Need[] = [];
        data.subjects.forEach((sub) => {
            const quota = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
            const target = Math.ceil(quota);
            if (target <= 0) return;
            let placed = 0;
            ctx.allSlots.forEach((slot) => {
                if (schedule[cls.id][slot.day][slot.period].subjectId === sub.id) placed += 1;
            });
            const remaining = Math.max(0, target - placed);
            if (remaining <= 0) return;
            list.push({
                subjectId: sub.id,
                name: sub.name,
                count: remaining,
                teacherIds: ctx.needTeachers.get(`${cls.id}|${sub.id}`) ?? [],
                partnerCount: partnersOf(ctx, sub.id, cls.id).length,
            });
        });
        // 連動が多い教科 → 残り数が多い教科 の順に優先
        list.sort((a, b) =>
            a.partnerCount !== b.partnerCount ? b.partnerCount - a.partnerCount : b.count - a.count
        );
        needs.set(cls.id, list);
    });

    return { schedule, teacherBusy, peCount, needs };
}

// ================= 配置判定 =================

/**
 * 配置できない場合はその理由（日本語）を返し、配置できる場合は null を返す。
 * 生成ループと「配置できなかった理由」の分析で同じ判定を共有する。
 */
function placementBlocker(
    ctx: GenContext,
    state: AttemptState,
    cls: ClassGroup,
    need: Need,
    slot: WeeklySlot
): string | null {
    const key = slotKey(slot.day, slot.period);
    const { schedule } = state;

    if (schedule[cls.id][slot.day][slot.period].subjectId) return "空きコマがない";

    const subject = ctx.subjectById.get(need.subjectId);
    const canDouble = !!subject?.allowDoubleInDay ||
        need.teacherIds.some((tId) => ctx.teacherById.get(tId)?.allowDoubleSubject);
    if (ctx.options.avoidSameDayDuplicate && !canDouble) {
        const dayCells = schedule[cls.id][slot.day];
        for (const p of Object.keys(dayCells)) {
            if (dayCells[Number(p)].subjectId === need.subjectId) {
                return "同じ教科が同日に配置済み";
            }
        }
    }

    if (ctx.isPe(need.subjectId) && (state.peCount.get(key) ?? 0) >= ctx.options.peConcurrencyLimit) {
        return "保体の同時実施数の上限";
    }

    // 連動学級（合同・交流）の状態確認
    const partners = partnersOf(ctx, need.subjectId, cls.id);
    const allTeachers = new Set(need.teacherIds);
    for (const pId of partners) {
        const pNeed = state.needs.get(pId)?.find((n) => n.subjectId === need.subjectId);
        if (!pNeed || pNeed.count <= 0) return "合同・交流先の学級の時数が既に満ちている";
        if (schedule[pId][slot.day]?.[slot.period]?.subjectId) {
            return "合同・交流先の学級に空きがない";
        }
        if (ctx.options.avoidSameDayDuplicate) {
            const pCanDouble = !!ctx.subjectById.get(need.subjectId)?.allowDoubleInDay ||
                pNeed.teacherIds.some((tId) => ctx.teacherById.get(tId)?.allowDoubleSubject);
            if (!pCanDouble) {
                const dayCells = schedule[pId][slot.day];
                for (const p of Object.keys(dayCells)) {
                    if (dayCells[Number(p)].subjectId === need.subjectId) {
                        return "合同・交流先で同じ教科が同日に配置済み";
                    }
                }
            }
        }
        pNeed.teacherIds.forEach((tId) => allTeachers.add(tId));
    }

    if (allTeachers.size === 0 && partners.length === 0) {
        return "担当教員が設定されていない";
    }

    // 教員の空き確認（インデックス参照なので高速）
    const busy = state.teacherBusy.get(key)!;
    for (const tId of allTeachers) {
        if (ctx.teacherBlocked.get(tId)?.has(key)) return "教員の不可時間・会議と重複";
        if (busy.has(tId)) return "教員が他の授業と重複";
    }

    // 担任の空きコマ（最終限）確保
    if (ctx.options.ensureHomeroomPrep) {
        const dayConfig = ctx.days.find((d) => d.key === slot.day)!;
        if (slot.period === dayConfig.periods) {
            for (const tId of allTeachers) {
                const t = ctx.teacherById.get(tId);
                if (t?.role !== "homeroom") continue;
                let hasFree = false;
                for (let p = 1; p <= dayConfig.periods; p += 1) {
                    if (p === slot.period) continue;
                    const k = slotKey(slot.day, p);
                    if (ctx.teacherBlocked.get(tId)?.has(k)) continue;
                    if (!state.teacherBusy.get(k)?.has(tId)) {
                        hasFree = true;
                        break;
                    }
                }
                if (!hasFree) return "担任の空き時間確保の制約";
            }
        }
    }

    return null;
}

/** 配置を実行し、インデックスと残り時数を更新する */
function commitPlacement(
    ctx: GenContext,
    state: AttemptState,
    cls: ClassGroup,
    need: Need,
    slot: WeeklySlot
) {
    const key = slotKey(slot.day, slot.period);
    const partners = partnersOf(ctx, need.subjectId, cls.id);
    const allTeachers = new Set(need.teacherIds);
    partners.forEach((pId) => {
        state.needs.get(pId)?.find((n) => n.subjectId === need.subjectId)
            ?.teacherIds.forEach((tId) => allTeachers.add(tId));
    });
    const teacherIds = Array.from(allTeachers);

    [cls.id, ...partners].forEach((cId) => {
        state.schedule[cId][slot.day][slot.period] = {
            subjectId: need.subjectId,
            teacherIds,
            teacherId: teacherIds[0],
        };
        const n = state.needs.get(cId)?.find((x) => x.subjectId === need.subjectId);
        if (n) n.count -= 1;
    });

    const busy = state.teacherBusy.get(key)!;
    teacherIds.forEach((tId) => busy.add(tId));
    if (ctx.isPe(need.subjectId)) {
        state.peCount.set(key, (state.peCount.get(key) ?? 0) + 1);
    }
}

// ================= 1回の試行 =================

const shuffle = <T,>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

function runAttempt(ctx: GenContext): AttemptState {
    const state = buildAttemptState(ctx);
    const { data } = ctx;

    // --- 0. 固定授業の配置（最優先） ---
    data.subjects.forEach((sub) => {
        if (!sub.fixedSlots) return;
        Object.entries(sub.fixedSlots).forEach(([targetKey, slots]) => {
            const targetClasses = /^\d+$/.test(targetKey)
                ? data.classes.filter((c) => c.grade === parseInt(targetKey, 10))
                : data.classes.filter((c) => c.id === targetKey);
            slots.forEach((slot) => {
                targetClasses.forEach((cls) => {
                    const need = state.needs.get(cls.id)?.find((n) => n.subjectId === sub.id);
                    if (!need || need.count <= 0) return;
                    if (!placementBlocker(ctx, state, cls, need, slot)) {
                        commitPlacement(ctx, state, cls, need, slot);
                    }
                });
            });
        });
    });

    const shuffledSlots = shuffle(ctx.allSlots);
    const shuffledClasses = shuffle(data.classes);

    const attemptFill = (filter: (need: Need, cls: ClassGroup) => boolean) => {
        shuffledSlots.forEach((slot) => {
            shuffledClasses.forEach((cls) => {
                if (state.schedule[cls.id][slot.day][slot.period].subjectId) return;
                const candidates = state.needs.get(cls.id) ?? [];
                for (const need of candidates) {
                    if (need.count <= 0 || !filter(need, cls)) continue;
                    if (!placementBlocker(ctx, state, cls, need, slot)) {
                        commitPlacement(ctx, state, cls, need, slot);
                        return;
                    }
                }
            });
        });
    };

    // --- 1. 保体（体育館の制約が最も厳しい） ---
    attemptFill((need) => isPeName(need.name));
    // --- 2. 合同・交流など連動のある教科 ---
    attemptFill((need) => need.partnerCount > 0);
    // --- 3. その他すべて ---
    attemptFill(() => true);

    return state;
}

const countPlacedCells = (schedule: AttemptState["schedule"]): number => {
    let count = 0;
    Object.values(schedule).forEach((week) => {
        Object.values(week).forEach((day) => {
            Object.values(day).forEach((cell) => {
                if (cell.subjectId) count += 1;
            });
        });
    });
    return count;
};

// ================= 配置できなかった理由の分析 =================

function analyzeUnplaced(ctx: GenContext, best: AttemptState): UnplacedItem[] {
    const items: UnplacedItem[] = [];
    best.needs.forEach((needList, classId) => {
        const cls = ctx.classById.get(classId);
        if (!cls) return;
        needList.forEach((need) => {
            if (need.count <= 0) return;
            const reasonCounts = new Map<string, number>();
            ctx.allSlots.forEach((slot) => {
                const reason = placementBlocker(ctx, best, cls, need, slot);
                if (reason) {
                    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
                }
            });
            const reasons = Array.from(reasonCounts.entries())
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);
            items.push({
                classId,
                subjectId: need.subjectId,
                remaining: need.count,
                reasons,
            });
        });
    });
    return items.sort((a, b) => b.remaining - a.remaining);
}

// ================= エントリポイント =================

export function generateAutoTimetable(
    data: TimetableData,
    options: GenerationOptions = DEFAULT_GENERATION_OPTIONS
): { data: TimetableData; report: GenerationReport } {
    const started = Date.now();
    const ctx = buildContext(data, options);

    // 配置対象コマ数（試行前の不足分）
    const initial = buildAttemptState(ctx);
    let totalTarget = 0;
    initial.needs.forEach((list) => list.forEach((n) => (totalTarget += n.count)));

    let best: AttemptState | null = null;
    let bestRemaining = Infinity;
    let attempts = 0;
    const hardCap = 300;

    while (attempts < hardCap && Date.now() - started < options.timeBudgetMs) {
        attempts += 1;
        const state = runAttempt(ctx);
        let remaining = 0;
        state.needs.forEach((list) => list.forEach((n) => (remaining += n.count)));
        if (remaining < bestRemaining) {
            bestRemaining = remaining;
            best = state;
        }
        if (remaining === 0) break;
    }

    if (!best) {
        best = initial;
        bestRemaining = totalTarget;
    }
    const result = best;
    const unplaced = analyzeUnplaced(ctx, result);
    const report: GenerationReport = {
        totalTarget,
        totalPlaced: totalTarget - bestRemaining,
        unplaced,
        attempts,
        elapsedMs: Date.now() - started,
    };

    return {
        data: {
            ...data,
            schedule: result.schedule,
            lastUpdated: new Date().toISOString(),
        },
        report,
    };
}
