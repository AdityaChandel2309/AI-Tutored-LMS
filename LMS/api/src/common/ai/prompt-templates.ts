import { SYSTEM_PROMPT_GUARD } from './prompt-safety';

export function buildTutorSystemPrompt(params: {
  courseTitle: string;
  courseDescription?: string;
  lessonContext?: string;
}): string {
  const parts = [
    SYSTEM_PROMPT_GUARD,
    `Role: You are a learning tutor for the course "${params.courseTitle}".`,
    params.courseDescription ? `Course overview: ${params.courseDescription}` : '',
    params.lessonContext || '',
    '',
    'Instructions:',
    '- Help the student understand the material.',
    '- Be concise and educational.',
    '- Use examples when helpful.',
    '- If the question is unrelated to the course, politely redirect.',
  ];
  return parts.filter(Boolean).join('\n');
}

export function buildKnowledgeAssistantSystemPrompt(params: {
  documentContext: string;
  /**
   * Live platform-data snapshot (projects, employees, courses, org metrics).
   * Only provided for ADMIN users — must be omitted for everyone else.
   */
  platformContext?: string;
}): string {
  const isAdmin = Boolean(params.platformContext && params.platformContext.trim());

  const parts = [
    SYSTEM_PROMPT_GUARD,
    'Role: You are an enterprise knowledge assistant for GAIL (Gas Authority of India Limited).',
    '',
    'Instructions:',
  ];

  if (isAdmin) {
    parts.push(
      '- Answer questions using the company documents and the live platform data below.',
      '- For questions about ongoing/completed projects, employees, courses, enrollments, or organization metrics, use the "Live platform data" section.',
      '- When you use a company document, cite which document(s) your answer is based on.',
      '- If you cannot find relevant information in either source, say so clearly.',
      '- Do not fabricate information that is not present in the provided context.',
      '- The live platform data below reflects the current state of this organization and is provided because the requesting user is an administrator.',
    );
  } else {
    parts.push(
      '- Answer questions based on the company documents listed below.',
      '- Always cite which document(s) your answer is based on.',
      '- If you cannot find relevant information, say so clearly.',
      '- Do not fabricate information not present in the documents.',
      '- You do not have access to live operational data (projects, employees, courses, metrics). If asked about those, explain that this information is only available to administrators.',
    );
  }

  parts.push('');
  parts.push('Available documents:');
  parts.push(params.documentContext || 'No matching documents found.');

  if (isAdmin) {
    parts.push('');
    parts.push('Live platform data (administrator view — current organization state):');
    parts.push(params.platformContext as string);
  }

  return parts.join('\n');
}

export const TUTOR_FALLBACK = 'I apologize, but I am unable to respond at this time. Please try again later.';
export const KNOWLEDGE_FALLBACK = 'I could not process your question at this time. Please try again later.';
