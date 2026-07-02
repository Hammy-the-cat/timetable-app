"use client";

import { useState } from "react";

import { DAY_CONFIGS } from "@/lib/school";
import {
  ClassGroup,
  DayConfig,
  ExchangeLessonRule,
  JointLessonRule,
  SchoolSettings,
  SchoolType,
  Subject,
  SubjectAssignment,
  Teacher,
  Weekday,
} from "@/lib/types";
import { useTimetableStore } from "@/store/timetable-store";
import { ExchangeRulesEditor, JointRulesEditor } from "./JointExchangeSettings";

const STEPS = [
  { key: "school", label: "学校・年度" },
  { key: "classes", label: "学年・学級" },
  { key: "subjects", label: "教科・週時数" },
  { key: "teachers", label: "教員" },
  { key: "assignments", label: "担当学級" },
  { key: "jointExchange", label: "合同・交流" },
] as const;

const SCHOOL_TYPES: { value: SchoolType; label: string }[] = [
  { value: "juniorHigh", label: "中学校" },
  { value: "elementary", label: "小学校" },
  { value: "highSchool", label: "高等学校" },
  { value: "other", label: "その他" },
];

const newId = (prefix: string) =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface Draft {
  settings: SchoolSettings;
  gradeCount: number;
  classes: ClassGroup[];
  subjects: Subject[];
  teachers: Teacher[];
  jointRules: JointLessonRule[];
  exchangeRules: ExchangeLessonRule[];
}

const sortClasses = (classes: ClassGroup[]): ClassGroup[] =>
  [...classes].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    const na = Number(a.label);
    const nb = Number(b.label);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.label.localeCompare(b.label, "ja");
  });

const inputClass =
  "rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500";
const miniInputClass =
  "w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-xs outline-none focus:ring-1 focus:ring-brand-500";

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { data, applySetup } = useTimetableStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({
    settings: {
      ...data.settings,
      days: data.settings.days.map((d) => ({ ...d })),
    },
    gradeCount: Math.max(1, ...data.classes.map((c) => c.grade)),
    classes: data.classes.map((c) => ({ ...c })),
    subjects: data.subjects.map((s) => ({ ...s })),
    teachers: data.teachers.map((t) => ({
      ...t,
      subjects: [...t.subjects],
      unavailable: [...t.unavailable],
      subjectAssignments: (t.subjectAssignments ?? []).map((a) => ({
        subjectName: a.subjectName,
        classIds: [...a.classIds],
      })),
    })),
    jointRules: data.jointRules.map((r) => ({
      ...r,
      classGroups: r.classGroups.map((g) => [...g]),
    })),
    exchangeRules: data.exchangeRules.map((r) => ({ ...r, subjectIds: [...r.subjectIds] })),
  }));

  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");

  const grades = Array.from({ length: draft.gradeCount }, (_, i) => i + 1);
  const step = STEPS[stepIndex];

  // ============ ステップ1: 学校・年度 ============

  const updateSettings = (patch: Partial<SchoolSettings>) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const toggleDay = (key: Weekday) => {
    setDraft((d) => {
      const enabled = d.settings.days.some((day) => day.key === key);
      let days: DayConfig[];
      if (enabled) {
        days = d.settings.days.filter((day) => day.key !== key);
      } else {
        const base = DAY_CONFIGS.find((day) => day.key === key)!;
        days = DAY_CONFIGS.filter(
          (master) =>
            master.key === key || d.settings.days.some((day) => day.key === master.key)
        ).map(
          (master) =>
            d.settings.days.find((day) => day.key === master.key) ?? { ...base }
        );
      }
      return { ...d, settings: { ...d.settings, days } };
    });
  };

  const setDayPeriods = (key: Weekday, periods: number) => {
    setDraft((d) => ({
      ...d,
      settings: {
        ...d.settings,
        days: d.settings.days.map((day) =>
          day.key === key ? { ...day, periods: Math.min(8, Math.max(1, periods)) } : day
        ),
      },
    }));
  };

  // ============ ステップ2: 学年・学級 ============

  const setGradeCount = (count: number) => {
    const next = Math.min(6, Math.max(1, count));
    setDraft((d) => {
      let classes = d.classes.filter((c) => c.grade <= next);
      for (let g = 1; g <= next; g += 1) {
        if (!classes.some((c) => c.grade === g)) {
          classes = [
            ...classes,
            ...[1, 2, 3, 4].map((label) => ({
              id: `class-${g}-${label}`,
              grade: g,
              label: String(label),
              type: "normal" as const,
            })),
          ];
        }
      }
      return { ...d, gradeCount: next, classes: sortClasses(classes) };
    });
  };

  const setNormalCount = (grade: number, count: number) => {
    const next = Math.min(12, Math.max(0, count));
    setDraft((d) => {
      const others = d.classes.filter((c) => !(c.grade === grade && c.type !== "special"));
      const existing = d.classes.filter((c) => c.grade === grade && c.type !== "special");
      const normals: ClassGroup[] = Array.from({ length: next }, (_, i) => {
        const label = String(i + 1);
        return (
          existing.find((c) => c.label === label) ?? {
            id: `class-${grade}-${label}`,
            grade,
            label,
            type: "normal" as const,
          }
        );
      });
      return { ...d, classes: sortClasses([...others, ...normals]) };
    });
  };

  const addSpecialClass = (grade: number) => {
    setDraft((d) => {
      const gradeClasses = d.classes.filter((c) => c.grade === grade);
      const usedNumbers = gradeClasses
        .map((c) => Number(c.label))
        .filter((n) => !Number.isNaN(n));
      const label = String(usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1);
      const cls: ClassGroup = {
        id: `class-${grade}-${label}`,
        grade,
        label,
        type: "special",
        specialType: "emotional",
      };
      return { ...d, classes: sortClasses([...d.classes, cls]) };
    });
  };

  const updateClass = (id: string, patch: Partial<ClassGroup>) =>
    setDraft((d) => ({
      ...d,
      classes: sortClasses(d.classes.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    }));

  const deleteClass = (id: string) =>
    setDraft((d) => ({ ...d, classes: d.classes.filter((c) => c.id !== id) }));

  // ============ ステップ3: 教科・週時数 ============

  const updateSubject = (id: string, patch: Partial<Subject>) =>
    setDraft((d) => ({
      ...d,
      subjects: d.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const setGradeQuota = (
    subject: Subject,
    field: "gradeQuotas" | "specialGradeQuotas",
    grade: number,
    raw: string
  ) => {
    const current = { ...(subject[field] ?? {}) };
    if (raw === "") {
      delete current[grade];
    } else {
      const value = Number(raw);
      if (Number.isNaN(value)) return;
      current[grade] = value;
    }
    updateSubject(subject.id, { [field]: current });
  };

  const addSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    setDraft((d) => ({
      ...d,
      subjects: [...d.subjects, { id: newId("subject"), name, weeklyQuota: 1 }],
    }));
    setNewSubjectName("");
  };

  const deleteSubject = (id: string) =>
    setDraft((d) => ({
      ...d,
      subjects: d.subjects.filter((s) => s.id !== id),
      jointRules: d.jointRules.filter((r) => r.subjectId !== id),
      exchangeRules: d.exchangeRules.map((r) => ({
        ...r,
        subjectIds: r.subjectIds.filter((sid) => sid !== id),
      })),
    }));

  // ============ ステップ4: 教員 ============

  const updateTeacher = (id: string, patch: Partial<Teacher>) =>
    setDraft((d) => ({
      ...d,
      teachers: d.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

  const addTeacher = () => {
    const name = newTeacherName.trim();
    if (!name) return;
    setDraft((d) => ({
      ...d,
      teachers: [
        ...d.teachers,
        { id: newId("teacher"), name, subjects: [], subjectAssignments: [], unavailable: [] },
      ],
    }));
    setNewTeacherName("");
  };

  const deleteTeacher = (id: string) =>
    setDraft((d) => ({ ...d, teachers: d.teachers.filter((t) => t.id !== id) }));

  const toggleTeacherSubject = (teacher: Teacher, subjectName: string) => {
    const has = teacher.subjects.includes(subjectName);
    const subjects = has
      ? teacher.subjects.filter((s) => s !== subjectName)
      : [...teacher.subjects, subjectName];
    const subjectAssignments = has
      ? (teacher.subjectAssignments ?? []).filter((a) => a.subjectName !== subjectName)
      : teacher.subjectAssignments;
    updateTeacher(teacher.id, { subjects, subjectAssignments });
  };

  const toggleTeacherUnavailable = (teacher: Teacher, day: Weekday, period: number) => {
    const has = teacher.unavailable.some((s) => s.day === day && s.period === period);
    updateTeacher(teacher.id, {
      unavailable: has
        ? teacher.unavailable.filter((s) => !(s.day === day && s.period === period))
        : [...teacher.unavailable, { day, period }],
    });
  };

  const setHomeroom = (teacher: Teacher, classId: string) => {
    updateTeacher(teacher.id, {
      role: classId ? "homeroom" : undefined,
      homeroomClassIds: classId ? [classId] : [],
    });
  };

  // ============ ステップ5: 担当学級 ============

  const toggleAssignment = (teacher: Teacher, subjectName: string, classId: string) => {
    const assignments = teacher.subjectAssignments ?? [];
    const existing = assignments.find((a) => a.subjectName === subjectName);
    let next: SubjectAssignment[];
    if (!existing) {
      next = [...assignments, { subjectName, classIds: [classId] }];
    } else {
      const classIds = existing.classIds.includes(classId)
        ? existing.classIds.filter((id) => id !== classId)
        : [...existing.classIds, classId];
      next = assignments.map((a) => (a.subjectName === subjectName ? { ...a, classIds } : a));
    }
    updateTeacher(teacher.id, { subjectAssignments: next });
  };

  // ============ 完了 ============

  const canProceed = () => {
    if (step.key === "school") return draft.settings.days.length > 0;
    if (step.key === "classes") return draft.classes.length > 0;
    if (step.key === "subjects") return draft.subjects.length > 0;
    return true;
  };

  const finish = () => {
    const classIds = new Set(draft.classes.map((c) => c.id));
    const subjectNames = new Set(draft.subjects.map((s) => s.name));

    // 存在しない学級・教科への参照を除去してから確定する
    const teachers = draft.teachers.map((t) => ({
      ...t,
      subjects: t.subjects.filter((name) => subjectNames.has(name)),
      homeroomClassIds: (t.homeroomClassIds ?? []).filter((id) => classIds.has(id)),
      subjectAssignments: (t.subjectAssignments ?? [])
        .filter((a) => subjectNames.has(a.subjectName))
        .map((a) => ({ ...a, classIds: a.classIds.filter((id) => classIds.has(id)) }))
        .filter((a) => a.classIds.length > 0),
    }));

    const classes = draft.classes.map((c) => {
      const homeroom = teachers.find((t) => t.homeroomClassIds?.includes(c.id));
      return { ...c, homeroomTeacherId: homeroom?.id };
    });

    const jointRules = draft.jointRules
      .map((r) => ({
        ...r,
        classGroups: r.classGroups
          .map((g) => g.filter((id) => classIds.has(id)))
          .filter((g) => g.length >= 2),
      }))
      .filter((r) => r.classGroups.length > 0 && draft.subjects.some((s) => s.id === r.subjectId));

    const exchangeRules = draft.exchangeRules.filter(
      (r) => classIds.has(r.specialClassId) && classIds.has(r.exchangeClassId)
    );

    applySetup({
      settings: draft.settings,
      classes,
      subjects: draft.subjects,
      teachers,
      jointRules,
      exchangeRules,
    });
    onComplete();
  };

  // ============ 描画 ============

  const renderSchoolStep = () => (
    <div className="space-y-6 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase">学校名</span>
          <input
            className={`${inputClass} w-full`}
            value={draft.settings.schoolName}
            placeholder="例: ○○市立○○中学校"
            onChange={(e) => updateSettings({ schoolName: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase">年度</span>
          <input
            className={`${inputClass} w-full`}
            value={draft.settings.yearLabel}
            placeholder="例: 2026年度"
            onChange={(e) => updateSettings({ yearLabel: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase">校種</span>
          <select
            className={`${inputClass} w-full`}
            value={draft.settings.schoolType}
            onChange={(e) => updateSettings({ schoolType: e.target.value as SchoolType })}
          >
            {SCHOOL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-extrabold text-slate-400 uppercase">週の曜日と時限数</p>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">曜日</th>
                <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">授業日</th>
                <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">時限数</th>
              </tr>
            </thead>
            <tbody>
              {DAY_CONFIGS.map((master) => {
                const current = draft.settings.days.find((d) => d.key === master.key);
                return (
                  <tr key={master.key} className="border-t border-slate-100">
                    <td className="p-2 font-bold text-slate-700">{master.label}</td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={!!current}
                        onChange={() => toggleDay(master.key)}
                      />
                    </td>
                    <td className="p-2">
                      {current ? (
                        <input
                          type="number"
                          min={1}
                          max={8}
                          className={miniInputClass}
                          value={current.periods}
                          onChange={(e) => setDayPeriods(master.key, Number(e.target.value))}
                        />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {draft.settings.days.length === 0 && (
          <p className="text-xs text-rose-500 font-bold">授業日を1日以上選んでください。</p>
        )}
      </div>
    </div>
  );

  const renderClassesStep = () => (
    <div className="space-y-6">
      <label className="flex items-center gap-3">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase">学年数</span>
        <input
          type="number"
          min={1}
          max={6}
          className={miniInputClass}
          value={draft.gradeCount}
          onChange={(e) => setGradeCount(Number(e.target.value))}
        />
      </label>

      <div className="space-y-4">
        {grades.map((grade) => {
          const normals = draft.classes.filter((c) => c.grade === grade && c.type !== "special");
          const specials = draft.classes.filter((c) => c.grade === grade && c.type === "special");
          return (
            <div key={grade} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-sm font-black text-slate-800">{grade}年</h3>
                <label className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  通常学級数
                  <input
                    type="number"
                    min={0}
                    max={12}
                    className={miniInputClass}
                    value={normals.length}
                    onChange={(e) => setNormalCount(grade, Number(e.target.value))}
                  />
                </label>
                <span className="text-xs text-slate-400">
                  {normals.map((c) => `${c.label}組`).join("、") || "なし"}
                </span>
                <button
                  type="button"
                  onClick={() => addSpecialClass(grade)}
                  className="ml-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                >
                  ＋ 特別支援学級を追加
                </button>
              </div>
              {specials.length > 0 && (
                <div className="space-y-2">
                  {specials.map((cls) => (
                    <div key={cls.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50/50 border border-emerald-100 p-2">
                      <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                        学級名
                        <input
                          className={`${miniInputClass} w-16`}
                          value={cls.label}
                          onChange={(e) => updateClass(cls.id, { label: e.target.value })}
                        />
                        組
                      </label>
                      <select
                        className={inputClass}
                        value={cls.specialType ?? "emotional"}
                        onChange={(e) =>
                          updateClass(cls.id, {
                            specialType: e.target.value as ClassGroup["specialType"],
                          })
                        }
                      >
                        <option value="emotional">自閉症・情緒</option>
                        <option value="intellectual">知的</option>
                        <option value="physical">肢体不自由</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteClass(cls.id)}
                        className="ml-auto text-xs font-bold text-rose-500 hover:text-rose-700"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSubjectsStep = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">教科名</th>
              <th className="p-2 text-[10px] font-black text-slate-400 uppercase">基本時数</th>
              {grades.map((g) => (
                <th key={`n-${g}`} className="p-2 text-[10px] font-black text-slate-400 uppercase">{g}年</th>
              ))}
              {grades.map((g) => (
                <th key={`s-${g}`} className="p-2 text-[10px] font-black text-emerald-500 uppercase">特支{g}年</th>
              ))}
              <th className="p-2 text-[10px] font-black text-slate-400 uppercase">1日複数可</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {draft.subjects.map((sub) => (
              <tr key={sub.id} className="border-t border-slate-100">
                <td className="p-2">
                  <input
                    className={`${inputClass} w-28`}
                    value={sub.name}
                    onChange={(e) => updateSubject(sub.id, { name: e.target.value })}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className={miniInputClass}
                    value={sub.weeklyQuota}
                    onChange={(e) => updateSubject(sub.id, { weeklyQuota: Number(e.target.value) })}
                  />
                </td>
                {grades.map((g) => (
                  <td key={`n-${g}`} className="p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="-"
                      className={miniInputClass}
                      value={sub.gradeQuotas?.[g] ?? ""}
                      onChange={(e) => setGradeQuota(sub, "gradeQuotas", g, e.target.value)}
                    />
                  </td>
                ))}
                {grades.map((g) => (
                  <td key={`s-${g}`} className="p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="-"
                      className={miniInputClass}
                      value={sub.specialGradeQuotas?.[g] ?? ""}
                      onChange={(e) => setGradeQuota(sub, "specialGradeQuotas", g, e.target.value)}
                    />
                  </td>
                ))}
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!sub.allowDoubleInDay}
                    onChange={(e) => updateSubject(sub.id, { allowDoubleInDay: e.target.checked })}
                  />
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => deleteSubject(sub.id)}
                    className="text-rose-500 hover:text-rose-700 font-bold"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400">
        ※ 学年ごとの欄が空の場合は、指導要領の標準時数または基本時数が使われます。
      </p>
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          value={newSubjectName}
          placeholder="教科名を入力"
          onChange={(e) => setNewSubjectName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubject()}
        />
        <button
          type="button"
          onClick={addSubject}
          className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-black text-brand-700 hover:bg-brand-100"
        >
          ＋ 教科を追加
        </button>
      </div>
    </div>
  );

  const renderTeachersStep = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        {draft.teachers.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className={`${inputClass} w-32 font-bold`}
                value={t.name}
                onChange={(e) => updateTeacher(t.id, { name: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
                担任
                <select
                  className={inputClass}
                  value={t.homeroomClassIds?.[0] ?? ""}
                  onChange={(e) => setHomeroom(t, e.target.value)}
                >
                  <option value="">なし</option>
                  {draft.classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.grade}年{c.label}組</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
                <input
                  type="checkbox"
                  checked={!!t.isPartTime}
                  onChange={(e) => updateTeacher(t.id, { isPartTime: e.target.checked })}
                />
                非常勤
              </label>
              <button
                type="button"
                onClick={() => deleteTeacher(t.id)}
                className="ml-auto text-xs font-bold text-rose-500 hover:text-rose-700"
              >
                削除
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draft.subjects.map((sub) => {
                const checked = t.subjects.includes(sub.name);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleTeacherSubject(t, sub.name)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border transition-colors ${
                      checked
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-400 border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
            <details>
              <summary className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600">
                授業不可コマを設定{t.unavailable.length > 0 ? `（${t.unavailable.length}コマ）` : ""}
              </summary>
              <table className="mt-2 border-collapse">
                <thead>
                  <tr>
                    <th className="w-6"></th>
                    {draft.settings.days.map((d) => (
                      <th key={d.key} className="px-1 text-[9px] text-slate-400 font-bold">{d.shortLabel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    { length: Math.max(1, ...draft.settings.days.map((d) => d.periods)) },
                    (_, i) => i + 1
                  ).map((period) => (
                    <tr key={period}>
                      <td className="pr-1 text-[9px] text-slate-400 font-bold text-center">{period}</td>
                      {draft.settings.days.map((day) => {
                        const outOfRange = day.periods < period;
                        const isUnavailable = t.unavailable.some(
                          (s) => s.day === day.key && s.period === period
                        );
                        return (
                          <td key={day.key} className="p-0.5">
                            <button
                              type="button"
                              disabled={outOfRange}
                              onClick={() => toggleTeacherUnavailable(t, day.key, period)}
                              className={`w-8 h-5 rounded-sm transition-all ${
                                outOfRange
                                  ? "bg-slate-100 cursor-not-allowed"
                                  : isUnavailable
                                    ? "bg-rose-500 border border-rose-600"
                                    : "bg-white border border-slate-200 hover:border-brand-300"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[9px] text-slate-400 mt-1">※ 赤色が「授業不可」の時間帯です</p>
            </details>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          value={newTeacherName}
          placeholder="教員名を入力"
          onChange={(e) => setNewTeacherName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTeacher()}
        />
        <button
          type="button"
          onClick={addTeacher}
          className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-black text-brand-700 hover:bg-brand-100"
        >
          ＋ 教員を追加
        </button>
      </div>
    </div>
  );

  const renderAssignmentsStep = () => {
    const rows = draft.teachers.flatMap((t) =>
      t.subjects.map((subjectName) => ({ teacher: t, subjectName }))
    );
    if (rows.length === 0) {
      return (
        <p className="text-xs text-slate-400 italic">
          担当教科が設定された教員がいません。前のステップで教員と担当教科を登録してください。
        </p>
      );
    }
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50">教員</th>
              <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">教科</th>
              <th className="p-2 text-left text-[10px] font-black text-slate-400 uppercase">担当学級</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ teacher, subjectName }) => {
              const assignment = teacher.subjectAssignments?.find(
                (a) => a.subjectName === subjectName
              );
              return (
                <tr key={`${teacher.id}-${subjectName}`} className="border-t border-slate-100">
                  <td className="p-2 font-bold text-slate-700 sticky left-0 bg-white">{teacher.name}</td>
                  <td className="p-2 text-slate-500 font-bold">{subjectName}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {draft.classes.map((cls) => {
                        const checked = !!assignment?.classIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleAssignment(teacher, subjectName, cls.id)}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                              checked
                                ? "bg-brand-500 text-white border-brand-500"
                                : "bg-white text-slate-400 border-slate-200 hover:border-brand-300"
                            }`}
                          >
                            {cls.grade}-{cls.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderJointExchangeStep = () => (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">合同授業</h3>
          <p className="text-[11px] text-slate-500">
            保体のように複数学級を同じ時間にそろえる教科のグループを設定します。
          </p>
        </div>
        <JointRulesEditor
          subjects={draft.subjects}
          classes={draft.classes}
          rules={draft.jointRules}
          onChange={(rules) => setDraft((d) => ({ ...d, jointRules: rules }))}
        />
      </section>
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">交流授業</h3>
          <p className="text-[11px] text-slate-500">
            特別支援学級の交流先学級と、交流する教科を設定します。
          </p>
        </div>
        <ExchangeRulesEditor
          subjects={draft.subjects}
          classes={draft.classes}
          rules={draft.exchangeRules}
          onChange={(rules) => setDraft((d) => ({ ...d, exchangeRules: rules }))}
        />
      </section>
    </div>
  );

  const renderStep = () => {
    switch (step.key) {
      case "school": return renderSchoolStep();
      case "classes": return renderClassesStep();
      case "subjects": return renderSubjectsStep();
      case "teachers": return renderTeachersStep();
      case "assignments": return renderAssignmentsStep();
      case "jointExchange": return renderJointExchangeStep();
    }
  };

  return (
    <div className="max-w-5xl">
      {/* ステップナビ */}
      <ol className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStepIndex(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black border transition-colors ${
                i === stepIndex
                  ? "bg-brand-500 text-white border-brand-500"
                  : i < stepIndex
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              <span>{i + 1}</span>
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      {renderStep()}

      {/* フッターナビ */}
      <div className="mt-10 flex items-center gap-3 border-t border-slate-200 pt-6">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 前へ
        </button>
        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canProceed()}
            onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            className="rounded-lg bg-brand-500 px-5 py-2 text-xs font-black text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            次へ →
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-md"
          >
            ✓ 設定を保存して時間割へ
          </button>
        )}
        <p className="ml-auto text-[10px] text-slate-400">
          設定内容はこの端末（ブラウザ）に保存されます。あとから「基本設定」や「合同・交流設定」でも変更できます。
        </p>
      </div>
    </div>
  );
}
