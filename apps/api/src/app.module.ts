import {MiddlewareConsumer,Module,NestModule} from '@nestjs/common';
import {HealthController} from './health.controller';
import {PrismaModule} from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';
import {WalletsModule} from './wallets/wallets.module';
import {TransfersModule} from './transfers/transfers.module';
import {WebhooksModule} from './webhooks/webhooks.module';
import {OutboxModule} from './outbox/outbox.module';
import {ObservabilityModule} from './observability/observability.module';
import {RequestObservabilityMiddleware} from './observability/request-observability.middleware';
import {rateLimitMiddleware} from './security/rate-limit.middleware';
@Module({imports:[PrismaModule,AuthModule,WalletsModule,TransfersModule,WebhooksModule,OutboxModule,ObservabilityModule],controllers:[HealthController]})
export class AppModule implements NestModule{
  configure(consumer:MiddlewareConsumer){consumer.apply(RequestObservabilityMiddleware,rateLimitMiddleware).forRoutes('*')}
}
