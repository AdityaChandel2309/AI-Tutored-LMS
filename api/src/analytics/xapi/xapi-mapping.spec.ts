import { mapDomainEventToXapiStatement } from './xapi-mapping';
import type { DomainEvent } from '../../events/domain-events';

describe('xAPI Mapping', () => {
  const baseEvent = (overrides: Partial<DomainEvent>): DomainEvent => ({
    type: 'enrollment.created',
    tenantId: 'tenant-1',
    timestamp: new Date('2026-01-15T10:00:00Z'),
    actorId: 'user-123',
    entityId: 'entity-456',
    entityType: 'course',
    payload: {},
    ...overrides,
  });

  describe('verb mapping', () => {
    const cases: [string, string][] = [
      ['enrollment.created', 'http://adlnet.gov/expapi/verbs/registered'],
      ['lesson.completed', 'http://adlnet.gov/expapi/verbs/completed'],
      ['course.completed', 'http://adlnet.gov/expapi/verbs/completed'],
      ['assessment.attempted', 'http://adlnet.gov/expapi/verbs/attempted'],
      ['assessment.passed', 'http://adlnet.gov/expapi/verbs/passed'],
      ['assessment.failed', 'http://adlnet.gov/expapi/verbs/failed'],
      ['certificate.issued', 'http://adlnet.gov/expapi/verbs/earned'],
      ['scorm.launched', 'http://adlnet.gov/expapi/verbs/launched'],
      ['course.published', 'http://adlnet.gov/expapi/verbs/published'],
      ['video.uploaded', 'http://adlnet.gov/expapi/verbs/created'],
    ];

    it.each(cases)('%s maps to %s', (eventType, expectedVerbId) => {
      const event = baseEvent({ type: eventType });
      const statement = mapDomainEventToXapiStatement(event);

      expect(statement).not.toBeNull();
      expect(statement!.verb.id).toBe(expectedVerbId);
    });

    it('returns null for unknown event types', () => {
      const event = baseEvent({ type: 'unknown.event' });
      const statement = mapDomainEventToXapiStatement(event);

      expect(statement).toBeNull();
    });
  });

  describe('activity type mapping', () => {
    it('maps course entityType to xAPI course activity', () => {
      const event = baseEvent({ entityType: 'course' });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.object.definition?.type).toBe(
        'http://adlnet.gov/expapi/activities/course',
      );
    });

    it('maps lesson entityType to xAPI lesson activity', () => {
      const event = baseEvent({
        type: 'lesson.completed',
        entityType: 'lesson',
        entityId: 'lesson-1',
      });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.object.definition?.type).toBe(
        'http://adlnet.gov/expapi/activities/lesson',
      );
    });

    it('maps assessment entityType to xAPI assessment activity', () => {
      const event = baseEvent({
        type: 'assessment.passed',
        entityType: 'assessment',
        entityId: 'assess-1',
        payload: { score: 85 },
      });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.object.definition?.type).toBe(
        'http://adlnet.gov/expapi/activities/assessment',
      );
    });

    it('infers entity type from event type prefix when entityType is missing', () => {
      const event = baseEvent({
        type: 'lesson.completed',
        entityType: undefined,
        entityId: 'lesson-1',
      });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.object.definition?.type).toBe(
        'http://adlnet.gov/expapi/activities/lesson',
      );
    });
  });

  describe('statement structure', () => {
    it('produces a valid xAPI statement shape', () => {
      const event = baseEvent({});
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement).toHaveProperty('actor');
      expect(statement).toHaveProperty('verb');
      expect(statement).toHaveProperty('object');
      expect(statement).toHaveProperty('timestamp');
      expect(statement.actor).toHaveProperty('objectType', 'Agent');
      expect(statement.object).toHaveProperty('objectType', 'Activity');
    });

    it('includes timestamp as ISO string', () => {
      const event = baseEvent({});
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.timestamp).toBe('2026-01-15T10:00:00.000Z');
    });

    it('builds actor with account identifier', () => {
      const event = baseEvent({ actorId: 'user-abc' });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.actor.account).toEqual({
        homePage: 'urn:lms:user',
        name: 'user-abc',
      });
    });

    it('builds object ID from entityType and entityId', () => {
      const event = baseEvent({ entityType: 'course', entityId: 'c-99' });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.object.id).toBe('urn:lms:course:c-99');
    });
  });

  describe('missing actorId handling', () => {
    it('produces a fallback agent when actorId is undefined', () => {
      const event = baseEvent({ actorId: undefined });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.actor.objectType).toBe('Agent');
      expect(statement.actor.name).toBe('Unknown');
      expect(statement.actor.account).toBeUndefined();
    });
  });

  describe('result mapping', () => {
    it('includes score for assessment.passed', () => {
      const event = baseEvent({
        type: 'assessment.passed',
        entityType: 'assessment',
        payload: { score: 90 },
      });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.result).toBeDefined();
      expect(statement.result!.score).toEqual({
        scaled: 0.9,
        raw: 90,
        max: 100,
      });
      expect(statement.result!.success).toBe(true);
    });

    it('includes failure for assessment.failed', () => {
      const event = baseEvent({
        type: 'assessment.failed',
        entityType: 'assessment',
        payload: { score: 40 },
      });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.result!.success).toBe(false);
    });

    it('includes completion for course.completed', () => {
      const event = baseEvent({ type: 'course.completed' });
      const statement = mapDomainEventToXapiStatement(event)!;

      expect(statement.result).toEqual({ completion: true, success: true });
    });
  });
});
