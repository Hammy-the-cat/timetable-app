import {
  ClassGroup,
  Classroom,
  DayConfig,
  ExchangeLessonRule,
  JointLessonRule,
  Meeting,
  SchoolSettings,
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

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: "",
  yearLabel: "2026年度",
  schoolType: "juniorHigh",
  days: DAY_CONFIGS,
};

// 学校設定に基づく曜日構成を返す（設定が無い旧データはデフォルトにフォールバック）
export const getDays = (data: Pick<TimetableData, "settings">): DayConfig[] => {
  const days = data.settings?.days;
  return days && days.length > 0 ? days : DAY_CONFIGS;
};

export const DAY_MAP = Object.fromEntries(
  DAY_CONFIGS.map((day) => [day.key, day])
) as Record<Weekday, DayConfig>;

export const ALL_SLOTS: WeeklySlot[] = DAY_CONFIGS.flatMap((day) =>
  Array.from({ length: day.periods }, (_, period) => ({
    day: day.key,
    period: period + 1,
  }))
) as WeeklySlot[];

const cid = (grade: number, label: number) => `class-${grade}-${label}`;

const PE_JOINT_GROUPS: Record<number, string[][]> = {
  1: [[cid(1, 1), cid(1, 2)], [cid(1, 3), cid(1, 4)]],
  2: [[cid(2, 1), cid(2, 2)], [cid(2, 3), cid(2, 4)]],
  3: [[cid(3, 1), cid(3, 2)], [cid(3, 3), cid(3, 4)]],
};

const EXCHANGE_GRADES = { 1: true, 2: true, 3: true };

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "sub-japanese", name: "国語", weeklyQuota: 4 },
  { id: "sub-social", name: "社会", weeklyQuota: 3, emotionalExchange: EXCHANGE_GRADES },
  { id: "sub-math", name: "数学", weeklyQuota: 4 },
  { id: "sub-science", name: "理科", weeklyQuota: 3 },
  { id: "sub-english", name: "英語", weeklyQuota: 4 },
  { id: "sub-music", name: "音楽", weeklyQuota: 1.3, emotionalExchange: EXCHANGE_GRADES, intellectualExchange: EXCHANGE_GRADES },
  { id: "sub-art", name: "美術", weeklyQuota: 1.3, emotionalExchange: EXCHANGE_GRADES, intellectualExchange: EXCHANGE_GRADES },
  {
    id: "sub-pe",
    name: "保体",
    weeklyQuota: 3,
    isJointSubject: true,
    jointClassGroups: PE_JOINT_GROUPS,
    emotionalExchange: EXCHANGE_GRADES,
    intellectualExchange: EXCHANGE_GRADES,
  },
  { id: "sub-tech", name: "技術", weeklyQuota: 1, emotionalExchange: EXCHANGE_GRADES, intellectualExchange: EXCHANGE_GRADES },
  { id: "sub-home", name: "家庭", weeklyQuota: 1, emotionalExchange: EXCHANGE_GRADES, intellectualExchange: EXCHANGE_GRADES },
  { id: "sub-independent", name: "自立", weeklyQuota: 0, specialGradeQuotas: { 1: 1, 2: 1, 3: 1 } },
  { id: "sub-life", name: "生活", weeklyQuota: 0, intellectualQuotas: { 1: 1, 2: 1, 3: 1 } },
  { id: "sub-moral", name: "道徳", weeklyQuota: 1 },
  { id: "sub-integrated", name: "総合的な学習", weeklyQuota: 1.4 },
  { id: "sub-special", name: "学活", weeklyQuota: 1 },
];

const TEACHER_IDS: Record<string, string> = {
  "奥村": "teacher-okumura",
  "小川": "teacher-ogawa",
  "高橋": "teacher-takahashi",
  "奈須": "teacher-nasu",
  "安藤": "teacher-ando",
  "竹井": "teacher-takei",
  "城戸": "teacher-kido",
  "片野": "teacher-katano",
  "川崎（真）": "teacher-kawasaki-makoto",
  "榎本": "teacher-enomoto",
  "森": "teacher-mori",
  "矢野": "teacher-yano",
  "古川": "teacher-furukawa",
  "宮路": "teacher-miyaji",
  "坂元": "teacher-sakamoto",
  "小野": "teacher-ono",
  "馬渡": "teacher-mawatari",
  "谷口": "teacher-taniguchi",
  "河野": "teacher-kawano",
  "岩下": "teacher-iwashita",
  "池田": "teacher-ikeda",
  "柳衛": "teacher-yanagie",
  "吉野": "teacher-yoshino",
  "岸本": "teacher-kishimoto",
  "川崎（勇）": "teacher-kawasaki-isamu",
  "山下": "teacher-yamashita",
  "田中": "teacher-tanaka",
  "小田": "teacher-oda",
  "アルダリンク": "teacher-aldalink",
};

const TEACHER_NAMES = Object.keys(TEACHER_IDS);

const assignmentRows: Array<[number, number, Record<string, string>]> = [
  [1, 1, { 国語: "奥村", 社会: "小川", 数学: "高橋", 理科: "安藤", 英語: "竹井/城戸", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [1, 2, { 国語: "奥村", 社会: "小川", 数学: "奈須", 理科: "安藤", 英語: "竹井/城戸", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [1, 3, { 国語: "奥村", 社会: "小川", 数学: "奈須", 理科: "安藤", 英語: "竹井/城戸", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [1, 4, { 国語: "奥村", 社会: "小川", 数学: "高橋", 理科: "安藤", 英語: "竹井/城戸", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [1, 5, { 国語: "坂元", 数学: "奈須", 理科: "小野", 英語: "馬渡", 自立: "小野" }],
  [1, 6, { 国語: "宮路", 社会: "小野", 数学: "川崎（真）", 理科: "小野", 英語: "片野", 自立: "谷口", 生活: "谷口" }],
  [2, 1, { 国語: "坂元", 社会: "河野", 数学: "岩下/奈須", 理科: "池田", 英語: "柳衛", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [2, 2, { 国語: "坂元", 社会: "河野", 数学: "岩下/高橋", 理科: "池田", 英語: "柳衛", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [2, 3, { 国語: "坂元", 社会: "河野", 数学: "岩下/高橋", 理科: "池田", 英語: "柳衛", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [2, 4, { 国語: "坂元", 社会: "河野", 数学: "岩下/奈須", 理科: "池田", 英語: "柳衛", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [2, 5, { 国語: "坂元", 数学: "奈須", 理科: "小野", 英語: "馬渡", 自立: "小野" }],
  [2, 6, { 国語: "宮路", 社会: "小野", 数学: "川崎（真）", 理科: "小野", 英語: "片野", 自立: "谷口", 生活: "谷口" }],
  [3, 1, { 国語: "岸本", 社会: "川崎（勇）", 数学: "山下", 理科: "田中", 英語: "小田/馬渡", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [3, 2, { 国語: "岸本", 社会: "川崎（勇）", 数学: "山下", 理科: "田中", 英語: "小田/馬渡", 音楽: "片野", 美術: "川崎（真）", 保体: "榎本/森/矢野", 技術: "古川", 家庭: "宮路" }],
  [3, 3, { 国語: "岸本", 社会: "川崎（勇）", 数学: "山下", 理科: "田中", 英語: "小田/馬渡", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [3, 4, { 国語: "岸本", 社会: "川崎（勇）", 数学: "山下", 理科: "田中", 英語: "小田/馬渡", 音楽: "片野", 美術: "川崎（真）", 保体: "矢野/吉野", 技術: "古川", 家庭: "宮路" }],
  [3, 5, { 国語: "岸本", 数学: "山下", 理科: "小野", 英語: "アルダリンク", 自立: "小野" }],
  [3, 6, { 国語: "宮路", 社会: "小野", 数学: "川崎（真）", 理科: "小野", 英語: "片野", 自立: "谷口", 生活: "谷口" }],
];

const normalizeTeacherNames = (value: string) =>
  value.split("/").map((name) => name.trim()).filter(Boolean);

const teacherAssignments = TEACHER_NAMES.reduce((acc, name) => {
  acc[name] = new Map<string, Set<string>>();
  return acc;
}, {} as Record<string, Map<string, Set<string>>>);

assignmentRows.forEach(([grade, label, subjects]) => {
  Object.entries(subjects).forEach(([subjectName, teacherList]) => {
    normalizeTeacherNames(teacherList).forEach((teacherName) => {
      if (!teacherAssignments[teacherName]) {
        teacherAssignments[teacherName] = new Map<string, Set<string>>();
      }
      const bySubject = teacherAssignments[teacherName];
      if (!bySubject.has(subjectName)) bySubject.set(subjectName, new Set<string>());
      bySubject.get(subjectName)?.add(cid(grade, label));
    });
  });
});

export const DEFAULT_TEACHERS: Teacher[] = TEACHER_NAMES.map((name) => {
  const bySubject = teacherAssignments[name];
  const subjects = Array.from(bySubject.keys());
  return {
    id: TEACHER_IDS[name],
    name,
    subjects,
    subjectAssignments: subjects.map((subjectName) => ({
      subjectName,
      classIds: Array.from(bySubject.get(subjectName) ?? []),
    })),
    unavailable: [],
  };
});

export const DEFAULT_MEETINGS: Meeting[] = [
  {
    id: "meeting-staff",
    name: "職員会議",
    notes: "水曜5限は全員参加",
    slots: [{ day: "wed", period: 5 }],
  },
];

export const DEFAULT_CLASSES: ClassGroup[] = [
  ...[1, 2, 3].flatMap((grade) =>
    [
      ...[1, 2, 3, 4].map((label) => ({
        id: cid(grade, label),
        grade,
        label: String(label),
        type: "normal" as const,
      })),
      {
        id: cid(grade, 5),
        grade,
        label: "5",
        type: "special" as const,
        specialType: "emotional" as const,
        exchangeClassId: grade === 1 ? cid(1, 2) : grade === 2 ? cid(2, 1) : cid(3, 4),
      },
      {
        id: cid(grade, 6),
        grade,
        label: "6",
        type: "special" as const,
        specialType: "intellectual" as const,
        exchangeClassId: grade === 1 ? cid(1, 1) : grade === 2 ? cid(2, 2) : cid(3, 2),
      },
    ]
  ),
];

export const DEFAULT_CLASSROOMS: Classroom[] = [
  ...DEFAULT_CLASSES.map((cls) => ({
    id: `room-${cls.grade}-${cls.label}`,
    name: `${cls.grade}年${cls.label}組 教室`,
    type: cls.type === "special" ? "special" as const : "standard" as const,
  })),
  { id: "room-sci", name: "理科室", type: "special" },
  { id: "room-music", name: "音楽室", type: "special" },
  { id: "room-gym", name: "体育館", type: "special" },
];

export const getPeriodsForDay = (day: Weekday): number => DAY_MAP[day].periods;

const createDaySchedule = (periods: number) => {
  const result: Record<number, ScheduleCell> = {};
  for (let period = 1; period <= periods; period += 1) {
    result[period] = {};
  }
  return result;
};

export const createEmptyWeek = (days: DayConfig[] = DAY_CONFIGS): WeekSchedule => {
  return days.reduce(
    (acc, config) => ({
      ...acc,
      [config.key]: createDaySchedule(config.periods),
    }),
    {} as WeekSchedule
  );
};

// ================= 合同・交流ルールと既存表現の相互変換 =================

// Subject.jointClassGroups から JointLessonRule[] を導出する
export const deriveJointRules = (subjects: Subject[]): JointLessonRule[] => {
  const rules: JointLessonRule[] = [];
  subjects.forEach((sub) => {
    if (!sub.isJointSubject || !sub.jointClassGroups) return;
    Object.entries(sub.jointClassGroups).forEach(([gradeStr, groups]) => {
      const validGroups = groups.filter((g) => g.length >= 2);
      if (validGroups.length === 0) return;
      rules.push({
        id: `joint-${sub.id}-${gradeStr}`,
        subjectId: sub.id,
        grade: Number(gradeStr),
        classGroups: validGroups,
      });
    });
  });
  return rules;
};

// ClassGroup.exchangeClassId と Subject の交流フラグから ExchangeLessonRule[] を導出する
export const deriveExchangeRules = (
  classes: ClassGroup[],
  subjects: Subject[]
): ExchangeLessonRule[] => {
  return classes
    .filter((cls) => cls.type === "special" && cls.exchangeClassId)
    .map((cls) => {
      const subjectIds = subjects
        .filter((sub) => {
          if (cls.specialType === "intellectual" && sub.intellectualExchange?.[cls.grade]) return true;
          if (cls.specialType === "emotional" && sub.emotionalExchange?.[cls.grade]) return true;
          if (cls.specialType === "physical" && sub.physicalExchange?.[cls.grade]) return true;
          return !!sub.specialGradeExchange?.[cls.grade];
        })
        .map((sub) => sub.id);
      return {
        id: `exchange-${cls.id}`,
        specialClassId: cls.id,
        exchangeClassId: cls.exchangeClassId!,
        subjectIds,
      };
    });
};

// JointLessonRule[] / ExchangeLessonRule[] を、自動配置・検証が参照する
// 既存フィールド（Subject.jointClassGroups / ClassGroup.exchangeClassId / 交流フラグ）へ反映する
export const applyRulesToData = (data: TimetableData): TimetableData => {
  const jointBySubject = new Map<string, Record<number, string[][]>>();
  data.jointRules.forEach((rule) => {
    const entry = jointBySubject.get(rule.subjectId) ?? {};
    entry[rule.grade] = rule.classGroups;
    jointBySubject.set(rule.subjectId, entry);
  });

  const ruleBySpecialClass = new Map<string, ExchangeLessonRule>();
  data.exchangeRules.forEach((rule) => ruleBySpecialClass.set(rule.specialClassId, rule));

  const classes = data.classes.map((cls) => {
    if (cls.type !== "special") return cls;
    const rule = ruleBySpecialClass.get(cls.id);
    return { ...cls, exchangeClassId: rule?.exchangeClassId || undefined };
  });

  const subjects = data.subjects.map((sub) => {
    const intellectualExchange: Record<number, boolean> = {};
    const emotionalExchange: Record<number, boolean> = {};
    const physicalExchange: Record<number, boolean> = {};

    data.exchangeRules.forEach((rule) => {
      if (!rule.subjectIds.includes(sub.id)) return;
      const cls = classes.find((c) => c.id === rule.specialClassId);
      if (!cls) return;
      if (cls.specialType === "intellectual") intellectualExchange[cls.grade] = true;
      else if (cls.specialType === "physical") physicalExchange[cls.grade] = true;
      else emotionalExchange[cls.grade] = true;
    });

    const jointGroups = jointBySubject.get(sub.id);
    return {
      ...sub,
      isJointSubject: !!jointGroups,
      jointClassGroups: jointGroups,
      intellectualExchange: Object.keys(intellectualExchange).length ? intellectualExchange : undefined,
      emotionalExchange: Object.keys(emotionalExchange).length ? emotionalExchange : undefined,
      physicalExchange: Object.keys(physicalExchange).length ? physicalExchange : undefined,
      specialGradeExchange: undefined,
    };
  });

  return { ...data, classes, subjects };
};

// 曜日構成の変更に合わせてスケジュールを組み替える（範囲内のコマは保持する）
export const reshapeSchedule = (
  schedule: TimetableData["schedule"],
  classes: ClassGroup[],
  days: DayConfig[]
): TimetableData["schedule"] => {
  const next: TimetableData["schedule"] = {};
  classes.forEach((cls) => {
    const prevWeek = schedule[cls.id];
    const week = createEmptyWeek(days);
    if (prevWeek) {
      days.forEach((day) => {
        for (let period = 1; period <= day.periods; period += 1) {
          const cell = prevWeek[day.key]?.[period];
          if (cell && Object.keys(cell).length > 0) {
            week[day.key][period] = cell;
          }
        }
      });
    }
    next[cls.id] = week;
  });
  return next;
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
    version: "2026-assignment-v1",
    settings: DEFAULT_SCHOOL_SETTINGS,
    classes: DEFAULT_CLASSES,
    subjects: DEFAULT_SUBJECTS,
    teachers: DEFAULT_TEACHERS,
    classrooms: DEFAULT_CLASSROOMS,
    meetings: DEFAULT_MEETINGS,
    jointRules: deriveJointRules(DEFAULT_SUBJECTS),
    exchangeRules: deriveExchangeRules(DEFAULT_CLASSES, DEFAULT_SUBJECTS),
    schedule,
    setupCompleted: false,
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
    体育: [3, 3, 3],
    保体: [3, 3, 3],
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
