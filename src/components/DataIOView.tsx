"use client";

import { useMemo, useState } from "react";

import {
  EXPORT_SHEET_LABELS,
  ExportSheetKey,
  downloadJson,
  exportClassPdf,
  exportWorkbook,
  readJsonFile,
} from "@/lib/exporters";
import {
  AssignmentImportPreview,
  DetectedLayout,
  buildAssignmentPreview,
  detectLayout,
} from "@/lib/excel-import";
import { useTimetableStore } from "@/store/timetable-store";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4";
const buttonPrimary =
  "rounded-lg bg-brand-500 px-5 py-2 text-xs font-black text-white hover:bg-brand-600 shadow-md disabled:opacity-40 disabled:cursor-not-allowed";
const buttonSecondary =
  "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50";

// exceljsのセル値を文字列にする
const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if (v.result !== undefined) return cellText(v.result);
    if (typeof v.text === "string") return v.text;
    if (value instanceof Date) return "";
  }
  return "";
};

interface SheetGrid {
  name: string;
  grid: string[][];
}

export function DataIOView() {
  const { data, replaceData, applyAssignmentImport, copyToNewYear } = useTimetableStore();

  // ============ Excel出力 ============
  const [selectedSheets, setSelectedSheets] = useState<ExportSheetKey[]>([
    "school",
    "classes",
    "teachers",
    "rooms",
    "check",
  ]);
  const [exporting, setExporting] = useState(false);

  const toggleSheet = (key: ExportSheetKey) =>
    setSelectedSheets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const runExport = async () => {
    setExporting(true);
    try {
      await exportWorkbook(data, selectedSheets);
    } finally {
      setExporting(false);
    }
  };

  // ============ PDF出力 ============
  const [pdfClassId, setPdfClassId] = useState<string>("");
  const [pdfExporting, setPdfExporting] = useState(false);

  const runPdfExport = async () => {
    setPdfExporting(true);
    try {
      await exportClassPdf(data, pdfClassId ? [pdfClassId] : undefined);
    } finally {
      setPdfExporting(false);
    }
  };

  // ============ Excel取り込み ============
  const [sheets, setSheets] = useState<SheetGrid[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [layoutOverride, setLayoutOverride] = useState<{ headerRow: number; classCol: number } | null>(null);
  const [importMessage, setImportMessage] = useState("");

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMessage("");
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const loaded: SheetGrid[] = [];
      workbook.eachSheet((ws) => {
        const grid: string[][] = [];
        ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          const rowValues: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowValues[colNumber - 1] = cellText(cell.value).trim();
          });
          grid[rowNumber - 1] = rowValues;
        });
        for (let i = 0; i < grid.length; i += 1) {
          if (!grid[i]) grid[i] = [];
        }
        loaded.push({ name: ws.name, grid });
      });
      setSheets(loaded);
      setSheetIndex(0);
      setLayoutOverride(null);
      setImportFileName(file.name);
    } catch {
      setImportMessage("ファイルを読み込めませんでした。Excel（.xlsx）形式か確認してください。");
    }
  };

  const currentGrid = sheets[sheetIndex]?.grid ?? [];

  const autoLayout = useMemo<DetectedLayout | null>(
    () => (currentGrid.length > 0 ? detectLayout(currentGrid, data.subjects) : null),
    [currentGrid, data.subjects]
  );

  const layout = useMemo<DetectedLayout | null>(() => {
    if (!currentGrid.length) return null;
    if (!layoutOverride) return autoLayout;
    const headerRow = layoutOverride.headerRow;
    const subjectNames = new Set(data.subjects.map((s) => s.name));
    const subjectCols = (currentGrid[headerRow] ?? [])
      .map((value, col) => ({ col, name: (value ?? "").trim() }))
      .filter((entry) => subjectNames.has(entry.name));
    return { headerRow, classCol: layoutOverride.classCol, subjectCols };
  }, [currentGrid, layoutOverride, autoLayout, data.subjects]);

  const preview = useMemo<AssignmentImportPreview | null>(() => {
    if (!layout || layout.subjectCols.length === 0) return null;
    return buildAssignmentPreview(
      currentGrid,
      layout,
      data.classes,
      data.teachers.map((t) => t.name)
    );
  }, [currentGrid, layout, data.classes, data.teachers]);

  const applyImport = () => {
    if (!preview || preview.entries.length === 0) return;
    applyAssignmentImport(
      preview.entries.map(({ classId, subjectName, teacherNames }) => ({
        classId,
        subjectName,
        teacherNames,
      }))
    );
    setImportMessage(
      `${preview.entries.length}件の担当割当を反映しました（新規教員 ${preview.newTeacherNames.length}名を追加）。`
    );
    setSheets([]);
    setImportFileName("");
  };

  // ============ 年度コピー ============
  const suggestedYear = useMemo(() => {
    const match = data.settings.yearLabel.match(/(\d{4})/);
    if (match) {
      return data.settings.yearLabel.replace(match[1], String(Number(match[1]) + 1));
    }
    return data.settings.yearLabel;
  }, [data.settings.yearLabel]);

  const [newYearLabel, setNewYearLabel] = useState("");
  const [clearUnavailable, setClearUnavailable] = useState(true);
  const [clearMeetings, setClearMeetings] = useState(false);
  const [yearMessage, setYearMessage] = useState("");

  const runYearCopy = () => {
    const yearLabel = (newYearLabel || suggestedYear).trim();
    if (!yearLabel) return;
    if (
      !confirm(
        `「${yearLabel}」として新年度データを作成しますか？\n時間割の配置はすべてクリアされます（学級・教科・教員・合同交流の設定は引き継がれます）。`
      )
    ) {
      return;
    }
    copyToNewYear({ yearLabel, clearUnavailable, clearMeetings });
    setYearMessage(`「${yearLabel}」の新年度データを作成しました。`);
    setNewYearLabel("");
  };

  // ============ JSONバックアップ ============
  const [jsonMessage, setJsonMessage] = useState("");

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = await readJsonFile(file);
      replaceData(imported);
      setJsonMessage("バックアップを読み込みました。");
    } catch {
      setJsonMessage("読み込みに失敗しました。正しいJSONファイルか確認してください。");
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* ============ Excel出力 ============ */}
      <section className={cardClass}>
        <div>
          <h2 className="text-sm font-black text-slate-800">Excel出力</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            校内確認・印刷用のExcelファイルを出力します。合同授業は色分け、交流授業は「＊」、チェック結果でエラーのあるコマは赤色で表示されます。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(EXPORT_SHEET_LABELS) as ExportSheetKey[]).map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={selectedSheets.includes(key)}
                onChange={() => toggleSheet(key)}
              />
              {EXPORT_SHEET_LABELS[key]}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={selectedSheets.length === 0 || exporting}
          onClick={runExport}
          className={buttonPrimary}
        >
          {exporting ? "出力中…" : "📗 Excelファイルを出力"}
        </button>
      </section>

      {/* ============ PDF出力 ============ */}
      <section className={cardClass}>
        <div>
          <h2 className="text-sm font-black text-slate-800">PDF出力（学級別時間割）</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            確認・配布用のPDFを出力します。1学級につきA4横1ページです。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand-500"
            value={pdfClassId}
            onChange={(e) => setPdfClassId(e.target.value)}
          >
            <option value="">全学級（{data.classes.length}ページ）</option>
            {data.classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.grade}年{cls.label}組
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pdfExporting}
            onClick={runPdfExport}
            className={buttonPrimary}
          >
            {pdfExporting ? "出力中…" : "📕 PDFを出力"}
          </button>
        </div>
      </section>

      {/* ============ Excel取り込み ============ */}
      <section className={cardClass}>
        <div>
          <h2 className="text-sm font-black text-slate-800">Excel取り込み（授業担当一覧）</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            「授業担当職員確認表」のような、行=学級（1-1、1年2組 など）・列=教科・セル=教員名の表を読み込み、教員と担当学級の設定に反映します。反映前に必ずプレビューで確認できます。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            id="import-excel"
            className="hidden"
            accept=".xlsx"
            onChange={handleExcelFile}
          />
          <label htmlFor="import-excel" className={`${buttonSecondary} cursor-pointer`}>
            📂 Excelファイルを選ぶ
          </label>
          {importFileName && (
            <span className="text-[11px] font-bold text-slate-500">{importFileName}</span>
          )}
        </div>

        {sheets.length > 0 && (
          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                シート
                <select
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={sheetIndex}
                  onChange={(e) => {
                    setSheetIndex(Number(e.target.value));
                    setLayoutOverride(null);
                  }}
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                教科名の行
                <input
                  type="number"
                  min={1}
                  max={currentGrid.length}
                  className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={(layout?.headerRow ?? 0) + 1}
                  onChange={(e) =>
                    setLayoutOverride({
                      headerRow: Math.max(0, Number(e.target.value) - 1),
                      classCol: layout?.classCol ?? 0,
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                学級の列
                <input
                  type="number"
                  min={1}
                  className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={(layout?.classCol ?? 0) + 1}
                  onChange={(e) =>
                    setLayoutOverride({
                      headerRow: layout?.headerRow ?? 0,
                      classCol: Math.max(0, Number(e.target.value) - 1),
                    })
                  }
                />
              </label>
              {!autoLayout && !layoutOverride && (
                <span className="text-[11px] font-bold text-amber-600">
                  表の形を自動判定できませんでした。行・列を手動で指定してください。
                </span>
              )}
            </div>

            {preview && preview.entries.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                    <p className="text-[9px] font-black text-slate-400">対象学級</p>
                    <p className="text-lg font-black text-slate-700">{preview.matchedClassCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                    <p className="text-[9px] font-black text-slate-400">教科</p>
                    <p className="text-lg font-black text-slate-700">{preview.subjectNames.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                    <p className="text-[9px] font-black text-slate-400">割当件数</p>
                    <p className="text-lg font-black text-slate-700">{preview.entries.length}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                    <p className="text-[9px] font-black text-emerald-500">新規教員</p>
                    <p className="text-lg font-black text-emerald-700">{preview.newTeacherNames.length}</p>
                  </div>
                </div>

                {preview.newTeacherNames.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    新しく追加される教員:{" "}
                    <span className="font-bold text-emerald-700">
                      {preview.newTeacherNames.join("、")}
                    </span>
                  </p>
                )}
                {preview.unmatchedClassRefs.length > 0 && (
                  <p className="text-[11px] font-bold text-amber-600">
                    ⚠ 対応する学級が見つからず読み飛ばした行: {preview.unmatchedClassRefs.join("、")}
                  </p>
                )}

                <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-[11px] whitespace-nowrap">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="p-2 text-left font-black text-slate-500">学級</th>
                        <th className="p-2 text-left font-black text-slate-500">教科</th>
                        <th className="p-2 text-left font-black text-slate-500">担当教員</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.entries.map((entry, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-1.5 font-bold text-slate-700">{entry.classLabel}</td>
                          <td className="p-1.5 text-slate-600">{entry.subjectName}</td>
                          <td className="p-1.5 text-slate-600">{entry.teacherNames.join("、")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={applyImport} className={buttonPrimary}>
                    ✓ この内容を設定に反映
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheets([]);
                      setImportFileName("");
                    }}
                    className={buttonSecondary}
                  >
                    キャンセル
                  </button>
                  <p className="text-[10px] text-slate-400">
                    ※ 表に含まれる教科×学級の担当は、取り込み内容で置き換えられます。
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                この設定では担当割当を読み取れませんでした。シート・行・列の指定を確認してください。
              </p>
            )}
          </div>
        )}
        {importMessage && (
          <p className="text-xs font-bold text-emerald-700">{importMessage}</p>
        )}
      </section>

      {/* ============ JSONバックアップ ============ */}
      <section className={cardClass}>
        <div>
          <h2 className="text-sm font-black text-slate-800">設定データの保存・読み込み</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            学級・教科・教員・合同交流・時間割のすべてをJSONファイルとして保存し、別の端末や年度更新前のバックアップとして使えます。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => downloadJson(data)} className={buttonPrimary}>
            💾 バックアップを保存
          </button>
          <input
            type="file"
            id="import-json-io"
            className="hidden"
            accept=".json"
            onChange={handleJsonImport}
          />
          <label htmlFor="import-json-io" className={`${buttonSecondary} cursor-pointer`}>
            📥 バックアップを読み込み
          </label>
        </div>
        {jsonMessage && <p className="text-xs font-bold text-emerald-700">{jsonMessage}</p>}
      </section>

      {/* ============ 年度コピー ============ */}
      <section className={cardClass}>
        <div>
          <h2 className="text-sm font-black text-slate-800">年度コピー（新年度の作成）</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            現在の設定（学級・教科・教員・担当・合同交流）を引き継いで、新年度のデータを作成します。時間割の配置はクリアされます。実行前のバックアップ保存をおすすめします。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            新しい年度
            <input
              className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
              placeholder={suggestedYear}
              value={newYearLabel}
              onChange={(e) => setNewYearLabel(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={clearUnavailable}
              onChange={(e) => setClearUnavailable(e.target.checked)}
            />
            教員の授業不可コマもクリア
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={clearMeetings}
              onChange={(e) => setClearMeetings(e.target.checked)}
            />
            会議もクリア
          </label>
        </div>
        <button type="button" onClick={runYearCopy} className={buttonPrimary}>
          🗓 新年度データを作成
        </button>
        {yearMessage && <p className="text-xs font-bold text-emerald-700">{yearMessage}</p>}
      </section>
    </div>
  );
}
