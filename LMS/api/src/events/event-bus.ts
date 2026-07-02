import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from './domain-events';

/**
 * Thin wrapper around EventEmitter2 that logs every
 * domain event and provides a typed emit API.
 *
 * Services inject this instead of EventEmitter2 directly
 * so that event dispatch stays auditable and testable.
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: DomainEvent): void {
    this.logger.log(
      `[${event.type}] tenant=${event.tenantId} ${JSON.stringify(event.payload)}`,
    );
    this.emitter.emit(event.type, event);
  }
}
