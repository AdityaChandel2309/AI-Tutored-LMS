import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TenantGuard } from './auth/tenant.guard';
import { FeatureFlagGuard } from './common/guards/feature-flag.guard';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { TenantModule } from './tenant/tenant.module';
import { StorageModule } from './storage/storage.module';
import { UserModule } from './user/user.module';
import { CourseModule } from './course/course.module';
import { CategoryModule } from './category/category.module';
import { CourseModuleModule } from './module/module.module';
import { LessonModule } from './lesson/lesson.module';
import { ProgressModule } from './progress/progress.module';
import { EventsModule } from './events/events.module';
import { VideoModule } from './video/video.module';
import { ScormModule } from './scorm/scorm.module';
import { AssessmentModule } from './assessment/assessment.module';
import { CertificateModule } from './certificate/certificate.module';
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { OrganizationModule } from './organization/organization.module';
import { EmployeeModule } from './employee/employee.module';
import { ProjectModule } from './project/project.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AiTutorModule } from './ai-tutor/ai-tutor.module';
import { KnowledgeAssistantModule } from './knowledge-assistant/knowledge-assistant.module';
import { AuditModule } from './audit/audit.module';
import { AiCoreModule } from './common/ai/ai-core.module';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { MetricsModule } from './common/metrics/metrics.module';
import { MetricsMiddleware } from './common/middleware/metrics.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    AiCoreModule,
    HealthModule,
    EventsModule,
    AuthModule,
    PrismaModule,
    StorageModule,
    TenantModule,
    UserModule,
    CourseModule,
    CategoryModule,
    CourseModuleModule,
    LessonModule,
    ProgressModule,
    VideoModule,
    ScormModule,
    AssessmentModule,
    CertificateModule,
    NotificationModule,
    AnalyticsModule,
    OrganizationModule,
    EmployeeModule,
    ProjectModule,
    KnowledgeModule,
    AiTutorModule,
    KnowledgeAssistantModule,
    AuditModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
    consumer.apply(MetricsMiddleware).forRoutes('*');
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
