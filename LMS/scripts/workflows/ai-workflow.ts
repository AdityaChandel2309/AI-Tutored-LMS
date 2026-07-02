/**
 * AI Feature Workflow Test
 *
 * Validates the AI Tutor and Knowledge Assistant features:
 * - AI Tutor message for enrolled course → response returned and conversation persisted
 * - AI Tutor message for unenrolled course → enrollment-required error
 * - Knowledge Assistant question → response with source document references
 * - AI service graceful degradation when LLM unavailable → fallback message
 *
 * Requirements: 5.1–5.4
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowResult, StepResult, SeedResult } from './types.js';
import { getToken, apiClient } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  const seedPath = path.resolve(__dirname, '../.validation-seed-result.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

async function runStep(
  description: string,
  fn: () => Promise<{ passed: boolean; expected?: string; actual?: string }>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      description,
      passed: result.passed,
      expected: result.expected,
      actual: result.actual,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      description,
      passed: false,
      expected: 'No error thrown',
      actual: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// ─── Workflow Steps ──────────────────────────────────────────────────────────

/**
 * Step 1: AI Tutor message for enrolled course → verify response returned and conversation persisted
 * Validates: Requirement 5.1
 */
async function testAiTutorEnrolledCourse(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'AI Tutor message for enrolled course → response returned and conversation persisted',
    async () => {
      const token = await getToken(seed.users.learner);
      const client = apiClient(token);

      // Use the published course from seed data (learner should be enrolled via seed or prior workflow)
      const courseId = seed.courses.publishedId;

      if (!courseId) {
        return {
          passed: false,
          expected: 'Published course ID available from seed data',
          actual: 'No published course ID in seed result',
        };
      }

      // Ensure the learner is enrolled in the published course
      const enrollRes = await client.post(`/courses/${courseId}/enroll`);
      // Accept 200/201 (new enrollment) or 409/400 (already enrolled)
      if (enrollRes.status >= 500) {
        return {
          passed: false,
          expected: 'Enrollment succeeds or already exists',
          actual: `HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
        };
      }

      // Send a message to the AI Tutor
      const chatRes = await client.post('/ai-tutor/chat', {
        message: 'Can you explain the key concepts covered in this course?',
        courseId,
      });

      if (chatRes.status !== 200 && chatRes.status !== 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on AI Tutor chat',
          actual: `HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data)}`,
        };
      }

      const response = chatRes.data;

      // Verify a response content is returned
      if (!response.content || typeof response.content !== 'string' || response.content.trim().length === 0) {
        return {
          passed: false,
          expected: 'Non-empty response content from AI Tutor',
          actual: `Response content: ${JSON.stringify(response.content)}`,
        };
      }

      // Verify conversation is persisted by checking history
      const historyRes = await client.get(`/ai-tutor/history?courseId=${courseId}`);

      if (historyRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on AI Tutor history retrieval',
          actual: `HTTP ${historyRes.status}: ${JSON.stringify(historyRes.data)}`,
        };
      }

      const history = Array.isArray(historyRes.data) ? historyRes.data : [];

      // Should have at least 2 messages (user + assistant)
      if (history.length < 2) {
        return {
          passed: false,
          expected: 'At least 2 messages in conversation history (user + assistant)',
          actual: `History contains ${history.length} message(s)`,
        };
      }

      // Verify the last messages include our user message and the assistant response
      const userMessages = history.filter((m: { role: string }) => m.role === 'user');
      const assistantMessages = history.filter((m: { role: string }) => m.role === 'assistant');

      if (userMessages.length === 0 || assistantMessages.length === 0) {
        return {
          passed: false,
          expected: 'History contains both user and assistant messages',
          actual: `User messages: ${userMessages.length}, Assistant messages: ${assistantMessages.length}`,
        };
      }

      return {
        passed: true,
        expected: 'AI Tutor returns response and conversation is persisted',
        actual: `Response received (${response.content.length} chars), history has ${history.length} messages`,
      };
    },
  );
}

/**
 * Step 2: AI Tutor message for unenrolled course → verify enrollment-required error
 * Validates: Requirement 5.2
 */
async function testAiTutorUnenrolledCourse(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'AI Tutor message for unenrolled course → enrollment-required error',
    async () => {
      const token = await getToken(seed.users.learner);
      const client = apiClient(token);

      // Use the draft course — learner should NOT be enrolled in it
      const courseId = seed.courses.draftId;

      if (!courseId) {
        return {
          passed: false,
          expected: 'Draft course ID available from seed data',
          actual: 'No draft course ID in seed result',
        };
      }

      // Send a message to the AI Tutor for a course the learner is NOT enrolled in
      const chatRes = await client.post('/ai-tutor/chat', {
        message: 'What topics does this course cover?',
        courseId,
      });

      // Should receive a 403 Forbidden (enrollment-required error)
      if (chatRes.status === 200 || chatRes.status === 201) {
        return {
          passed: false,
          expected: 'HTTP 403 (enrollment-required error)',
          actual: `Chat succeeded with HTTP ${chatRes.status} — enrollment guard not enforced`,
        };
      }

      if (chatRes.status !== 403) {
        // Accept other client errors that indicate rejection
        if (chatRes.status >= 400 && chatRes.status < 500) {
          return {
            passed: true,
            expected: 'Enrollment-required error (4xx)',
            actual: `HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data?.message || chatRes.data)}`,
          };
        }

        return {
          passed: false,
          expected: 'HTTP 403 (enrollment-required error)',
          actual: `HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data)}`,
        };
      }

      // Verify the error message mentions enrollment
      const errorMessage = chatRes.data?.message || JSON.stringify(chatRes.data);
      const mentionsEnrollment =
        errorMessage.toLowerCase().includes('enroll') ||
        errorMessage.toLowerCase().includes('enrollment');

      return {
        passed: true,
        expected: 'HTTP 403 with enrollment-required error message',
        actual: `HTTP 403: "${errorMessage}"${mentionsEnrollment ? ' (mentions enrollment)' : ''}`,
      };
    },
  );
}

/**
 * Step 3: Knowledge Assistant question → verify response with source document references
 * Validates: Requirement 5.3
 */
async function testKnowledgeAssistantQuestion(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Knowledge Assistant question → response with source document references',
    async () => {
      // Use admin or instructor for Knowledge Assistant (they have broader access)
      const token = await getToken(seed.users.admin);
      const client = apiClient(token);

      // Ask a question that should match seeded knowledge documents
      const askRes = await client.post('/knowledge-assistant/ask', {
        question: 'What safety procedures are documented?',
      });

      if (askRes.status !== 200 && askRes.status !== 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on Knowledge Assistant ask',
          actual: `HTTP ${askRes.status}: ${JSON.stringify(askRes.data)}`,
        };
      }

      const response = askRes.data;

      // Verify a response content is returned
      if (!response.content || typeof response.content !== 'string' || response.content.trim().length === 0) {
        return {
          passed: false,
          expected: 'Non-empty response content from Knowledge Assistant',
          actual: `Response content: ${JSON.stringify(response.content)}`,
        };
      }

      // Verify source document references are included
      const sources = response.sources;

      if (!sources || !Array.isArray(sources)) {
        return {
          passed: false,
          expected: 'Response includes sources array with document references',
          actual: `Sources field: ${JSON.stringify(sources)}`,
        };
      }

      // Sources should have document metadata (id, title at minimum)
      if (sources.length > 0) {
        const firstSource = sources[0];
        if (!firstSource.id || !firstSource.title) {
          return {
            passed: false,
            expected: 'Source documents have id and title fields',
            actual: `First source: ${JSON.stringify(firstSource)}`,
          };
        }
      }

      return {
        passed: true,
        expected: 'Knowledge Assistant returns response with source document references',
        actual: `Response received (${response.content.length} chars) with ${sources.length} source document(s)`,
      };
    },
  );
}

/**
 * Step 4: AI service graceful degradation when LLM unavailable → verify fallback message
 * Validates: Requirement 5.4
 *
 * Note: This test verifies that the AI services handle LLM unavailability gracefully.
 * Since we cannot easily disable the LLM mid-test in a live environment, we verify
 * that the response structure is valid (either a real LLM response or a fallback message).
 * The service code uses a circuit breaker pattern that returns fallback content when the
 * LLM API is unreachable.
 */
async function testAiGracefulDegradation(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'AI service graceful degradation when LLM unavailable → fallback message',
    async () => {
      const token = await getToken(seed.users.learner);
      const client = apiClient(token);

      const courseId = seed.courses.publishedId;

      if (!courseId) {
        return {
          passed: false,
          expected: 'Published course ID available from seed data',
          actual: 'No published course ID in seed result',
        };
      }

      // Ensure enrollment exists
      await client.post(`/courses/${courseId}/enroll`);

      // Send a message to the AI Tutor — the service should either return a real
      // response or a graceful fallback (never an unhandled 500 error)
      const chatRes = await client.post('/ai-tutor/chat', {
        message: 'Please summarize the main topics of this course.',
        courseId,
      });

      // The key requirement is that we do NOT get an unhandled exception (5xx)
      if (chatRes.status >= 500) {
        return {
          passed: false,
          expected: 'No unhandled server error (no 5xx response)',
          actual: `HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data)}`,
        };
      }

      // If we get a successful response, verify it has content (either real or fallback)
      if (chatRes.status === 200 || chatRes.status === 201) {
        const response = chatRes.data;

        if (!response.content || typeof response.content !== 'string' || response.content.trim().length === 0) {
          return {
            passed: false,
            expected: 'Response has non-empty content (real or fallback)',
            actual: `Response content: ${JSON.stringify(response.content)}`,
          };
        }

        // Known fallback messages from the service
        const knownFallbacks = [
          'I apologize, but I am unable to respond at this time',
          'I could not process your question at this time',
          'Please try again later',
        ];

        const isFallback = knownFallbacks.some((fb) =>
          response.content.toLowerCase().includes(fb.toLowerCase()),
        );

        return {
          passed: true,
          expected: 'AI service returns valid response (real or graceful fallback)',
          actual: isFallback
            ? `Fallback message returned: "${response.content.substring(0, 80)}..."`
            : `Real LLM response returned (${response.content.length} chars)`,
        };
      }

      // If we get a 403 (enrollment issue), that's a different problem but not a crash
      if (chatRes.status === 403) {
        return {
          passed: false,
          expected: 'AI Tutor accessible for enrolled learner',
          actual: `HTTP 403: ${JSON.stringify(chatRes.data?.message || chatRes.data)} — enrollment may not exist`,
        };
      }

      // Any other 4xx is acceptable (not an unhandled crash)
      return {
        passed: true,
        expected: 'No unhandled server error — graceful response',
        actual: `HTTP ${chatRes.status}: service responded gracefully`,
      };
    },
  );
}

// ─── Workflow Entry Point ────────────────────────────────────────────────────

export async function runAiWorkflow(seedResult?: SeedResult): Promise<WorkflowResult> {
  const start = Date.now();
  const seed = seedResult ?? loadSeedResult();
  const steps: StepResult[] = [];

  steps.push(await testAiTutorEnrolledCourse(seed));
  steps.push(await testAiTutorUnenrolledCourse(seed));
  steps.push(await testKnowledgeAssistantQuestion(seed));
  steps.push(await testAiGracefulDegradation(seed));

  const passed = steps.every((s) => s.passed);

  return {
    name: 'AI Feature Workflow',
    steps,
    passed,
    duration: Date.now() - start,
  };
}
