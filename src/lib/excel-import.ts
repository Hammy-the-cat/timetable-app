import { ClassGroup, Subject } from "./types";

/**
 * Excel取り込み（授業担当確認表）の解析ヘルパー。
 *
 * 完全自動にはせず、
 *   1. 表をグリッド（文字列の2次元配列）として読み込む
 *   2. ヘッダー行・学級列を推定する（ユーザーが修正できる）
 *   3. プレビューを作り、ユーザーが確認してから反映する
 * という補助機能として動く。
 */

// 全角数字・全角ハイフンなどを正規化
const normalize = (text: string): string =>
  text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/** "1-1" "1年1組" "１－１" などを {grade, label} に解釈する */
export const parseClassRef = (raw: string): { grade: number; label: string } | null => {
  const text = normalize(raw);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\s*[-年]\s*(\d{1,2})\s*組?$/);
  if (!match) return null;
  return { grade: Number(match[1]), label: String(Number(match[2])) };
};

/** セル内の教員名を分割（"竹井/城戸" "榎本・森・矢野" など） */
export const splitTeacherNames = (raw: string): string[] =>
  raw
    .split(/[\/／・,、;；\n]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name !== "-" && name !== "－");

export interface DetectedLayout {
  headerRow: number; // 0始まり
  classCol: number; // 0始まり
  subjectCols: { col: number; name: string }[];
}

/** ヘッダー行（教科名が並ぶ行）と学級列を推定する */
export const detectLayout = (
  grid: string[][],
  subjects: Subject[]
): DetectedLayout | null => {
  const subjectNames = new Set(subjects.map((s) => s.name));
  let best: DetectedLayout | null = null;
  let bestScore = 0;

  const scanRows = Math.min(grid.length, 30);
  for (let r = 0; r < scanRows; r += 1) {
    const row = grid[r] ?? [];
    const subjectCols = row
      .map((value, col) => ({ col, name: normalize(value ?? "") }))
      .filter((entry) => subjectNames.has(entry.name));
    if (subjectCols.length < 2) continue;

    // この行より下で「学級らしき値」が最も多い列を探す
    let classCol = -1;
    let classHits = 0;
    const colCount = Math.max(...grid.map((g) => g.length));
    for (let c = 0; c < colCount; c += 1) {
      let hits = 0;
      for (let rr = r + 1; rr < grid.length; rr += 1) {
        if (parseClassRef(grid[rr]?.[c] ?? "")) hits += 1;
      }
      if (hits > classHits) {
        classHits = hits;
        classCol = c;
      }
    }
    if (classCol < 0 || classHits === 0) continue;

    const score = subjectCols.length * 10 + classHits;
    if (score > bestScore) {
      bestScore = score;
      best = { headerRow: r, classCol, subjectCols };
    }
  }
  return best;
};

export interface ImportAssignmentEntry {
  classId: string;
  classLabel: string;
  subjectName: string;
  teacherNames: string[];
}

export interface AssignmentImportPreview {
  entries: ImportAssignmentEntry[];
  matchedClassCount: number;
  unmatchedClassRefs: string[];
  teacherNames: string[];
  newTeacherNames: string[];
  subjectNames: string[];
}

/** レイアウト確定後、担当割当を抽出してプレビューを作る */
export const buildAssignmentPreview = (
  grid: string[][],
  layout: DetectedLayout,
  classes: ClassGroup[],
  existingTeacherNames: string[]
): AssignmentImportPreview => {
  const entries: ImportAssignmentEntry[] = [];
  const unmatchedClassRefs: string[] = [];
  const matchedClassIds = new Set<string>();
  const teacherSet = new Set<string>();

  for (let r = layout.headerRow + 1; r < grid.length; r += 1) {
    const rawRef = grid[r]?.[layout.classCol] ?? "";
    const ref = parseClassRef(rawRef);
    if (!ref) continue;
    const cls = classes.find(
      (c) => c.grade === ref.grade && String(Number(c.label)) === ref.label
    ) ?? classes.find((c) => c.grade === ref.grade && c.label === ref.label);
    if (!cls) {
      if (normalize(rawRef)) unmatchedClassRefs.push(normalize(rawRef));
      continue;
    }
    matchedClassIds.add(cls.id);
    layout.subjectCols.forEach(({ col, name }) => {
      const teacherNames = splitTeacherNames(grid[r]?.[col] ?? "");
      if (teacherNames.length === 0) return;
      teacherNames.forEach((n) => teacherSet.add(n));
      entries.push({
        classId: cls.id,
        classLabel: `${cls.grade}年${cls.label}組`,
        subjectName: name,
        teacherNames,
      });
    });
  }

  const existing = new Set(existingTeacherNames);
  const teacherNames = Array.from(teacherSet).sort((a, b) => a.localeCompare(b, "ja"));
  return {
    entries,
    matchedClassCount: matchedClassIds.size,
    unmatchedClassRefs: Array.from(new Set(unmatchedClassRefs)),
    teacherNames,
    newTeacherNames: teacherNames.filter((n) => !existing.has(n)),
    subjectNames: layout.subjectCols.map((s) => s.name),
  };
};
