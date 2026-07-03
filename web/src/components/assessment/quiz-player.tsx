"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import {
  useAssessment,
  useMyAttempts,
  useStartAttempt,
  useSubmitAttempt,
} from "@/lib/api/assessments";
import { QuizResults } from "@/components/assessment/quiz-results";
import type { AssessmentAttempt, Question } from "@/lib/types/course";

export function QuizPlayer({
  lessonId,
  courseId,
  onCompleted,
}: {
  lessonId: string;
  courseId: string;
  onCompleted?: () => void;
}) {
  const { data: assessment, isLoading, error } = useAssessment(lessonId);
  const { data: attempts } = useMyAttempts(assessment?.id ?? null);

  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttempt | null>(
    null,
  );
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

  if (isLoading) {
    return <Notice>Loading quiz…</Notice>;
  }

  if (error) {
    const msg = (error as Error).message;
    if (msg?.includes("not found")) {
      return (
        <Notice>No quiz has been configured for this lesson yet.</Notice>
      );
    }
    return <Notice variant="danger">{msg}</Notice>;
  }

  if (!assessment) {
    return <Notice>No quiz configured.</Notice>;
  }

  // Show results if reviewing
  if (reviewAttemptId) {
    return (
      <QuizResults
        attemptId={reviewAttemptId}
        onBack={() => setReviewAttemptId(null)}
      />
    );
  }

  // Show active attempt
  if (activeAttempt && !activeAttempt.submittedAt) {
    return (
      <AttemptView
        attempt={activeAttempt}
        assessment={assessment}
        courseId={courseId}
        onSubmitted={(result) => {
          setActiveAttempt(result);
          if (result.passed) {
            onCompleted?.();
          }
          setReviewAttemptId(result.id);
        }}
      />
    );
  }

  // Landing: show past attempts + start button
  const sortedAttempts = attempts
    ? [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)
    : [];

  const bestScore = sortedAttempts.reduce(
    (max, a) => (a.score != null && a.score > max ? a.score : max),
    0,
  );

  const hasPassed = sortedAttempts.some((a) => a.passed);
  const attemptsUsed = sortedAttempts.length;
  const canRetake =
    !hasPassed &&
    (assessment.maxAttempts === null ||
      attemptsUsed < assessment.maxAttempts);

  return (
    <div className="space-y-4">
      {/* Quiz info card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] p-5">
        <h3 className="text-lg font-semibold">{assessment.title}</h3>
        {assessment.description && (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {assessment.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
          <span>{assessment.questions.length} questions</span>
          <span>Pass: {assessment.passingScore}%</span>
          {assessment.maxAttempts && (
            <span>
              Attempts: {attemptsUsed}/{assessment.maxAttempts}
            </span>
          )}
          {assessment.timeLimitSec && (
            <span>
              Time: {Math.ceil(assessment.timeLimitSec / 60)} min
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      {hasPassed && (
        <Notice variant="success">
          ✓ You passed this quiz with a score of {bestScore}%
        </Notice>
      )}

      {/* Past attempts */}
      {sortedAttempts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
            Past Attempts
          </h4>
          {sortedAttempts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white/60 px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--color-muted-foreground)]">
                  Attempt {a.attemptNumber}
                </span>
                {a.score != null && (
                  <Badge variant={a.passed ? "success" : "warning"}>
                    {a.score}%
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReviewAttemptId(a.id)}
              >
                Review
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Start quiz */}
      {(canRetake || sortedAttempts.length === 0) && (
        <StartQuizButton
          assessmentId={assessment.id}
          isFirstAttempt={sortedAttempts.length === 0}
          onStarted={setActiveAttempt}
        />
      )}

      {!canRetake && !hasPassed && attemptsUsed > 0 && (
        <Notice variant="danger">
          You have used all {assessment.maxAttempts} attempts.
        </Notice>
      )}
    </div>
  );
}

// ─── Start Quiz Button ──────────────────────

function StartQuizButton({
  assessmentId,
  isFirstAttempt,
  onStarted,
}: {
  assessmentId: string;
  isFirstAttempt: boolean;
  onStarted: (attempt: AssessmentAttempt) => void;
}) {
  const startAttempt = useStartAttempt(assessmentId);

  return (
    <div>
      <Button
        disabled={startAttempt.isPending}
        onClick={() =>
          startAttempt.mutate(undefined, {
            onSuccess: (data) => onStarted(data),
          })
        }
      >
        {startAttempt.isPending
          ? "Starting…"
          : isFirstAttempt
            ? "Start Quiz"
            : "Retake Quiz"}
      </Button>
      {startAttempt.isError && (
        <Notice variant="danger" className="mt-2">
          {(startAttempt.error as Error).message}
        </Notice>
      )}
    </div>
  );
}

// ─── Active Attempt View ────────────────────

function AttemptView({
  attempt,
  assessment,
  courseId,
  onSubmitted,
}: {
  attempt: AssessmentAttempt;
  assessment: {
    id: string;
    passingScore: number;
    timeLimitSec: number | null;
    questions: Question[];
  };
  courseId: string;
  onSubmitted: (result: AssessmentAttempt) => void;
}) {
  const questions = assessment.questions;
  const [answers, setAnswers] = useState<
    Record<string, string[]>
  >({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showReview, setShowReview] = useState(false);

  const submitAttempt = useSubmitAttempt(
    attempt.id,
    assessment.id,
    courseId,
  );

  // Countdown timer (only if time-limited).
  const deadlineMs = useMemo(() => {
    if (!assessment.timeLimitSec) return null;
    const started = attempt.startedAt
      ? new Date(attempt.startedAt).getTime()
      : Date.now();
    return started + assessment.timeLimitSec * 1000;
  }, [assessment.timeLimitSec, attempt.startedAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const secondsLeft = deadlineMs
    ? Math.max(0, Math.floor((deadlineMs - now) / 1000))
    : null;

  const autoSubmittedRef = useRef(false);

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.values(answers).filter((v) => v && v.length > 0).length;
  const unansweredIndexes = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => !(answers[q.id] && answers[q.id].length > 0))
    .map(({ i }) => i);

  function selectOption(questionId: string, optionId: string, questionType: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (questionType === "multi_select") {
        // Toggle
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      // Single select
      return { ...prev, [questionId]: [optionId] };
    });
  }

  function handleSubmit() {
    const answerPayload = questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: answers[q.id] ?? [],
    }));

    submitAttempt.mutate(
      { answers: answerPayload },
      { onSuccess: (data) => onSubmitted(data) },
    );
  }

  // Auto-submit once the timer expires.
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmittedRef.current && !submitAttempt.isPending) {
      autoSubmittedRef.current = true;
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!currentQuestion) {
    return <Notice variant="danger">No questions found.</Notice>;
  }

  // ── Review-before-submit screen ──
  if (showReview) {
    return (
      <div className="space-y-4">
        {secondsLeft !== null && (
          <TimerBar secondsLeft={secondsLeft} />
        )}
        <Card className="p-6">
          <h3 className="text-lg font-semibold">Review your answers</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            You answered {answeredCount} of {questions.length} questions.
          </p>

          {unansweredIndexes.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] p-3 text-xs text-[var(--color-warning)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {unansweredIndexes.length} question
                {unansweredIndexes.length === 1 ? "" : "s"} still unanswered.
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
            {questions.map((q, i) => {
              const answered = !!(answers[q.id] && answers[q.id].length > 0);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setCurrentIdx(i);
                    setShowReview(false);
                  }}
                  className={`aspect-square rounded-md border text-xs font-semibold transition-colors ${
                    answered
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:border-[var(--color-warning)]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button size="sm" variant="ghost" onClick={() => setShowReview(false)}>
              ← Back to questions
            </Button>
            <Button
              size="sm"
              disabled={submitAttempt.isPending}
              onClick={handleSubmit}
            >
              {submitAttempt.isPending ? "Submitting…" : "Submit Quiz"}
            </Button>
          </div>

          {submitAttempt.isError && (
            <Notice variant="danger" className="mt-3">
              {(submitAttempt.error as Error).message}
            </Notice>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {secondsLeft !== null && <TimerBar secondsLeft={secondsLeft} />}

      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span>
          {answeredCount}/{questions.length} answered
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
          style={{
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold">
            {currentQuestion.text}
          </h3>
          <Badge variant="neutral">
            {currentQuestion.type.replace("_", " ")}
          </Badge>
        </div>

        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {currentQuestion.type === "multi_select"
            ? "Select all that apply"
            : "Select one answer"}
        </p>

        {/* Options */}
        <div className="mt-4 space-y-2">
          {currentQuestion.options.map((opt) => {
            const isSelected = (
              answers[currentQuestion.id] ?? []
            ).includes(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  selectOption(
                    currentQuestion.id,
                    opt.id,
                    currentQuestion.type,
                  )
                }
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150 ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[color:color-mix(in_oklch,var(--color-primary)_10%,white)] font-medium text-[var(--color-primary)] shadow-sm"
                    : "border-[var(--color-border)] bg-white/60 text-[var(--color-foreground)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    {isSelected && "✓"}
                  </span>
                  {opt.text}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => i - 1)}
        >
          ← Previous
        </Button>

        <div className="flex gap-1">
          {questions.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIdx(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                i === currentIdx
                  ? "scale-125 bg-[var(--color-primary)]"
                  : answers[questions[i].id]
                    ? "bg-[var(--color-primary)]/50"
                    : "bg-[var(--color-muted)]"
              }`}
            />
          ))}
        </div>

        {currentIdx < questions.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setCurrentIdx((i) => i + 1)}
          >
            Next →
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowReview(true)}
            disabled={submitAttempt.isPending}
          >
            Review & Submit
          </Button>
        )}
      </div>

      {submitAttempt.isError && (
        <Notice variant="danger">
          {(submitAttempt.error as Error).message}
        </Notice>
      )}
    </div>
  );
}

// ─── Timer Bar ──────────────────────────────

function TimerBar({ secondsLeft }: { secondsLeft: number }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const urgent = secondsLeft <= 60;
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium ${
        urgent
          ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
          : "border-[var(--color-border)] bg-[var(--color-card-muted)] text-[var(--color-foreground)]"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <Clock className="h-4 w-4" aria-hidden />
        Time remaining
      </span>
      <span className="tabular-nums">
        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
