"use client";

import { useMemo, useState } from "react";

import {
  CHECK_TYPE_LABELS,
  CheckIssue,
  CheckIssueType,
  CheckSeverity,
  runAllChecks,
} from "@/lib/checks";
import { TimetableData, WeeklySlot } from "@/lib/types";

type GroupMode = "all" | "class" | "teacher" | "type";

interface CheckResultsViewProps {
  data: TimetableData;
  onNavigate: (classId: string, slot: WeeklySlot) => void;
}

const severityStyles: Record<CheckSeverity, { border: string; badge: string; label: string }> = {
  error: {
    border: "border-l-rose-500",
    badge: "bg-rose-100 text-rose-700",
    label: "要修正",
  },
  warning: {
    border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-700",
    label: "要確認",
  },
};

export function CheckResultsView({ data, onNavigate }: CheckResultsViewProps) {
  const issues = useMemo(() => runAllChecks(data), [data]);

  const [severityFilter, setSeverityFilter] = useState<"all" | CheckSeverity>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | CheckIssueType>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("all");

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const typeCounts = useMemo(() => {
    const counts = new Map<CheckIssueType, number>();
    issues.forEach((i) => counts.set(i.type, (counts.get(i.type) ?? 0) + 1));
    return counts;
  }, [issues]);

  const filtered = issues.filter(
    (i) =>
      (severityFilter === "all" || i.severity === severityFilter) &&
      (typeFilter === "all" || i.type === typeFilter)
  );

  // グループ化
  const groups = useMemo(() => {
    if (groupMode === "class") {
      const map = new Map<string, CheckIssue[]>();
      filtered.forEach((issue) => {
        const keys = issue.classIds.length > 0 ? issue.classIds : ["__none__"];
        keys.forEach((key) => map.set(key, [...(map.get(key) ?? []), issue]));
      });
      return data.classes
        .filter((c) => map.has(c.id))
        .map((c) => ({
          key: c.id,
          label: `${c.grade}年${c.label}組`,
          issues: map.get(c.id)!,
        }));
    }
    if (groupMode === "teacher") {
      const map = new Map<string, CheckIssue[]>();
      filtered.forEach((issue) => {
        issue.teacherIds.forEach((tId) => map.set(tId, [...(map.get(tId) ?? []), issue]));
      });
      return data.teachers
        .filter((t) => map.has(t.id))
        .map((t) => ({ key: t.id, label: t.name, issues: map.get(t.id)! }));
    }
    if (groupMode === "type") {
      const map = new Map<CheckIssueType, CheckIssue[]>();
      filtered.forEach((issue) => map.set(issue.type, [...(map.get(issue.type) ?? []), issue]));
      return Array.from(map.entries()).map(([type, list]) => ({
        key: type,
        label: CHECK_TYPE_LABELS[type],
        issues: list,
      }));
    }
    return [{ key: "all", label: "", issues: filtered }];
  }, [filtered, groupMode, data.classes, data.teachers]);

  const renderIssue = (issue: CheckIssue) => {
    const style = severityStyles[issue.severity];
    const targetClassId = issue.classIds[0];
    return (
      <div
        key={issue.id}
        className={`flex items-start gap-3 rounded-lg border border-slate-200 border-l-4 ${style.border} bg-white p-3 shadow-sm`}
      >
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${style.badge}`}>
          {style.label}
        </span>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
          {CHECK_TYPE_LABELS[issue.type]}
        </span>
        <p className="flex-1 text-xs text-slate-700 leading-relaxed">{issue.message}</p>
        {issue.slot && targetClassId && (
          <button
            type="button"
            onClick={() => onNavigate(targetClassId, issue.slot!)}
            className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1 text-[10px] font-black text-brand-700 hover:bg-brand-100 transition-colors"
          >
            該当コマへ →
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* サマリー */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase">チェック項目合計</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{issues.length}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-[10px] font-black text-rose-400 uppercase">要修正（エラー）</p>
          <p className="mt-1 text-2xl font-black text-rose-600">{errorCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-[10px] font-black text-amber-500 uppercase">要確認（警告）</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{warningCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-[10px] font-black text-emerald-500 uppercase">状態</p>
          <p className="mt-1 text-sm font-black text-emerald-700">
            {errorCount === 0 ? (warningCount === 0 ? "問題なし ✓" : "調整が必要") : "要修正あり"}
          </p>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
          {([
            ["all", "すべて"],
            ["error", "要修正"],
            ["warning", "要確認"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeverityFilter(value)}
              className={`rounded-md px-3 py-1 transition-colors ${
                severityFilter === value
                  ? "bg-brand-500 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
          {([
            ["all", "一覧"],
            ["class", "学級別"],
            ["teacher", "教員別"],
            ["type", "種類別"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGroupMode(value)}
              className={`rounded-md px-3 py-1 transition-colors ${
                groupMode === value
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | CheckIssueType)}
        >
          <option value="all">すべての種類</option>
          {(Object.keys(CHECK_TYPE_LABELS) as CheckIssueType[]).map((type) => (
            <option key={type} value={type}>
              {CHECK_TYPE_LABELS[type]}（{typeCounts.get(type) ?? 0}）
            </option>
          ))}
        </select>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-10 text-center">
          <p className="text-sm font-black text-emerald-700">
            {issues.length === 0
              ? "問題は見つかりませんでした ✓"
              : "この条件に該当する項目はありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              {group.label && (
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-700">
                  {group.label}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    {group.issues.length}件
                  </span>
                </h3>
              )}
              <div className="space-y-1.5">{group.issues.map(renderIssue)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
