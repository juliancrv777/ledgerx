import {Module} from '@nestjs/common';
import {OutboxDispatcher} from './outbox.dispatcher';
@Module({providers:[OutboxDispatcher]})
export class OutboxModule{}
