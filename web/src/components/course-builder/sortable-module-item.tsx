"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  Video,
  BookText,
  FileCode,
  HelpCircle,
  GripVertical,
  Clock,
  X as XIcon,
  CheckSquare,
  Square,
  Settings,
  Mic,
  Presentation,
  ClipboardList,
  Code,
  FileText,
  Check,
  PlayCircle,
  Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiPatch } from "@/lib/api/client";
import {
  useAddLesson,
  useDeleteLesson,
  useUpdateModule,
  useDeleteModule,
  useReorderLessons,
} from "@/lib/api/courses";
import {
  LectureDescriptionMenu,
  LectureResourcesMenu,
  LectureLabMenu,
  LectureContentSelector,
} from "@/components/course-builder/lecture-sub-menus";
import {
  QuizContentEditor,
  AssignmentContentEditor,
  CodingExerciseContentEditor,
  PracticeTestContentEditor,
  FileUploadContentEditor,
  ArticleContentEditor,
} from "@/components/course-builder/curriculum-item-editors";

// ─── Types ───────────────────────────────────────────

export type Lesson = {
  id: string;
  title: string;
  type: string;
  order: number;
  content?: Record<string, unknown> | null | undefined;
};

export type Module = {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  lessons: Lesson[];
};

// ─── Helpers ─────────────────────────────────────────

const LESSON_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <BookText className="h-3.5 w-3.5 text-blue-500" />,
  video: <Video className="h-3.5 w-3.5 text-purple-500" />,
  scorm: <FileCode className="h-3.5 w-3.5 text-amber-500" />,
  quiz: <HelpCircle className="h-3.5 w-3.5 text-green-500" />,
  assignment: <BookText className="h-3.5 w-3.5 text-rose-500" />,
  audio: <Mic className="h-3.5 w-3.5 text-cyan-500" />,
  article: <FileCode className="h-3.5 w-3.5 text-teal-500" />,
  pdf: <FileCode className="h-3.5 w-3.5 text-red-500" />,
  ppt: <Presentation className="h-3.5 w-3.5 text-orange-500" />,
  "practice-test": <ClipboardList className="h-3.5 w-3.5 text-lime-500" />,
  "coding-exercise": <Code className="h-3.5 w-3.5 text-indigo-500" />,
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  video: "Video",
  scorm: "SCORM",
  quiz: "Quiz",
  assignment: "Assignment",
  audio: "Audio",
  article: "Article",
  pdf: "PDF",
  ppt: "PPT",
  "practice-test": "Practice Test",
  "coding-exercise": "Coding Exercise",
};

function getDurationLabel(seconds?: number | null): string | null {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function getModuleDuration(module: Module): number {
  return module.lessons.reduce((sum, l) => {
    const dur = l.content?.durationSeconds as number | undefined;
    return sum + (dur ?? 0);
  }, 0);
}

// ─── Curriculum Item Categories (Udemy-style) ────────

const CURRICULUM_CATEGORIES = [
  {
    label: "Watch or read",
    items: [
      { type: "video", label: "Lecture", description: "Video or text lesson", icon: PlayCircle, color: "text-purple-500", bg: "bg-purple-50" },
      { type: "article", label: "Article", description: "Text-based lesson", icon: FileText, color: "text-teal-500", bg: "bg-teal-50" },
    ],
  },
  {
    label: "Coding & labs",
    items: [
      { type: "coding-exercise", label: "Coding Exercise", description: "Code challenges with instant feedback", icon: Code, color: "text-indigo-500", bg: "bg-indigo-50" },
    ],
  },
  {
    label: "Knowledge checks",
    items: [
      { type: "quiz", label: "Quiz", description: "Quick comprehension check after a lesson", icon: HelpCircle, color: "text-green-500", bg: "bg-green-50" },
      { type: "practice-test", label: "Practice Test", description: "Timed exam to prep for certification", icon: ClipboardList, color: "text-lime-500", bg: "bg-lime-50" },
      { type: "assignment", label: "Assignment", description: "Task for learners to complete and submit", icon: BookText, color: "text-amber-500", bg: "bg-amber-50" },
    ],
  },
] as const;

// ─── Type-specific sub-menu configs ──────────────────

type SubMenu = "description" | "resources" | "lab" | "content" | "type-editor" | null;

// Types that show the generic lecture sub-menus (Description, Resources, Lab)
const LECTURE_TYPES = new Set(["video", "text", "scorm"]);
// Types that use a dedicated type-specific editor instead of generic sub-menus
const DEDICATED_EDITOR_TYPES = new Set(["quiz", "assignment", "coding-exercise", "practice-test", "audio", "pdf", "ppt"]);
// Types that show the article editor
const ARTICLE_TYPES = new Set(["article"]);

export function SortableLessonRow({
  lesson,
  courseId,
  selected,
  onToggle,
}: {
  lesson: Lesson;
  courseId: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const {
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  // Each lecture owns its own accordion state — fully isolated per instance
  const [lectureExpanded, setLectureExpanded] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenu>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const durationLabel =
    getDurationLabel(lesson.content?.durationSeconds as number | undefined);

  function handleSubMenuAction(menu: SubMenu) {
    // Toggle: if already active, close it; otherwise open it
    setActiveSubMenu((prev) => (prev === menu ? null : menu));
    // Auto-expand the lecture so the sub-menu panel is visible
    if (!lectureExpanded) {
      setLectureExpanded(true);
    }
  }

  function closeSubMenu() {
    setActiveSubMenu(null);
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* ── Lecture Row Header (always visible) ── */}
      <div
        className={`flex items-center gap-2 border-t border-[var(--color-border)] bg-white px-4 py-2.5 text-left hover:bg-gray-50/50 transition-colors ${selected ? "bg-[var(--color-primary)]/5" : ""}`}
      >
        {/* Drag handle (lesson) */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-roledescription="draggable"
          style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none', flexShrink: 0 }}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Select checkbox */}
        <button
          onClick={() => onToggle(lesson.id)}
          className="flex-shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          {selected ? (
            <CheckSquare className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Completed checkmark (always shown as per spec) */}
        <span className="flex-shrink-0 text-[var(--color-primary)]">
          <Check className="h-3.5 w-3.5" />
        </span>

        {/* Type icon + label + Document icon + Title */}
        <button
          onClick={() => setLectureExpanded(!lectureExpanded)}
          className="flex flex-1 items-center gap-1.5 truncate text-sm text-left"
        >
          {LESSON_TYPE_ICONS[lesson.type] ?? <FileText className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />}
          <span className="flex-shrink-0 font-medium">{LESSON_TYPE_LABELS[lesson.type] ?? "Item"} {lesson.order}:</span>
          <span className="flex-1 truncate">{lesson.title}</span>
        </button>

        {/* Duration */}
        {durationLabel && (
          <span className="flex items-center gap-0.5 text-xs text-[var(--color-muted-foreground)] flex-shrink-0">
            <Clock className="h-3 w-3" />
            {durationLabel}
          </span>
        )}

        {/* Type badge */}
        <Badge variant="neutral" className="text-[10px] flex-shrink-0">
          {LESSON_TYPE_LABELS[lesson.type] ?? lesson.type}
        </Badge>

        {/* + Content button — label changes based on type */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (DEDICATED_EDITOR_TYPES.has(lesson.type) || ARTICLE_TYPES.has(lesson.type)) {
              handleSubMenuAction("type-editor");
            } else {
              handleSubMenuAction("content");
            }
          }}
          className="flex-shrink-0 text-xs"
        >
          <Plus className="h-3 w-3" />
          {lesson.type === "quiz" ? "Questions" : lesson.type === "assignment" ? "Instructions" : lesson.type === "coding-exercise" ? "Code" : lesson.type === "practice-test" ? "Configure" : "Content"}
        </Button>

        {/* Expand chevron (UP when expanded, DOWN when collapsed) */}
        <button
          onClick={() => setLectureExpanded(!lectureExpanded)}
          className="flex-shrink-0 text-[var(--color-muted-foreground)]"
        >
          {lectureExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Expanded Accordion Body ── */}
      {lectureExpanded && (
        <div className="border-t border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)]/30">
          {/* Sub-action buttons row — different buttons per type */}
          <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-4 py-2">
            {/* Lecture/Video/Text/SCORM types: Description, Resources, Lab */}
            {LECTURE_TYPES.has(lesson.type) && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("resources")}
                  className={`text-xs ${activeSubMenu === "resources" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Resources
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("lab")}
                  className={`text-xs ${activeSubMenu === "lab" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Lab
                </Button>
              </>
            )}

            {/* Quiz: Description + Questions */}
            {lesson.type === "quiz" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Questions
                </Button>
              </>
            )}

            {/* Assignment: Description + Instructions/Rubric */}
            {lesson.type === "assignment" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Instructions & Rubric
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("resources")}
                  className={`text-xs ${activeSubMenu === "resources" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Resources
                </Button>
              </>
            )}

            {/* Coding Exercise: Description + Code Editor */}
            {lesson.type === "coding-exercise" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Code Setup
                </Button>
              </>
            )}

            {/* Practice Test: Description + Configure */}
            {lesson.type === "practice-test" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Configure Test
                </Button>
              </>
            )}

            {/* Article: Description + Write Article */}
            {ARTICLE_TYPES.has(lesson.type) && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Write Article
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("resources")}
                  className={`text-xs ${activeSubMenu === "resources" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Resources
                </Button>
              </>
            )}

            {/* Audio/PDF/PPT: Description + Upload */}
            {(lesson.type === "audio" || lesson.type === "pdf" || lesson.type === "ppt") && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("description")}
                  className={`text-xs ${activeSubMenu === "description" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Description
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSubMenuAction("type-editor")}
                  className={`text-xs ${activeSubMenu === "type-editor" ? "text-[var(--color-primary)]" : ""}`}
                >
                  <Plus className="h-3 w-3" />
                  Upload File
                </Button>
              </>
            )}
          </div>

          {/* Sub-menu content area — shared menus */}
          {activeSubMenu === "description" && (
            <LectureDescriptionMenu
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "resources" && (
            <LectureResourcesMenu
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "lab" && (
            <LectureLabMenu onClose={closeSubMenu} />
          )}
          {activeSubMenu === "content" && (
            <LectureContentSelector
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}

          {/* Type-specific editors */}
          {activeSubMenu === "type-editor" && lesson.type === "quiz" && (
            <QuizContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "type-editor" && lesson.type === "assignment" && (
            <AssignmentContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "type-editor" && lesson.type === "coding-exercise" && (
            <CodingExerciseContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "type-editor" && lesson.type === "practice-test" && (
            <PracticeTestContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "type-editor" && ARTICLE_TYPES.has(lesson.type) && (
            <ArticleContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
          {activeSubMenu === "type-editor" && (lesson.type === "audio" || lesson.type === "pdf" || lesson.type === "ppt") && (
            <FileUploadContentEditor
              lesson={lesson}
              courseId={courseId}
              onClose={closeSubMenu}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sortable Module Item ────────────────────────────

export function SortableModuleItem({
  module,
  courseId,
  selectedLessonIds,
  onToggleLesson,
  allSelected,
  onToggleAll,
}: {
  module: Module;
  courseId: string;
  selectedLessonIds: Set<string>;
  onToggleLesson: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [titleValue, setTitleValue] = useState(module.title);
  const [descValue, setDescValue] = useState(module.description ?? "");
  const [showCurriculumPicker, setShowCurriculumPicker] = useState(false);
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const deleteModule = useDeleteModule(courseId);
  const updateModule = useUpdateModule(courseId);
  const addLesson = useAddLesson(courseId);
  const deleteLesson = useDeleteLesson(courseId);
  const reorderLessons = useReorderLessons(courseId);

  const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order);
  const moduleDuration = getModuleDuration(module);
  const durationLabel = getDurationLabel(moduleDuration);

  const {
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleSaveTitle() {
    if (!titleValue.trim()) return;
    updateModule.mutate(
      { moduleId: module.id, title: titleValue.trim() },
      { onSuccess: () => setEditingTitle(false) },
    );
  }

  function handleSaveDesc() {
    apiPatch(`/modules/${module.id}`, { description: descValue }).then(() => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      setShowDesc(false);
    });
  }

  function handlePickCurriculumItem(type: string) {
    setPickedType(type);
    setShowCurriculumPicker(false);
  }

  function handleAddLesson() {
    if (!newLessonTitle.trim() || !pickedType) return;
    addLesson.mutate(
      {
        moduleId: module.id,
        title: newLessonTitle.trim(),
        type: pickedType,
      },
      {
        onSuccess: () => {
          setNewLessonTitle("");
          setPickedType(null);
          setExpanded(true);
        },
      },
    );
  }

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = sortedLessons.findIndex((l) => l.id === active.id);
    const overIndex = sortedLessons.findIndex((l) => l.id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const reordered = arrayMove(sortedLessons, activeIndex, overIndex);
    reorderLessons.mutate({
      moduleId: module.id,
      orderedIds: reordered.map((l: Lesson) => l.id),
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)]"
    >
      {/* Module header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 ${isDragging ? "bg-[var(--color-muted)]" : ""}`}
      >
        {/* Drag handle - positioned first to avoid button interception */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-roledescription="draggable"
          style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none', flexShrink: 0 }}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Expand toggle + Section label */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          <span className="text-sm font-bold flex-shrink-0">
            Section {module.order}:
          </span>
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />

          {/* Title */}
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="h-7 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <Button size="sm" variant="outline" onClick={handleSaveTitle}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTitleValue(module.title);
                  setEditingTitle(false);
                }}
              >
                <XIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="text-sm font-semibold">{module.title}</span>
          )}

          {/* Duration badge */}
          {durationLabel && !editingTitle && (
            <span className="flex items-center gap-0.5 text-xs text-[var(--color-muted-foreground)] flex-shrink-0">
              <Clock className="h-3 w-3" />
              {durationLabel}
            </span>
          )}

          {/* Lesson count badge */}
          <Badge variant="neutral" className="text-[10px] flex-shrink-0">
            {module.lessons.length} lecture
            {module.lessons.length !== 1 ? "s" : ""}
          </Badge>
        </button>

        {/* Actions */}
        {!editingTitle && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Bulk select toggle */}
            <button
              onClick={onToggleAll}
              title={allSelected ? "Deselect all" : "Select all"}
              className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDesc(!showDesc)}
              title="Edit description"
            >
              <span className="text-xs">About</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingTitle(true)}
            >
              Edit
            </Button>

            {/* Settings gear dropdown */}
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
                title="Section settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl py-1">
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setEditingTitle(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)] transition-colors"
                  >
                    Edit title
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setShowDesc(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)] transition-colors"
                  >
                    Edit description
                  </button>
                  <hr className="my-1 border-[var(--color-border)]" />
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      if (confirm(`Delete section "${module.title}"?`)) {
                        deleteModule.mutate(module.id);
                      }
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                  >
                    Delete section
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Description area */}
      {showDesc && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 bg-white/30">
          <textarea
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={handleSaveDesc}
            placeholder="Add a chapter description…"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
        </div>
      )}

      {/* Lesson list — each module has its own DndContext for intra-module lesson reordering */}
      {expanded && (
        <div className="border-t border-[var(--color-border)]">
          {sortedLessons.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-[var(--color-border)] rounded-xl mx-4 my-2">
              <p className="text-sm text-[var(--color-muted-foreground)] italic mb-3">
                No lectures yet. Add a curriculum item to get started.
              </p>
            </div>
          )}
          <DndContext
            sensors={innerSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <SortableContext
              items={sortedLessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedLessons.map((lesson) => (
                <SortableLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  selected={selectedLessonIds.has(lesson.id)}
                  onToggle={onToggleLesson}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* ── Curriculum item picker (Udemy-style) ── */}
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            {/* Title input (shown after picking a type) */}
            {pickedType && (
              <div className="mb-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] flex-shrink-0">
                  {LESSON_TYPE_ICONS[pickedType]}
                  {LESSON_TYPE_LABELS[pickedType] ?? pickedType}:
                </span>
                <Input
                  placeholder="Enter a title…"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  className="flex-1 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddLesson();
                    if (e.key === "Escape") {
                      setPickedType(null);
                      setNewLessonTitle("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={addLesson.isPending || !newLessonTitle.trim()}
                  onClick={handleAddLesson}
                >
                  {addLesson.isPending ? "Adding…" : "Add"}
                </Button>
                <button
                  onClick={() => { setPickedType(null); setNewLessonTitle(""); }}
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] p-1"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* + Curriculum item button */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCurriculumPicker(!showCurriculumPicker)}
                className="border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
              >
                <Plus className="h-3.5 w-3.5" />
                Curriculum item
              </Button>

              {/* Categorized dropdown */}
              {showCurriculumPicker && (
                <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl py-2 max-h-[360px] overflow-y-auto">
                  {CURRICULUM_CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                        {cat.label}
                      </p>
                      {cat.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.type}
                            onClick={() => handlePickCurriculumItem(item.type)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-muted)] transition-colors"
                          >
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg}`}>
                              <Icon className={`h-4 w-4 ${item.color}`} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-[10px] text-[var(--color-muted-foreground)] truncate">
                                {item.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
