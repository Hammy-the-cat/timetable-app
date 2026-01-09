"use client";

import { DAY_CONFIGS, formatSlot } from "@/lib/school";
import { TimetableData, WeekSchedule, Weekday } from "@/lib/types";

const maxPeriods = Math.max(...DAY_CONFIGS.map((day) => day.periods));

const getClassLabel = (grade: number, label: string) => `${grade}年${label}組`;

const getCellText = (
  data: TimetableData,
  week: WeekSchedule | undefined,
  dayKey: Weekday,
  period: number
) => {
  const cell = week?.[dayKey]?.[period];
  if (!cell?.subjectId) return { title: "", subtitle: "" };
  const subject = data.subjects.find((s) => s.id === cell.subjectId);
  const room = data.classrooms.find((r) => r.id === cell.roomId);
  return {
    title: subject?.name ?? "",
    subtitle: room?.name ?? "",
  };
};

export function TimetableOverview({ data }: { data: TimetableData }) {
  const teacherAssignments = data.teachers.map((teacher) => {
    const slots: { classLabel: string; slotLabel: string; subject?: string }[] = [];

    for (const [classId, week] of Object.entries(data.schedule)) {
      const cls = data.classes.find((c) => c.id === classId);
      const label = cls ? getClassLabel(cls.grade, cls.label) : classId;
      for (const [dayKey, daySchedule] of Object.entries(week)) {
        for (const [periodStr, cell] of Object.entries(daySchedule)) {
          const period = Number(periodStr);
          if (cell.teacherId === teacher.id) {
            const subject = data.subjects.find((s) => s.id === cell.subjectId)?.name;
            slots.push({
              classLabel: label,
              slotLabel: formatSlot({ day: dayKey as Weekday, period }),
              subject,
            });
          }
        }
      }
    }
    return { teacher, slots };
  });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-900">全学級の時間割</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.classes.map((cls) => {
            const week = data.schedule[cls.id];
            const homeroom = data.teachers.find((t) => t.id === cls.homeroomTeacherId);
            return (
              <div
                key={cls.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-base font-semibold text-zinc-900">
                    {getClassLabel(cls.grade, cls.label)}
                  </h4>
                  <span className="text-xs text-zinc-500">
                    担任: {homeroom?.name ?? "--"}
                  </span>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border bg-zinc-100 px-2 py-1 text-left text-[11px] text-zinc-600">
                        時限/曜日
                      </th>
                      {DAY_CONFIGS.map((day) => (
                        <th
                          key={day.key}
                          className="border bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600"
                        >
                          {day.shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxPeriods }, (_, idx) => idx + 1).map((period) => (
                      <tr key={period}>
                        <th className="border bg-zinc-50 px-2 py-2 text-left text-[11px] text-zinc-600">
                          {period}限
                        </th>
                        {DAY_CONFIGS.map((day) => {
                          const text = getCellText(data, week, day.key, period);
                          const disabled = day.periods < period;
                          return (
                            <td
                              key={`${day.key}-${period}`}
                              className={`border px-2 py-2 align-top ${
                                disabled ? "bg-zinc-50 text-zinc-400" : ""
                              }`}
                            >
                              <div className="font-semibold text-zinc-800">{text.title}</div>
                              <div className="text-[11px] text-zinc-500">{text.subtitle}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-900">教員担当まとめ</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {teacherAssignments.map(({ teacher, slots }) => (
            <div
              key={teacher.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <h4 className="text-sm font-semibold text-zinc-900">{teacher.name}</h4>
              {slots.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">担当コマなし</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                  {slots.map((item, idx) => (
                    <li key={`${teacher.id}-${idx}`} className="flex justify-between gap-2">
                      <span>{item.slotLabel}</span>
                      <span className="text-right text-[11px] text-zinc-500">
                        {item.classLabel}
                        {item.subject ? ` / ${item.subject}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
