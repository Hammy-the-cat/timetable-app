"use client";

import { TimetableData, ScheduleCell, WeeklySlot, CellWarning, Teacher } from "@/lib/types";

interface CellEditorProps {
  classId: string;
  slot: WeeklySlot | null;
  cell: ScheduleCell | undefined;
  data: TimetableData;
  currentGrade?: number;
  warnings: CellWarning[];
  onUpdate: (patch: ScheduleCell) => void;
  onClear: () => void;
  /** 他学級の同じコマへコピーする（合同・交流の反映用） */
  onApplyToClass?: (targetClassId: string, patch: ScheduleCell) => void;
}

export function CellEditor({
  classId,
  slot,
  cell,
  data,
  currentGrade,
  warnings,
  onUpdate,
  onClear,
  onApplyToClass,
}: CellEditorProps) {
  if (!slot) return null;

  const selectedSubject = data.subjects.find(s => s.id === cell?.subjectId);
  const currentClass = data.classes.find(c => c.id === classId);
  const isHomeroomForClass = (teacher: Teacher) =>
    teacher.id === currentClass?.homeroomTeacherId ||
    (teacher.role === "homeroom" && !!teacher.homeroomClassIds?.includes(classId));
  const exchangeClass =
    currentClass?.type === "special" && currentClass.exchangeClassId && selectedSubject
      ? (() => {
        const usesExchange =
          (currentClass.specialType === "intellectual" && !!selectedSubject.intellectualExchange?.[currentClass.grade]) ||
          (currentClass.specialType === "emotional" && !!selectedSubject.emotionalExchange?.[currentClass.grade]) ||
          (currentClass.specialType === "physical" && !!selectedSubject.physicalExchange?.[currentClass.grade]) ||
          !!selectedSubject.specialGradeExchange?.[currentClass.grade];
        return usesExchange ? data.classes.find(c => c.id === currentClass.exchangeClassId) : undefined;
      })()
      : undefined;

  // 合同グループ（このコマの教科・学年でこの学級が属するグループ）
  const jointPartnerIds: string[] = cell?.subjectId
    ? data.jointRules
      .filter((r) => r.subjectId === cell.subjectId && r.grade === currentClass?.grade)
      .flatMap((r) => r.classGroups)
      .filter((group) => group.includes(classId))
      .flatMap((group) => group.filter((id) => id !== classId))
    : [];

  // 交流ペア（特支側でも通常側でも反映できるよう双方向に解決）
  const exchangePartnerIds: string[] = cell?.subjectId
    ? data.exchangeRules
      .filter((r) => r.subjectIds.includes(cell.subjectId!))
      .flatMap((r) => {
        if (r.specialClassId === classId) return [r.exchangeClassId];
        if (r.exchangeClassId === classId) return [r.specialClassId];
        return [];
      })
    : [];

  const classLabelOf = (id: string) => {
    const c = data.classes.find((x) => x.id === id);
    return c ? `${c.grade}-${c.label}` : id;
  };

  const applyTo = (targetIds: string[]) => {
    if (!onApplyToClass || !cell?.subjectId) return;
    const patch: ScheduleCell = {
      subjectId: cell.subjectId,
      teacherId: cell.teacherId,
      teacherIds: cell.teacherIds,
      roomId: cell.roomId,
    };
    targetIds.forEach((id) => onApplyToClass(id, patch));
  };

  const filteredTeachers = data.teachers.filter((t: Teacher) => {
    // 授業不可時間フィルター
    if (t.unavailable.some(u => u.day === slot.day && u.period === slot.period)) {
      return false;
    }

    // 会議重複フィルター
    if (t.meetingIds && t.meetingIds.length > 0) {
      const hasMeeting = data.meetings.some(m =>
        t.meetingIds?.includes(m.id) &&
        m.slots.some(s => s.day === slot.day && s.period === slot.period)
      );
      if (hasMeeting) return false;
    }

    // 2. 教科別の絞り込みロジック
    const subName = selectedSubject?.name || "";

    // A. 道徳・学活: 担任のみ（そのクラスの担任であること）
    if (subName === "道徳" || subName === "学活") {
      return isHomeroomForClass(t);
    }

    // B. 特別支援学級の「自立」「生活」: そのクラスの担任のみ
    if (subName === "自立" || subName === "生活") {
      const cls = data.classes.find(c => c.id === classId);
      if (cls?.type === "special") {
        return isHomeroomForClass(t);
      }
    }

    // C. 総合: 所属学年、またはその学級の担任
    if (subName === "総合") {
      const cls = data.classes.find(c => c.id === classId);
      return !!t.taughtGrades?.includes(cls?.grade || 0) || isHomeroomForClass(t);
    }

    // D. それ以外の教科: 教科ごとの担当クラス設定がある場合は最優先
    if (exchangeClass && selectedSubject) {
      const exchangeAssignment = t.subjectAssignments?.find(a => a.subjectName === selectedSubject.name);
      return !!exchangeAssignment?.classIds.includes(exchangeClass.id);
    }

    if (t.subjectAssignments && t.subjectAssignments.length > 0 && selectedSubject) {
      const assignment = t.subjectAssignments.find(a => a.subjectName === selectedSubject.name);
      if (assignment) {
        return assignment.classIds.includes(classId);
      }
    }

    // E. 基本フィルター: 名前に教科名が含まれているか、または教科リストに含まれているか
    if (selectedSubject) {
      const teachesSubject = t.subjects.includes(selectedSubject.name);
      return teachesSubject;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Subject Select */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">科目</label>
          <select
            className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            value={cell?.subjectId ?? ""}
            onChange={(e) => onUpdate({ subjectId: e.target.value })}
          >
            <option value="">未選択</option>
            {data.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Teacher Select */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            教師 {filteredTeachers.length < data.teachers.length ? "(絞り込み中)" : ""}
          </label>
          <select
            className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            value={cell?.teacherId ?? ""}
            onChange={(e) => onUpdate({ teacherId: e.target.value })}
          >
            <option value="">未選択</option>
            {filteredTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {filteredTeachers.length === 0 && (
              <option disabled>該当する教師がいません</option>
            )}
          </select>
        </div>

        {/* Room Select */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">教室</label>
          <select
            className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
            value={cell?.roomId ?? ""}
            onChange={(e) => onUpdate({ roomId: e.target.value })}
          >
            <option value="">未選択</option>
            {data.classrooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`p-2 rounded border text-[10px] font-bold ${w.type === "teacherConflict" || w.type === "roomConflict"
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "bg-amber-50 border-amber-200 text-amber-600"
                }`}
            >
              ⚠️ {w.message}
            </div>
          ))}
        </div>
      )}

      {/* 合同・交流への反映 */}
      {onApplyToClass && cell?.subjectId && (jointPartnerIds.length > 0 || exchangePartnerIds.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {jointPartnerIds.length > 0 && (
            <button
              type="button"
              onClick={() => applyTo(jointPartnerIds)}
              className="px-3 py-1.5 text-xs font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
              title={`このコマの内容を ${jointPartnerIds.map(classLabelOf).join("、")} の同じ時間にコピーします`}
            >
              🤝 合同グループに反映（{jointPartnerIds.map(classLabelOf).join("・")}）
            </button>
          )}
          {exchangePartnerIds.length > 0 && (
            <button
              type="button"
              onClick={() => applyTo(exchangePartnerIds)}
              className="px-3 py-1.5 text-xs font-bold rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              title={`このコマの内容を ${exchangePartnerIds.map(classLabelOf).join("、")} の同じ時間にコピーします`}
            >
              🔁 交流先にも反映（{exchangePartnerIds.map(classLabelOf).join("・")}）
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded transition-colors font-bold"
        >
          削除
        </button>
      </div>
    </div>
  );
}
