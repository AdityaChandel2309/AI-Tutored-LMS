/**
 * xAPI-compatible mapping utilities.
 * Converts domain events to xAPI statement shapes.
 * No runtime LRS — pure mapping for future interoperability.
 */

import type { DomainEvent } from '../../events/domain-events';
import type {
  XapiStatement,
  XapiVerb,
  XapiActor,
  XapiObject,
} from './xapi-types';

// ─── Verb Mapping ───────────────────────────

const VERB_MAP: Record<string, XapiVerb> = {
  'enrollment.created': {
    id: 'http://adlnet.gov/expapi/verbs/registered',
    display: { 'en-US': 'registered' },
  },
  'lesson.completed': {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' },
  },
  'course.completed': {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' },
  },
  'assessment.attempted': {
    id: 'http://adlnet.gov/expapi/verbs/attempted',
    display: { 'en-US': 'attempted' },
  },
  'assessment.passed': {
    id: 'http://adlnet.gov/expapi/verbs/passed',
    display: { 'en-US': 'passed' },
  },
  'assessment.failed': {
    id: 'http://adlnet.gov/expapi/verbs/failed',
    display: { 'en-US': 'failed' },
  },
  'certificate.issued': {
    id: 'http://adlnet.gov/expapi/verbs/earned',
    display: { 'en-US': 'earned' },
  },
  'scorm.launched': {
    id: 'http://adlnet.gov/expapi/verbs/launched',
    display: { 'en-US': 'launched' },
  },
  'course.published': {
    id: 'http://adlnet.gov/expapi/verbs/published',
    display: { 'en-US': 'published' },
  },
  'video.uploaded': {
    id: 'http://adlnet.gov/expapi/verbs/created',
    display: { 'en-US': 'created' },
  },
};

// ─── Activity Type Mapping ──────────────────

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  course: 'http://adlnet.gov/expapi/activities/course',
  lesson: 'http://adlnet.gov/expapi/activities/lesson',
  assessment: 'http://adlnet.gov/expapi/activities/assessment',
  certificate: 'http://adlnet.gov/expapi/activities/certificate',
  video: 'http://adlnet.gov/expapi/activities/media',
  scorm: 'http://adlnet.gov/expapi/activities/module',
};

// ─── Helpers ────────────────────────────────

function buildActor(actorId: string | undefined): XapiActor {
  if (!actorId) {
    return { objectType: 'Agent', name: 'Unknown' };
  }
  return {
    objectType: 'Agent',
    account: {
      homePage: 'urn:lms:user',
      name: actorId,
    },
  };
}

function buildObject(event: DomainEvent): XapiObject {
  const entityType = event.entityType ?? inferEntityType(event.type);
  const activityType = ACTIVITY_TYPE_MAP[entityType] ?? undefined;

  return {
    objectType: 'Activity',
    id: `urn:lms:${entityType}:${event.entityId ?? 'unknown'}`,
    definition: activityType ? { type: activityType } : undefined,
  };
}

function inferEntityType(eventType: string): string {
  const prefix = eventType.split('.')[0];
  const map: Record<string, string> = {
    enrollment: 'course',
    lesson: 'lesson',
    course: 'course',
    assessment: 'assessment',
    certificate: 'certificate',
    video: 'video',
    scorm: 'scorm',
  };
  return map[prefix] ?? 'unknown';
}

// ─── Main Mapping Function ──────────────────

export function mapDomainEventToXapiStatement(
  event: DomainEvent,
): XapiStatement | null {
  const verb = VERB_MAP[event.type];
  if (!verb) return null;

  const statement: XapiStatement = {
    actor: buildActor(event.actorId),
    verb,
    object: buildObject(event),
    timestamp: event.timestamp.toISOString(),
  };

  // Add result for assessment events
  if (event.type.startsWith('assessment.') && event.payload) {
    const score = event.payload.score as number | undefined;
    statement.result = {
      score:
        score != null
          ? { scaled: score / 100, raw: score, max: 100 }
          : undefined,
      success:
        event.type === 'assessment.passed'
          ? true
          : event.type === 'assessment.failed'
            ? false
            : undefined,
      completion: true,
    };
  }

  // Add completion for course/lesson completed
  if (event.type === 'course.completed' || event.type === 'lesson.completed') {
    statement.result = { completion: true, success: true };
  }

  return statement;
}
