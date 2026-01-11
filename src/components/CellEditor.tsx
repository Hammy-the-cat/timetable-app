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
}: CellEditorProps) {
  if (!slot) return null;

  const selectedSubject = data.subjects.find(s => s.id === cell?.subjectId);

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
      return t.role === "homeroom" && !!t.homeroomClassIds?.includes(classId);
    }

    // B. 総合: 所属学年で判定
    if (subName === "総合") {
      const cls = data.classes.find(c => c.id === classId);
      const grade = cls?.grade || currentGrade;
      if (!grade) return false;
      return !!t.taughtGrades?.includes(grade) || (t.role === "homeroom" && !!t.homeroomClassIds?.includes(classId));
    }

    // C. それ以外の教科: 担当クラス設定で判定
    if (t.assignedClassIds && t.assignedClassIds.length > 0) {
      if (!t.assignedClassIds.includes(classId)) return false;
    }

    // D. 教科フィルター（既存: その教科を教えられる登録があるか）
    if (selectedSubject) {
      const teachesSubject = t.subjects.some(sn =>
        sn.includes(selectedSubject.name) || selectedSubject.name.includes(subName)
      );
      const anyTeacherAssigned = data.teachers.some(tt =>
        tt.subjects.some(sn => sn.includes(selectedSubject.name))
      );
      if (anyTeacherAssigned && !teachesSubject) return false;
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
