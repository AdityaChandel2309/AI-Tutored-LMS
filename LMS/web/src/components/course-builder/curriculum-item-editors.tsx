"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Upload,
  Play,
  Timer,
  CheckCircle2,
  AlertCircle,
  Code,
  FileText,
  HelpCircle,
  ClipboardList,
  BookText,
  Mic,
  Presentation,
  X as XIcon,
  Settings2,
  ListChecks,
  Lightbulb,
  FileUp,
  Globe,
  Braces,
  TestTube,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiPatch } from "@/lib/api/client";
import { RichTextEditor } from "@/components/course-builder/rich-text-editor";
import type { Lesson } from "@/components/course-builder/sortable-module-item";

// ─── Shared Types ────────────────────────────────────

interface EditorProps {
  lesson: Lesson;
  courseId: string;
  onClose: () => void;
}

// ─── Quiz Editor (Inline) ────────────────────────────

type QuizQuestion = {
  id: string;
  text: string;
  type: "multiple-choice" | "multi-select" | "true-false";
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation?: string;
};

export function QuizContentEditor({ lesson, courseId, onClose }: EditorProps) {
  const qc = useQueryClient();
  const existingQuestions = (lesson.content?.questions as QuizQuestion[]) ?? [];
  const [questions, setQuestions] = useState<QuizQuestion[]>(existingQuestions);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [quizDescription, setQuizDescription] = useState(
    (lesson.content?.description as string) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "settings">("questions");

  // Quiz settings
  const [timeLimit, setTimeLimit] = useState(
    (lesson.content?.timeLimitMinutes as number) ?? 0
  );
  const [passingScore, setPassingScore] = useState(
    (lesson.content?.passingScore as number) ?? 70
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(
    (lesson.content?.shuffleQuestions as boolean) ?? false
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    (lesson.content?.showCorrectAnswers as boolean) ?? true
  );

  function addQuestion() {
    const newQ: QuizQuestion = {
      id: `q-${Date.now()}`,
      text: "",
      type: "multiple-choice",
      options: [
        { id: `o-${Date.now()}-1`, text: "", isCorrect: true },
        { id: `o-${Date.now()}-2`, text: "", isCorrect: false },
      ],
      explanation: "",
    };
    setQuestions([...questions, newQ]);
    setExpandedQ(newQ.id);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
    if (expandedQ === id) setExpandedQ(null);
  }

  function updateQuestion(id: string, update: Partial<QuizQuestion>) {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...update } : q)));
  }

  function addOption(qId: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: [
            ...q.options,
            { id: `o-${Date.now()}`, text: "", isCorrect: false },
          ],
        };
      })
    );
  }

  function updateOption(qId: string, optId: string, text: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((o) =>
            o.id === optId ? { ...o, text } : o
          ),
        };
      })
    );
  }

  function toggleCorrect(qId: string, optId: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        if (q.type === "multiple-choice" || q.type === "true-false") {
          // Only one correct
          return {
            ...q,
            options: q.options.map((o) => ({
              ...o,
              isCorrect: o.id === optId,
            })),
          };
        }
        // Multi-select: toggle
        return {
          ...q,
          options: q.options.map((o) =>
            o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o
          ),
        };
      })
    );
  }

  function removeOption(qId: string, optId: string) {
    setQuestions(
      questions.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, options: q.options.filter((o) => o.id !== optId) };
      })
    );
  }

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        questions,
        description: quizDescription,
        timeLimitMinutes: timeLimit,
        passingScore,
        shuffleQuestions,
        showCorrectAnswers,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-green-500" />
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            Quiz Content
          </span>
          <Badge variant="neutral" className="text-[10px]">
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-border)] mb-4">
        <button
          onClick={() => setActiveTab("questions")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "questions"
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <ListChecks className="h-3 w-3 inline mr-1" />
          Questions
          {activeTab === "questions" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "settings"
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Settings2 className="h-3 w-3 inline mr-1" />
          Settings
          {activeTab === "settings" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>
      </div>

      {activeTab === "questions" && (
        <>
          {/* Description */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
              Quiz Description
            </label>
            <textarea
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              placeholder="Describe what this quiz covers…"
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
            />
          </div>

          {/* Questions list */}
          <div className="space-y-2">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]"
              >
                {/* Question header */}
                <button
                  onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-green-50 text-[10px] font-bold text-green-600 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm truncate">
                    {q.text || "Untitled question"}
                  </span>
                  <Badge variant="neutral" className="text-[9px] flex-shrink-0">
                    {q.type === "multiple-choice"
                      ? "MC"
                      : q.type === "multi-select"
                      ? "MS"
                      : "T/F"}
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestion(q.id);
                    }}
                    className="flex-shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {expandedQ === q.id ? (
                    <ChevronUp className="h-3 w-3 text-[var(--color-muted-foreground)] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-[var(--color-muted-foreground)] flex-shrink-0" />
                  )}
                </button>

                {/* Expanded question editor */}
                {expandedQ === q.id && (
                  <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-3">
                    {/* Question type selector */}
                    <div className="flex gap-1">
                      {(
                        [
                          { value: "multiple-choice", label: "Multiple Choice" },
                          { value: "multi-select", label: "Multi Select" },
                          { value: "true-false", label: "True / False" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.value}
                          onClick={() => {
                            if (t.value === "true-false") {
                              updateQuestion(q.id, {
                                type: t.value,
                                options: [
                                  {
                                    id: "tf-true",
                                    text: "True",
                                    isCorrect: true,
                                  },
                                  {
                                    id: "tf-false",
                                    text: "False",
                                    isCorrect: false,
                                  },
                                ],
                              });
                            } else {
                              updateQuestion(q.id, { type: t.value });
                            }
                          }}
                          className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                            q.type === t.value
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/80"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Question text */}
                    <Input
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(q.id, { text: e.target.value })
                      }
                      placeholder="Enter your question…"
                      className="text-sm"
                    />

                    {/* Options */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        Answers{" "}
                        <span className="font-normal normal-case">
                          (click radio to mark correct)
                        </span>
                      </p>
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-center gap-2"
                        >
                          <button
                            onClick={() => toggleCorrect(q.id, opt.id)}
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0 ${
                              opt.isCorrect
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-[var(--color-border)] hover:border-green-300"
                            }`}
                          >
                            {opt.isCorrect && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                          </button>
                          <Input
                            value={opt.text}
                            onChange={(e) =>
                              updateOption(q.id, opt.id, e.target.value)
                            }
                            placeholder="Answer option…"
                            className="flex-1 h-8 text-sm"
                            disabled={q.type === "true-false"}
                          />
                          {q.type !== "true-false" && q.options.length > 2 && (
                            <button
                              onClick={() => removeOption(q.id, opt.id)}
                              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {q.type !== "true-false" && (
                        <button
                          onClick={() => addOption(q.id)}
                          className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                        >
                          <Plus className="h-3 w-3" />
                          Add answer
                        </button>
                      )}
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        <Lightbulb className="h-3 w-3 inline mr-0.5" />
                        Explanation (shown after answer)
                      </label>
                      <textarea
                        value={q.explanation ?? ""}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            explanation: e.target.value,
                          })
                        }
                        placeholder="Explain why this answer is correct…"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add question button */}
          <button
            onClick={addQuestion}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--color-border)] py-3 text-xs font-medium text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Question
          </button>
        </>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* Time limit */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <Timer className="h-3 w-3" />
              Time Limit (minutes)
            </label>
            <Input
              type="number"
              min={0}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              placeholder="0 = no limit"
              className="w-32 text-sm"
            />
            <p className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)]">
              Set to 0 for no time limit
            </p>
          </div>

          {/* Passing score */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <Award className="h-3 w-3" />
              Passing Score (%)
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="w-32 text-sm"
            />
          </div>

          {/* Toggle settings */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={() => setShuffleQuestions(!shuffleQuestions)}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-xs text-[var(--color-foreground)]">
              Shuffle questions order
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCorrectAnswers}
              onChange={() => setShowCorrectAnswers(!showCorrectAnswers)}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-xs text-[var(--color-foreground)]">
              Show correct answers after submission
            </span>
          </label>
        </div>
      )}

      {/* Save / Cancel */}
      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Quiz"}
        </Button>
      </div>
    </div>
  );
}

// ─── Assignment Editor ───────────────────────────────

export function AssignmentContentEditor({
  lesson,
  courseId,
  onClose,
}: EditorProps) {
  const qc = useQueryClient();
  const [instructions, setInstructions] = useState(
    (lesson.content?.instructions as string) ?? ""
  );
  const [rubric, setRubric] = useState(
    (lesson.content?.rubric as string) ?? ""
  );
  const [dueInDays, setDueInDays] = useState(
    (lesson.content?.dueInDays as number) ?? 7
  );
  const [maxScore, setMaxScore] = useState(
    (lesson.content?.maxScore as number) ?? 100
  );
  const [allowLateSubmission, setAllowLateSubmission] = useState(
    (lesson.content?.allowLateSubmission as boolean) ?? false
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "instructions" | "rubric" | "settings"
  >("instructions");

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        instructions,
        rubric,
        dueInDays,
        maxScore,
        allowLateSubmission,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookText className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            Assignment Content
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-4">
        {(
          [
            { id: "instructions" as const, label: "Instructions", icon: FileText },
            { id: "rubric" as const, label: "Rubric", icon: ListChecks },
            { id: "settings" as const, label: "Settings", icon: Settings2 },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <tab.icon className="h-3 w-3 inline mr-1" />
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "instructions" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Describe the task students need to complete. Be specific about
            deliverables, format, and expectations.
          </p>
          <RichTextEditor
            content={instructions}
            onChange={setInstructions}
            placeholder="Write assignment instructions…"
          />
        </div>
      )}

      {activeTab === "rubric" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Define the grading criteria so students understand how they&apos;ll be
            evaluated.
          </p>
          <RichTextEditor
            content={rubric}
            onChange={setRubric}
            placeholder="Define grading criteria…"
          />
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <Timer className="h-3 w-3" />
              Due in (days after enrollment)
            </label>
            <Input
              type="number"
              min={1}
              value={dueInDays}
              onChange={(e) => setDueInDays(Number(e.target.value))}
              className="w-32 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <Award className="h-3 w-3" />
              Max Score
            </label>
            <Input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-32 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowLateSubmission}
              onChange={() => setAllowLateSubmission(!allowLateSubmission)}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-xs text-[var(--color-foreground)]">
              Allow late submissions
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Assignment"}
        </Button>
      </div>
    </div>
  );
}

// ─── Coding Exercise Editor ──────────────────────────

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
] as const;

export function CodingExerciseContentEditor({
  lesson,
  courseId,
  onClose,
}: EditorProps) {
  const qc = useQueryClient();
  const [language, setLanguage] = useState(
    (lesson.content?.language as string) ?? "javascript"
  );
  const [instructions, setInstructions] = useState(
    (lesson.content?.instructions as string) ?? ""
  );
  const [starterCode, setStarterCode] = useState(
    (lesson.content?.starterCode as string) ?? ""
  );
  const [solutionCode, setSolutionCode] = useState(
    (lesson.content?.solutionCode as string) ?? ""
  );
  const [testCode, setTestCode] = useState(
    (lesson.content?.testCode as string) ?? ""
  );
  const [hints, setHints] = useState(
    (lesson.content?.hints as string) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "instructions" | "starter" | "solution" | "tests" | "hints"
  >("instructions");

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        language,
        instructions,
        starterCode,
        solutionCode,
        testCode,
        hints,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            Coding Exercise
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Language selector */}
      <div className="mb-4">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
          <Globe className="h-3 w-3" />
          Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-[var(--color-border)] mb-4">
        {(
          [
            { id: "instructions" as const, label: "Instructions", icon: FileText },
            { id: "starter" as const, label: "Starter Code", icon: Braces },
            { id: "solution" as const, label: "Solution", icon: CheckCircle2 },
            { id: "tests" as const, label: "Test Cases", icon: TestTube },
            { id: "hints" as const, label: "Hints", icon: Lightbulb },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <tab.icon className="h-3 w-3 inline mr-1" />
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "instructions" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Describe the coding challenge. Include expected inputs, outputs, and
            constraints.
          </p>
          <RichTextEditor
            content={instructions}
            onChange={setInstructions}
            placeholder="Write exercise instructions…"
          />
        </div>
      )}

      {activeTab === "starter" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Code that students start with. Include function signatures and
            comments.
          </p>
          <textarea
            value={starterCode}
            onChange={(e) => setStarterCode(e.target.value)}
            placeholder={`// Write your ${LANGUAGES.find((l) => l.value === language)?.label ?? language} starter code…`}
            rows={10}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-gray-900 px-4 py-3 text-sm font-mono text-green-400 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
        </div>
      )}

      {activeTab === "solution" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            The reference solution. This won&apos;t be shown to students but is used
            for validation.
          </p>
          <textarea
            value={solutionCode}
            onChange={(e) => setSolutionCode(e.target.value)}
            placeholder="// Reference solution…"
            rows={10}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-gray-900 px-4 py-3 text-sm font-mono text-green-400 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
        </div>
      )}

      {activeTab === "tests" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Write test cases to validate student submissions. These run
            automatically.
          </p>
          <textarea
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder="// Test cases…"
            rows={10}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-gray-900 px-4 py-3 text-sm font-mono text-green-400 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
        </div>
      )}

      {activeTab === "hints" && (
        <div>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Optional hints to help students who get stuck. They can reveal hints
            one at a time.
          </p>
          <textarea
            value={hints}
            onChange={(e) => setHints(e.target.value)}
            placeholder="Hint 1: Think about edge cases…&#10;Hint 2: Consider using a hash map…"
            rows={6}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
          <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
            Separate hints with line breaks. Each line becomes a separate hint.
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Exercise"}
        </Button>
      </div>
    </div>
  );
}

// ─── Practice Test Editor ────────────────────────────

export function PracticeTestContentEditor({
  lesson,
  courseId,
  onClose,
}: EditorProps) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(
    (lesson.content?.description as string) ?? ""
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    (lesson.content?.timeLimitMinutes as number) ?? 60
  );
  const [passingScore, setPassingScore] = useState(
    (lesson.content?.passingScore as number) ?? 65
  );
  const [totalQuestions, setTotalQuestions] = useState(
    (lesson.content?.totalQuestions as number) ?? 50
  );
  const [certificationName, setCertificationName] = useState(
    (lesson.content?.certificationName as string) ?? ""
  );
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        description,
        timeLimitMinutes,
        passingScore,
        totalQuestions,
        certificationName,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-lime-500" />
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            Practice Test
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-4 rounded-lg bg-lime-50 border border-lime-200 px-3 py-2.5 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-lime-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-lime-800">
          Practice tests simulate real certification exams. Set the time limit
          and passing score to match the actual exam conditions.
        </p>
      </div>

      <div className="space-y-4">
        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
            Test Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what certification this practice test prepares for…"
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
          />
        </div>

        {/* Certification Name */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
            <Award className="h-3 w-3" />
            Certification Name
          </label>
          <Input
            value={certificationName}
            onChange={(e) => setCertificationName(e.target.value)}
            placeholder="e.g. AWS Solutions Architect Associate"
            className="text-sm"
          />
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <Timer className="h-3 w-3" />
              Time Limit
            </label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                className="w-20 text-sm"
              />
              <span className="text-xs text-[var(--color-muted-foreground)]">
                min
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <CheckCircle2 className="h-3 w-3" />
              Passing %
            </label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-20 text-sm"
              />
              <span className="text-xs text-[var(--color-muted-foreground)]">
                %
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
              <ListChecks className="h-3 w-3" />
              Questions
            </label>
            <Input
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
              className="w-20 text-sm"
            />
          </div>
        </div>

        <p className="text-[10px] text-[var(--color-muted-foreground)]">
          Manage individual questions in the dedicated question editor after
          saving.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Practice Test"}
        </Button>
      </div>
    </div>
  );
}

// ─── File Upload Editor (Audio, PDF, PPT) ─────────────

export function FileUploadContentEditor({
  lesson,
  courseId,
  onClose,
}: EditorProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(
    (lesson.content?.description as string) ?? ""
  );
  const [fileName, setFileName] = useState(
    (lesson.content?.fileName as string) ?? ""
  );
  const [saving, setSaving] = useState(false);

  const typeConfig: Record<
    string,
    { icon: React.ReactNode; label: string; accept: string; hint: string; color: string; bg: string }
  > = {
    audio: {
      icon: <Mic className="h-8 w-8 text-cyan-500" />,
      label: "Audio Lesson",
      accept: "audio/*,.mp3,.wav,.ogg,.m4a",
      hint: "Upload an MP3, WAV, OGG, or M4A audio file",
      color: "text-cyan-500",
      bg: "bg-cyan-50 border-cyan-200",
    },
    pdf: {
      icon: <FileText className="h-8 w-8 text-red-500" />,
      label: "PDF Document",
      accept: ".pdf",
      hint: "Upload a PDF document for students to read",
      color: "text-red-500",
      bg: "bg-red-50 border-red-200",
    },
    ppt: {
      icon: <Presentation className="h-8 w-8 text-orange-500" />,
      label: "Presentation",
      accept: ".ppt,.pptx,.key",
      hint: "Upload a PowerPoint or Keynote presentation",
      color: "text-orange-500",
      bg: "bg-orange-50 border-orange-200",
    },
  };

  const config = typeConfig[lesson.type] ?? {
    icon: <FileUp className="h-8 w-8 text-gray-500" />,
    label: "File Upload",
    accept: "*",
    hint: "Upload a file",
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
  };

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        description,
        fileName,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.icon && (
            <span className="flex-shrink-0">
              {/* Show a small version of the icon */}
              {lesson.type === "audio" && <Mic className="h-4 w-4 text-cyan-500" />}
              {lesson.type === "pdf" && <FileText className="h-4 w-4 text-red-500" />}
              {lesson.type === "ppt" && <Presentation className="h-4 w-4 text-orange-500" />}
            </span>
          )}
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            {config.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* File upload zone */}
      <div
        className={`mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer hover:border-[var(--color-primary)] ${
          fileName ? config.bg : "border-[var(--color-border)]"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setFileName(file.name);
          }}
        />
        {fileName ? (
          <>
            {config.icon}
            <p className="text-sm font-medium text-[var(--color-foreground)]">
              {fileName}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFileName("");
              }}
              className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
            >
              Remove file
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--color-foreground)]">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {config.hint}
            </p>
          </>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Add a description for this ${config.label.toLowerCase()}…`}
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Article Content Editor ──────────────────────────

export function ArticleContentEditor({
  lesson,
  courseId,
  onClose,
}: EditorProps) {
  const qc = useQueryClient();
  const [articleContent, setArticleContent] = useState(
    (lesson.content?.articleContent as string) ?? ""
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    (lesson.content?.estimatedMinutes as number) ?? 5
  );
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content ?? {}),
        articleContent,
        estimatedMinutes,
      },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-500" />
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            Article Content
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Estimated reading time */}
      <div className="mb-3 flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)]">
          <Timer className="h-3 w-3" />
          Est. reading time:
        </label>
        <Input
          type="number"
          min={1}
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
          className="w-16 h-7 text-xs"
        />
        <span className="text-xs text-[var(--color-muted-foreground)]">min</span>
      </div>

      {/* Rich text editor */}
      <RichTextEditor
        content={articleContent}
        onChange={setArticleContent}
        placeholder="Write your article content here…"
      />

      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Article"}
        </Button>
      </div>
    </div>
  );
}
