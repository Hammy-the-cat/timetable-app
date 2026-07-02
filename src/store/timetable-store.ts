'use client';

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ClassGroup,
  Classroom,
  ExchangeLessonRule,
  JointLessonRule,
  Meeting,
  ScheduleCell,
  SchoolSettings,
  Subject,
  Teacher,
  TimetableData,
  WeekSchedule,
  WeeklySlot,
} from "@/lib/types";
import {
  applyRulesToData,
  createEmptyWeek,
  createInitialData,
  deriveExchangeRules,
  deriveJointRules,
  getDays,
  DEFAULT_SCHOOL_SETTINGS,
  reshapeSchedule,
} from "@/lib/school";
import {
  DEFAULT_GENERATION_OPTIONS,
  GenerationOptions,
  GenerationReport,
  generateAutoTimetable,
} from "@/lib/auto-generator";

type NewEntity<T> = Omit<T, "id"> & { id?: string };

export interface TimetableStore {
  data: TimetableData;
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  updateCell: (classId: string, slot: WeeklySlot, patch: ScheduleCell) => void;
  clearCell: (classId: string, slot: WeeklySlot) => void;

  // Teachers
  addTeacher: (teacher: NewEntity<Teacher>) => void;
  updateTeacher: (id: string, patch: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  // Classrooms
  addClassroom: (room: NewEntity<Classroom>) => void;
  updateClassroom: (id: string, patch: Partial<Classroom>) => void;
  deleteClassroom: (id: string) => void;

  // Subjects
  addSubject: (subject: NewEntity<Subject>) => void;
  updateSubject: (id: string, patch: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;

  // Meetings
  addMeeting: (meeting: NewEntity<Meeting>) => void;
  updateMeeting: (id: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;

  // Classes
  addClass: (classGroup: NewEntity<ClassGroup>) => void;
  updateClass: (id: string, patch: Partial<ClassGroup>) => void;
  deleteClass: (id: string) => void;

  // School settings / Joint & Exchange rules
  updateSettings: (patch: Partial<SchoolSettings>) => void;
  setJointRules: (rules: JointLessonRule[]) => void;
  setExchangeRules: (rules: ExchangeLessonRule[]) => void;
  applySetup: (payload: {
    settings: SchoolSettings;
    classes: ClassGroup[];
    subjects: Subject[];
    teachers: Teacher[];
    jointRules: JointLessonRule[];
    exchangeRules: ExchangeLessonRule[];
  }) => void;

  replaceData: (payload: TimetableData) => void;

  // Excel取り込み（授業担当）・年度コピー
  applyAssignmentImport: (
    entries: { classId: string; subjectName: string; teacherNames: string[] }[]
  ) => void;
  copyToNewYear: (opts: {
    yearLabel: string;
    clearUnavailable: boolean;
    clearMeetings: boolean;
  }) => void;

  // 空きコマ自動配置
  generationOptions: GenerationOptions;
  setGenerationOptions: (patch: Partial<GenerationOptions>) => void;
  lastReport: GenerationReport | null;
  clearReport: () => void;
  autoGenerate: () => void;

  clearSchedule: () => void;
  reset: () => void;
}

const now = () => new Date().toISOString();

const ensureWeek = (
  schedule: TimetableData["schedule"],
  classId: string
): WeekSchedule => {
  return schedule[classId] ?? createEmptyWeek();
};

const withId = <T extends { id: string }>(
  entity: NewEntity<T>,
  prefix: string
): T => {
  const id =
    entity.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  return { ...entity, id } as T;
};

export const useTimetableStore = create<TimetableStore>()(
  persist(
    (set) => ({
      data: createInitialData(),
      selectedClassId: "class-1-1",
      setSelectedClassId: (classId) => set({ selectedClassId: classId }),
      updateCell: (classId, slot, patch) =>
        set((state) => {
          const prevWeek = ensureWeek(state.data.schedule, classId);
          const nextWeek: WeekSchedule = {
            ...prevWeek,
            [slot.day]: {
              ...prevWeek[slot.day],
              [slot.period]: {
                ...prevWeek[slot.day]?.[slot.period],
                ...patch,
              },
            },
          };

          return {
            data: {
              ...state.data,
              schedule: {
                ...state.data.schedule,
                [classId]: nextWeek,
              },
              lastUpdated: now(),
            },
          };
        }),
      clearCell: (classId, slot) =>
        set((state) => {
          const prevWeek = ensureWeek(state.data.schedule, classId);
          const nextWeek: WeekSchedule = {
            ...prevWeek,
            [slot.day]: {
              ...prevWeek[slot.day],
              [slot.period]: {},
            },
          };
          return {
            data: {
              ...state.data,
              schedule: {
                ...state.data.schedule,
                [classId]: nextWeek,
              },
              lastUpdated: now(),
            },
          };
        }),
      addTeacher: (teacher) =>
        set((state) => ({
          data: {
            ...state.data,
            teachers: [...state.data.teachers, withId(teacher, "teacher")],
            lastUpdated: now(),
          },
        })),
      updateTeacher: (id, patch) =>
        set((state) => ({
          data: {
            ...state.data,
            teachers: state.data.teachers.map((t) =>
              t.id === id ? { ...t, ...patch } : t
            ),
            lastUpdated: now(),
          },
        })),
      deleteTeacher: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            teachers: state.data.teachers.filter((t) => t.id !== id),
            lastUpdated: now(),
          },
        })),
      addClassroom: (room) =>
        set((state) => ({
          data: {
            ...state.data,
            classrooms: [...state.data.classrooms, withId(room, "room")],
            lastUpdated: now(),
          },
        })),
      updateClassroom: (id, patch) =>
        set((state) => ({
          data: {
            ...state.data,
            classrooms: state.data.classrooms.map((r) =>
              r.id === id ? { ...r, ...patch } : r
            ),
            lastUpdated: now(),
          },
        })),
      deleteClassroom: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            classrooms: state.data.classrooms.filter((r) => r.id !== id),
            lastUpdated: now(),
          },
        })),
      addSubject: (subject) =>
        set((state) => ({
          data: {
            ...state.data,
            subjects: [...state.data.subjects, withId(subject, "subject")],
            lastUpdated: now(),
          },
        })),
      updateSubject: (id, patch) =>
        set((state) => {
          const subjects = state.data.subjects.map((s) =>
            s.id === id ? { ...s, ...patch } : s
          );
          // 旧形式の合同・交流フィールドを直接編集した場合はルールにも反映して同期を保つ
          const touchesJoint = "jointClassGroups" in patch || "isJointSubject" in patch;
          const touchesExchange =
            "intellectualExchange" in patch ||
            "emotionalExchange" in patch ||
            "physicalExchange" in patch ||
            "specialGradeExchange" in patch;
          return {
            data: {
              ...state.data,
              subjects,
              jointRules: touchesJoint ? deriveJointRules(subjects) : state.data.jointRules,
              exchangeRules: touchesExchange
                ? deriveExchangeRules(state.data.classes, subjects)
                : state.data.exchangeRules,
              lastUpdated: now(),
            },
          };
        }),
      deleteSubject: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            subjects: state.data.subjects.filter((s) => s.id !== id),
            jointRules: state.data.jointRules.filter((r) => r.subjectId !== id),
            exchangeRules: state.data.exchangeRules.map((r) => ({
              ...r,
              subjectIds: r.subjectIds.filter((sid) => sid !== id),
            })),
            lastUpdated: now(),
          },
        })),
      addMeeting: (meeting) =>
        set((state) => ({
          data: {
            ...state.data,
            meetings: [...state.data.meetings, withId(meeting, "meeting")],
            lastUpdated: now(),
          },
        })),
      updateMeeting: (id, patch) =>
        set((state) => ({
          data: {
            ...state.data,
            meetings: state.data.meetings.map((m) =>
              m.id === id ? { ...m, ...patch } : m
            ),
            lastUpdated: now(),
          },
        })),
      deleteMeeting: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            meetings: state.data.meetings.filter((m) => m.id !== id),
            lastUpdated: now(),
          },
        })),
      addClass: (classGroup) =>
        set((state) => {
          const newClass = withId(classGroup, "class");
          const schedule = {
            ...state.data.schedule,
            [newClass.id]: createEmptyWeek(getDays(state.data)),
          };
          return {
            data: {
              ...state.data,
              classes: [...state.data.classes, newClass],
              schedule,
              lastUpdated: now(),
            },
            selectedClassId: newClass.id,
          };
        }),
      updateClass: (id, patch) =>
        set((state) => {
          const classes = state.data.classes.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          );
          // 旧形式の交流先を直接編集した場合はルール側にも反映して同期を保つ
          const exchangeRules =
            "exchangeClassId" in patch
              ? deriveExchangeRules(classes, state.data.subjects).map((derived) => {
                  const existing = state.data.exchangeRules.find(
                    (r) => r.specialClassId === derived.specialClassId
                  );
                  return existing
                    ? { ...existing, exchangeClassId: derived.exchangeClassId }
                    : derived;
                })
              : state.data.exchangeRules;
          return {
            data: {
              ...state.data,
              classes,
              exchangeRules,
              lastUpdated: now(),
            },
          };
        }),
      deleteClass: (id) =>
        set((state) => {
          const { [id]: _, ...remainingSchedule } = state.data.schedule;
          const nextClasses = state.data.classes.filter((c) => c.id !== id);
          return {
            data: {
              ...state.data,
              classes: nextClasses,
              schedule: remainingSchedule,
              jointRules: state.data.jointRules
                .map((r) => ({
                  ...r,
                  classGroups: r.classGroups
                    .map((g) => g.filter((cid) => cid !== id))
                    .filter((g) => g.length >= 2),
                }))
                .filter((r) => r.classGroups.length > 0),
              exchangeRules: state.data.exchangeRules.filter(
                (r) => r.specialClassId !== id && r.exchangeClassId !== id
              ),
              lastUpdated: now(),
            },
            selectedClassId:
              state.selectedClassId === id
                ? nextClasses[0]?.id ?? ""
                : state.selectedClassId,
          };
        }),
      updateSettings: (patch) =>
        set((state) => {
          const settings = { ...state.data.settings, ...patch };
          const daysChanged = "days" in patch;
          return {
            data: {
              ...state.data,
              settings,
              schedule: daysChanged
                ? reshapeSchedule(state.data.schedule, state.data.classes, settings.days)
                : state.data.schedule,
              lastUpdated: now(),
            },
          };
        }),
      setJointRules: (rules) =>
        set((state) => ({
          data: applyRulesToData({
            ...state.data,
            jointRules: rules,
            lastUpdated: now(),
          }),
        })),
      setExchangeRules: (rules) =>
        set((state) => ({
          data: applyRulesToData({
            ...state.data,
            exchangeRules: rules,
            lastUpdated: now(),
          }),
        })),
      applySetup: (payload) =>
        set((state) => {
          const schedule = reshapeSchedule(
            state.data.schedule,
            payload.classes,
            payload.settings.days
          );
          const data = applyRulesToData({
            ...state.data,
            settings: payload.settings,
            classes: payload.classes,
            subjects: payload.subjects,
            teachers: payload.teachers,
            jointRules: payload.jointRules,
            exchangeRules: payload.exchangeRules,
            schedule,
            setupCompleted: true,
            lastUpdated: now(),
          });
          const selectedStillExists = payload.classes.some(
            (c) => c.id === state.selectedClassId
          );
          return {
            data,
            selectedClassId: selectedStillExists
              ? state.selectedClassId
              : payload.classes[0]?.id ?? "",
          };
        }),
      replaceData: (payload) =>
        set(() => ({
          // 旧バージョンのJSON（settings・ルール未保持）も補完して受け入れる
          data: {
            ...payload,
            settings: payload.settings ?? DEFAULT_SCHOOL_SETTINGS,
            jointRules: payload.jointRules ?? deriveJointRules(payload.subjects ?? []),
            exchangeRules:
              payload.exchangeRules ??
              deriveExchangeRules(payload.classes ?? [], payload.subjects ?? []),
            setupCompleted: payload.setupCompleted ?? true,
            lastUpdated: now(),
          },
          selectedClassId: payload.classes[0]?.id ?? "",
        })),
      applyAssignmentImport: (entries) =>
        set((state) => {
          const teachers: Teacher[] = state.data.teachers.map((t) => ({
            ...t,
            subjects: [...t.subjects],
            subjectAssignments: (t.subjectAssignments ?? []).map((a) => ({
              subjectName: a.subjectName,
              classIds: [...a.classIds],
            })),
          }));

          const findOrCreate = (name: string): Teacher => {
            let teacher = teachers.find((t) => t.name === name);
            if (!teacher) {
              teacher = withId<Teacher>(
                { name, subjects: [], subjectAssignments: [], unavailable: [] },
                "teacher"
              );
              teachers.push(teacher);
            }
            return teacher;
          };

          // 取り込み対象の（教科×学級）については、既存の担当割当をいったん外して置き換える
          entries.forEach(({ classId, subjectName }) => {
            teachers.forEach((t) => {
              const assignment = t.subjectAssignments?.find(
                (a) => a.subjectName === subjectName
              );
              if (assignment) {
                assignment.classIds = assignment.classIds.filter((id) => id !== classId);
              }
            });
          });

          entries.forEach(({ classId, subjectName, teacherNames }) => {
            teacherNames.forEach((name) => {
              const teacher = findOrCreate(name);
              if (!teacher.subjects.includes(subjectName)) {
                teacher.subjects.push(subjectName);
              }
              let assignment = teacher.subjectAssignments!.find(
                (a) => a.subjectName === subjectName
              );
              if (!assignment) {
                assignment = { subjectName, classIds: [] };
                teacher.subjectAssignments!.push(assignment);
              }
              if (!assignment.classIds.includes(classId)) {
                assignment.classIds.push(classId);
              }
            });
          });

          teachers.forEach((t) => {
            t.subjectAssignments = (t.subjectAssignments ?? []).filter(
              (a) => a.classIds.length > 0
            );
          });

          return {
            data: { ...state.data, teachers, lastUpdated: now() },
          };
        }),
      copyToNewYear: (opts) =>
        set((state) => {
          const days = getDays(state.data);
          const schedule: TimetableData["schedule"] = {};
          state.data.classes.forEach((cls) => {
            schedule[cls.id] = createEmptyWeek(days);
          });
          return {
            data: {
              ...state.data,
              settings: { ...state.data.settings, yearLabel: opts.yearLabel },
              teachers: opts.clearUnavailable
                ? state.data.teachers.map((t) => ({ ...t, unavailable: [] }))
                : state.data.teachers,
              meetings: opts.clearMeetings ? [] : state.data.meetings,
              schedule,
              lastUpdated: now(),
            },
            lastReport: null,
          };
        }),
      generationOptions: DEFAULT_GENERATION_OPTIONS,
      setGenerationOptions: (patch) =>
        set((state) => ({
          generationOptions: { ...state.generationOptions, ...patch },
        })),
      lastReport: null,
      clearReport: () => set({ lastReport: null }),
      autoGenerate: () =>
        set((state) => {
          const { data, report } = generateAutoTimetable(
            state.data,
            state.generationOptions
          );
          return { data, lastReport: report };
        }),
      clearSchedule: () =>
        set((state) => {
          const emptySchedule: Record<string, any> = {};
          state.data.classes.forEach((cls) => {
            emptySchedule[cls.id] = createEmptyWeek(getDays(state.data));
          });
          return {
            data: {
              ...state.data,
              schedule: emptySchedule,
              lastUpdated: now(),
            },
          };
        }),
      reset: () =>
        set(() => ({
          data: createInitialData(),
          selectedClassId: "class-1-1",
        })),
    }),
    {
      name: "timetable-app-state",
      version: 6,
      migrate: (persistedState: any, version: number) => {
        if (version === 5 && persistedState?.data) {
          // v5 → v6: SchoolSettings と合同・交流ルールを既存データから導出して追加
          const data = persistedState.data;
          return {
            ...persistedState,
            data: {
              ...data,
              settings: data.settings ?? DEFAULT_SCHOOL_SETTINGS,
              jointRules: data.jointRules ?? deriveJointRules(data.subjects ?? []),
              exchangeRules:
                data.exchangeRules ??
                deriveExchangeRules(data.classes ?? [], data.subjects ?? []),
              setupCompleted: data.setupCompleted ?? true,
            },
          };
        }
        if (version < 5) {
          return {
            ...persistedState,
            data: createInitialData(),
            selectedClassId: "class-1-1",
          };
        }
        if (version === 1) {
          const state = persistedState as TimetableStore;
          if (!state.data) return persistedState;

          const subjects = [...state.data.subjects];
          const teachers = [...state.data.teachers];

          // 1. 保健体育 -> 体育
          subjects.forEach(s => {
            if (s.name === "保健体育") s.name = "体育";
          });
          teachers.forEach(t => {
            t.subjects = t.subjects.map(s => s === "保健体育" ? "体育" : s);
          });

          // 2. 技術・家庭 -> 技術 & 家庭
          const techHomeIdx = subjects.findIndex(s => s.name === "技術・家庭" || s.name === "技術家庭");
          if (techHomeIdx !== -1) {
            const oldSubject = subjects[techHomeIdx];
            const techId = "sub-tech";
            const homeId = "sub-home";

            // Rename old to Tech
            oldSubject.name = "技術";
            oldSubject.id = techId;

            // Add new Home
            const newHome: Subject = {
              ...oldSubject,
              id: homeId,
              name: "家庭",
              weeklyQuota: 1, // Defaulting if possible
            };
            subjects.push(newHome);

            // Update Teachers
            teachers.forEach(t => {
              if (t.subjects.includes("技術・家庭") || t.subjects.includes("技術家庭")) {
                t.subjects = t.subjects.filter(s => s !== "技術・家庭" && s !== "技術家庭");
                t.subjects.push("技術", "家庭");
              }
            });
          }

          state.data.subjects = subjects;
          state.data.teachers = teachers;
          return state;
        }
        return persistedState;
      }
    }
  )
);
