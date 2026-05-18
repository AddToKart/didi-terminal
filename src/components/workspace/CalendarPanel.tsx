import { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, LayoutList } from "lucide-react";
import { PersonalTask, loadPersonalTasks, updatePersonalTaskStatus } from "../../services/db-service";
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, addMonths, subMonths, 
  isSameMonth, isSameDay, isToday, startOfDay
} from "date-fns";
import { PersonalKanban } from "./PersonalKanban";

interface CalendarPanelProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarPanel({ workspaceId, isOpen, onClose }: CalendarPanelProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [selectedKanbanDate, setSelectedKanbanDate] = useState<Date | null>(null);

  const refreshTasks = () => {
    if (isOpen && workspaceId) {
      loadPersonalTasks(workspaceId).then(setTasks).catch(console.error);
    }
  };

  useEffect(() => {
    refreshTasks();
  }, [isOpen, workspaceId]);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const isFutureDay = (date: Date) => {
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    return target > today;
  };

  const handleToggleTask = async (task: PersonalTask, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const taskDate = new Date(task.created_at);
    if (isFutureDay(taskDate)) {
      alert("Cannot start or complete tasks in the future. Wait until the scheduled day.");
      return;
    }

    const newStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await updatePersonalTaskStatus(task.id, newStatus);
    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const today = () => setCurrentMonth(new Date());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-4 top-[48px] bg-[#0b0b0d]/98 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[60] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-bold text-zinc-100 min-w-[140px]">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={today}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
            >
              Today
            </button>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-md overflow-hidden">
              <button onClick={prevMonth} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button onClick={nextMonth} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-col flex-1 min-h-0 bg-black/40">
        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b border-white/5 shrink-0 bg-white/[0.01]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {daysInMonth.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDayToday = isToday(day);
            const dayKey = day.toISOString();
            const dayTasks = tasks.filter(t => {
              const taskDate = new Date(t.created_at);
              return isSameDay(taskDate, day);
            });

            return (
              <div 
                key={dayKey} 
                onClick={() => setSelectedKanbanDate(day)}
                className={`
                  group border-r border-b border-white/5 p-2 flex flex-col gap-1 overflow-hidden transition-colors cursor-pointer
                  ${!isCurrentMonth ? 'bg-black/60 opacity-50' : 'hover:bg-white/[0.02]'}
                  ${i % 7 === 6 ? 'border-r-0' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <span className={`
                    text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                    ${isDayToday ? 'bg-brand-primary text-black' : isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600'}
                  `}>
                    {format(day, "d")}
                  </span>
                  
                  {/* Subtle hover indicator that you can open daily kanban */}
                  <span className="opacity-0 group-hover:opacity-100 text-zinc-500 transition-opacity">
                    <LayoutList size={14} />
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-1 pr-1 mt-1">
                  {dayTasks.map(task => {
                    const isDone = task.status === "done";
                    const isInProgress = task.status === "in_progress";
                    
                    let statusColor = "bg-zinc-800 border-zinc-700 text-zinc-300";
                    let icon = <Circle size={10} className="shrink-0 opacity-50" />;
                    
                    if (isDone) {
                      statusColor = "bg-brand-accent/20 border-brand-accent/30 text-brand-accent line-through opacity-60";
                      icon = <CheckCircle2 size={10} className="shrink-0" />;
                    } else if (isInProgress) {
                      statusColor = "bg-blue-500/20 border-blue-500/30 text-blue-400";
                      icon = <Clock size={10} className="shrink-0" />;
                    }

                    return (
                      <button
                        key={task.id}
                        onClick={(e) => handleToggleTask(task, e)}
                        className={`
                          flex items-center gap-1.5 px-1.5 py-1 text-[10px] text-left leading-tight
                          border rounded transition-colors group/btn hover:brightness-110
                          ${statusColor}
                        `}
                        title={task.description || task.title}
                      >
                        {icon}
                        <span className="truncate flex-1">{task.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PersonalKanban
        workspaceId={workspaceId}
        isOpen={!!selectedKanbanDate}
        onClose={() => {
          setSelectedKanbanDate(null);
          refreshTasks();
        }}
        filterDate={selectedKanbanDate || undefined}
      />
    </div>
  );
}
