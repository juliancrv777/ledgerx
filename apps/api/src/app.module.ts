import {Module} from '@nestjs/common';
import {HealthController} from './health.controller';
import {PrismaModule} from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';
import {WalletsModule} from './wallets/wallets.module';
import {TransfersModule} from './transfers/transfers.module';
import {WebhooksModule} from './webhooks/webhooks.module';
import {OutboxModule} from './outbox/outbox.module';

@Module({imports:[PrismaModule,AuthModule,WalletsModule,TransfersModule,WebhooksModule,OutboxModule],controllers:[HealthController]})
export class AppModule{}
