'use client';

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ClassGroup,
  Classroom,
  Meeting,
  ScheduleCell,
  Subject,
  Teacher,
  TimetableData,
  WeekSchedule,
  WeeklySlot,
} from "@/lib/types";
import { createEmptyWeek, createInitialData } from "@/lib/school";

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

  replaceData: (payload: TimetableData) => void;
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
      selectedClassId: "class-1a",
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
        set((state) => ({
          data: {
            ...state.data,
            subjects: state.data.subjects.map((s) =>
              s.id === id ? { ...s, ...patch } : s
            ),
            lastUpdated: now(),
          },
        })),
      deleteSubject: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            subjects: state.data.subjects.filter((s) => s.id !== id),
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
            [newClass.id]: createEmptyWeek(),
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
        set((state) => ({
          data: {
            ...state.data,
            classes: state.data.classes.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
            lastUpdated: now(),
          },
        })),
      deleteClass: (id) =>
        set((state) => {
          const { [id]: _, ...remainingSchedule } = state.data.schedule;
          const nextClasses = state.data.classes.filter((c) => c.id !== id);
          return {
            data: {
              ...state.data,
              classes: nextClasses,
              schedule: remainingSchedule,
              lastUpdated: now(),
            },
            selectedClassId:
              state.selectedClassId === id
                ? nextClasses[0]?.id ?? ""
                : state.selectedClassId,
          };
        }),
      replaceData: (payload) =>
        set(() => ({
          data: {
            ...payload,
            lastUpdated: now(),
          },
          selectedClassId: payload.classes[0]?.id ?? "",
        })),
      reset: () =>
        set(() => ({
          data: createInitialData(),
          selectedClassId: "class-1a",
        })),
    }),
    {
      name: "timetable-app-state",
      version: 1,
    }
  )
);
