"use client";

import { useMemo } from "react";

import {
  ClassGroup,
  ExchangeLessonRule,
  JointLessonRule,
  Subject,
} from "@/lib/types";
import { useTimetableStore } from "@/store/timetable-store";

const newId = (prefix: string) =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const specialTypeLabel = (type?: ClassGroup["specialType"]) => {
  if (type === "intellectual") return "知的";
  if (type === "emotional") return "自情";
  if (type === "physical") return "肢体";
  return "支援";
};

const classLabel = (cls: ClassGroup) => `${cls.grade}年${cls.label}組`;

// ================= 合同授業ルールエディタ =================

interface JointRulesEditorProps {
  subjects: Subject[];
  classes: ClassGroup[];
  rules: JointLessonRule[];
  onChange: (rules: JointLessonRule[]) => void;
}

export function JointRulesEditor({ subjects, classes, rules, onChange }: JointRulesEditorProps) {
  const grades = useMemo(
    () => Array.from(new Set(classes.map((c) => c.grade))).sort((a, b) => a - b),
    [classes]
  );

  const updateRule = (id: string, patch: Partial<JointLessonRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRule = () => {
    const pe = subjects.find((s) => s.name === "保体" || s.name === "体育");
    onChange([
      ...rules,
      {
        id: newId("joint"),
        subjectId: pe?.id ?? subjects[0]?.id ?? "",
        grade: grades[0] ?? 1,
        classGroups: [[]],
      },
    ]);
  };

  const toggleClassInGroup = (rule: JointLessonRule, groupIndex: number, classId: string) => {
    const inGroup = rule.classGroups[groupIndex]?.includes(classId);
    // 同じルール内で同じ学級が複数グループに属さないよう、他グループからは外す
    const nextGroups = rule.classGroups.map((group, idx) => {
      if (idx === groupIndex) {
        return inGroup ? group.filter((id) => id !== classId) : [...group, classId];
      }
      return group.filter((id) => id !== classId);
    });
    updateRule(rule.id, { classGroups: nextGroups });
  };

  return (
    <div className="space-y-4">
      {rules.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          合同授業のルールはまだ登録されていません。「合同ルールを追加」から作成できます。
        </p>
      )}
      {rules.map((rule) => {
        const gradeClasses = classes.filter((c) => c.grade === rule.grade);
        return (
          <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">教科</label>
                <select
                  className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={rule.subjectId}
                  onChange={(e) => updateRule(rule.id, { subjectId: e.target.value })}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">学年</label>
                <select
                  className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={rule.grade}
                  onChange={(e) =>
                    updateRule(rule.id, { grade: Number(e.target.value), classGroups: [[]] })
                  }
                >
                  {grades.map((g) => (
                    <option key={g} value={g}>{g}年</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
                className="ml-auto text-xs font-bold text-rose-500 hover:text-rose-700"
              >
                このルールを削除
              </button>
            </div>

            <div className="space-y-2">
              {rule.classGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">
                    グループ{groupIndex + 1}
                  </span>
                  {gradeClasses.map((cls) => {
                    const checked = group.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClassInGroup(rule, groupIndex, cls.id)}
                        className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
                          checked
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-slate-500 border-slate-200 hover:border-brand-300"
                        }`}
                      >
                        {cls.label}組{cls.type === "special" ? `(${specialTypeLabel(cls.specialType)})` : ""}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      updateRule(rule.id, {
                        classGroups: rule.classGroups.filter((_, idx) => idx !== groupIndex),
                      })
                    }
                    className="ml-auto text-xs text-rose-400 hover:text-rose-600 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateRule(rule.id, { classGroups: [...rule.classGroups, []] })}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >
                ＋ グループを追加
              </button>
              {rule.classGroups.some((g) => g.length === 1) && (
                <p className="text-[10px] text-amber-600 font-bold">
                  ※ 学級が1つだけのグループは合同として扱われません（2学級以上選んでください）
                </p>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRule}
        className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-black text-brand-700 hover:bg-brand-100 transition-colors"
      >
        ＋ 合同ルールを追加
      </button>
    </div>
  );
}

// ================= 交流授業ルールエディタ =================

interface ExchangeRulesEditorProps {
  subjects: Subject[];
  classes: ClassGroup[];
  rules: ExchangeLessonRule[];
  onChange: (rules: ExchangeLessonRule[]) => void;
}

export function ExchangeRulesEditor({ subjects, classes, rules, onChange }: ExchangeRulesEditorProps) {
  const specialClasses = classes.filter((c) => c.type === "special");

  const ruleFor = (specialClassId: string) =>
    rules.find((r) => r.specialClassId === specialClassId);

  const setExchangeTarget = (specialClass: ClassGroup, exchangeClassId: string) => {
    const existing = ruleFor(specialClass.id);
    if (!exchangeClassId) {
      onChange(rules.filter((r) => r.specialClassId !== specialClass.id));
      return;
    }
    if (existing) {
      onChange(
        rules.map((r) =>
          r.specialClassId === specialClass.id ? { ...r, exchangeClassId } : r
        )
      );
    } else {
      onChange([
        ...rules,
        {
          id: newId("exchange"),
          specialClassId: specialClass.id,
          exchangeClassId,
          subjectIds: [],
        },
      ]);
    }
  };

  const toggleSubject = (specialClass: ClassGroup, subjectId: string) => {
    const existing = ruleFor(specialClass.id);
    if (!existing) return;
    const subjectIds = existing.subjectIds.includes(subjectId)
      ? existing.subjectIds.filter((id) => id !== subjectId)
      : [...existing.subjectIds, subjectId];
    onChange(
      rules.map((r) => (r.specialClassId === specialClass.id ? { ...r, subjectIds } : r))
    );
  };

  if (specialClasses.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic">
        特別支援学級が登録されていません。学級設定で特別支援学級を追加すると、ここで交流先を設定できます。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {specialClasses.map((cls) => {
        const rule = ruleFor(cls.id);
        const candidates = classes.filter(
          (c) => c.grade === cls.grade && c.type !== "special" && c.id !== cls.id
        );
        return (
          <div key={cls.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-black text-slate-800">
                {classLabel(cls)}
                <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                  {specialTypeLabel(cls.specialType)}
                </span>
              </span>
              <span className="text-xs text-slate-400 font-bold">→ 交流先:</span>
              <select
                className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                value={rule?.exchangeClassId ?? ""}
                onChange={(e) => setExchangeTarget(cls, e.target.value)}
              >
                <option value="">（交流なし）</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
            </div>
            {rule && (
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase">交流する教科</p>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((sub) => {
                    const checked = rule.subjectIds.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => toggleSubject(cls, sub.id)}
                        className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
                          checked
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
                {rule.subjectIds.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold">
                    ※ 教科が未選択です。交流する教科を1つ以上選んでください。
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= 合同・交流設定ページ =================

export function JointExchangeSettings() {
  const { data, setJointRules, setExchangeRules } = useTimetableStore();

  return (
    <div className="space-y-10 max-w-4xl">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-800">合同授業の設定</h2>
          <p className="text-xs text-slate-500 mt-1">
            保体のように複数学級を同じ時間にそろえる教科を設定します。空きコマ自動配置とチェックに反映されます。
          </p>
        </div>
        <JointRulesEditor
          subjects={data.subjects}
          classes={data.classes}
          rules={data.jointRules}
          onChange={setJointRules}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-800">交流授業の設定</h2>
          <p className="text-xs text-slate-500 mt-1">
            特別支援学級の交流先学級と、交流する教科を設定します。交流教科は交流先学級と同じ時間に配置されます。
          </p>
        </div>
        <ExchangeRulesEditor
          subjects={data.subjects}
          classes={data.classes}
          rules={data.exchangeRules}
          onChange={setExchangeRules}
        />
      </section>
    </div>
  );
}
