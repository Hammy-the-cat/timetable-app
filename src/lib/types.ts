export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

export interface DayConfig {
  key: Weekday;
  label: string;
  shortLabel: string;
  periods: number;
}

export interface WeeklySlot {
  day: Weekday;
  period: number;
}

export interface Subject {
  id: string;
  name: string;
  weeklyQuota: number;
  gradeQuotas?: Record<number, number>;
  specialGradeQuotas?: Record<number, number>;
  intellectualQuotas?: Record<number, number>;
  emotionalQuotas?: Record<number, number>;
  physicalQuotas?: Record<number, number>;
  intellectualExchange?: Record<number, boolean>;
  emotionalExchange?: Record<number, boolean>;
  physicalExchange?: Record<number, boolean>;
  specialGradeExchange?: Record<number, boolean>;
  isJointSubject?: boolean;
  jointClassGroups?: Record<number, string[][]>; // Grade -> Array of groups (each group is string[])
  isMultiGrade?: boolean; // 新たに追加：学年をまたぐ複式授業
  multiGradeGroups?: string[][]; // 学年を超えたグループ設定 [[classId1, classId2, ...], [...]]
  notes?: string;
}

export interface SubjectAssignment {
  subjectName: string;
  classIds: string[];
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  taughtGrades?: number[];
  assignedClassIds?: string[];
  subjectAssignments?: SubjectAssignment[]; // 教科ごとの担当クラス
  role?: "homeroom" | "assistant";
  homeroomClassIds?: string[];
  unavailable: WeeklySlot[];
  meetingIds?: string[]; // 参加する会議のID
}

export interface Classroom {
  id: string;
  name: string;
  type: "standard" | "special";
  notes?: string;
}

export interface Meeting {
  id: string;
  name: string;
  slots: WeeklySlot[];
  notes?: string;
}

export interface ClassGroup {
  id: string;
  grade: number;
  label: string; // e.g., "A", "B", "1"
  type?: "normal" | "special";
  specialType?: "intellectual" | "emotional" | "physical";
  exchangeClassId?: string;
  homeroomTeacherId?: string;
}

export interface ScheduleCell {
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
  note?: string;
}

export type DaySchedule = Record<number, ScheduleCell>;
export type WeekSchedule = Record<Weekday, DaySchedule>;
export type TimetableMap = Record<string, WeekSchedule>;

export interface TimetableData {
  version: string;
  classes: ClassGroup[];
  subjects: Subject[];
  teachers: Teacher[];
  classrooms: Classroom[];
  meetings: Meeting[];
  schedule: TimetableMap;
  lastUpdated: string;
}

export interface CellWarning {
  type:
  | "teacherUnavailable"
  | "teacherConflict"
  | "roomConflict"
  | "meetingBlock"
  | "subjectQuota";
  message: string;
}
