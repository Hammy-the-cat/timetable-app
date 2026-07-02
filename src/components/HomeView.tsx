"use client";

import { useEffect, useMemo, useState } from "react";

import { runAllChecks } from "@/lib/checks";
import { getDays, getEffectiveQuota } from "@/lib/school";
import { TimetableData } from "@/lib/types";

interface HomeViewProps {
  data: TimetableData;
  onNavigate: (view: string) => void;
}

const HOMEROOM_SUBJECTS = new Set(["道徳", "学活", "自立", "生活", "総合", "総合的な学習"]);

export function HomeView({ data, onNavigate }: HomeViewProps) {
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");

  useEffect(() => {
    if (!data.lastUpdated) return;
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    setLastUpdatedLabel(formatter.format(new Date(data.lastUpdated)));
  }, [data.lastUpdated]);

  const stats = useMemo(() => {
    const days = getDays(data);
    const totalSlots =
      data.classes.length * days.reduce((sum, d) => sum + d.periods, 0);

    let filledCells = 0;
    data.classes.forEach((cls) => {
      days.forEach((day) => {
        for (let p = 1; p <= day.periods; p += 1) {
          if (data.schedule[cls.id]?.[day.key]?.[p]?.subjectId) filledCells += 1;
        }
      });
    });

    // 未設定の担当数: 時数が必要なのに担当者を決められない（学級×教科）の数
    let unassigned = 0;
    data.classes.forEach((cls) => {
      const hasHomeroom =
        !!cls.homeroomTeacherId ||
        data.teachers.some(
          (t) => t.role === "homeroom" && t.homeroomClassIds?.includes(cls.id)
        );
      data.subjects.forEach((sub) => {
        const quota = getEffectiveQuota(sub, cls.grade, cls.type || "normal", cls.specialType);
        if (Math.ceil(quota) <= 0) return;
        if (HOMEROOM_SUBJECTS.has(sub.name)) {
          if (!hasHomeroom) unassigned += 1;
          return;
        }
        // 交流教科は交流先の担当でまかなえるため対象外
        const isExchange =
          cls.type === "special" &&
          data.exchangeRules.some(
            (r) => r.specialClassId === cls.id && r.subjectIds.includes(sub.id)
          );
        if (isExchange) return;
        const covered = data.teachers.some((t) =>
          t.subjectAssignments?.some(
            (a) => a.subjectName === sub.name && a.classIds.includes(cls.id)
          ) || t.subjects.includes(sub.name)
        );
        if (!covered) unassigned += 1;
      });
    });

    const issues = runAllChecks(data);
    return {
      classCount: data.classes.length,
      teacherCount: data.teachers.length,
      subjectCount: data.subjects.length,
      unassigned,
      filledCells,
      totalSlots,
      errorCount: issues.filter((i) => i.severity === "error").length,
      warningCount: issues.filter((i) => i.severity === "warning").length,
    };
  }, [data]);

  const statCards: { label: string; value: string; tone?: "alert" | "warn" }[] = [
    { label: "学級数", value: String(stats.classCount) },
    { label: "教員数", value: String(stats.teacherCount) },
    { label: "教科数", value: String(stats.subjectCount) },
    {
      label: "未設定の担当",
      value: String(stats.unassigned),
      tone: stats.unassigned > 0 ? "warn" : undefined,
    },
    {
      label: "配置済みコマ",
      value: `${stats.filledCells} / ${stats.totalSlots}`,
    },
    {
      label: "エラー",
      value: String(stats.errorCount),
      tone: stats.errorCount > 0 ? "alert" : undefined,
    },
  ];

  const actions = [
    {
      label: "初期設定を始める",
      description: "学校・学級・教科・教員・合同交流をステップ形式で設定",
      icon: "🧭",
      view: "wizard",
    },
    {
      label: "時間割を開く",
      description: "全校マトリックスでコマを編集・自動配置",
      icon: "📊",
      view: "matrix",
    },
    {
      label: "チェック結果を見る",
      description: "重複・時数・合同交流のズレを一覧で確認",
      icon: "🔍",
      view: "check",
    },
    {
      label: "Excel出力・年度更新",
      description: "校内確認用のExcel/PDF出力、取り込み、年度コピー",
      icon: "📤",
      view: "io",
    },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-xs font-bold text-slate-400">{data.settings.yearLabel}</p>
        <h2 className="text-2xl font-black text-slate-800">
          {data.settings.schoolName || "学校名未設定"}
        </h2>
        <p className="mt-1 text-[11px] text-slate-400">
          最終更新: {lastUpdatedLabel || "----"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 shadow-sm ${
              card.tone === "alert"
                ? "border-rose-200 bg-rose-50"
                : card.tone === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-white"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase ${
                card.tone === "alert"
                  ? "text-rose-400"
                  : card.tone === "warn"
                    ? "text-amber-500"
                    : "text-slate-400"
              }`}
            >
              {card.label}
            </p>
            <p
              className={`mt-1 text-2xl font-black ${
                card.tone === "alert"
                  ? "text-rose-600"
                  : card.tone === "warn"
                    ? "text-amber-600"
                    : "text-slate-800"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.view}
            type="button"
            onClick={() => onNavigate(action.view)}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
          >
            <span className="text-2xl">{action.icon}</span>
            <span>
              <span className="block text-sm font-black text-slate-800">{action.label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                {action.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      {!data.setupCompleted && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-bold text-brand-700">
            初期設定がまだ完了していません。「初期設定を始める」から学校の情報を入力してください。
          </p>
        </div>
      )}
    </div>
  );
}
