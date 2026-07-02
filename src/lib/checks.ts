import { formatSlot, getDays, getEffectiveQuota } from "./school";
import {
  ClassGroup,
  ScheduleCell,
  TimetableData,
  Weekday,
  WeeklySlot,
} from "./types";

export type CheckIssueType =
  | "teacherConflict"
  | "roomConflict"
  | "teacherUnavailable"
  | "meetingConflict"
  | "quotaShortage"
  | "quotaExcess"
  | "unassignedTeacher"
  | "jointMismatch"
  | "exchangeMismatch"
  | "sameDayDuplicate";

export type CheckSeverity = "error" | "warning";

export interface CheckIssue {
  id: string;
  type: CheckIssueType;
  severity: CheckSeverity;
  message: string;
  classIds: string[];
  teacherIds: string[];
  subjectId?: string;
  slot?: WeeklySlot;
}

export const CHECK_TYPE_LABELS: Record<CheckIssueType, string> = {
  teacherConflict: "教員重複",
  roomConflict: "教室重複",
  teacherUnavailable: "授業不可コマ",
  meetingConflict: "会議と重複",
  quotaShortage: "時数不足",
  quotaExcess: "時数超過",
  unassignedTeacher: "担当未設定",
  jointMismatch: "合同授業のズレ",
  exchangeMismatch: "交流授業のズレ",
  sameDayDuplicate: "同日重複",
};

const classLabel = (cls?: ClassGroup) =>
  cls ? `${cls.grade}年${cls.label}組` : "不明な学級";

const cellTeacherIds = (cell: ScheduleCell): string[] =>
  cell.teacherIds && cell.teacherIds.length > 0
    ? cell.teacherIds
    : cell.teacherId
      ? [cell.teacherId]
      : [];

/**
 * 全時間割を横断してチェックし、問題点の一覧を返す。
 * （企画書 6.6 チェック結果画面のチェック項目に対応）
 */
export function runAllChecks(data: TimetableData): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const days = getDays(data);
  const classById = new Map(data.classes.map((c) => [c.id, c]));
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));
  let seq = 0;
  const push = (issue: Omit<CheckIssue, "id">) => {
    issues.push({ ...issue, id: `issue-${seq++}` });
  };

  const allSlots: WeeklySlot[] = days.flatMap((day) =>
    Array.from({ length: day.periods }, (_, i) => ({
      day: day.key as Weekday,
      period: i + 1,
    }))
  );

  // ---- 同じ教科で「同じ時間になるべき学級」のつながり（合同・交流・複式） ----
  const partnersOf = (subjectId: string, classId: string): Set<string> => {
    const result = new Set<string>();
    const cls = classById.get(classId);
    data.jointRules
      .filter((r) => r.subjectId === subjectId && r.grade === cls?.grade)
      .forEach((r) => {
        r.classGroups.forEach((group) => {
          if (group.includes(classId)) {
            group.forEach((id) => id !== classId && result.add(id));
          }
        });
      });
    data.exchangeRules
      .filter((r) => r.subjectIds.includes(subjectId))
      .forEach((r) => {
        if (r.specialClassId === classId) result.add(r.exchangeClassId);
        if (r.exchangeClassId === classId) result.add(r.specialClassId);
      });
    const subject = subjectById.get(subjectId);
    if (subject?.isMultiGrade && subject.multiGradeGroups) {
      subject.multiGradeGroups.forEach((group) => {
        if (group.includes(classId)) {
          group.forEach((id) => id !== classId && result.add(id));
        }
      });
    }
    return result;
  };

  // 同じ教科のクラス群が「すべて連動関係でつながっているか」（教員重複の許容判定）
  const areLinked = (subjectId: string, classIds: string[]): boolean => {
    if (classIds.length <= 1) return true;
    const visited = new Set<string>([classIds[0]]);
    const queue = [classIds[0]];
    while (queue.length > 0) {
      const current = queue.shift()!;
      partnersOf(subjectId, current).forEach((p) => {
        if (!visited.has(p)) {
          visited.add(p);
          queue.push(p);
        }
      });
    }
    return classIds.every((id) => visited.has(id));
  };

  // ================= スロット横断チェック =================
  allSlots.forEach((slot) => {
    const teacherUsage = new Map<string, { classId: string; subjectId?: string }[]>();
    const roomUsage = new Map<string, string[]>();

    data.classes.forEach((cls) => {
      const cell = data.schedule[cls.id]?.[slot.day]?.[slot.period];
      if (!cell?.subjectId) return;

      // 担当未設定
      const tIds = cellTeacherIds(cell);
      if (tIds.length === 0) {
        push({
          type: "unassignedTeacher",
          severity: "warning",
          message: `${classLabel(cls)} ${formatSlot(slot)} の「${subjectById.get(cell.subjectId)?.name ?? "授業"}」に担当者が設定されていません。`,
          classIds: [cls.id],
          teacherIds: [],
          subjectId: cell.subjectId,
          slot,
        });
      }

      tIds.forEach((tId) => {
        const list = teacherUsage.get(tId) ?? [];
        list.push({ classId: cls.id, subjectId: cell.subjectId });
        teacherUsage.set(tId, list);

        const teacher = teacherById.get(tId);
        if (!teacher) return;

        // 授業不可コマ
        if (teacher.unavailable.some((s) => s.day === slot.day && s.period === slot.period)) {
          push({
            type: "teacherUnavailable",
            severity: "error",
            message: `${teacher.name} は ${formatSlot(slot)} が授業不可ですが、${classLabel(cls)} に授業があります。`,
            classIds: [cls.id],
            teacherIds: [tId],
            subjectId: cell.subjectId,
            slot,
          });
        }

        // 会議との重なり
        const meeting = data.meetings.find(
          (m) =>
            teacher.meetingIds?.includes(m.id) &&
            m.slots.some((s) => s.day === slot.day && s.period === slot.period)
        );
        if (meeting) {
          push({
            type: "meetingConflict",
            severity: "error",
            message: `${teacher.name} は ${formatSlot(slot)} に「${meeting.name}」がありますが、${classLabel(cls)} に授業があります。`,
            classIds: [cls.id],
            teacherIds: [tId],
            subjectId: cell.subjectId,
            slot,
          });
        }
      });

      if (cell.roomId) {
        const list = roomUsage.get(cell.roomId) ?? [];
        list.push(cls.id);
        roomUsage.set(cell.roomId, list);
      }
    });

    // 教員重複（合同・交流でつながっている場合は正常とみなす）
    teacherUsage.forEach((usages, tId) => {
      if (usages.length <= 1) return;
      const subjectIds = Array.from(new Set(usages.map((u) => u.subjectId)));
      const sameSubject = subjectIds.length === 1 && subjectIds[0];
      if (sameSubject && areLinked(sameSubject, usages.map((u) => u.classId))) return;
      const teacher = teacherById.get(tId);
      const labels = usages.map((u) => classLabel(classById.get(u.classId))).join("、");
      push({
        type: "teacherConflict",
        severity: "error",
        message: `${teacher?.name ?? "教員"} が ${formatSlot(slot)} に ${labels} で重複しています。`,
        classIds: usages.map((u) => u.classId),
        teacherIds: [tId],
        subjectId: usages[0].subjectId,
        slot,
      });
    });

    // 教室重複
    roomUsage.forEach((clsIds, roomId) => {
      if (clsIds.length <= 1) return;
      const room = data.classrooms.find((r) => r.id === roomId);
      const labels = clsIds.map((id) => classLabel(classById.get(id))).join("、");
      push({
        type: "roomConflict",
        severity: "error",
        message: `${room?.name ?? "教室"} が ${formatSlot(slot)} に ${labels} で重複しています。`,
        classIds: clsIds,
        teacherIds: [],
        slot,
      });
    });
  });

  // ================= 学級ごとのチェック =================
  data.classes.forEach((cls) => {
    const week = data.schedule[cls.id];

    // 教科ごとの配置数
    const counts = new Map<string, number>();
    days.forEach((day) => {
      for (let period = 1; period <= day.periods; period += 1) {
        const cell = week?.[day.key]?.[period];
        if (cell?.subjectId) {
          counts.set(cell.subjectId, (counts.get(cell.subjectId) ?? 0) + 1);
        }
      }
    });

    // 時数不足・超過
    data.subjects.forEach((sub) => {
      const quota = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
      const target = Math.ceil(quota);
      const count = counts.get(sub.id) ?? 0;
      if (target > 0 && count < target) {
        push({
          type: "quotaShortage",
          severity: "warning",
          message: `${classLabel(cls)} の「${sub.name}」が ${target - count} コマ不足しています（${count}/${target}）。`,
          classIds: [cls.id],
          teacherIds: [],
          subjectId: sub.id,
        });
      } else if (count > target) {
        push({
          type: "quotaExcess",
          severity: "warning",
          message: `${classLabel(cls)} の「${sub.name}」が ${count - target} コマ超過しています（${count}/${target}）。`,
          classIds: [cls.id],
          teacherIds: [],
          subjectId: sub.id,
        });
      }
    });

    // 同一教科の同日重複
    days.forEach((day) => {
      const perSubject = new Map<string, number[]>();
      for (let period = 1; period <= day.periods; period += 1) {
        const cell = week?.[day.key]?.[period];
        if (cell?.subjectId) {
          const list = perSubject.get(cell.subjectId) ?? [];
          list.push(period);
          perSubject.set(cell.subjectId, list);
        }
      }
      perSubject.forEach((periods, subjectId) => {
        if (periods.length <= 1) return;
        const sub = subjectById.get(subjectId);
        if (sub?.allowDoubleInDay) return;
        // 担当教員に「1日2時間可能」設定があれば許容
        const canDouble = periods.some((p) => {
          const cell = week?.[day.key]?.[p];
          return cellTeacherIds(cell ?? {}).some(
            (tId) => teacherById.get(tId)?.allowDoubleSubject
          );
        });
        if (canDouble) return;
        push({
          type: "sameDayDuplicate",
          severity: "warning",
          message: `${classLabel(cls)} の「${sub?.name ?? "教科"}」が ${days.find((d) => d.key === day.key)?.shortLabel}曜日に ${periods.length} 回入っています（${periods.map((p) => `${p}限`).join("、")}）。`,
          classIds: [cls.id],
          teacherIds: [],
          subjectId,
          slot: { day: day.key, period: periods[1] },
        });
      });
    });
  });

  // ================= 合同授業のズレ =================
  data.jointRules.forEach((rule) => {
    const sub = subjectById.get(rule.subjectId);
    if (!sub) return;
    rule.classGroups.forEach((group) => {
      if (group.length < 2) return;
      allSlots.forEach((slot) => {
        const present = group.filter(
          (id) => data.schedule[id]?.[slot.day]?.[slot.period]?.subjectId === rule.subjectId
        );
        if (present.length === 0 || present.length === group.length) return;
        const missing = group.filter((id) => !present.includes(id));
        push({
          type: "jointMismatch",
          severity: "error",
          message: `合同授業「${sub.name}」（${rule.grade}年）: ${formatSlot(slot)} に ${missing
            .map((id) => classLabel(classById.get(id)))
            .join("、")} の授業が入っていません。`,
          classIds: group,
          teacherIds: [],
          subjectId: rule.subjectId,
          slot,
        });
      });
    });
  });

  // ================= 交流授業のズレ =================
  data.exchangeRules.forEach((rule) => {
    const special = classById.get(rule.specialClassId);
    const partner = classById.get(rule.exchangeClassId);
    if (!special || !partner) return;
    rule.subjectIds.forEach((subjectId) => {
      const sub = subjectById.get(subjectId);
      if (!sub) return;
      allSlots.forEach((slot) => {
        const specialHas =
          data.schedule[special.id]?.[slot.day]?.[slot.period]?.subjectId === subjectId;
        const partnerHas =
          data.schedule[partner.id]?.[slot.day]?.[slot.period]?.subjectId === subjectId;
        if (specialHas && !partnerHas) {
          push({
            type: "exchangeMismatch",
            severity: "error",
            message: `交流授業「${sub.name}」: ${classLabel(special)} は ${formatSlot(slot)} に授業がありますが、交流先の ${classLabel(partner)} に同じ授業がありません。`,
            classIds: [special.id, partner.id],
            teacherIds: [],
            subjectId,
            slot,
          });
        }
      });
    });
  });

  const severityOrder: Record<CheckSeverity, number> = { error: 0, warning: 1 };
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
