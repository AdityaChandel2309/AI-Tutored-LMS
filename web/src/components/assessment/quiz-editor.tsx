"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import {
  useAssessment,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  useAddQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from "@/lib/api/assessments";
import type { Question } from "@/lib/types/course";

type QuestionFormData = {
  type: string;
  text: string;
  explanation: string;
  points: number;
  options: { text: string; isCorrect: boolean }[];
};

const EMPTY_QUESTION: QuestionFormData = {
  type: "multiple_choice",
  text: "",
  explanation: "",
  points: 1,
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
};

export function QuizEditor({
  lessonId,
  lessonTitle,
}: {
  lessonId: string;
  lessonTitle: string;
}) {
  const { data: assessment, isLoading, error } = useAssessment(lessonId);
  const createAssessment = useCreateAssessment(lessonId);

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createPassingScore, setCreatePassingScore] = useState(70);
  const [createMaxAttempts, setCreateMaxAttempts] = useState<string>("");
  const [createTimeLimitMin, setCreateTimeLimitMin] = useState<string>("");

  if (isLoading) {
    return <Notice>Loading assessment…</Notice>;
  }

  if (error instanceof Error && !error.message.includes("not found")) {
    return (
      <Notice variant="danger">{error.message}</Notice>
    );
  }

  if (!assessment) {
    return (
      <div className="mt-3 space-y-3">
        {!showCreate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCreateTitle(`${lessonTitle} Quiz`);
              setShowCreate(true);
            }}
          >
            + Create Quiz Assessment
          </Button>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] p-4 space-y-3">
            <h5 className="text-sm font-semibold">New Assessment</h5>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                Title
              </label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Passing Score (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={createPassingScore}
                  onChange={(e) =>
                    setCreatePassingScore(Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Max Attempts (blank = unlimited)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={createMaxAttempts}
                  onChange={(e) =>
                    setCreateMaxAttempts(e.target.value)
                  }
                  placeholder="Unlimited"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Time Limit (minutes, blank = untimed)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={createTimeLimitMin}
                  onChange={(e) => setCreateTimeLimitMin(e.target.value)}
                  placeholder="Untimed"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={createAssessment.isPending || !createTitle.trim()}
                onClick={() =>
                  createAssessment.mutate(
                    {
                      title: createTitle.trim(),
                      passingScore: createPassingScore,
                      maxAttempts: createMaxAttempts
                        ? Number(createMaxAttempts)
                        : undefined,
                      timeLimitSec: createTimeLimitMin
                        ? Number(createTimeLimitMin) * 60
                        : undefined,
                    },
                    { onSuccess: () => setShowCreate(false) },
                  )
                }
              >
                {createAssessment.isPending ? "Creating…" : "Create"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
            {createAssessment.isError && (
              <Notice variant="danger">
                {(createAssessment.error as Error).message}
              </Notice>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <AssessmentEditor
      assessmentId={assessment.id}
      lessonId={lessonId}
      assessment={assessment}
    />
  );
}

// ─── Inner component with assessment loaded ──

function AssessmentEditor({
  assessmentId,
  lessonId,
  assessment,
}: {
  assessmentId: string;
  lessonId: string;
  assessment: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    maxAttempts: number | null;
    timeLimitSec: number | null;
    questions: Question[];
  };
}) {
  const updateAssessment = useUpdateAssessment(assessmentId, lessonId);
  const deleteAssessment = useDeleteAssessment(assessmentId, lessonId);
  const addQuestion = useAddQuestion(assessmentId, lessonId);
  const updateQuestion = useUpdateQuestion(lessonId);
  const deleteQuestion = useDeleteQuestion(lessonId);

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState(assessment.title);
  const [metaPassingScore, setMetaPassingScore] = useState(
    assessment.passingScore,
  );
  const [metaMaxAttempts, setMetaMaxAttempts] = useState<string>(
    assessment.maxAttempts?.toString() ?? "",
  );
  const [metaTimeLimitMin, setMetaTimeLimitMin] = useState<string>(
    assessment.timeLimitSec ? String(Math.round(assessment.timeLimitSec / 60)) : "",
  );

  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQuestion, setNewQuestion] =
    useState<QuestionFormData>(EMPTY_QUESTION);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editQuestion, setEditQuestion] =
    useState<QuestionFormData>(EMPTY_QUESTION);

  const sortedQuestions = [...assessment.questions].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="mt-3 space-y-3">
      {/* Assessment metadata header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Quiz</Badge>
            <span className="text-sm font-semibold">{assessment.title}</span>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMetaTitle(assessment.title);
                setMetaPassingScore(assessment.passingScore);
                setMetaMaxAttempts(assessment.maxAttempts?.toString() ?? "");
                setMetaTimeLimitMin(
                  assessment.timeLimitSec
                    ? String(Math.round(assessment.timeLimitSec / 60))
                    : "",
                );
                setEditingMeta(true);
              }}
            >
              Settings
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={deleteAssessment.isPending}
              onClick={() => {
                if (confirm("Delete this assessment and all questions?")) {
                  deleteAssessment.mutate();
                }
              }}
            >
              ✕
            </Button>
          </div>
        </div>

        <div className="mt-2 flex gap-4 text-xs text-[var(--color-muted-foreground)]">
          <span>Pass: {assessment.passingScore}%</span>
          <span>
            Attempts: {assessment.maxAttempts ?? "Unlimited"}
          </span>
          <span>
            Time: {assessment.timeLimitSec ? `${Math.round(assessment.timeLimitSec / 60)} min` : "Untimed"}
          </span>
          <span>{assessment.questions.length} questions</span>
        </div>

        {editingMeta && (
          <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                Title
              </label>
              <Input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Passing Score (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={metaPassingScore}
                  onChange={(e) =>
                    setMetaPassingScore(Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Max Attempts
                </label>
                <Input
                  type="number"
                  min={1}
                  value={metaMaxAttempts}
                  onChange={(e) =>
                    setMetaMaxAttempts(e.target.value)
                  }
                  placeholder="Unlimited"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Time Limit (minutes, blank = untimed)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={metaTimeLimitMin}
                  onChange={(e) => setMetaTimeLimitMin(e.target.value)}
                  placeholder="Untimed"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={updateAssessment.isPending}
                onClick={() =>
                  updateAssessment.mutate(
                    {
                      title: metaTitle.trim(),
                      passingScore: metaPassingScore,
                      maxAttempts: metaMaxAttempts
                        ? Number(metaMaxAttempts)
                        : null,
                      timeLimitSec: metaTimeLimitMin
                        ? Number(metaTimeLimitMin) * 60
                        : null,
                    },
                    { onSuccess: () => setEditingMeta(false) },
                  )
                }
              >
                {updateAssessment.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingMeta(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Question list */}
      {sortedQuestions.map((q) => (
        <div
          key={q.id}
          className="rounded-lg border border-[var(--color-border)] bg-white/60 p-3"
        >
          {editingQuestionId === q.id ? (
            <QuestionForm
              data={editQuestion}
              onChange={setEditQuestion}
              onSave={() =>
                updateQuestion.mutate(
                  {
                    questionId: q.id,
                    type: editQuestion.type,
                    text: editQuestion.text.trim(),
                    explanation: editQuestion.explanation.trim() || null,
                    points: editQuestion.points,
                    options: editQuestion.options.map((o, i) => ({
                      text: o.text.trim(),
                      isCorrect: o.isCorrect,
                      order: i + 1,
                    })),
                  },
                  { onSuccess: () => setEditingQuestionId(null) },
                )
              }
              onCancel={() => setEditingQuestionId(null)}
              isPending={updateQuestion.isPending}
              saveLabel="Update"
            />
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                    Q{q.order}.
                  </span>
                  <span className="text-sm">{q.text}</span>
                  <Badge variant="neutral">
                    {q.type.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {q.points}pt{q.points !== 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="mt-1.5 ml-6 space-y-0.5">
                  {q.options.map((opt) => (
                    <li
                      key={opt.id}
                      className={`text-xs ${
                        opt.isCorrect
                          ? "font-semibold text-green-700"
                          : "text-[var(--color-muted-foreground)]"
                      }`}
                    >
                      {opt.isCorrect ? "✓ " : "○ "}
                      {opt.text}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-1 ml-6 text-xs italic text-[var(--color-muted-foreground)]">
                    💡 {q.explanation}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingQuestionId(q.id);
                    setEditQuestion({
                      type: q.type,
                      text: q.text,
                      explanation: q.explanation ?? "",
                      points: q.points,
                      options: q.options.map((o) => ({
                        text: o.text,
                        isCorrect: o.isCorrect ?? false,
                      })),
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteQuestion.isPending}
                  onClick={() => {
                    if (confirm(`Delete question "${q.text.slice(0, 40)}…"?`)) {
                      deleteQuestion.mutate(q.id);
                    }
                  }}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add question */}
      {addingQuestion ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)] p-4">
          <h5 className="mb-3 text-sm font-semibold">New Question</h5>
          <QuestionForm
            data={newQuestion}
            onChange={setNewQuestion}
            onSave={() =>
              addQuestion.mutate(
                {
                  type: newQuestion.type,
                  text: newQuestion.text.trim(),
                  explanation: newQuestion.explanation.trim() || undefined,
                  points: newQuestion.points,
                  order: sortedQuestions.length + 1,
                  options: newQuestion.options.map((o, i) => ({
                    text: o.text.trim(),
                    isCorrect: o.isCorrect,
                    order: i + 1,
                  })),
                },
                {
                  onSuccess: () => {
                    setAddingQuestion(false);
                    setNewQuestion(EMPTY_QUESTION);
                  },
                },
              )
            }
            onCancel={() => {
              setAddingQuestion(false);
              setNewQuestion(EMPTY_QUESTION);
            }}
            isPending={addQuestion.isPending}
            saveLabel="Add Question"
          />
          {addQuestion.isError && (
            <Notice variant="danger" className="mt-2">
              {(addQuestion.error as Error).message}
            </Notice>
          )}
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddingQuestion(true)}
        >
          + Add Question
        </Button>
      )}
    </div>
  );
}

// ─── Reusable Question Form ─────────────────

function QuestionForm({
  data,
  onChange,
  onSave,
  onCancel,
  isPending,
  saveLabel,
}: {
  data: QuestionFormData;
  onChange: (d: QuestionFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  saveLabel: string;
}) {
  function updateOption(
    index: number,
    patch: Partial<{ text: string; isCorrect: boolean }>,
  ) {
    const next = [...data.options];
    next[index] = { ...next[index], ...patch };

    // For multiple_choice / true_false, only one correct
    if (patch.isCorrect && data.type !== "multi_select") {
      next.forEach((o, i) => {
        if (i !== index) o.isCorrect = false;
      });
    }

    onChange({ ...data, options: next });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Question Text
          </label>
          <Input
            value={data.text}
            onChange={(e) => onChange({ ...data, text: e.target.value })}
            placeholder="Enter question…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Type
          </label>
          <select
            className="h-9 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-xs"
            value={data.type}
            onChange={(e) => {
              const type = e.target.value;
              let options = data.options;
              if (type === "true_false") {
                options = [
                  { text: "True", isCorrect: true },
                  { text: "False", isCorrect: false },
                ];
              } else if (data.type === "true_false" && type !== "true_false") {
                options = data.options?.length === 2
                  ? data.options.map((o) => ({
                      text: o.text === "True" || o.text === "False" ? "" : o.text,
                      isCorrect: false,
                    }))
                  : data.options;
              }
              onChange({ ...data, type, options });
            }}
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="multi_select">Multi Select</option>
            <option value="true_false">True / False</option>
          </select>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
          Options
          {data.type === "multi_select" && (
            <span className="ml-1 text-[10px] text-[var(--color-muted-foreground)]">
              (check all correct answers)
            </span>
          )}
        </label>
        <div className="space-y-1.5">
          {data.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={data.type === "multi_select" ? "checkbox" : "radio"}
                name="correct-option"
                checked={opt.isCorrect}
                onChange={() =>
                  updateOption(i, {
                    isCorrect: data.type === "multi_select" ? !opt.isCorrect : true,
                  })
                }
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <Input
                value={opt.text}
                onChange={(e) =>
                  updateOption(i, { text: e.target.value })
                }
                placeholder={`Option ${i + 1}`}
                className="flex-1"
                disabled={data.type === "true_false"}
              />
              {data.type !== "true_false" && data.options.length > 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      ...data,
                      options: data.options.filter((_, j) => j !== i),
                    })
                  }
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
        </div>
        {data.type !== "true_false" && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() =>
              onChange({
                ...data,
                options: [
                  ...data.options,
                  { text: "", isCorrect: false },
                ],
              })
            }
          >
            + Option
          </Button>
        )}
      </div>

      {/* Explanation + Points */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Explanation (shown after submission)
          </label>
          <Input
            value={data.explanation}
            onChange={(e) =>
              onChange({ ...data, explanation: e.target.value })
            }
            placeholder="Optional explanation…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Points
          </label>
          <Input
            type="number"
            min={1}
            value={data.points}
            onChange={(e) =>
              onChange({ ...data, points: Number(e.target.value) })
            }
            className="w-20"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending || !data.text.trim() || data.options.some((o) => !o.text.trim())}
          onClick={onSave}
        >
          {isPending ? "Saving…" : saveLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
