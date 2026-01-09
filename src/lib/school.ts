import {
  ClassGroup,
  Classroom,
  DayConfig,
  Meeting,
  Subject,
  Teacher,
  TimetableData,
  ScheduleCell,
  WeekSchedule,
  Weekday,
  WeeklySlot,
} from "./types";

export const DAY_CONFIGS: DayConfig[] = [
  { key: "mon", label: "月曜日", shortLabel: "月", periods: 6 },
  { key: "tue", label: "火曜日", shortLabel: "火", periods: 6 },
  { key: "wed", label: "水曜日", shortLabel: "水", periods: 5 },
  { key: "thu", label: "木曜日", shortLabel: "木", periods: 6 },
  { key: "fri", label: "金曜日", shortLabel: "金", periods: 6 },
];

export const DAY_MAP = Object.fromEntries(
  DAY_CONFIGS.map((day) => [day.key, day])
) as Record<Weekday, DayConfig>;

export const ALL_SLOTS: WeeklySlot[] = DAY_CONFIGS.flatMap((day) =>
  Array.from({ length: day.periods }, (_, period) => ({
    day: day.key,
    period: period + 1,
  }))
) as WeeklySlot[];

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "sub-japanese", name: "国語", weeklyQuota: 4 },
  { id: "sub-math", name: "数学", weeklyQuota: 4 },
  { id: "sub-english", name: "英語", weeklyQuota: 4 },
  { id: "sub-science", name: "理科", weeklyQuota: 3 },
  { id: "sub-social", name: "社会", weeklyQuota: 3 },
  { id: "sub-music", name: "音楽", weeklyQuota: 1.3 },
  { id: "sub-art", name: "美術", weeklyQuota: 1.3 },
  { id: "sub-pe", name: "保健体育", weeklyQuota: 3 },
  { id: "sub-tech", name: "技術", weeklyQuota: 1 },
  { id: "sub-home", name: "家庭", weeklyQuota: 1 },
  { id: "sub-moral", name: "道徳", weeklyQuota: 1 },
  { id: "sub-integrated", name: "総合的な学習", weeklyQuota: 1.4 },
  { id: "sub-special", name: "特別活動", weeklyQuota: 1 },
];

export const DEFAULT_TEACHERS: Teacher[] = [
  {
    id: "teacher-yamada",
    name: "山田",
    subjects: ["国語"],
    unavailable: [{ day: "wed", period: 5 }],
  },
  {
    id: "teacher-suzuki",
    name: "鈴木",
    subjects: ["数学"],
    unavailable: [],
  },
  {
    id: "teacher-takahashi",
    name: "高橋",
    subjects: ["英語"],
    unavailable: [{ day: "fri", period: 6 }],
  },
  {
    id: "teacher-tanaka",
    name: "田中",
    subjects: ["理科"],
    unavailable: [],
  },
  {
    id: "teacher-watanabe",
    name: "渡辺",
    subjects: ["社会"],
    unavailable: [],
  },
  {
    id: "teacher-saito",
    name: "斎藤",
    subjects: ["体育"],
    unavailable: [],
  },
];

export const DEFAULT_CLASSROOMS: Classroom[] = [
  { id: "room-1a", name: "1年A組 教室", type: "standard" },
  { id: "room-1b", name: "1年B組 教室", type: "standard" },
  { id: "room-sci", name: "理科室", type: "special" },
  { id: "room-music", name: "音楽室", type: "special" },
  { id: "room-gym", name: "体育館", type: "special" },
];

export const DEFAULT_MEETINGS: Meeting[] = [
  {
    id: "meeting-staff",
    name: "職員会議",
    notes: "水曜5限は全員参加",
    slots: [{ day: "wed", period: 5 }],
  },
];

export const DEFAULT_CLASSES: ClassGroup[] = [
  { id: "class-1a", grade: 1, label: "A", homeroomTeacherId: "teacher-yamada" },
  { id: "class-1b", grade: 1, label: "B", homeroomTeacherId: "teacher-suzuki" },
];

export const getPeriodsForDay = (day: Weekday): number => DAY_MAP[day].periods;

const createDaySchedule = (day: Weekday) => {
  const result: Record<number, ScheduleCell> = {};
  for (let period = 1; period <= getPeriodsForDay(day); period += 1) {
    result[period] = {};
  }
  return result;
};

export const createEmptyWeek = (): WeekSchedule => {
  return DAY_CONFIGS.reduce(
    (acc, config) => ({
      ...acc,
      [config.key]: createDaySchedule(config.key),
    }),
    {} as WeekSchedule
  );
};

export const createInitialData = (): TimetableData => {
  const schedule = DEFAULT_CLASSES.reduce(
    (acc, classGroup) => ({
      ...acc,
      [classGroup.id]: createEmptyWeek(),
    }),
    {}
  );

  return {
    version: "0.1.0",
    classes: DEFAULT_CLASSES,
    subjects: DEFAULT_SUBJECTS,
    teachers: DEFAULT_TEACHERS,
    classrooms: DEFAULT_CLASSROOMS,
    meetings: DEFAULT_MEETINGS,
    schedule,
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * 中学校学習指導要領に基づき、年間35週として算出した標準的な週当たり時数を取得
 */
/**
 * 指定した学年における教科の「有効な時数」を取得します。
 * 1. 教科個別の設定 (gradeQuotas / specialGradeQuotas)
 * 2. 指導要領の標準 (STATUTORY_MASTER)
 * 3. 基本時数 (weeklyQuota)
 * の順に優先されます。
 */
export const getEffectiveQuota = (
  subject: Subject,
  grade: number,
  type: "normal" | "special" = "normal",
  specialType?: "intellectual" | "emotional" | "physical"
): number => {
  // 1. 個別設定がある場合
  if (type === "special") {
    // A. 支援種別ごとの設定 (知的/自情/肢体)
    if (specialType === "intellectual" && subject.intellectualQuotas?.[grade] !== undefined) return subject.intellectualQuotas[grade];
    if (specialType === "emotional" && subject.emotionalQuotas?.[grade] !== undefined) return subject.emotionalQuotas[grade];
    if (specialType === "physical" && subject.physicalQuotas?.[grade] !== undefined) return subject.physicalQuotas[grade];

    // B. 特別支援共通の設定
    if (subject.specialGradeQuotas && subject.specialGradeQuotas[grade] !== undefined) {
      return subject.specialGradeQuotas[grade];
    }
  }

  // 通常学級の設定
  if (subject.gradeQuotas && subject.gradeQuotas[grade] !== undefined) {
    return subject.gradeQuotas[grade];
  }

  // 2. 指導要領マスター
  const STATUTORY_MASTER: Record<string, number[]> = {
    国語: [4, 4, 3],
    社会: [3, 3, 4],
    数学: [4, 3, 4],
    理科: [3, 4, 4],
    音楽: [1.3, 1, 1],
    美術: [1.3, 1, 1],
    保健体育: [3, 3, 3],
    技術: [1, 1, 0.5],
    家庭: [1, 1, 0.5],
    英語: [4, 4, 4],
    道徳: [1, 1, 1],
    総合的な学習: [1.4, 2, 2],
    特別活動: [1, 1, 1],
  };

  const statutory = STATUTORY_MASTER[subject.name];
  if (statutory) {
    return statutory[grade - 1] ?? statutory[0];
  }

  // 3. 基本設定
  return subject.weeklyQuota;
};

export const formatSlot = (slot: WeeklySlot): string => {
  const day = DAY_MAP[slot.day];
  return `${day.shortLabel}${slot.period}限`;
};
