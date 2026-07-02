import { formatSlot, getDays } from "./school";
import { CHECK_TYPE_LABELS, runAllChecks } from "./checks";
import {
  ClassGroup,
  DayConfig,
  ScheduleCell,
  TimetableData,
  WeekSchedule,
  Weekday,
  WeeklySlot,
} from "./types";

const filename = (name: string, ext: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const stamp = `${year}${month}${day}`;
  return `${stamp}_${name}.${ext}`;
};

const getClassLabel = (cls: ClassGroup) => `${cls.grade}年${cls.label}組`;

const renderCell = (
  data: TimetableData,
  week: WeekSchedule | undefined,
  day: Weekday,
  period: number
) => {
  const cell: ScheduleCell | undefined = week?.[day]?.[period];
  if (!cell?.subjectId) return "";
  const subject = data.subjects.find((s) => s.id === cell.subjectId);
  const teacher = data.teachers.find((t) => t.id === cell.teacherId);
  const room = data.classrooms.find((r) => r.id === cell.roomId);
  const teacherLabel = teacher ? ` (${teacher.name})` : "";
  const roomLabel = room ? ` @${room.name}` : "";
  return `${subject?.name ?? ""}${teacherLabel}${roomLabel}`.trim();
};

export const downloadJson = (data: TimetableData) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename("時間割保存", "json");
  link.click();
  URL.revokeObjectURL(link.href);
};

export const readJsonFile = (file: File): Promise<TimetableData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// ================= Excel出力（整形版） =================

// 合同グループの色分けパレット（淡色）
const JOINT_COLORS = [
  "FFE2EFDA", // 緑
  "FFFCE4D6", // 橙
  "FFDDEBF7", // 青
  "FFFFF2CC", // 黄
  "FFE4DFEC", // 紫
  "FFD9E1F2", // 藍
];

const HEADER_FILL = "FF1F3864";
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
const ERROR_FILL = "FFFFC7CE";

type AnyCell = any;

const thinBorder = { style: "thin" as const, color: { argb: "FFB0B0B0" } };
const mediumBorder = { style: "medium" as const, color: { argb: "FF404040" } };

const setBorder = (cell: AnyCell, isDayEnd: boolean) => {
  cell.border = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: isDayEnd ? mediumBorder : thinBorder,
  };
};

const setupPage = (sheet: AnyCell) => {
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
  };
};

interface ExportContext {
  data: TimetableData;
  days: DayConfig[];
  allSlots: WeeklySlot[];
  /** `${classId}|${subjectId}` -> 塗り色 */
  jointColor: Map<string, string>;
  /** `${classId}|${day}:${period}` エラーのあるコマ */
  errorSlots: Set<string>;
  /** 特別支援学級 -> 交流ルール */
  exchangeLabel: Map<string, string>;
}

const buildExportContext = (data: TimetableData): ExportContext => {
  const days = getDays(data);
  const allSlots = days.flatMap((d) =>
    Array.from({ length: d.periods }, (_, i) => ({ day: d.key, period: i + 1 }))
  );

  const jointColor = new Map<string, string>();
  let colorIndex = 0;
  data.jointRules.forEach((rule) => {
    rule.classGroups.forEach((group) => {
      if (group.length < 2) return;
      const color = JOINT_COLORS[colorIndex % JOINT_COLORS.length];
      colorIndex += 1;
      group.forEach((classId) => jointColor.set(`${classId}|${rule.subjectId}`, color));
    });
  });

  const issues = runAllChecks(data);
  const errorSlots = new Set<string>();
  issues
    .filter((i) => i.severity === "error" && i.slot)
    .forEach((i) =>
      i.classIds.forEach((cid) =>
        errorSlots.add(`${cid}|${i.slot!.day}:${i.slot!.period}`)
      )
    );

  const exchangeLabel = new Map<string, string>();
  data.exchangeRules.forEach((rule) => {
    const partner = data.classes.find((c) => c.id === rule.exchangeClassId);
    if (partner) exchangeLabel.set(rule.specialClassId, `${partner.label}組`);
  });

  return { data, days, allSlots, jointColor, errorSlots, exchangeLabel };
};

/** 曜日（結合）+ 時限 の2段ヘッダーを書き、データ開始列を返す */
const writeMatrixHeader = (sheet: AnyCell, ctx: ExportContext, firstColTitle: string) => {
  const dayRow = sheet.getRow(1);
  const periodRow = sheet.getRow(2);
  const corner = sheet.getCell(1, 1);
  corner.value = firstColTitle;
  sheet.mergeCells(1, 1, 2, 1);
  corner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  corner.font = HEADER_FONT;
  corner.alignment = { vertical: "middle", horizontal: "center" };

  let col = 2;
  ctx.days.forEach((day) => {
    const start = col;
    for (let p = 1; p <= day.periods; p += 1) {
      const cell = periodRow.getCell(col);
      cell.value = p;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center" };
      setBorder(cell, p === day.periods);
      sheet.getColumn(col).width = 11;
      col += 1;
    }
    sheet.mergeCells(1, start, 1, col - 1);
    const dayCell = sheet.getCell(1, start);
    dayCell.value = day.label;
    dayCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    dayCell.font = HEADER_FONT;
    dayCell.alignment = { horizontal: "center" };
    dayCell.border = { right: mediumBorder, top: thinBorder, bottom: thinBorder, left: thinBorder };
  });
  sheet.getColumn(1).width = 14;
  dayRow.height = 18;
  periodRow.height = 16;
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];
};

/** 全校時間割シート（学級 × 曜日・時限） */
const addSchoolSheet = (workbook: AnyCell, ctx: ExportContext) => {
  const { data } = ctx;
  const sheet = workbook.addWorksheet("全校時間割");
  setupPage(sheet);
  writeMatrixHeader(sheet, ctx, "学級");

  data.classes.forEach((cls, rowIdx) => {
    const row = sheet.getRow(3 + rowIdx);
    row.height = 26;
    const head = row.getCell(1);
    const exchange = ctx.exchangeLabel.get(cls.id);
    head.value =
      getClassLabel(cls) + (cls.type === "special" && exchange ? `\n(交流:${exchange})` : "");
    head.font = { bold: true, size: 9 };
    head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    setBorder(head, true);

    let col = 2;
    ctx.days.forEach((day) => {
      for (let p = 1; p <= day.periods; p += 1) {
        const cell = row.getCell(col);
        const sc = data.schedule[cls.id]?.[day.key]?.[p];
        if (sc?.subjectId) {
          const subject = data.subjects.find((s) => s.id === sc.subjectId);
          const teacher = data.teachers.find((t) => t.id === sc.teacherId);
          const isExchange =
            cls.type === "special" &&
            data.exchangeRules.some(
              (r) => r.specialClassId === cls.id && r.subjectIds.includes(sc.subjectId!)
            );
          cell.value =
            `${subject?.name ?? ""}${isExchange ? "＊" : ""}` +
            (teacher ? `\n${teacher.name}` : "");
          const joint = ctx.jointColor.get(`${cls.id}|${sc.subjectId}`);
          if (ctx.errorSlots.has(`${cls.id}|${day.key}:${p}`)) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ERROR_FILL } };
          } else if (joint) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: joint } };
          }
        }
        cell.font = { size: 8 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        setBorder(cell, p === day.periods);
        col += 1;
      }
    });
  });

  // 凡例
  const legendRow = sheet.getRow(3 + data.classes.length + 1);
  legendRow.getCell(1).value =
    "＊…交流授業 / 色付き…合同授業 / 赤色…チェック結果でエラーのあるコマ";
  legendRow.getCell(1).font = { size: 8, italic: true };
};

/** 学級別シート（時限 × 曜日） */
const addClassSheet = (workbook: AnyCell, ctx: ExportContext, cls: ClassGroup) => {
  const { data } = ctx;
  const sheet = workbook.addWorksheet(getClassLabel(cls));
  setupPage(sheet);
  sheet.pageSetup.orientation = "portrait";

  const title = sheet.getCell(1, 1);
  const homeroom = data.teachers.find((t) => t.id === cls.homeroomTeacherId);
  title.value = `${data.settings.yearLabel} ${getClassLabel(cls)} 時間割${homeroom ? `（担任: ${homeroom.name}）` : ""}`;
  title.font = { bold: true, size: 12 };
  sheet.mergeCells(1, 1, 1, ctx.days.length + 1);

  const headerRow = sheet.getRow(2);
  headerRow.getCell(1).value = "時限";
  ctx.days.forEach((day, i) => {
    headerRow.getCell(i + 2).value = day.shortLabel;
    sheet.getColumn(i + 2).width = 16;
  });
  headerRow.eachCell((cell: AnyCell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center" };
    setBorder(cell, false);
  });
  sheet.getColumn(1).width = 6;

  const week = data.schedule[cls.id];
  const maxPeriods = Math.max(...ctx.days.map((d) => d.periods));
  for (let p = 1; p <= maxPeriods; p += 1) {
    const row = sheet.getRow(2 + p);
    row.height = 34;
    const head = row.getCell(1);
    head.value = `${p}`;
    head.font = { bold: true };
    head.alignment = { vertical: "middle", horizontal: "center" };
    setBorder(head, false);
    ctx.days.forEach((day, i) => {
      const cell = row.getCell(i + 2);
      if (day.periods >= p) {
        cell.value = renderCell(data, week, day.key, p);
        const sc = week?.[day.key]?.[p];
        if (sc?.subjectId) {
          const joint = ctx.jointColor.get(`${cls.id}|${sc.subjectId}`);
          if (ctx.errorSlots.has(`${cls.id}|${day.key}:${p}`)) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ERROR_FILL } };
          } else if (joint) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: joint } };
          }
        }
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
      cell.font = { size: 9 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      setBorder(cell, false);
    });
  }
};

/** 教員別時間割シート（教員 × 曜日・時限） */
const addTeacherSheet = (workbook: AnyCell, ctx: ExportContext) => {
  const { data } = ctx;
  const sheet = workbook.addWorksheet("教員別時間割");
  setupPage(sheet);
  writeMatrixHeader(sheet, ctx, "教員");

  data.teachers.forEach((teacher, rowIdx) => {
    const row = sheet.getRow(3 + rowIdx);
    row.height = 24;
    const head = row.getCell(1);
    head.value = teacher.name;
    head.font = { bold: true, size: 9 };
    head.alignment = { vertical: "middle", horizontal: "center" };
    setBorder(head, true);

    let col = 2;
    ctx.days.forEach((day) => {
      for (let p = 1; p <= day.periods; p += 1) {
        const cell = row.getCell(col);
        const entries: string[] = [];
        let subjectName = "";
        data.classes.forEach((cls) => {
          const sc = data.schedule[cls.id]?.[day.key]?.[p];
          if (!sc?.subjectId) return;
          const tIds = sc.teacherIds && sc.teacherIds.length > 0 ? sc.teacherIds : sc.teacherId ? [sc.teacherId] : [];
          if (tIds.includes(teacher.id)) {
            entries.push(`${cls.grade}-${cls.label}`);
            subjectName = data.subjects.find((s) => s.id === sc.subjectId)?.name ?? "";
          }
        });
        if (entries.length > 0) {
          cell.value = `${entries.join("･")}\n${subjectName}`;
        } else if (
          teacher.unavailable.some((s) => s.day === day.key && s.period === p)
        ) {
          cell.value = "×";
          cell.font = { size: 8, color: { argb: "FF999999" } };
        } else {
          const meeting = data.meetings.find(
            (m) =>
              teacher.meetingIds?.includes(m.id) &&
              m.slots.some((s) => s.day === day.key && s.period === p)
          );
          if (meeting) {
            cell.value = meeting.name;
            cell.font = { size: 7, color: { argb: "FF996600" } };
          }
        }
        if (!cell.font) cell.font = { size: 8 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        setBorder(cell, p === day.periods);
        col += 1;
      }
    });
  });
};

/** 教室別時間割シート（教室 × 曜日・時限） */
const addRoomSheet = (workbook: AnyCell, ctx: ExportContext) => {
  const { data } = ctx;
  const sheet = workbook.addWorksheet("教室別時間割");
  setupPage(sheet);
  writeMatrixHeader(sheet, ctx, "教室");

  data.classrooms.forEach((room, rowIdx) => {
    const row = sheet.getRow(3 + rowIdx);
    row.height = 24;
    const head = row.getCell(1);
    head.value = room.name;
    head.font = { bold: true, size: 9 };
    head.alignment = { vertical: "middle", horizontal: "center" };
    setBorder(head, true);

    let col = 2;
    ctx.days.forEach((day) => {
      for (let p = 1; p <= day.periods; p += 1) {
        const cell = row.getCell(col);
        const entries: string[] = [];
        data.classes.forEach((cls) => {
          const sc = data.schedule[cls.id]?.[day.key]?.[p];
          if (sc?.roomId === room.id && sc.subjectId) {
            const subject = data.subjects.find((s) => s.id === sc.subjectId);
            entries.push(`${cls.grade}-${cls.label} ${subject?.name ?? ""}`);
          }
        });
        if (entries.length > 0) cell.value = entries.join("\n");
        if (entries.length > 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ERROR_FILL } };
        }
        cell.font = { size: 8 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        setBorder(cell, p === day.periods);
        col += 1;
      }
    });
  });
};

/** チェック結果一覧シート */
const addCheckSheet = (workbook: AnyCell, ctx: ExportContext) => {
  const { data } = ctx;
  const issues = runAllChecks(data);
  const sheet = workbook.addWorksheet("チェック結果");
  setupPage(sheet);

  const header = ["重要度", "種類", "内容", "学級", "コマ"];
  const headerRow = sheet.getRow(1);
  header.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = HEADER_FONT;
    setBorder(cell, false);
  });
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 80;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 8;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  issues.forEach((issue, i) => {
    const row = sheet.getRow(2 + i);
    const severity = row.getCell(1);
    severity.value = issue.severity === "error" ? "要修正" : "要確認";
    severity.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: issue.severity === "error" ? ERROR_FILL : "FFFFEB9C" },
    };
    row.getCell(2).value = CHECK_TYPE_LABELS[issue.type];
    row.getCell(3).value = issue.message;
    row.getCell(4).value = issue.classIds
      .map((cid) => {
        const cls = data.classes.find((c) => c.id === cid);
        return cls ? getClassLabel(cls) : "";
      })
      .filter(Boolean)
      .join("、");
    row.getCell(5).value = issue.slot ? formatSlot(issue.slot) : "";
    for (let c = 1; c <= 5; c += 1) setBorder(row.getCell(c), false);
  });

  if (issues.length === 0) {
    sheet.getRow(2).getCell(1).value = "問題は見つかりませんでした。";
  }
};

export type ExportSheetKey = "school" | "classes" | "teachers" | "rooms" | "check";

export const EXPORT_SHEET_LABELS: Record<ExportSheetKey, string> = {
  school: "全校時間割",
  classes: "学級別時間割",
  teachers: "教員別時間割",
  rooms: "教室別時間割",
  check: "チェック結果一覧",
};

export const exportWorkbook = async (
  data: TimetableData,
  sheets: ExportSheetKey[] = ["school", "classes", "teachers", "rooms", "check"]
) => {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "時間割作成アプリ";

  const ctx = buildExportContext(data);
  if (sheets.includes("school")) addSchoolSheet(workbook, ctx);
  if (sheets.includes("classes")) {
    data.classes.forEach((cls) => addClassSheet(workbook, ctx, cls));
  }
  if (sheets.includes("teachers")) addTeacherSheet(workbook, ctx);
  if (sheets.includes("rooms")) addRoomSheet(workbook, ctx);
  if (sheets.includes("check")) addCheckSheet(workbook, ctx);

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename(`時間割_${data.settings.yearLabel || "Excel"}`, "xlsx")
  );
};

// ================= PDF出力（Canvas描画: 日本語はシステムフォントで描くため文字化けしない） =================

const argbToCss = (argb: string) => `#${argb.slice(2)}`;

/** 1学級分の時間割をCanvasに描画して返す */
const drawClassTimetable = (
  data: TimetableData,
  ctx: ExportContext,
  cls: ClassGroup
): HTMLCanvasElement => {
  const days = ctx.days;
  const maxPeriods = Math.max(...days.map((d) => d.periods));

  const scale = 2;
  const headW = 60;
  const colW = 170;
  const headerH = 44;
  const rowH = 84;
  const titleH = 60;
  const width = headW + colW * days.length + 40;
  const height = titleH + headerH + rowH * maxPeriods + 50;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const g = canvas.getContext("2d")!;
  g.scale(scale, scale);

  const font = (size: number, bold = false) =>
    `${bold ? "bold " : ""}${size}px "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif`;

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, width, height);

  // タイトル
  const homeroom = data.teachers.find((t) => t.id === cls.homeroomTeacherId);
  g.fillStyle = "#1f2937";
  g.font = font(20, true);
  g.textBaseline = "top";
  g.fillText(
    `${data.settings.yearLabel} ${getClassLabel(cls)} 時間割${homeroom ? `（担任: ${homeroom.name}）` : ""}`,
    20,
    18
  );

  const originX = 20;
  const originY = titleH;

  // ヘッダー
  g.fillStyle = "#1f3864";
  g.fillRect(originX, originY, headW + colW * days.length, headerH);
  g.fillStyle = "#ffffff";
  g.font = font(15, true);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("時限", originX + headW / 2, originY + headerH / 2);
  days.forEach((day, i) => {
    g.fillText(day.shortLabel, originX + headW + colW * i + colW / 2, originY + headerH / 2);
  });

  const week = data.schedule[cls.id];
  for (let p = 1; p <= maxPeriods; p += 1) {
    const y = originY + headerH + rowH * (p - 1);
    // 時限見出し
    g.fillStyle = "#f1f5f9";
    g.fillRect(originX, y, headW, rowH);
    g.fillStyle = "#334155";
    g.font = font(16, true);
    g.fillText(String(p), originX + headW / 2, y + rowH / 2);

    days.forEach((day, i) => {
      const x = originX + headW + colW * i;
      const sc = day.periods >= p ? week?.[day.key]?.[p] : undefined;
      // 背景
      if (day.periods < p) {
        g.fillStyle = "#f1f5f9";
        g.fillRect(x, y, colW, rowH);
      } else if (sc?.subjectId) {
        const joint = ctx.jointColor.get(`${cls.id}|${sc.subjectId}`);
        if (ctx.errorSlots.has(`${cls.id}|${day.key}:${p}`)) {
          g.fillStyle = argbToCss(ERROR_FILL);
          g.fillRect(x, y, colW, rowH);
        } else if (joint) {
          g.fillStyle = argbToCss(joint);
          g.fillRect(x, y, colW, rowH);
        }
      }
      // 文字
      if (sc?.subjectId) {
        const subject = data.subjects.find((s) => s.id === sc.subjectId);
        const teacher = data.teachers.find((t) => t.id === sc.teacherId);
        const isExchange =
          cls.type === "special" &&
          data.exchangeRules.some(
            (r) => r.specialClassId === cls.id && r.subjectIds.includes(sc.subjectId!)
          );
        g.fillStyle = "#111827";
        g.font = font(16, true);
        g.fillText(
          `${subject?.name ?? ""}${isExchange ? "＊" : ""}`,
          x + colW / 2,
          y + rowH / 2 - (teacher ? 12 : 0)
        );
        if (teacher) {
          g.fillStyle = "#64748b";
          g.font = font(12);
          g.fillText(teacher.name, x + colW / 2, y + rowH / 2 + 16);
        }
      }
    });
  }

  // 罫線
  g.strokeStyle = "#94a3b8";
  g.lineWidth = 1;
  const tableW = headW + colW * days.length;
  const tableH = headerH + rowH * maxPeriods;
  for (let p = 0; p <= maxPeriods; p += 1) {
    const y = originY + headerH + rowH * p;
    g.beginPath();
    g.moveTo(originX, y);
    g.lineTo(originX + tableW, y);
    g.stroke();
  }
  for (let i = 0; i <= days.length; i += 1) {
    const x = i === 0 ? originX : originX + headW + colW * (i - 1) + (i > 0 ? colW : 0);
    g.beginPath();
    g.moveTo(x, originY);
    g.lineTo(x, originY + tableH);
    g.stroke();
  }
  // 学級名列の右の線
  g.beginPath();
  g.moveTo(originX + headW, originY);
  g.lineTo(originX + headW, originY + tableH);
  g.stroke();
  // 外枠
  g.strokeStyle = "#334155";
  g.lineWidth = 2;
  g.strokeRect(originX, originY, tableW, tableH);

  // 凡例
  g.fillStyle = "#94a3b8";
  g.font = font(11);
  g.textAlign = "left";
  g.fillText(
    "＊…交流授業 / 色付き…合同授業 / 赤色…エラーのあるコマ",
    originX,
    originY + tableH + 14
  );
  g.textAlign = "center";

  return canvas;
};

/** 学級別時間割のPDF出力（classIds省略時は全学級・1学級1ページ） */
export const exportClassPdf = async (
  data: TimetableData,
  classIds?: string[]
) => {
  const jsPDF = (await import("jspdf")).default;
  const targets = data.classes.filter(
    (cls) => !classIds || classIds.length === 0 || classIds.includes(cls.id)
  );
  if (targets.length === 0) return;

  const ctx = buildExportContext(data);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  targets.forEach((cls, index) => {
    if (index > 0) doc.addPage();
    const canvas = drawClassTimetable(data, ctx, cls);
    const ratio = canvas.height / canvas.width;
    let w = pageW - margin * 2;
    let h = w * ratio;
    if (h > pageH - margin * 2) {
      h = pageH - margin * 2;
      w = h / ratio;
    }
    doc.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h
    );
  });

  doc.save(
    filename(
      targets.length === 1 ? getClassLabel(targets[0]) : `時間割PDF_${data.settings.yearLabel || ""}`,
      "pdf"
    )
  );
};

export const describeSlotList = (slots: WeeklySlot[]) =>
  slots.map((slot) => formatSlot(slot)).join(", ");
