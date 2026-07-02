"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useAttemptResult } from "@/lib/api/assessments";

export function QuizResults({
  attemptId,
  onBack,
}: {
  attemptId: string;
  onBack: () => void;
}) {
  const { data: attempt, isLoading, error } = useAttemptResult(attemptId);

  if (isLoading) {
    return <Notice>Loading results…</Notice>;
  }

  if (error || !attempt) {
    return (
      <Notice variant="danger">
        {(error as Error)?.message ?? "Could not load results"}
      </Notice>
    );
  }

  const score = attempt.score ?? 0;
  const passed = attempt.passed ?? false;
  const passingScore = attempt.assessment?.passingScore ?? 70;

  return (
    <div className="space-y-4">
      {/* Score card */}
      <Card className="p-6 text-center">
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
            passed
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {score}%
        </div>
        <h3 className="mt-4 text-xl font-semibold">
          {passed ? "🎉 You Passed!" : "Not Passed"}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {attempt.assessment?.title} — Attempt #{attempt.attemptNumber}
        </p>
        <div className="mt-2 flex justify-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          <span>Your score: {score}%</span>
          <span>Required: {passingScore}%</span>
        </div>
        <Badge
          variant={passed ? "success" : "warning"}
          className="mt-3"
        >
          {passed ? "PASSED" : "FAILED"}
        </Badge>
      </Card>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
          Question Review
        </h4>

        {attempt.answers.map((answer, idx) => {
          const question = answer.question;
          if (!question) return null;

          return (
            <Card
              key={answer.id}
              className={`p-4 ${
                answer.isCorrect
                  ? "border-green-200 bg-green-50/50"
                  : "border-red-200 bg-red-50/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                      Q{idx + 1}.
                    </span>
                    <span className="text-sm font-medium">
                      {question.text}
                    </span>
                  </div>

                  {/* Options with correct/incorrect highlighting */}
                  <ul className="mt-2 ml-4 space-y-1">
                    {question.options.map((opt) => {
                      const wasSelected =
                        answer.selectedOptionIds.includes(opt.id);
                      const isCorrect = opt.isCorrect ?? false;

                      let style = "text-[var(--color-muted-foreground)]";
                      let marker = "○";

                      if (wasSelected && isCorrect) {
                        style = "text-green-700 font-semibold";
                        marker = "✓";
                      } else if (wasSelected && !isCorrect) {
                        style = "text-red-600 line-through";
                        marker = "✗";
                      } else if (!wasSelected && isCorrect) {
                        style = "text-green-600";
                        marker = "✓";
                      }

                      return (
                        <li key={opt.id} className={`text-xs ${style}`}>
                          {marker} {opt.text}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Explanation */}
                  {question.explanation && (
                    <p className="mt-2 ml-4 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                      💡 {question.explanation}
                    </p>
                  )}
                </div>

                <Badge
                  variant={answer.isCorrect ? "success" : "warning"}
                >
                  {answer.isCorrect ? "Correct" : "Incorrect"}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Back button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>
          ← Back to Quiz
        </Button>
      </div>
    </div>
  );
}
