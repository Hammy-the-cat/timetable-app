"use client";

import { useEffect, useState } from "react";
import { downloadJson, exportClassPdf, exportWorkbook, readJsonFile } from "@/lib/exporters";
import { collectWarnings } from "@/lib/validation";
import { formatSlot, getDays } from "@/lib/school";
import { ScheduleCell, WeeklySlot, ClassGroup } from "@/lib/types";
import { useTimetableStore } from "@/store/timetable-store";
import { CellEditor } from "./CellEditor";
import { SettingsPanel } from "./SettingsPanel";
import { TimetableOverview } from "./TimetableOverview";
import { Sidebar } from "./Sidebar";
import { LessonPalette } from "./LessonPalette";
import { MatrixView } from "./MatrixView";
import { AssignmentAuditView } from "./AssignmentAuditView";
import { SetupWizard } from "./SetupWizard";
import { JointExchangeSettings } from "./JointExchangeSettings";
import { CheckResultsView } from "./CheckResultsView";
import { GenerationOptionsDialog, GenerationReportDialog } from "./GenerationDialogs";
import { DataIOView } from "./DataIOView";
import { HomeView } from "./HomeView";

type ViewKey = "matrix" | "settings" | "overview" | "audit" | "wizard" | "jointExchange" | "check" | "io" | "home";

export function TimetableWorkspace() {
  const {
    data,
    selectedClassId,
    setSelectedClassId,
    updateCell,
    clearCell,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    addClassroom,
    updateClassroom,
    deleteClassroom,
    addSubject,
    updateSubject,
    deleteSubject,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    addClass,
    updateClass,
    deleteClass,
    reset,
    replaceData,
    autoGenerate,
    clearSchedule,
    lastReport,
    clearReport,
  } = useTimetableStore();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedData = await readJsonFile(file);
      replaceData(importedData);
      alert("データを正常に読み込みました。");
    } catch (err) {
      alert("データの読み込みに失敗しました。正しいJSONファイルか確認してください。");
    }
  };

  const classes = data.classes;
  const selectedClass =
    classes.find((cls: ClassGroup) => cls.id === selectedClassId) ?? classes[0];
  const currentWeek = selectedClass ? data.schedule[selectedClass.id] : undefined;

  const [activeView, setActiveView] = useState<ViewKey>("home");
  const [selectedSlot, setSelectedSlot] = useState<WeeklySlot | null>(null);

  // 初回利用時（初期設定が未完了）はウィザードを開く
  useEffect(() => {
    const check = () => {
      if (!useTimetableStore.getState().data.setupCompleted) {
        setActiveView("wizard");
      }
    };
    if (useTimetableStore.persist.hasHydrated()) {
      check();
      return;
    }
    const unsub = useTimetableStore.persist.onFinishHydration(check);
    return unsub;
  }, []);

  const [matrixSelection, setMatrixSelection] = useState<{ classId: string; slot: WeeklySlot } | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [generating, setGenerating] = useState(false);

  const runGeneration = () => {
    setShowGenerateDialog(false);
    setGenerating(true);
    // 先に「配置中」の表示を描画させてから同期処理を実行する
    setTimeout(() => {
      try {
        autoGenerate();
        setShowReport(true);
      } finally {
        setGenerating(false);
      }
    }, 50);
  };

  const selectedCell: ScheduleCell | undefined =
    selectedSlot && currentWeek
      ? currentWeek[selectedSlot.day]?.[selectedSlot.period]
      : undefined;

  const mSelectedClass = matrixSelection ? data.classes.find((c: ClassGroup) => c.id === matrixSelection.classId) : null;
  const mSelectedCell = (matrixSelection && mSelectedClass) ? data.schedule[mSelectedClass.id]?.[matrixSelection.slot.day]?.[matrixSelection.slot.period] : undefined;

  const warnings =
    matrixSelection && mSelectedClass
      ? collectWarnings(data, mSelectedClass.id, matrixSelection.slot, mSelectedCell ?? {})
      : [];

  useEffect(() => {
    if (!data.lastUpdated) {
      setLastUpdatedLabel("");
      return;
    }
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    setLastUpdatedLabel(formatter.format(new Date(data.lastUpdated)));
  }, [data.lastUpdated]);

  if ((!selectedClass || !currentWeek) && activeView !== "wizard" && activeView !== "home") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="pro-card p-10 text-center max-w-md">
          <p className="text-slate-600 mb-4">学級データが存在しません。</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-brand-500 text-white rounded-md shadow hover:bg-brand-600"
          >
            初期データをロード
          </button>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    switch (activeView) {
      case "matrix":
        return (
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {/* Header / Toolbar */}
            <div className="min-h-14 border-b border-slate-200 bg-white flex items-center justify-between gap-4 px-6 shrink-0">
              <div className="flex shrink-0 items-center gap-4">
                <h1 className="whitespace-nowrap text-sm font-bold text-slate-800">全校時間割マトリックス</h1>
                <span className="whitespace-nowrap text-[10px] px-2 py-0.5 bg-brand-100 text-brand-600 rounded uppercase font-bold tracking-tight">
                  マスター編集モード
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3 overflow-x-auto py-2">
                <input
                  type="file"
                  id="import-json"
                  className="hidden"
                  accept=".json"
                  onChange={handleImport}
                />
                <label
                  htmlFor="import-json"
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm bg-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                  読み込み
                </label>

                <button
                  type="button"
                  onClick={() => exportWorkbook(data)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-bold border border-emerald-100 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14.5 2 14.5 7 20 7" /></svg>
                  Excel出力
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("時間割の配置をすべて消去しますか？（教員や学級などの基本設定は消えません）")) {
                      clearSchedule();
                    }
                  }}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-bold border border-rose-200 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                  時間割をリセット
                </button>

                <button
                  type="button"
                  onClick={() => setShowGenerateDialog(true)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-black border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all shadow-sm group"
                >
                  <span className="group-hover:animate-spin">✨</span>
                  空きコマ自動配置
                </button>

                {lastReport && (
                  <button
                    type="button"
                    onClick={() => setShowReport(true)}
                    className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-bold border border-slate-200 text-slate-600 bg-white rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                  >
                    📄 配置結果
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => downloadJson(data)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-5 py-2 text-xs font-black bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-all shadow-md active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                  すべての設定を保存
                </button>
              </div>
            </div>

            {/* Matrix Area */}
            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <MatrixView
                  data={data}
                  selectedSlot={matrixSelection}
                  onSelectSlot={(classId, slot) => {
                    setMatrixSelection({ classId, slot });
                    setSelectedClassId(classId);
                  }}
                />
              </div>
            </div>

            {/* Floating Editor */}
            {matrixSelection && (
              <div className="fixed bottom-10 right-10 w-[400px] pro-card shadow-2xl border-2 border-brand-500 z-50 animate-in slide-in-from-bottom-4">
                <div className="bg-brand-500 px-4 py-2 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-bold">
                      {mSelectedClass?.grade}年{mSelectedClass?.label}組 - {formatSlot(matrixSelection.slot)}
                    </span>
                  </div>
                  <button onClick={() => setMatrixSelection(null)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <div className="p-4 bg-white">
                  <CellEditor
                    classId={matrixSelection.classId}
                    slot={matrixSelection.slot}
                    cell={mSelectedCell}
                    data={data}
                    currentGrade={mSelectedClass?.grade}
                    warnings={warnings}
                    onUpdate={(patch) => updateCell(matrixSelection.classId, matrixSelection.slot, patch)}
                    onClear={() => clearCell(matrixSelection.classId, matrixSelection.slot)}
                    onApplyToClass={(targetClassId, patch) =>
                      updateCell(targetClassId, matrixSelection.slot, patch)
                    }
                  />
                </div>
              </div>
            )}

            <footer className="h-8 border-t border-slate-200 bg-white px-4 flex items-center justify-between shrink-0">
              <p className="text-[9px] text-slate-400">最終更新: {lastUpdatedLabel || "----"}</p>
              <div className="flex gap-4">
                <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Powered by IdeaEngine Timetable</span>
              </div>
            </footer>
          </div>
        );
      case "settings":
        return (
          <div className="flex-1 overflow-auto bg-white p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-8 border-b pb-4">基本設定・マスター管理</h1>
            <SettingsPanel
              teachers={data.teachers}
              classrooms={data.classrooms}
              subjects={data.subjects}
              meetings={data.meetings}
              classes={data.classes}
              onAddTeacher={addTeacher}
              onUpdateTeacher={updateTeacher}
              onDeleteTeacher={deleteTeacher}
              onAddClassroom={addClassroom}
              onUpdateClassroom={updateClassroom}
              onDeleteClassroom={deleteClassroom}
              onAddSubject={addSubject}
              onUpdateSubject={updateSubject}
              onDeleteSubject={deleteSubject}
              onAddMeeting={addMeeting}
              onUpdateMeeting={updateMeeting}
              onDeleteMeeting={deleteMeeting}
              onAddClass={(payload) => addClass({ grade: payload.grade, label: payload.label })}
              onUpdateClass={updateClass}
              onDeleteClass={deleteClass}
              sections={["teacher", "class", "subject", "classroom", "meeting"]}
              days={getDays(data)}
            />
          </div>
        );
      case "wizard":
        return (
          <div className="flex-1 overflow-auto bg-white p-8">
            <div className="mb-8 border-b pb-4">
              <h1 className="text-xl font-bold text-slate-800">初期設定ウィザード</h1>
              <p className="text-xs text-slate-500 mt-1">
                学校・学級・教科・教員・担当・合同交流の順に、学校の基本情報を設定します。
              </p>
            </div>
            <SetupWizard onComplete={() => setActiveView("matrix")} />
          </div>
        );
      case "jointExchange":
        return (
          <div className="flex-1 overflow-auto bg-white p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-8 border-b pb-4">合同・交流授業の設定</h1>
            <JointExchangeSettings />
          </div>
        );
      case "home":
        return (
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="mb-8 border-b pb-4">
              <h1 className="text-xl font-bold text-slate-800">ホーム</h1>
              <p className="text-xs text-slate-500 mt-1">現在の設定状況と、よく使う操作へのショートカットです。</p>
            </div>
            <HomeView data={data} onNavigate={(view) => setActiveView(view as ViewKey)} />
          </div>
        );
      case "io":
        return (
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="mb-8 border-b pb-4">
              <h1 className="text-xl font-bold text-slate-800">入出力・年度更新</h1>
              <p className="text-xs text-slate-500 mt-1">
                Excel出力・Excel取り込み・バックアップ・年度コピーをまとめて行えます。
              </p>
            </div>
            <DataIOView />
          </div>
        );
      case "check":
        return (
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="mb-8 border-b pb-4">
              <h1 className="text-xl font-bold text-slate-800">チェック結果</h1>
              <p className="text-xs text-slate-500 mt-1">
                時間割全体の問題点を一覧で確認できます。「該当コマへ」をクリックすると、マトリックスの該当箇所に移動して修正できます。
              </p>
            </div>
            <CheckResultsView
              data={data}
              onNavigate={(classId, slot) => {
                setSelectedClassId(classId);
                setMatrixSelection({ classId, slot });
                setActiveView("matrix");
              }}
            />
          </div>
        );
      case "overview":
        return (
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-8">全校時間割 俯瞰表示</h1>
            <TimetableOverview data={data} />
          </div>
        );
      case "audit":
        return (
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-8">設定進捗・監査レポート</h1>
            <AssignmentAuditView data={data} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 border border-slate-300">
      <Sidebar activeView={activeView} onViewChange={(v) => setActiveView(v as ViewKey)} />
      {renderMainContent()}
      {activeView === "matrix" && matrixSelection && (
        <div className="w-80 border-l border-slate-200 bg-white">
          <LessonPalette />
        </div>
      )}

      <GenerationOptionsDialog
        open={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onRun={runGeneration}
      />
      <GenerationReportDialog
        open={showReport}
        report={lastReport}
        data={data}
        onClose={() => setShowReport(false)}
        onOpenCheck={() => {
          setShowReport(false);
          setActiveView("check");
        }}
      />
      {generating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl">
            <p className="text-2xl animate-pulse">✨</p>
            <p className="mt-2 text-sm font-black text-slate-800">空きコマを配置しています…</p>
            <p className="mt-1 text-[11px] text-slate-400">数秒かかることがあります</p>
          </div>
        </div>
      )}
    </div>
  );
}

