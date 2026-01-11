"use client";

import { DAY_CONFIGS, formatSlot } from "@/lib/school";
import { TimetableData, WeekSchedule, Weekday } from "@/lib/types";

const maxPeriods = Math.max(...DAY_CONFIGS.map((day) => day.periods));

const getClassLabel = (grade: number, label: string) => `${grade}-${label}`;

const getCellData = (
  data: TimetableData,
  week: WeekSchedule | undefined,
  dayKey: Weekday,
  period: number
) => {
  const cell = week?.[dayKey]?.[period];
  if (!cell?.subjectId) return { title: "", subtitle: "", teacher: "" };
  const subject = data.subjects.find((s) => s.id === cell.subjectId);
  const room = data.classrooms.find((r) => r.id === cell.roomId);

  // 複数担任対応
  let teacherName = "";
  if (cell.teacherIds && cell.teacherIds.length > 0) {
    teacherName = cell.teacherIds
      .map(id => data.teachers.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  } else if (cell.teacherId) {
    teacherName = data.teachers.find((t) => t.id === cell.teacherId)?.name ?? "";
  }

  return {
    title: subject?.name ?? "",
    subtitle: room?.name ?? "",
    teacher: teacherName,
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
    <div className="space-y-12 pb-12">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-brand-500 rounded-full" />
          <h3 className="text-xl font-black text-slate-800 tracking-tight">全学級の時間割一覧</h3>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {data.classes.map((cls) => {
            const week = data.schedule[cls.id];
            const homeroom = data.teachers.find((t) => t.id === cls.homeroomTeacherId);
            return (
              <div
                key={cls.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />

                <div className="mb-4 flex items-center justify-between relative z-10">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-black text-slate-800">
                      {cls.grade}
                      <span className="text-sm text-slate-400 font-bold ml-1">年</span>
                      {cls.label}
                      <span className="text-sm text-slate-400 font-bold ml-0.5">組</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Homeroom Teacher</span>
                    <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-black shadow-sm">
                      {homeroom?.name ?? "--"} 先生
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0.5">
                    <thead>
                      <tr>
                        <th className="w-8"></th>
                        {DAY_CONFIGS.map((day) => (
                          <th
                            key={day.key}
                            className="text-[10px] font-black text-slate-400 py-1"
                          >
                            {day.shortLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxPeriods }, (_, idx) => idx + 1).map((period) => (
                        <tr key={period}>
                          <th className="text-[10px] font-black text-slate-300 pr-1">
                            {period}
                          </th>
                          {DAY_CONFIGS.map((day) => {
                            const cell = getCellData(data, week, day.key, period);
                            const disabled = day.periods < period;
                            if (disabled) return <td key={`${day.key}-${period}`} className="bg-slate-50/50 rounded-sm h-10" />;

                            return (
                              <td
                                key={`${day.key}-${period}`}
                                className={`h-10 border border-slate-100/50 rounded-sm p-1 text-center transition-colors ${cell.title ? "bg-brand-50/40" : "bg-white"
                                  }`}
                              >
                                {cell.title && (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <div className="text-[9px] font-black text-slate-800 leading-tight line-clamp-1">{cell.title}</div>
                                    <div className="text-[7px] font-bold text-slate-400 leading-tight truncate w-full">{cell.teacher}</div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-indigo-500 rounded-full" />
          <h3 className="text-xl font-black text-slate-800 tracking-tight">教員担当まとめ</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {teacherAssignments.map(({ teacher, slots }) => (
            <div
              key={teacher.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                    {teacher.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800 leading-none">{teacher.name} 先生</h4>
                    <div className="flex gap-1 mt-1">
                      {teacher.role === "homeroom" && (
                        <span className="text-[8px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-black uppercase">担任</span>
                      )}
                      {teacher.taughtGrades?.map(g => (
                        <span key={g} className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-black border border-indigo-100">{g}年所属</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Weekly</div>
                  <div className="text-lg font-black text-indigo-600">{slots.length} <span className="text-[10px] text-slate-400">コマ</span></div>
                </div>
              </div>

              {/* Teacher Subjects */}
              <div className="mb-4 flex flex-wrap gap-1">
                {teacher.subjects.map(s => (
                  <span key={s} className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {s}
                  </span>
                ))}
              </div>

              {/* Teacher Meetings */}
              {(teacher.meetingIds?.length ?? 0) > 0 && (
                <div className="mb-4 p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-[8px] font-black text-amber-600 uppercase mb-1">参加する会議</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.meetingIds?.map(mid => {
                      const m = data.meetings.find(me => me.id === mid);
                      return m ? (
                        <span key={mid} className="text-[9px] font-black text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          {m.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {slots.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-50 rounded-xl">
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">No Assigned Classes</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((item, idx) => (
                      <div key={idx} className="flex flex-col p-2 bg-slate-50 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-indigo-600 px-1 bg-indigo-50 rounded">{item.slotLabel}</span>
                          <span className="text-[10px] font-black text-slate-800">{item.classLabel}</span>
                        </div>
                        <div className="text-[9px] font-bold text-slate-500 text-center truncate">{item.subject}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

