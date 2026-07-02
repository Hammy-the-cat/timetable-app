"use client";

import { GenerationReport } from "@/lib/auto-generator";
import { TimetableData } from "@/lib/types";
import { useTimetableStore } from "@/store/timetable-store";

const overlayClass =
  "fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4";

// ================= 実行前: 配置条件ダイアログ =================

interface GenerationOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  onRun: () => void;
}

export function GenerationOptionsDialog({ open, onClose, onRun }: GenerationOptionsDialogProps) {
  const { generationOptions, setGenerationOptions } = useTimetableStore();
  if (!open) return null;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-black text-slate-800">空きコマ自動配置</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            空いているコマにたたき台を作成します。すでに設定されているコマは上書きされません。
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            保体の同時実施グループ数の上限
            <select
              className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
              value={generationOptions.peConcurrencyLimit}
              onChange={(e) =>
                setGenerationOptions({ peConcurrencyLimit: Number(e.target.value) })
              }
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}グループ</option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            同じ教科を同じ日に重ねない
            <input
              type="checkbox"
              checked={generationOptions.avoidSameDayDuplicate}
              onChange={(e) =>
                setGenerationOptions({ avoidSameDayDuplicate: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            担任の空きコマ（最終限）を確保する
            <input
              type="checkbox"
              checked={generationOptions.ensureHomeroomPrep}
              onChange={(e) =>
                setGenerationOptions({ ensureHomeroomPrep: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            処理時間
            <select
              className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
              value={generationOptions.timeBudgetMs}
              onChange={(e) =>
                setGenerationOptions({ timeBudgetMs: Number(e.target.value) })
              }
            >
              <option value={1000}>短い（約1秒）</option>
              <option value={3000}>標準（約3秒）</option>
              <option value={8000}>じっくり（約8秒）</option>
            </select>
          </label>
          <p className="text-[10px] text-slate-400">
            ※ 条件をすべて満たせない場合、配置できなかったコマは理由つきで結果に表示されます。
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onRun}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-md"
          >
            ✨ たたき台を作成
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= 実行後: 配置結果レポート =================

interface GenerationReportDialogProps {
  open: boolean;
  report: GenerationReport | null;
  data: TimetableData;
  onClose: () => void;
  onOpenCheck: () => void;
}

export function GenerationReportDialog({
  open,
  report,
  data,
  onClose,
  onOpenCheck,
}: GenerationReportDialogProps) {
  if (!open || !report) return null;

  const classLabel = (classId: string) => {
    const cls = data.classes.find((c) => c.id === classId);
    return cls ? `${cls.grade}年${cls.label}組` : classId;
  };
  const subjectName = (subjectId: string) =>
    data.subjects.find((s) => s.id === subjectId)?.name ?? subjectId;

  const unplacedTotal = report.unplaced.reduce((sum, u) => sum + u.remaining, 0);
  const allPlaced = unplacedTotal === 0;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-black text-slate-800">空きコマ自動配置の結果</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {report.attempts}回試行 / 処理時間 {(report.elapsedMs / 1000).toFixed(1)}秒
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase">配置対象</p>
            <p className="text-xl font-black text-slate-700">{report.totalTarget}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-[9px] font-black text-emerald-500 uppercase">配置できた</p>
            <p className="text-xl font-black text-emerald-600">{report.totalPlaced}</p>
          </div>
          <div
            className={`rounded-xl border p-3 text-center ${
              allPlaced ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-rose-50"
            }`}
          >
            <p className={`text-[9px] font-black uppercase ${allPlaced ? "text-slate-400" : "text-rose-400"}`}>
              配置できず
            </p>
            <p className={`text-xl font-black ${allPlaced ? "text-slate-700" : "text-rose-600"}`}>
              {unplacedTotal}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {allPlaced ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="text-sm font-black text-emerald-700">
                必要なコマをすべて配置できました ✓
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">
                内容はたたき台です。チェック結果も確認のうえ、必要に応じて手直ししてください。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500">
                配置できなかったコマと、主な理由（該当する空きコマ数の内訳）:
              </p>
              {report.unplaced.map((item) => (
                <div
                  key={`${item.classId}-${item.subjectId}`}
                  className="rounded-lg border border-slate-200 border-l-4 border-l-rose-400 bg-white p-3 shadow-sm"
                >
                  <p className="text-xs font-black text-slate-800">
                    {classLabel(item.classId)} 「{subjectName(item.subjectId)}」
                    <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-600">
                      あと{item.remaining}コマ
                    </span>
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {item.reasons.map((r) => (
                      <li key={r.reason} className="text-[11px] text-slate-500">
                        ・{r.reason}（{r.count}コマ）
                      </li>
                    ))}
                    {item.reasons.length === 0 && (
                      <li className="text-[11px] text-slate-400 italic">
                        理由を特定できませんでした（条件の組み合わせを見直してください）
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onOpenCheck}
            className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-black text-brand-700 hover:bg-brand-100"
          >
            チェック結果を見る
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-5 py-2 text-xs font-black text-white hover:bg-slate-800"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
