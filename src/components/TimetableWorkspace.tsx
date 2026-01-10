"use client";

import { useEffect, useState } from "react";
import { downloadJson, exportClassPdf, exportWorkbook, readJsonFile } from "@/lib/exporters";
import { collectWarnings } from "@/lib/validation";
import { DAY_CONFIGS, formatSlot } from "@/lib/school";
import { ScheduleCell, WeeklySlot, ClassGroup } from "@/lib/types";
import { useTimetableStore } from "@/store/timetable-store";
import { CellEditor } from "./CellEditor";
import { SettingsPanel } from "./SettingsPanel";
import { TimetableOverview } from "./TimetableOverview";
import { Sidebar } from "./Sidebar";
import { LessonPalette } from "./LessonPalette";
import { MatrixView } from "./MatrixView";

type ViewKey = "matrix" | "settings" | "overview";

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

  const [activeView, setActiveView] = useState<ViewKey>("matrix");
  const [selectedSlot, setSelectedSlot] = useState<WeeklySlot | null>(null);
  const [matrixSelection, setMatrixSelection] = useState<{ classId: string; slot: WeeklySlot } | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");

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

  if (!selectedClass || !currentWeek) {
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
            <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-4">
                <h1 className="text-sm font-bold text-slate-800">全校時間割マトリックス</h1>
                <span className="text-[10px] px-2 py-0.5 bg-brand-100 text-brand-600 rounded uppercase font-bold tracking-tight">
                  マスター編集モード
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="import-json"
                  className="hidden"
                  accept=".json"
                  onChange={handleImport}
                />
                <label
                  htmlFor="import-json"
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ファイル読み込み
                </label>
                <button
                  type="button"
                  onClick={() => exportWorkbook(data)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Excel出力
                </button>
                <button
                  type="button"
                  onClick={() => downloadJson(data)}
                  className="px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors shadow-sm"
                >
                  保存（JSON）
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
    </div>
  );
}

