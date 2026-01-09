"use client";

import { TimetableData, WeekSchedule, WeeklySlot, Meeting } from "@/lib/types";

const WEEKDAYS = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
] as const;

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface TimetableGridProps {
  week: WeekSchedule;
  data: TimetableData;
  meetings: Meeting[];
  selectedSlot: WeeklySlot | null;
  onSelect: (slot: WeeklySlot) => void;
}

export function TimetableGrid({
  week,
  data,
  meetings,
  selectedSlot,
  onSelect,
}: TimetableGridProps) {
  const isSelected = (day: string, period: number) =>
    selectedSlot?.day === day && selectedSlot?.period === period;

  const isMeetingSlot = (day: string, period: number) =>
    meetings.some((m) =>
      m.slots.some((s) => s.day === day && s.period === period)
    );

  const getMeetingName = (day: string, period: number) =>
    meetings.find((m) =>
      m.slots.some((s) => s.day === day && s.period === period)
    )?.name;

  return (
    <div className="pro-card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(5,1fr)] bg-slate-100 border-b border-slate-200">
        <div className="h-10 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200">
          時限
        </div>
        {WEEKDAYS.map((day) => (
          <div
            key={day.key}
            className="h-10 flex items-center justify-center text-sm font-bold text-slate-700 border-r border-slate-200 last:border-r-0"
          >
            {day.label}
          </div>
        ))}
      </div>

      <div className="bg-white">
        {PERIODS.map((period) => (
          <div key={period} className="grid grid-cols-[60px_repeat(5,1fr)] group">
            <div className="h-20 flex items-center justify-center border-r border-b border-slate-200 bg-slate-50/50 text-sm font-mono font-bold text-slate-400 group-hover:text-brand-500 transition-colors text-center leading-none">
              {period}
            </div>
            {WEEKDAYS.map((day) => {
              const cell = week[day.key as WeeklySlot["day"]]?.[period];
              const meetingName = getMeetingName(day.key, period);
              const subject = data.subjects.find((s) => s.id === cell?.subjectId);
              const teacher = data.teachers.find((t) => t.id === cell?.teacherId);
              const room = data.classrooms.find((r) => r.id === cell?.roomId);

              const active = isSelected(day.key, period);

              return (
                <div
                  key={`${day.key}-${period}`}
                  onClick={() => onSelect({ day: day.key as any, period })}
                  className={`relative h-20 border-r border-b border-slate-200 cursor-pointer transition-all ${active ? "ring-2 ring-inset ring-brand-500 bg-brand-50/50 z-10" : "hover:bg-slate-50"
                    } ${isMeetingSlot(day.key, period) ? "bg-amber-50/30" : ""}`}
                >
                  {cell?.subjectId ? (
                    <div className="h-full p-2 flex flex-col justify-between overflow-hidden">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold leading-tight text-slate-900 line-clamp-2">
                          {subject?.name}
                        </span>
                        {active && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {teacher && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="opacity-50">👤</span> {teacher.name}
                          </div>
                        )}
                        {room && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="opacity-50">📍</span> {room.name}
                          </div>
                        )}
                      </div>
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 opacity-80" />
                    </div>
                  ) : meetingName ? (
                    <div className="h-full p-2 flex items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100/50 px-1.5 py-1 rounded border border-amber-200 uppercase tracking-tighter">
                        {meetingName}
                      </span>
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-2xl text-slate-200">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
