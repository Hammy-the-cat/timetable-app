"use client";

import { useState } from "react";

import { DAY_CONFIGS, formatSlot, getEffectiveQuota } from "@/lib/school";
import {
  ClassGroup,
  Classroom,
  Meeting,
  Subject,
  SubjectAssignment,
  Teacher,
  WeeklySlot,
} from "@/lib/types";

type Weekday = WeeklySlot["day"];

type SectionKey = "teacher" | "meeting" | "classroom" | "subject" | "class";

const defaultSlot: WeeklySlot = { day: "mon", period: 1 };

const SlotPicker = ({
  slot,
  onChange,
}: {
  slot: WeeklySlot;
  onChange: (slot: WeeklySlot) => void;
}) => {
  const config = DAY_CONFIGS.find((day) => day.key === slot.day)!;
  return (
    <div className="flex gap-2">
      <select
        className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
        value={slot.day}
        onChange={(event) =>
          onChange({
            day: event.target.value as Weekday,
            period: 1,
          })
        }
      >
        {DAY_CONFIGS.map((day) => (
          <option key={day.key} value={day.key}>
            {day.label}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
        value={slot.period}
        onChange={(event) =>
          onChange({
            ...slot,
            period: Number(event.target.value),
          })
        }
      >
        {Array.from({ length: config.periods }, (_, idx) => idx + 1).map(
          (period) => (
            <option key={period} value={period}>
              {period}限
            </option>
          )
        )}
      </select>
    </div>
  );
};

const SlotList = ({
  value,
  onRemove,
}: {
  value: WeeklySlot[];
  onRemove: (slot: WeeklySlot) => void;
}) => {
  if (!value.length) {
    return <p className="text-[10px] text-slate-400 italic">登録なし</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5 text-[10px]">
      {value.map((slot) => (
        <li
          key={`${slot.day}-${slot.period}`}
          className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200 flex items-center gap-1"
        >
          {formatSlot(slot)}
          <button
            type="button"
            className="text-rose-500 hover:text-rose-700 font-bold"
            onClick={() => onRemove(slot)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
};

interface SettingsPanelProps {
  teachers: Teacher[];
  classrooms: Classroom[];
  subjects: Subject[];
  meetings: Meeting[];
  classes: ClassGroup[];
  // Teachers
  onAddTeacher: (payload: Omit<Teacher, "id">) => void;
  onUpdateTeacher: (id: string, patch: Partial<Teacher>) => void;
  onDeleteTeacher: (id: string) => void;
  // Classrooms
  onAddClassroom: (payload: Omit<Classroom, "id">) => void;
  onUpdateClassroom: (id: string, patch: Partial<Classroom>) => void;
  onDeleteClassroom: (id: string) => void;
  // Subjects
  onAddSubject: (payload: Omit<Subject, "id">) => void;
  onUpdateSubject: (id: string, patch: Partial<Subject>) => void;
  onDeleteSubject: (id: string) => void;
  // Meetings
  onAddMeeting: (payload: Omit<Meeting, "id">) => void;
  onUpdateMeeting: (id: string, patch: Partial<Meeting>) => void;
  onDeleteMeeting: (id: string) => void;
  // Classes
  onAddClass: (payload: { grade: number; label: string; type?: "normal" | "special"; specialType?: "intellectual" | "emotional" | "physical"; exchangeClassId?: string }) => void;
  onUpdateClass: (id: string, patch: Partial<ClassGroup>) => void;
  onDeleteClass: (id: string) => void;
  sections?: SectionKey[];
}

export function SettingsPanel({
  teachers,
  classrooms,
  subjects,
  meetings,
  classes,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onAddClassroom,
  onUpdateClassroom,
  onDeleteClassroom,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  sections,
}: SettingsPanelProps) {
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherGrades, setTeacherGrades] = useState<number[]>([]);
  const [teacherBlocks, setTeacherBlocks] = useState<WeeklySlot[]>([]);
  const [teacherSlot, setTeacherSlot] = useState<WeeklySlot>(defaultSlot);

  const [meetingName, setMeetingName] = useState("");
  const [meetingSlots, setMeetingSlots] = useState<WeeklySlot[]>([]);
  const [meetingSlot, setMeetingSlot] = useState<WeeklySlot>(defaultSlot);

  const [teacherRole, setTeacherRole] = useState<"homeroom" | "assistant">("assistant");
  const [teacherHomeroomClassIds, setTeacherHomeroomClassIds] = useState<string[]>([]);
  const [teacherMeetings, setTeacherMeetings] = useState<string[]>([]);
  const [teacherSubjectAssignments, setTeacherSubjectAssignments] = useState<SubjectAssignment[]>([]);

  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState<"standard" | "special">("standard");

  const [subjectName, setSubjectName] = useState("");
  const [subjectQuota, setSubjectQuota] = useState(1);
  const [subjectIsJoint, setSubjectIsJoint] = useState(false);

  const [classGrade, setClassGrade] = useState(1);
  const [classLabel, setClassLabel] = useState("");
  const [classType, setClassType] = useState<"normal" | "special">("normal");
  const [classSpecialType, setClassSpecialType] = useState<"intellectual" | "emotional" | "physical">("intellectual");
  const [classExchangeClassId, setClassExchangeClassId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleAssignmentClass = (subjectName: string, classId: string, assignments: SubjectAssignment[], setter: (val: SubjectAssignment[]) => void) => {
    const existing = assignments.find(a => a.subjectName === subjectName);
    if (existing) {
      if (existing.classIds.includes(classId)) {
        setter(assignments.map(a => a.subjectName === subjectName
          ? { ...a, classIds: a.classIds.filter(id => id !== classId) }
          : a
        ));
      } else {
        setter(assignments.map(a => a.subjectName === subjectName
          ? { ...a, classIds: [...a.classIds, classId] }
          : a
        ));
      }
    } else {
      setter([...assignments, { subjectName, classIds: [classId] }]);
    }
  };

  const want = (key: SectionKey) => !sections || sections.includes(key);

  const appendSlot = (
    slot: WeeklySlot,
    current: WeeklySlot[],
    setter: (value: WeeklySlot[]) => void
  ) => {
    if (current.some((item) => item.day === slot.day && item.period === slot.period)) {
      return;
    }
    setter([...current, slot]);
  };

  const removeSlot = (
    slot: WeeklySlot,
    current: WeeklySlot[],
    setter: (value: WeeklySlot[]) => void
  ) => {
    setter(
      current.filter(
        (item) => !(item.day === slot.day && item.period === slot.period)
      )
    );
  };

  return (
    <div className="space-y-12 max-w-4xl">
      {/* 1. 教員設定 */}
      {want("teacher") && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-brand-500 rounded-full" />
              教員マスター
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
            {/* 登録フォーム */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 h-fit">
              <div className="space-y-3">
                <input
                  placeholder="教師名 (例: 山本)"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />

                <div className="space-y-4 bg-white/50 p-3 rounded-lg border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">役割</label>
                    <div className="flex gap-2">
                      {(["assistant", "homeroom"] as const).map(r => (
                        <label key={r} className={`flex-1 flex items-center justify-center p-2 rounded-md border cursor-pointer transition-colors ${teacherRole === r ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-200'}`}>
                          <input type="radio" className="hidden" name="teacherRole" checked={teacherRole === r} onChange={() => setTeacherRole(r)} />
                          <span className={`text-[10px] font-bold ${teacherRole === r ? 'text-brand-700' : 'text-slate-400'}`}>
                            {r === "homeroom" ? "学級担任" : "副担任・他"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {teacherRole === "homeroom" && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">担任学級 (道徳・学活の担当)</label>
                      <select
                        className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-500"
                        value={teacherHomeroomClassIds.length > 0 ? (
                          classes.find(c => c.id === teacherHomeroomClassIds[0])?.type === "special"
                            ? `special-${classes.find(c => c.id === teacherHomeroomClassIds[0])?.label}`
                            : teacherHomeroomClassIds[0]
                        ) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith("special-")) {
                            const label = val.replace("special-", "");
                            const ids = classes.filter(c => c.type === "special" && c.label === label).map(c => c.id);
                            setTeacherHomeroomClassIds(ids);
                          } else {
                            setTeacherHomeroomClassIds(val ? [val] : []);
                          }
                        }}
                      >
                        <option value="">担当学級を選択</option>
                        {/* Normal Classes */}
                        <optgroup label="通常学級">
                          {classes.filter(c => c.type !== "special").map(c => (
                            <option key={c.id} value={c.id}>{c.grade}-{c.label}</option>
                          ))}
                        </optgroup>
                        {/* Special Classes Grouped by Label */}
                        <optgroup label="特別支援学級">
                          {Array.from(new Set(classes.filter(c => c.type === "special").map(c => c.label))).map(label => (
                            <option key={`special-${label}`} value={`special-${label}`}>{label}組</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">所属学年 (総合の担当)</label>
                      <button
                        type="button"
                        onClick={() => setTeacherGrades([])}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-black border transition-all ${teacherGrades.length === 0 ? 'bg-slate-500 border-slate-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                      >
                        なし
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(g => (
                        <label key={g} className={`flex-1 flex items-center justify-center p-2 rounded-md border transition-all cursor-pointer ${teacherGrades.includes(g) ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={teacherGrades.includes(g)}
                            onChange={() => {
                              setTeacherGrades(prev => prev.includes(g) ? prev.filter(gg => gg !== g) : [...prev, g]);
                            }}
                          />
                          <span className={`text-xs font-bold ${teacherGrades.includes(g) ? 'text-brand-600' : 'text-slate-400'}`}>
                            {g}年
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">参加する会議</label>
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto p-1 border border-slate-100 rounded bg-white">
                      {meetings.map(m => (
                        <label key={m.id} className="flex items-center gap-1.5 p-1 px-2 rounded border border-slate-100 bg-white cursor-pointer hover:bg-brand-50 transition-colors">
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded text-brand-500 focus:ring-brand-500"
                            checked={teacherMeetings.includes(m.id)}
                            onChange={() => {
                              setTeacherMeetings(prev =>
                                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                              );
                            }}
                          />
                          <span className={`text-[9px] font-bold ${teacherMeetings.includes(m.id) ? 'text-brand-600' : 'text-slate-400'}`}>
                            {m.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">担当教科</label>
                    <button
                      type="button"
                      onClick={() => setTeacherSubjects([])}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black border transition-all ${teacherSubjects.length === 0 ? 'bg-slate-500 border-slate-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                    >
                      クリア
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded bg-white">
                    {Array.from(new Set(subjects.map(s => s.name)))
                      .filter((sn: string) => !["道徳", "学活", "総合", "自立", "生活"].includes(sn))
                      .map(subName => (
                        <label key={subName} className="flex items-center gap-1.5 p-1 px-2 rounded border border-slate-100 bg-white cursor-pointer hover:bg-brand-50 transition-colors">
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded text-brand-500 focus:ring-brand-500"
                            checked={teacherSubjects.includes(subName)}
                            onChange={() => {
                              setTeacherSubjects(prev =>
                                prev.includes(subName) ? prev.filter(s => s !== subName) : [...prev, subName]
                              );
                            }}
                          />
                          <span className={`text-[9px] font-bold ${teacherSubjects.includes(subName) ? 'text-brand-600' : 'text-slate-400'}`}>
                            {subName}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {teacherSubjects.length > 0 && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">教科ごとの担当学級設定</label>
                    <div className="space-y-2">
                      {teacherSubjects.map(subName => (
                        <div key={subName} className="p-2 border border-brand-100 rounded-lg bg-brand-50/30 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-brand-600 flex items-center gap-1">
                              <span className="w-1 h-3 bg-brand-500 rounded-full" />
                              {subName} の担当クラス
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {classes.map(c => {
                              const isAssigned = teacherSubjectAssignments.find(a => a.subjectName === subName)?.classIds.includes(c.id);
                              return (
                                <label key={c.id} className={`flex items-center justify-center p-1 rounded border text-[8px] font-bold cursor-pointer transition-all ${isAssigned
                                  ? 'bg-brand-500 border-brand-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                                  }`}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isAssigned || false}
                                    onChange={() => toggleAssignmentClass(subName, c.id, teacherSubjectAssignments, setTeacherSubjectAssignments)}
                                  />
                                  {c.grade}-{c.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">授業不可コマ</label>
                  <SlotPicker slot={teacherSlot} onChange={setTeacherSlot} />
                  <button
                    type="button"
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold transition-colors"
                    onClick={() => appendSlot(teacherSlot, teacherBlocks, setTeacherBlocks)}
                  >
                    選択中のコマを追加
                  </button>
                  <SlotList value={teacherBlocks} onRemove={(s) => removeSlot(s, teacherBlocks, setTeacherBlocks)} />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!teacherName.trim()) return;
                  let subjects = [...teacherSubjects];
                  if (teacherRole === "homeroom") {
                    const autoSubjects = ["道徳", "学活"];

                    // 特別支援学級の担任なら「自立」「生活」を追加
                    const isSpecialHomeroom = teacherHomeroomClassIds.some(id => {
                      const cls = classes.find(c => c.id === id);
                      return cls?.type === "special";
                    });
                    if (isSpecialHomeroom) {
                      autoSubjects.push("自立", "生活");
                    }

                    autoSubjects.forEach(s => {
                      if (!subjects.includes(s)) subjects.push(s);
                      // 担任学級を自動割り当て
                      if (!teacherSubjectAssignments.some(a => a.subjectName === s)) {
                        teacherSubjectAssignments.push({ subjectName: s, classIds: teacherHomeroomClassIds });
                      }
                    });
                  }
                  if (teacherGrades.length > 0 || teacherRole === "homeroom") {
                    if (!subjects.includes("総合")) subjects.push("総合");
                    if (!teacherSubjectAssignments.some(a => a.subjectName === "総合")) {
                      // 総合は担当学年全てのクラス、または担任クラス
                      const targetIds = teacherRole === "homeroom" ? [...teacherHomeroomClassIds] : [];
                      teacherGrades.forEach(g => {
                        classes.filter(c => c.grade === g).forEach(c => {
                          if (!targetIds.includes(c.id)) targetIds.push(c.id);
                        });
                      });
                      teacherSubjectAssignments.push({ subjectName: "総合", classIds: targetIds });
                    }
                  }
                  onAddTeacher({
                    name: teacherName.trim(),
                    subjects,
                    taughtGrades: teacherGrades,
                    role: teacherRole,
                    homeroomClassIds: teacherRole === "homeroom" ? teacherHomeroomClassIds : [],
                    unavailable: teacherBlocks,
                    meetingIds: teacherMeetings,
                    subjectAssignments: teacherSubjectAssignments
                  });
                  setTeacherName(""); setTeacherSubjects([]); setTeacherBlocks([]);
                  setTeacherRole("assistant"); setTeacherHomeroomClassIds([]); setTeacherGrades([]);
                  setTeacherMeetings([]); setTeacherSubjectAssignments([]);
                }}
                className="w-full py-2 bg-brand-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-brand-600 transition-colors"
              >
                教員を登録
              </button>
            </div>
            {/* 一覧 */}
            <div className="space-y-2">
              {teachers.map((t: any) => (
                <div key={t.id} className="group bg-white p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition-all shadow-sm">
                  {editingId === t.id ? (
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-brand-500 uppercase">教員情報を編集</span>
                        <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400">✕ 閉じる</button>
                      </div>
                      <input
                        className="w-full rounded border border-brand-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        defaultValue={t.name}
                        onBlur={(e) => onUpdateTeacher(t.id, { name: e.target.value })}
                        placeholder="教師名"
                      />
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase">役割・担任変更</label>
                        <div className="flex gap-2 mb-2">
                          {(["assistant", "homeroom"] as const).map(r => (
                            <label key={r} className={`flex-1 flex items-center justify-center p-1 rounded border cursor-pointer transition-colors ${t.role === r ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}>
                              <input type="radio" className="hidden" checked={t.role === r} onChange={() => {
                                let patch: Partial<Teacher> = { role: r };
                                if (r === "homeroom") {
                                  let subjects = [...t.subjects];
                                  ["道徳", "学活", "総合"].forEach(s => { if (!subjects.includes(s)) subjects.push(s); });
                                  patch.subjects = subjects;
                                }
                                onUpdateTeacher(t.id, patch);
                              }} />
                              <span className={`text-[9px] font-bold ${t.role === r ? 'text-brand-700' : 'text-slate-400'}`}>
                                {r === "homeroom" ? "学級担任" : "副担任"}
                              </span>
                            </label>
                          ))}
                        </div>
                        {t.role === "homeroom" && (
                          <div className="mt-1 mb-2">
                            <label className="text-[8px] font-black text-slate-400 uppercase">担任学級(道徳・学活向け)</label>
                            <select
                              className="w-full text-[10px] p-1.5 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-500"
                              value={t.homeroomClassIds && t.homeroomClassIds.length > 0 ? (
                                classes.find(c => c.id === t.homeroomClassIds![0])?.type === "special"
                                  ? `special-${classes.find(c => c.id === t.homeroomClassIds![0])?.label}`
                                  : t.homeroomClassIds![0]
                              ) : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val.startsWith("special-")) {
                                  const label = val.replace("special-", "");
                                  const ids = classes.filter(c => c.type === "special" && c.label === label).map(c => c.id);
                                  onUpdateTeacher(t.id, { homeroomClassIds: ids });
                                } else {
                                  onUpdateTeacher(t.id, { homeroomClassIds: val ? [val] : [] });
                                }
                              }}
                            >
                              <option value="">担任学級を選択</option>
                              <optgroup label="通常学級">
                                {classes.filter(c => c.type !== "special").map(c => (
                                  <option key={c.id} value={c.id}>{c.grade}-{c.label}</option>
                                ))}
                              </optgroup>
                              <optgroup label="特別支援学級">
                                {Array.from(new Set(classes.filter(c => c.type === "special").map(c => c.label))).map(label => (
                                  <option key={`special-${label}`} value={`special-${label}`}>{label}組</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-2 bg-slate-50 rounded border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">担当教科</label>
                          <button
                            type="button"
                            onClick={() => onUpdateTeacher(t.id, { subjects: [] })}
                            className={`text-[7px] px-1 py-0.5 rounded font-black border transition-all ${t.subjects.length === 0 ? 'bg-slate-500 border-slate-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                          >
                            クリア
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-0.5 max-h-32 overflow-y-auto">
                          {Array.from(new Set(subjects.map(s => s.name)))
                            .filter(sn => !["道徳", "学活", "総合", "自立", "生活"].includes(sn))
                            .map(subName => (
                              <label key={subName} className="flex items-center gap-1 p-1 rounded border border-slate-100 bg-white cursor-pointer hover:bg-brand-50 transition-colors">
                                <input
                                  type="checkbox"
                                  className="w-3 h-3 rounded text-brand-500 focus:ring-brand-500"
                                  checked={t.subjects.includes(subName)}
                                  onChange={() => {
                                    const next = t.subjects.includes(subName)
                                      ? t.subjects.filter((s: string) => s !== subName)
                                      : [...t.subjects, subName];

                                    // Remove assignment if subject is removed
                                    let nextAssignments = t.subjectAssignments || [];
                                    if (!next.includes(subName)) {
                                      nextAssignments = nextAssignments.filter(a => a.subjectName !== subName);
                                    }

                                    onUpdateTeacher(t.id, { subjects: next, subjectAssignments: nextAssignments });
                                  }}
                                />
                                <span className={`text-[8px] font-bold ${t.subjects.includes(subName) ? 'text-brand-600' : 'text-slate-400'}`}>
                                  {subName}
                                </span>
                              </label>
                            ))}
                        </div>
                      </div>

                      {t.subjects.length > 0 && (
                        <div className="space-y-1.5 p-2 bg-indigo-50/30 rounded border border-indigo-100 animate-in fade-in slide-in-from-top-1">
                          <label className="text-[8px] font-black text-indigo-500 uppercase flex items-center gap-1">
                            <span className="w-1 h-2 bg-indigo-500 rounded-full" />
                            教科ごとの担当クラス
                          </label>
                          <div className="space-y-1.5">
                            {t.subjects
                              .filter((sn: string) => !["道徳", "学活", "総合", "自立", "生活"].includes(sn))
                              .map((subName: string) => (
                                <div key={subName} className="p-1.5 bg-white rounded border border-indigo-100 space-y-1 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-700">{subName}</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-0.5">
                                    {classes.map(c => {
                                      const assignments = t.subjectAssignments || [];
                                      const isAssigned = assignments.find((a: SubjectAssignment) => a.subjectName === subName)?.classIds.includes(c.id);
                                      return (
                                        <label key={c.id} className={`flex items-center justify-center p-1 rounded border text-[7px] font-bold cursor-pointer transition-all ${isAssigned
                                          ? 'bg-indigo-500 border-indigo-600 text-white shadow-sm'
                                          : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                          }`}>
                                          <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isAssigned || false}
                                            onChange={() => toggleAssignmentClass(subName, c.id, assignments, (val) => onUpdateTeacher(t.id, { subjectAssignments: val }))}
                                          />
                                          {c.grade}-{c.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase">担当設定の変更</label>
                        <div className="flex gap-1 mb-2">
                          {(["assistant", "homeroom"] as const).map(r => (
                            <label key={r} className={`flex-1 flex items-center justify-center p-1 rounded border cursor-pointer transition-colors ${t.role === r ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}>
                              <input type="radio" className="hidden" checked={t.role === r} onChange={() => {
                                let patch: Partial<Teacher> = { role: r };
                                if (r === "homeroom") {
                                  let subjects = [...t.subjects];
                                  ["道徳", "学活", "総合"].forEach(s => { if (!subjects.includes(s)) subjects.push(s); });
                                  patch.subjects = subjects;
                                }
                                onUpdateTeacher(t.id, patch);
                              }} />
                              <span className={`text-[9px] font-bold ${t.role === r ? 'text-brand-700' : 'text-slate-400'}`}>
                                {r === "homeroom" ? "担任" : "副担"}
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="space-y-1 p-2 bg-slate-50 rounded border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase">所属学年(総合向け)</label>
                              <button
                                type="button"
                                onClick={() => {
                                  let subjects = t.subjects.filter((s: string) => s !== "総合" || t.role === "homeroom");
                                  onUpdateTeacher(t.id, { taughtGrades: [], subjects });
                                }}
                                className={`text-[7px] px-1 py-0.5 rounded font-black border transition-all ${(!t.taughtGrades || t.taughtGrades.length === 0) ? 'bg-slate-500 border-slate-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                              >
                                なし
                              </button>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3].map(g => (
                                <label key={g} className={`flex-1 flex items-center justify-center p-1 rounded border transition-colors cursor-pointer ${t.taughtGrades?.includes(g) ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-200 hover:bg-brand-50'}`}>
                                  <input type="checkbox" className="hidden" checked={t.taughtGrades?.includes(g)} onChange={(e) => {
                                    const nextGrades = e.target.checked ? [...(t.taughtGrades || []), g] : (t.taughtGrades || []).filter((gg: number) => gg !== g);
                                    let patch: any = { taughtGrades: nextGrades };
                                    let subjects = [...t.subjects];

                                    if (nextGrades.length > 0 && !subjects.includes("総合")) {
                                      subjects.push("総合");
                                    } else if (nextGrades.length === 0 && subjects.includes("総合") && t.role !== "homeroom") {
                                      subjects = subjects.filter(s => s !== "総合");
                                    }
                                    patch.subjects = subjects;
                                    onUpdateTeacher(t.id, patch);
                                  }} />
                                  <span className={`text-[9px] font-bold ${t.taughtGrades?.includes(g) ? 'text-brand-600' : 'text-slate-400'}`}>{g}年</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 p-2 bg-slate-50 rounded border border-slate-100">
                          <label className="text-[8px] font-black text-slate-400 uppercase">参加する会議</label>
                          <div className="grid grid-cols-3 gap-0.5 max-h-24 overflow-y-auto">
                            {meetings.map(m => (
                              <label key={m.id} className="flex items-center gap-1 p-1 rounded border border-slate-100 bg-white cursor-pointer hover:bg-brand-50 transition-colors">
                                <input
                                  type="checkbox"
                                  className="w-3 h-3 rounded text-brand-500 focus:ring-brand-500"
                                  checked={t.meetingIds?.includes(m.id)}
                                  onChange={() => {
                                    const next = t.meetingIds?.includes(m.id)
                                      ? t.meetingIds.filter((id: string) => id !== m.id)
                                      : [...(t.meetingIds || []), m.id];
                                    onUpdateTeacher(t.id, { meetingIds: next });
                                  }}
                                />
                                <span className={`text-[8px] font-bold ${t.meetingIds?.includes(m.id) ? 'text-brand-600' : 'text-slate-400'}`}>
                                  {m.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {t.role === "homeroom" && (
                          <div className="mt-2 space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase">担任学級(道徳・学活向け)</label>
                            <select
                              className="w-full text-[10px] p-1.5 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-500"
                              value={t.homeroomClassIds && t.homeroomClassIds.length > 0 ? (
                                classes.find(c => c.id === t.homeroomClassIds![0])?.type === "special"
                                  ? `special-${classes.find(c => c.id === t.homeroomClassIds![0])?.label}`
                                  : t.homeroomClassIds![0]
                              ) : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                let nextIds: string[] = [];
                                if (val.startsWith("special-")) {
                                  const label = val.replace("special-", "");
                                  nextIds = classes.filter(c => c.type === "special" && c.label === label).map(c => c.id);
                                } else {
                                  nextIds = val ? [val] : [];
                                }

                                let subjects = [...t.subjects];
                                const isSpecial = nextIds.some(id => classes.find(c => c.id === id)?.type === "special");
                                if (isSpecial) {
                                  ["自立", "生活"].forEach(s => { if (!subjects.includes(s)) subjects.push(s); });
                                }

                                onUpdateTeacher(t.id, { homeroomClassIds: nextIds, subjects });
                              }}
                            >
                              <option value="">担任学級を選択</option>
                              <optgroup label="通常学級">
                                {classes.filter(c => c.type !== "special").map(c => (
                                  <option key={c.id} value={c.id}>{c.grade}-{c.label}</option>
                                ))}
                              </optgroup>
                              <optgroup label="特別支援学級">
                                {Array.from(new Set(classes.filter(c => c.type === "special").map(c => c.label))).map(label => (
                                  <option key={`special-${label}`} value={`special-${label}`}>{label}組</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase">授業不可時間の設定</label>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="w-6"></th>
                                {DAY_CONFIGS.map(d => (
                                  <th key={d.key} className="text-[9px] text-slate-400 font-bold p-1">{d.shortLabel}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[1, 2, 3, 4, 5, 6].map(period => (
                                <tr key={period}>
                                  <td className="text-[9px] text-slate-400 font-bold text-center">{period}</td>
                                  {DAY_CONFIGS.map(day => {
                                    const isUnavailable = t.unavailable.some((u: any) => u.day === day.key && u.period === period);
                                    const outOfRange = day.periods < period;
                                    return (
                                      <td key={day.key} className="p-0.5">
                                        <button
                                          disabled={outOfRange}
                                          onClick={() => {
                                            const next = isUnavailable
                                              ? t.unavailable.filter((u: any) => !(u.day === day.key && u.period === period))
                                              : [...t.unavailable, { day: day.key, period }];
                                            onUpdateTeacher(t.id, { unavailable: next });
                                          }}
                                          className={`w-full h-5 rounded-sm transition-all ${outOfRange ? 'bg-slate-100 cursor-not-allowed' :
                                            isUnavailable ? 'bg-rose-500 shadow-sm border border-rose-600' : 'bg-white border border-slate-200 hover:border-brand-300'
                                            }`}
                                          title={`${day.label} ${period}限: ${isUnavailable ? '不可' : '可能'}`}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-[8px] text-slate-400 mt-1 text-center font-bold">※ 赤色が「授業不可」の時間帯です</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col flex-1 cursor-pointer" onClick={() => setEditingId(t.id)}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">{t.name}</span>
                          {t.role === "homeroom" && (
                            <span className="text-[9px] bg-brand-500 text-white px-2 py-0.5 rounded-full font-black whitespace-nowrap flex-shrink-0">
                              {t.homeroomClassIds && t.homeroomClassIds.length > 0 ? (() => {
                                const firstClass = classes.find(c => c.id === t.homeroomClassIds![0]);
                                if (!firstClass) return "担任";
                                if (firstClass.type === "special") return `${firstClass.label}組 担任`;
                                return `${firstClass.grade}-${firstClass.label} 担任`;
                              })() : "担任"}
                            </span>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {t.role === "homeroom" ? (
                              t.homeroomClassIds?.map((classId: string) => {
                                const cls = classes.find(c => c.id === classId);
                                return cls ? (
                                  <span key={classId} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                    {cls.grade}-{cls.label}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              (t.taughtGrades?.length ?? 0) > 0 ? (
                                t.taughtGrades?.map((g: number) => (
                                  <span key={g} className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-bold">
                                    {g}年所属
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                                  学年所属なし
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.subjectAssignments && t.subjectAssignments.length > 0 ? (
                            t.subjectAssignments.map((a: SubjectAssignment) => (
                              <div key={a.subjectName} className="flex items-center bg-indigo-50 border border-indigo-100 rounded overflow-hidden shadow-sm">
                                <span className="text-[9px] font-black bg-indigo-500 text-white px-1.5 py-0.5">{a.subjectName}</span>
                                <span className="text-[9px] font-bold text-indigo-700 px-1.5 py-0.5">
                                  {a.classIds.map(cid => {
                                    const cls = classes.find(c => c.id === cid);
                                    return cls ? `${cls.grade}-${cls.label}` : cid;
                                  }).join(", ")}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">{t.subjects.join(", ") || "担当未設定"}</span>
                          )}
                        </div>

                        {(t.meetingIds?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.meetingIds?.map((mid: string) => {
                              const m = meetings.find(meeting => meeting.id === mid);
                              return m ? (
                                <span key={mid} className="text-[9px] bg-teal-50 text-teal-600 border border-teal-100 px-1.5 py-0.5 rounded font-bold">
                                  会: {m.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}

                        {t.unavailable.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.unavailable.map((s: any) => (
                              <span key={`${s.day}-${s.period}`} className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1 rounded">
                                不可: {formatSlot(s)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditingId(t.id)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded">✏️</button>
                        <button
                          onClick={() => { if (confirm(`${t.name}を削除しますか？`)) onDeleteTeacher(t.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. 教室設定 */}
      {want("classroom") && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-500 rounded-full" />
            教室マスター
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 h-fit">
              <input
                placeholder="教室名 (例: 第1理科室)"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as any)}
              >
                <option value="standard">普通教室</option>
                <option value="special">特別教室</option>
              </select>
              <button
                onClick={() => {
                  if (!roomName.trim()) return;
                  onAddClassroom({ name: roomName.trim(), type: roomType });
                  setRoomName("");
                }}
                className="w-full py-2 bg-brand-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-brand-600 transition-colors"
              >
                新規登録
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {classrooms.map((r) => (
                <div key={r.id} className="group flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition-all shadow-sm">
                  {editingId === r.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <input
                        className="w-full rounded border border-brand-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        defaultValue={r.name}
                        onBlur={(e) => onUpdateClassroom(r.id, { name: e.target.value })}
                        autoFocus
                      />
                      <select
                        className="w-full rounded border border-brand-200 px-2 py-1 text-[10px] outline-none bg-white"
                        defaultValue={r.type}
                        onChange={(e) => onUpdateClassroom(r.id, { type: e.target.value as any })}
                      >
                        <option value="standard">普通教室</option>
                        <option value="special">特別教室</option>
                      </select>
                      <button onClick={() => setEditingId(null)} className="text-[10px] text-brand-500 font-bold self-end">完了</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col flex-1 cursor-pointer" onClick={() => setEditingId(r.id)}>
                        <span className="text-sm font-bold text-slate-700">{r.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{r.type === 'special' ? '特別教室' : '普通教室'}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditingId(r.id)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded">✏️</button>
                        <button
                          onClick={() => { if (confirm(`${r.name}を削除しますか？`)) onDeleteClassroom(r.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. 教科設定 */}
      {want("subject") && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-500 rounded-full" />
            教科・週配当コマ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 h-fit">
              <input
                placeholder="教科名 (例: 数学)"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">週の目安コマ数</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                  value={subjectQuota}
                  onChange={(e) => setSubjectQuota(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="subject-joint"
                  className="w-3.5 h-3.5 text-brand-500 rounded border-slate-300 focus:ring-brand-500"
                  checked={subjectIsJoint}
                  onChange={(e) => setSubjectIsJoint(e.target.checked)}
                />
                <label htmlFor="subject-joint" className="text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                  複数クラス合同授業の対象
                </label>
              </div>
              <button
                onClick={() => {
                  if (!subjectName.trim()) return;
                  onAddSubject({
                    name: subjectName.trim(),
                    weeklyQuota: subjectQuota,
                    isJointSubject: subjectIsJoint
                  });
                  setSubjectName("");
                  setSubjectQuota(1);
                  setSubjectIsJoint(false);
                }}
                className="w-full py-2 bg-brand-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-brand-600 transition-colors"
              >
                新規登録
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {subjects.map((s) => (
                <div key={s.id} className="group flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition-all shadow-sm">
                  {editingId === s.id ? (
                    <div className="flex flex-col gap-3 w-full p-2 bg-slate-50 rounded-md border border-brand-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-brand-500 uppercase tracking-tighter">学年別時数の個別設定</span>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-[10px] text-slate-400 hover:text-slate-600">✕ 閉じる</button>
                      </div>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Normal Class */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 block ml-1 uppercase">通常学級</span>
                          <div className="flex gap-3">
                            {[1, 2, 3].map(grade => (
                              <div key={grade} className="flex-1 flex flex-col gap-0.5">
                                <label className="text-[8px] font-bold text-slate-400 text-center">{grade}年</label>
                                <input
                                  type="number" step="0.1"
                                  className="w-full rounded border border-slate-200 px-1 py-1 text-[10px] outline-none bg-white focus:ring-1 focus:ring-brand-500 font-bold text-center"
                                  defaultValue={getEffectiveQuota(s, grade, "normal")}
                                  onBlur={(e) => onUpdateSubject(s.id, { gradeQuotas: { ...(s.gradeQuotas || {}), [grade]: Number(e.target.value) } })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Special Needs Subtypes */}
                        {[
                          { qKey: "specialGradeQuotas", eKey: "specialGradeExchange", label: "支援共通", color: "indigo" },
                          { qKey: "intellectualQuotas", eKey: "intellectualExchange", label: "知的学級", color: "blue" },
                          { qKey: "emotionalQuotas", eKey: "emotionalExchange", label: "自情学級", color: "purple" },
                          { qKey: "physicalQuotas", eKey: "physicalExchange", label: "肢体学級", color: "rose" }
                        ].map(type => (
                          <div key={type.qKey} className="space-y-1.5 border-t border-slate-100 pt-2">
                            <span className={`text-[9px] font-black text-${type.color}-400 block ml-1 uppercase`}>{type.label}</span>
                            <div className="flex gap-2">
                              {[1, 2, 3].map(grade => {
                                const isEx = (s as any)[type.eKey]?.[grade] === true;
                                return (
                                  <div key={grade} className="flex-1 bg-white p-1 rounded border border-slate-100 flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-300 text-center">{grade}年</label>
                                    <div className="flex flex-col gap-1">
                                      <input
                                        type="number" step="0.1"
                                        className={`w-full rounded border border-slate-200 px-1 py-1 text-[10px] outline-none focus:ring-1 focus:ring-${type.color}-500 font-bold text-center`}
                                        defaultValue={getEffectiveQuota(s, grade, "special", type.qKey.replace("Quotas", "") as any)}
                                        onBlur={(e) => onUpdateSubject(s.id, { [type.qKey]: { ...((s as any)[type.qKey] || {}), [grade]: Number(e.target.value) } })}
                                      />
                                      <button
                                        onClick={() => {
                                          const currentFlags = (s as any)[type.eKey] || {};
                                          onUpdateSubject(s.id, { [type.eKey]: { ...currentFlags, [grade]: !isEx } });
                                        }}
                                        className={`w-full py-0.5 rounded text-[8px] font-black transition-all ${isEx
                                          ? "bg-emerald-500 text-white shadow-sm"
                                          : "bg-slate-100 text-slate-400 hover:bg-slate-200 shadow-inner"
                                          }`}
                                      >
                                        {isEx ? "交流" : "単独"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div className="space-y-3 border-t border-slate-100 pt-3 pb-1">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 block ml-1 uppercase">合同授業・学年連携の設定</span>
                            <label className="flex items-center gap-2 cursor-pointer group/toggle bg-white p-2 rounded border border-slate-100 hover:border-amber-200 transition-colors">
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
                                defaultChecked={s.isJointSubject}
                                onChange={(e) => onUpdateSubject(s.id, { isJointSubject: e.target.checked })}
                              />
                              <span className="text-[10px] font-black text-slate-600 group-hover/toggle:text-amber-600">
                                この教科を複数クラス合同（連携）で実施する
                              </span>
                            </label>
                          </div>

                          {s.isJointSubject && (
                            <div className="space-y-4 bg-white p-2.5 rounded-lg border border-amber-100 animate-in fade-in slide-in-from-top-1 shadow-inner">
                              <p className="text-[10px] text-amber-600 font-black leading-tight flex items-center gap-1">
                                <span className="w-1 h-3 bg-amber-500 rounded-full" />
                                同時に授業を行うグループの設定（学年内）:
                              </p>
                              {[1, 2, 3].map(grade => {
                                const gradeClasses = classes.filter(c => c.grade === grade && c.type !== 'special');
                                if (gradeClasses.length === 0) return null;

                                const groups = s.jointClassGroups?.[grade] || [[]];

                                return (
                                  <div key={grade} className="space-y-2 border-l-2 border-slate-100/50 pl-2 ml-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-black text-slate-400">{grade}年</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...groups, []];
                                          onUpdateSubject(s.id, { jointClassGroups: { ...(s.jointClassGroups || {}), [grade]: next } });
                                        }}
                                        className="text-[8px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold hover:bg-amber-100 transition-colors"
                                      >
                                        + グループ追加
                                      </button>
                                    </div>
                                    <div className="space-y-2">
                                      {groups.map((group, groupIdx) => (
                                        <div key={groupIdx} className="flex flex-col gap-1.5 p-1.5 rounded bg-slate-50/50 border border-slate-100">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-black text-amber-500">Group {groupIdx + 1}</span>
                                            {groups.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const next = groups.filter((_, i) => i !== groupIdx);
                                                  onUpdateSubject(s.id, { jointClassGroups: { ...(s.jointClassGroups || {}), [grade]: next.length > 0 ? next : [[]] } });
                                                }}
                                                className="text-slate-300 hover:text-rose-400 p-0.5 transition-colors"
                                              >
                                                ✕
                                              </button>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {gradeClasses.map(c => {
                                              const isInThisGroup = group.includes(c.id);
                                              const isInAnyGroup = groups.some(g => g.includes(c.id));

                                              return (
                                                <button
                                                  key={c.id}
                                                  type="button"
                                                  disabled={isInAnyGroup && !isInThisGroup}
                                                  onClick={() => {
                                                    const nextGroups = groups.map((g, i) => {
                                                      if (i === groupIdx) {
                                                        return isInThisGroup ? g.filter(id => id !== c.id) : [...g, c.id].sort();
                                                      }
                                                      return g.filter(id => id !== c.id);
                                                    });
                                                    onUpdateSubject(s.id, { jointClassGroups: { ...(s.jointClassGroups || {}), [grade]: nextGroups } });
                                                  }}
                                                  className={`text-[8px] px-2 py-0.5 rounded transition-all font-bold border ${isInThisGroup
                                                    ? "bg-amber-500 border-amber-600 text-white shadow-sm"
                                                    : (isInAnyGroup && !isInThisGroup)
                                                      ? "bg-slate-100 border-slate-100 text-slate-200 opacity-30 cursor-not-allowed"
                                                      : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-amber-200 shadow-sm"
                                                    }`}
                                                >
                                                  {c.label}組
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              <p className="text-[7px] text-amber-400 italic leading-tight">
                                ※１つの学年内で「組の組み合わせ」を複数パターン作成できるようになりました。<br />
                                クラスを選択するとそのGroupに追加されます。
                              </p>
                            </div>
                          )}

                          <div className="flex flex-col gap-1 border-t border-slate-50 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group/toggle bg-white p-2 rounded border border-slate-100 hover:border-indigo-200 transition-colors">
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 text-indigo-500 rounded border-slate-300 focus:ring-indigo-500"
                                defaultChecked={s.isMultiGrade}
                                onChange={(e) => onUpdateSubject(s.id, { isMultiGrade: e.target.checked })}
                              />
                              <span className="text-[10px] font-black text-slate-600 group-hover/toggle:text-indigo-600">
                                この教科を複式授業（複数学年の合同）で実施する
                              </span>
                            </label>
                          </div>

                          {s.isMultiGrade && (
                            <div className="space-y-4 bg-white p-2.5 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-top-1 shadow-inner">
                              <p className="text-[10px] text-indigo-600 font-black leading-tight flex items-center gap-1">
                                <span className="w-1 h-3 bg-indigo-500 rounded-full" />
                                複式・学年をまたぐグループ設定:
                              </p>
                              <div className="space-y-3">
                                {(s.multiGradeGroups || [[]]).map((group, groupIdx) => (
                                  <div key={groupIdx} className="space-y-2 border-l-2 border-slate-100/50 pl-2 ml-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8px] font-black text-indigo-500">複式 Group {groupIdx + 1}</span>
                                      {(s.multiGradeGroups?.length || 1) > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = (s.multiGradeGroups || []).filter((_, i) => i !== groupIdx);
                                            onUpdateSubject(s.id, { multiGradeGroups: next.length > 0 ? next : [[]] });
                                          }}
                                          className="text-[8px] text-rose-400 hover:text-rose-600 font-bold"
                                        >
                                          削除
                                        </button>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                      {[1, 2, 3].map(grade => {
                                        const gradeClasses = classes.filter(c => c.grade === grade);
                                        return (
                                          <div key={grade} className="flex items-center gap-2 bg-slate-50/50 p-1 rounded">
                                            <span className="text-[8px] font-black text-slate-400 w-4">{grade}年</span>
                                            <div className="flex flex-wrap gap-1">
                                              {gradeClasses.map(c => {
                                                const isInThisGroup = group.includes(c.id);
                                                const isInAnyMultiGroup = (s.multiGradeGroups || []).some(g => g.includes(c.id));
                                                return (
                                                  <button
                                                    key={c.id}
                                                    type="button"
                                                    disabled={isInAnyMultiGroup && !isInThisGroup}
                                                    onClick={() => {
                                                      const currentGroups = s.multiGradeGroups || [[]];
                                                      const nextGroups = currentGroups.map((g, i) => {
                                                        if (i === groupIdx) {
                                                          return isInThisGroup ? g.filter(id => id !== c.id) : [...g, c.id].sort();
                                                        }
                                                        return g.filter(id => id !== c.id);
                                                      });
                                                      onUpdateSubject(s.id, { multiGradeGroups: nextGroups });
                                                    }}
                                                    className={`text-[8px] px-2 py-0.5 rounded transition-all font-bold border ${isInThisGroup
                                                      ? "bg-indigo-500 border-indigo-600 text-white shadow-sm"
                                                      : (isInAnyMultiGroup && !isInThisGroup)
                                                        ? "bg-slate-100 border-slate-100 text-slate-200 opacity-30 cursor-not-allowed"
                                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-indigo-200 shadow-sm"
                                                      }`}
                                                  >
                                                    {c.label}組
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(s.multiGradeGroups || [[]]), []];
                                    onUpdateSubject(s.id, { multiGradeGroups: next });
                                  }}
                                  className="w-full text-[8px] bg-slate-50 text-slate-400 border border-slate-200 border-dashed py-1.5 rounded-md font-bold hover:bg-slate-100 transition-colors"
                                >
                                  + 新しい複式グループを追加
                                </button>
                              </div>
                              <p className="text-[7px] text-indigo-400 italic leading-tight">
                                ※「学年をまたいで」同時に授業を行う組み合わせを設定できます。<br />
                                例：1年6組, 2年6組, 3年6組を1つのグループに。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-400 leading-tight italic">※入力した数値はその学年の専用設定として保存されます。未設定の学年は全体基準を引き継ぎます。</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col flex-1 cursor-pointer" onClick={() => setEditingId(s.id)}>
                        <span className="text-sm font-bold text-slate-700">{s.name}</span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          <div className="flex gap-3">
                            <span className="text-[8px] font-black text-slate-300 uppercase w-6">通常</span>
                            <div className="flex gap-4">
                              {[1, 2, 3].map(g => {
                                const quota = getEffectiveQuota(s, g, "normal");
                                const isCustom = s.gradeQuotas?.[g] !== undefined;
                                return (
                                  <div key={g} className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400 font-bold">{g}年:</span>
                                    <span className={`text-[10px] font-mono font-bold ${isCustom ? 'text-brand-600' : 'text-slate-500'}`}>
                                      {quota}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <span className="text-[8px] font-black text-indigo-300 uppercase w-6">支援</span>
                            <div className="flex gap-4">
                              {[1, 2, 3].map(g => {
                                const quota = getEffectiveQuota(s, g, "special");
                                const isCustom = s.specialGradeQuotas?.[g] !== undefined;
                                return (
                                  <div key={g} className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400 font-bold">{g}年:</span>
                                    <span className={`text-[10px] font-mono font-bold ${isCustom ? 'text-indigo-600' : 'text-slate-500'}`}>
                                      {quota}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {[
                              { key: "specialGradeExchange", label: "共通", color: "slate" },
                              { key: "intellectualExchange", label: "知的", color: "blue" },
                              { key: "emotionalExchange", label: "自情", color: "purple" },
                              { key: "physicalExchange", label: "肢体", color: "rose" }
                            ].map(type => {
                              const flags = (s as any)[type.key] || {};
                              const activeGrades = [1, 2, 3].filter(g => flags[g]);
                              if (activeGrades.length === 0) return null;
                              return (
                                <span key={type.key} className={`text-[7px] bg-${type.color}-50 text-${type.color}-600 border border-${type.color}-200 px-1 py-0.5 rounded font-black flex items-center gap-0.5`}>
                                  <span className={`w-1 h-1 bg-${type.color}-500 rounded-full`} />
                                  {type.label}交流: {activeGrades.join(',')}年
                                </span>
                              );
                            })}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {s.isJointSubject && (
                              <div className="flex flex-col gap-1 w-full">
                                <span className="text-[7px] bg-amber-50 text-amber-600 border border-amber-200 px-1 py-0.5 rounded font-black flex items-center gap-0.5 w-fit">
                                  <span className="w-1 h-1 bg-amber-500 rounded-full" /> 合同授業対象
                                </span>
                                <div className="flex flex-col gap-0.5 ml-1">
                                  {[1, 2, 3].map(grade => {
                                    const groups = (s.jointClassGroups?.[grade] || []).filter(g => g.length >= 2);
                                    if (groups.length === 0) return null;
                                    return (
                                      <div key={grade} className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[7px] text-slate-400 font-bold">{grade}年:</span>
                                        {groups.map((group, idx) => {
                                          const labels = group.map(id => classes.find(c => c.id === id)?.label).filter(Boolean);
                                          return (
                                            <span key={idx} className="text-[7px] text-amber-500 font-bold bg-amber-50/50 px-1 border border-amber-100 rounded">
                                              {labels.join('&')}組
                                            </span>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {s.isMultiGrade && (
                              <div className="flex flex-col gap-1 w-full mt-1 border-t border-slate-50 pt-1">
                                <span className="text-[7px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1 py-0.5 rounded font-black flex items-center gap-0.5 w-fit">
                                  <span className="w-1 h-1 bg-indigo-500 rounded-full" /> 複式授業対象
                                </span>
                                <div className="flex flex-col gap-0.5 ml-1">
                                  {(s.multiGradeGroups || []).filter(g => g.length >= 2).map((group, idx) => {
                                    const names = group.map(id => {
                                      const c = classes.find(cc => cc.id === id);
                                      return c ? `${c.grade}-${c.label}` : null;
                                    }).filter(Boolean);
                                    return (
                                      <span key={idx} className="text-[7px] text-indigo-500 font-bold bg-indigo-50/50 px-1 border border-indigo-100 rounded w-fit">
                                        複式: {names.join(' & ')}組
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => setEditingId(s.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => { if (confirm(`${s.name}を削除しますか？`)) onDeleteSubject(s.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. クラス設定 */}
      {want("class") && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-500 rounded-full" />
            学級（クラス）マスター
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 h-fit">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">学年</label>
                  <input
                    type="number"
                    min={1} max={9}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
                    value={classGrade}
                    onChange={(e) => setClassGrade(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">クラス名</label>
                  <input
                    placeholder="1, A, 松"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
                    value={classLabel}
                    onChange={(e) => setClassLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">学級種別</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["normal", "special"] as const).map(t => (
                      <label key={t} className={`flex items-center justify-center p-2 rounded border cursor-pointer transition-colors ${classType === t ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-200'}`}>
                        <input type="radio" className="hidden" checked={classType === t} onChange={() => setClassType(t)} />
                        <span className={`text-[10px] font-bold ${classType === t ? 'text-brand-700' : 'text-slate-400'}`}>
                          {t === "normal" ? "通常" : "特別支援"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {classType === "special" && (
                  <div className="grid grid-cols-2 gap-2 mt-2 col-span-2 animate-in fade-in slide-in-from-top-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">支援種別</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { key: "intellectual", label: "知的" },
                          { key: "emotional", label: "自情" },
                          { key: "physical", label: "肢体" }
                        ].map(st => (
                          <label key={st.key} className={`flex items-center justify-center p-1.5 rounded border cursor-pointer transition-colors ${classSpecialType === st.key ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200'}`}>
                            <input type="radio" className="hidden" checked={classSpecialType === st.key} onChange={() => setClassSpecialType(st.key as any)} />
                            <span className={`text-[9px] font-bold ${classSpecialType === st.key ? 'text-indigo-700' : 'text-slate-400'}`}>
                              {st.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">交流学級</label>
                      <select
                        className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-brand-500"
                        value={classExchangeClassId}
                        onChange={(e) => setClassExchangeClassId(e.target.value)}
                      >
                        <option value="">設定なし</option>
                        {classes.filter(c => c.type !== "special" && c.grade === classGrade).map(c => (
                          <option key={c.id} value={c.id}>{c.grade}-{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (!classLabel.trim()) return;
                  onAddClass({
                    grade: classGrade,
                    label: classLabel.trim(),
                    type: classType,
                    specialType: classType === "special" ? classSpecialType : undefined,
                    exchangeClassId: classType === "special" ? classExchangeClassId : undefined
                  });
                  setClassLabel("");
                  setClassExchangeClassId("");
                }}
                className="w-full py-2 bg-brand-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-brand-600 transition-colors"
              >
                新規登録
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {classes.map((c) => (
                <div key={c.id} className="group flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition-all shadow-sm">
                  {editingId === c.id ? (
                    <div className="flex flex-col gap-2 w-full p-2 bg-slate-50 rounded border border-brand-100">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-10 rounded border border-brand-200 px-1 py-1 text-xs outline-none text-center bg-white"
                          defaultValue={c.grade}
                          onBlur={(e) => onUpdateClass(c.id, { grade: Number(e.target.value) })}
                        />
                        <span className="text-[10px] text-slate-400">年</span>
                        <input
                          className="w-12 rounded border border-brand-200 px-1 py-1 text-xs outline-none text-center bg-white"
                          defaultValue={c.label}
                          onBlur={(e) => onUpdateClass(c.id, { label: e.target.value })}
                        />
                        <span className="text-[10px] text-slate-400">組</span>
                        <button onClick={() => setEditingId(null)} className="ml-auto text-xs text-brand-500 font-bold">✓</button>
                      </div>
                      <div className="flex gap-1">
                        {(["normal", "special"] as const).map(t => (
                          <label key={t} className={`flex-1 flex items-center justify-center p-1 rounded border cursor-pointer transition-colors ${c.type === t ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}>
                            <input type="radio" className="hidden" checked={c.type === t} onChange={() => onUpdateClass(c.id, { type: t })} />
                            <span className={`text-[9px] font-bold ${c.type === t ? 'text-brand-700' : 'text-slate-400'}`}>{t === "normal" ? "通常" : "支援"}</span>
                          </label>
                        ))}
                      </div>
                      {c.type === "special" && (
                        <div className="space-y-1">
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { key: "intellectual", label: "知的" },
                              { key: "emotional", label: "自情" },
                              { key: "physical", label: "肢体" }
                            ].map(st => (
                              <label key={st.key} className={`flex items-center justify-center p-1 rounded border cursor-pointer transition-colors ${c.specialType === st.key ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100'}`}>
                                <input type="radio" className="hidden" checked={c.specialType === st.key} onChange={() => onUpdateClass(c.id, { specialType: st.key as any })} />
                                <span className={`text-[8px] font-bold ${c.specialType === st.key ? 'text-indigo-700' : 'text-slate-400'}`}>{st.label}</span>
                              </label>
                            ))}
                          </div>
                          <select
                            className="w-full text-[9px] p-1 border border-slate-200 rounded bg-white outline-none"
                            value={c.exchangeClassId || ""}
                            onChange={(e) => onUpdateClass(c.id, { exchangeClassId: e.target.value })}
                          >
                            <option value="">交流学級なし</option>
                            {classes.filter(oc => oc.type !== "special" && oc.grade === c.grade).map(oc => (
                              <option key={oc.id} value={oc.id}>{oc.grade}-{oc.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col flex-1 cursor-pointer" onClick={() => setEditingId(c.id)}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{c.grade}年{c.label}組</span>
                          {c.type === "special" && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black whitespace-nowrap flex-shrink-0">
                                {c.specialType === "intellectual" ? "知的" :
                                  c.specialType === "emotional" ? "自情" :
                                    c.specialType === "physical" ? "肢体" : "支援"}
                              </span>
                              {c.exchangeClassId && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex-shrink-0">
                                  交流: {classes.find(oc => oc.id === c.exchangeClassId)?.label}組
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditingId(c.id)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded">✏️</button>
                        <button
                          onClick={() => { if (confirm(`${c.grade}年${c.label}組を削除しますか？\n時間割データも消去されます。`)) onDeleteClass(c.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. 会議・共通枠 */}
      {want("meeting") && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-500 rounded-full" />
            会議・固定枠
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 h-fit">
              <input
                placeholder="名称 (例: 職員会議)"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
              />
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">曜日・時限の確保</label>
                <SlotPicker slot={meetingSlot} onChange={setMeetingSlot} />
                <button
                  type="button"
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold transition-colors"
                  onClick={() => appendSlot(meetingSlot, meetingSlots, setMeetingSlots)}
                >
                  コマを追加
                </button>
                <SlotList value={meetingSlots} onRemove={(s) => removeSlot(s, meetingSlots, setMeetingSlots)} />
              </div>
              <button
                onClick={() => {
                  if (!meetingName.trim() || meetingSlots.length === 0) return;
                  onAddMeeting({ name: meetingName.trim(), slots: meetingSlots });
                  setMeetingName(""); setMeetingSlots([]);
                }}
                className="w-full py-2 bg-brand-500 text-white rounded-md text-sm font-bold shadow-sm hover:bg-brand-600 transition-colors"
              >
                新規登録
              </button>
            </div>
            <div className="space-y-2">
              {meetings.map((m) => (
                <div key={m.id} className="group flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition-all shadow-sm">
                  {editingId === m.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <input
                        className="w-full rounded border border-brand-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        defaultValue={m.name}
                        onBlur={(e) => onUpdateMeeting(m.id, { name: e.target.value })}
                        autoFocus
                      />
                      <button onClick={() => setEditingId(null)} className="text-[10px] text-brand-500 font-bold self-end">完了</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col flex-1 cursor-pointer" onClick={() => setEditingId(m.id)}>
                        <span className="text-sm font-bold text-slate-700">{m.name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.slots.map(s => (
                            <span key={`${s.day}-${s.period}`} className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1 rounded">
                              {formatSlot(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setEditingId(m.id)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded">✏️</button>
                        <button
                          onClick={() => { if (confirm(`${m.name}を削除しますか？`)) onDeleteMeeting(m.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
