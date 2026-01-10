import { DAY_CONFIGS, formatSlot } from "./school";
import {
  ClassGroup,
  ScheduleCell,
  TimetableData,
  WeekSchedule,
  Weekday,
  WeeklySlot,
} from "./types";

const filename = (prefix: string, ext: string) => {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
  return `${prefix}-${stamp}.${ext}`;
};

const getClassLabel = (cls: ClassGroup) => `${cls.grade}年${cls.label}組`;

const renderCell = (
  data: TimetableData,
  week: WeekSchedule,
  day: Weekday,
  period: number
) => {
  const cell: ScheduleCell | undefined = week[day]?.[period];
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
  link.download = filename("timetable", "json");
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

export const exportWorkbook = async (data: TimetableData) => {
  // @ts-ignore
  const ExcelJS = await import("exceljs");
  // @ts-ignore
  const { saveAs } = await import("file-saver");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VIBECORDING Timetable";
  data.classes.forEach((cls) => {
    const sheet = workbook.addWorksheet(getClassLabel(cls));
    sheet.addRow(["時限", ...DAY_CONFIGS.map((day) => day.shortLabel)]);
    const week = data.schedule[cls.id];
    const maxPeriods = Math.max(...DAY_CONFIGS.map((day) => day.periods));
    for (let period = 1; period <= maxPeriods; period += 1) {
      sheet.addRow([
        `${period}限`,
        ...DAY_CONFIGS.map((day) =>
          day.periods < period ? "" : renderCell(data, week, day.key, period)
        ),
      ]);
    }
    sheet.addRow([]);
    sheet.addRow(["最終更新日", data.lastUpdated]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename("timetable", "xlsx")
  );
};

export const exportClassPdf = async (
  data: TimetableData,
  classId: string
) => {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
  const cls = data.classes.find((item) => item.id === classId);
  if (!cls) return;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`${getClassLabel(cls)} 時間割`, 14, 18);
  const week = data.schedule[classId];
  const head = [
    ["時限", ...DAY_CONFIGS.map((day) => day.shortLabel)],
  ];
  const body: string[][] = [];
  const maxPeriods = Math.max(...DAY_CONFIGS.map((day) => day.periods));
  for (let period = 1; period <= maxPeriods; period += 1) {
    body.push([
      `${period}限`,
      ...DAY_CONFIGS.map((day) =>
        day.periods < period ? "" : renderCell(data, week, day.key, period)
      ),
    ]);
  }
  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 10 },
  });
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 24;
  doc.text(`最終更新: ${data.lastUpdated}`, 14, finalY + 10);
  doc.save(filename(`${classId}-timetable`, "pdf"));
};

export const describeSlotList = (slots: WeeklySlot[]) =>
  slots.map((slot) => formatSlot(slot)).join(", ");
