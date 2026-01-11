import { formatSlot } from "./school";
import {
  CellWarning,
  ScheduleCell,
  TimetableData,
  WeekSchedule,
  WeeklySlot,
} from "./types";

const slotEquals = (a: WeeklySlot, b: WeeklySlot) =>
  a.day === b.day && a.period === b.period;

const getClassLabel = (data: TimetableData, classId: string) => {
  const target = data.classes.find((cls) => cls.id === classId);
  if (!target) return classId;
  return `${target.grade}年${target.label}組`;
};

const classSubjectCount = (
  week: WeekSchedule,
  subjectId: string,
  slot: WeeklySlot,
  nextCell: ScheduleCell
) => {
  let count = 0;
  for (const dayKey of Object.keys(week)) {
    const daySchedule = week[dayKey as keyof WeekSchedule];
    for (const periodKey of Object.keys(daySchedule)) {
      const period = Number(periodKey);
      const isTarget = slot.day === dayKey && slot.period === period;
      const cell = isTarget ? nextCell : daySchedule[period];
      if (cell?.subjectId === subjectId) {
        count += 1;
      }
    }
  }
  return count;
};

export const collectWarnings = (
  data: TimetableData,
  classId: string,
  slot: WeeklySlot,
  cell: ScheduleCell
): CellWarning[] => {
  const warnings: CellWarning[] = [];

  if (cell.teacherId) {
    const teacher = data.teachers.find((t) => t.id === cell.teacherId);
    if (teacher) {
      if (teacher.unavailable.some((block) => slotEquals(block, slot))) {
        warnings.push({
          type: "teacherUnavailable",
          message: `${teacher.name}は${formatSlot(slot)}は不可コマです。`,
        });
      }

      const conflict = Object.entries(data.schedule).find(([otherClassId, week]) => {
        if (otherClassId === classId) return false;
        const match = week[slot.day]?.[slot.period];
        return match?.teacherId === cell.teacherId;
      });

      if (conflict) {
        warnings.push({
          type: "teacherConflict",
          message: `${teacher.name}は${getClassLabel(
            data,
            conflict[0]
          )}と重複しています。`,
        });
      }

      // 参加する会議との重複チェック
      if (teacher.meetingIds && teacher.meetingIds.length > 0) {
        const teacherMeetingConflict = data.meetings.find(m =>
          teacher.meetingIds?.includes(m.id) &&
          m.slots.some(s => slotEquals(s, slot))
        );
        if (teacherMeetingConflict) {
          warnings.push({
            type: "meetingBlock",
            message: `${teacher.name}は「${teacherMeetingConflict.name}」に出席するため、この時間は不可です。`,
          });
        }
      }

      // 担当資格・割当チェック
      if (cell.subjectId) {
        const subject = data.subjects.find((s) => s.id === cell.subjectId);
        const subName = subject?.name || "";
        const cls = data.classes.find((c) => c.id === classId);

        // A. 道徳・学活
        if (subName === "道徳" || subName === "学活") {
          if (teacher.role !== "homeroom" || !teacher.homeroomClassIds?.includes(classId)) {
            warnings.push({
              type: "teacherConflict",
              message: `${subName}は担任以外の設定はできません。`,
            });
          }
        }
        // B. 総合
        else if (subName === "総合") {
          const isGradeMember = teacher.taughtGrades?.includes(cls?.grade || 0);
          const isHomeroom = teacher.role === "homeroom" && teacher.homeroomClassIds?.includes(classId);
          if (!isGradeMember && !isHomeroom) {
            warnings.push({
              type: "teacherConflict",
              message: `総合はその学年所属または担任の先生のみ担当可能です。`,
            });
          }
        }
        // C. その他 (教科ごとの担当設定)
        else {
          if (teacher.subjectAssignments && teacher.subjectAssignments.length > 0) {
            const assignment = teacher.subjectAssignments.find((a) => a.subjectName === subName);
            if (assignment && !assignment.classIds.includes(classId)) {
              warnings.push({
                type: "teacherConflict",
                message: `${teacher.name}はこのクラスの「${subName}」は担当していません。`,
              });
            }
          }
        }
      }
    }
  }

  if (cell.roomId) {
    const conflict = Object.entries(data.schedule).find(([otherClassId, week]) => {
      if (otherClassId === classId) return false;
      const match = week[slot.day]?.[slot.period];
      return match?.roomId === cell.roomId;
    });
    if (conflict) {
      const room = data.classrooms.find((room) => room.id === cell.roomId);
      warnings.push({
        type: "roomConflict",
        message: `${room?.name ?? "教室"}は${getClassLabel(
          data,
          conflict[0]
        )}と重複しています。`,
      });
    }
  }

  const meeting = data.meetings.find((m) =>
    m.slots.some((block) => slotEquals(block, slot))
  );
  if (meeting) {
    warnings.push({
      type: "meetingBlock",
      message: `${meeting.name}のため${formatSlot(slot)}は使用できません。`,
    });
  }

  if (cell.subjectId) {
    const week = data.schedule[classId];
    const subject = data.subjects.find((s) => s.id === cell.subjectId);
    if (week && subject?.weeklyQuota) {
      const count = classSubjectCount(week, subject.id, slot, cell);
      if (count > subject.weeklyQuota) {
        warnings.push({
          type: "subjectQuota",
          message: `${subject.name}のコマ数が上限を超えています(${count}/${subject.weeklyQuota})。`,
        });
      }

      // --- 1日1回制限のチェック ---
      const daySchedule = data.schedule[classId]?.[slot.day] || {};
      const subjectAlreadyInDay = Object.entries(daySchedule).some(([pStr, c]) => {
        const p = parseInt(pStr);
        return p !== slot.period && c.subjectId === cell.subjectId;
      });

      if (subjectAlreadyInDay) {
        const tIds = cell.teacherIds || (cell.teacherId ? [cell.teacherId] : []);
        const canDouble = tIds.some(tId => {
          const t = data.teachers.find(tx => tx.id === tId);
          return t?.allowDoubleSubject;
        });

        if (!canDouble) {
          warnings.push({
            type: "subjectQuota",
            message: `${subject.name}は1日に既に設定されています（「1日2時間可能」設定が必要です）。`,
          });
        }
      }
    }
  }

  return warnings;
};

export const summarizeSubjectUsage = (
  week: WeekSchedule,
  subjects: TimetableData["subjects"]
) => {
  return subjects.map((subject) => {
    let count = 0;
    for (const day of Object.values(week)) {
      for (const cell of Object.values(day)) {
        if (cell.subjectId === subject.id) {
          count += 1;
        }
      }
    }
    return { subject, count };
  });
};
