import React, { useState, useEffect } from "react";
import { 
  X, Plus, Check, Trash2, Edit2, Columns, LayoutList, 
  CircleDot, CheckCircle2, Circle
} from "lucide-react";
import { 
  DndContext, DragOverlay, closestCorners, KeyboardSensor, 
  PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent
} from "@dnd-kit/core";
import { 
  SortableContext, arrayMove, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  PersonalTask, loadPersonalTasks, savePersonalTask, 
  updatePersonalTasksOrder, deletePersonalTask 
} from "../../services/db-service";

// Use native crypto.randomUUID() instead of uuid package
const uuidv4 = () => crypto.randomUUID();

interface PersonalKanbanProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type ColumnType = "todo" | "in_progress" | "done";

// ── Sortable Item ─────────────────────────────────────────────────────────────

function SortableTask({ 
  task, 
  onDelete,
  onEdit
}: { 
  task: PersonalTask; 
  onDelete: (id: string) => void;
  onEdit: (task: PersonalTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-3 rounded-lg border flex flex-col gap-1.5 cursor-grab active:cursor-grabbing transition-colors ${
        isDragging 
          ? "opacity-50 border-brand-accent/50 bg-brand-accent/5" 
          : "border-zinc-800 bg-[#18181b] hover:border-zinc-700/80 hover:bg-[#1f1f22]"
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-tight ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(task); }} 
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <Edit2 size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {task.description && (
        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{task.description}</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PersonalKanban({ currentProject, isOpen, onClose }: PersonalKanbanProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
  
  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState<ColumnType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (isOpen && currentProject) {
      loadPersonalTasks(currentProject).then(setTasks).catch(console.error);
    }
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Handle dropping on an empty column
    if (["todo", "in_progress", "done"].includes(overId)) {
      if (activeTask.status !== overId) {
        const newTasks = tasks.map(t => t.id === activeId ? { ...t, status: overId as ColumnType } : t);
        setTasks(newTasks);
        await updatePersonalTasksOrder(newTasks);
      }
      return;
    }

    const overTask = tasks.find(t => t.id === overId);
    if (!overTask) return;

    // Moving within the same list or between lists
    const activeIndex = tasks.findIndex(t => t.id === activeId);
    const overIndex = tasks.findIndex(t => t.id === overId);

    let newTasks = [...tasks];
    
    if (activeTask.status !== overTask.status) {
      newTasks[activeIndex] = { ...activeTask, status: overTask.status };
    }
    
    newTasks = arrayMove(newTasks, activeIndex, overIndex);
    setTasks(newTasks);
    await updatePersonalTasksOrder(newTasks);
  };

  const handleAddTask = async (status: ColumnType) => {
    if (!newTaskTitle.trim() || !currentProject) return;
    
    const newTask: PersonalTask = {
      id: uuidv4(),
      workspace_id: currentProject,
      title: newTaskTitle.trim(),
      description: "",
      status,
      order_index: tasks.filter(t => t.status === status).length,
      created_at: Date.now()
    };

    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    setNewTaskTitle("");
    setIsAddingTask(null);
    
    await savePersonalTask(newTask);
  };

  const handleDelete = async (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    await deletePersonalTask(id);
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    const newTasks = tasks.map(t => t.id === editingTask.id ? editingTask : t);
    setTasks(newTasks);
    await savePersonalTask(editingTask);
    setEditingTask(null);
  };

  const columns: { id: ColumnType; title: string; icon: React.ReactNode; color: string }[] = [
    { id: "todo", title: "To Do", icon: <Circle size={14} className="text-zinc-500" />, color: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400" },
    { id: "in_progress", title: "In Progress", icon: <CircleDot size={14} className="text-amber-500" />, color: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
    { id: "done", title: "Done", icon: <CheckCircle2 size={14} className="text-emerald-500" />, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  ];

  return (
    <div className="w-[850px] border-l border-app-border bg-[#0d0d10] flex flex-col shadow-2xl z-50 h-full absolute right-0 top-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border bg-[#0e0e12] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
            <LayoutList size={16} className="text-brand-accent" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white tracking-wide leading-tight">My Tasks</h2>
            <p className="text-[11px] text-zinc-500">Personal workspace tracking</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden p-5 bg-black/20">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.status === col.id);
              return (
                <div key={col.id} className="flex-1 flex flex-col min-w-0 bg-[#0e0e11] border border-zinc-800/60 rounded-xl overflow-hidden shadow-sm">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
                    <div className="flex items-center gap-2">
                      {col.icon}
                      <span className="text-xs font-bold text-zinc-200">{col.title}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${col.color}`}>
                        {colTasks.length}
                      </span>
                    </div>
                    <button 
                      onClick={() => setIsAddingTask(col.id)}
                      className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                    <SortableContext id={col.id} items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {colTasks.map(task => (
                        <SortableTask key={task.id} task={task} onDelete={handleDelete} onEdit={setEditingTask} />
                      ))}
                      
                      {/* Empty state drop zone */}
                      {colTasks.length === 0 && !isAddingTask && (
                        <div className="h-20 border-2 border-dashed border-zinc-800/50 rounded-lg flex items-center justify-center text-[11px] font-medium text-zinc-600">
                          Drop tasks here
                        </div>
                      )}
                    </SortableContext>

                    {/* Add Task Input */}
                    {isAddingTask === col.id && (
                      <div className="p-2 border border-brand-accent/40 bg-brand-accent/5 rounded-lg flex flex-col gap-2 animate-in slide-in-from-top-2">
                        <textarea
                          autoFocus
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Task title..."
                          className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none resize-none leading-tight"
                          rows={2}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddTask(col.id);
                            } else if (e.key === 'Escape') {
                              setIsAddingTask(null);
                              setNewTaskTitle("");
                            }
                          }}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => { setIsAddingTask(null); setNewTaskTitle(""); }}
                            className="px-2 py-1 rounded text-[10px] font-bold text-zinc-500 hover:bg-zinc-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleAddTask(col.id)}
                            disabled={!newTaskTitle.trim()}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 disabled:opacity-40 transition-colors"
                          >
                            Add Task
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId ? (
              <div className="p-3 rounded-lg border border-brand-accent bg-[#1f1f22] shadow-2xl rotate-2 opacity-90">
                <p className="text-sm font-medium text-zinc-200">{tasks.find(t => t.id === activeId)?.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[450px] bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/30">
              <h3 className="text-sm font-bold text-white">Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Title</label>
                <input 
                  value={editingTask.title}
                  onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                  className="w-full bg-[#0d0d10] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-brand-accent/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                <textarea 
                  value={editingTask.description}
                  onChange={e => setEditingTask({...editingTask, description: e.target.value})}
                  rows={4}
                  className="w-full bg-[#0d0d10] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-brand-accent/50 transition-colors resize-none"
                  placeholder="Add details..."
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800/60 bg-zinc-900/30 flex items-center justify-end gap-2">
              <button 
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={!editingTask.title.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-accent text-black hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
