import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {Queue} from 'bullmq';
import IORedis from 'ioredis';
import {PrismaService} from '../prisma/prisma.service';

const QUEUE_PREFIX=process.env.BULLMQ_PREFIX??'ledgerx';

@Injectable()
export class OutboxDispatcher implements OnModuleInit,OnModuleDestroy{
  private readonly logger=new Logger(OutboxDispatcher.name);
  private connection?:IORedis;private queue?:Queue;private timer?:NodeJS.Timeout;
  constructor(private readonly db:PrismaService){}
  onModuleInit(){
    const url=process.env.REDIS_URL;
    if(!url){this.logger.warn('REDIS_URL missing; outbox dispatcher disabled');return}
    this.connection=new IORedis(url,{maxRetriesPerRequest:null});
    this.queue=new Queue('webhooks',{connection:this.connection,prefix:QUEUE_PREFIX});
    this.timer=setInterval(()=>void this.flush(),1000);this.timer.unref();void this.flush();
    this.logger.log(`Outbox queue enabled with isolated prefix ${QUEUE_PREFIX}`);
  }
  async flush(){
    if(!this.queue)return;
    const events=await this.db.outboxEvent.findMany({where:{publishedAt:null},orderBy:{createdAt:'asc'},take:50});
    for(const event of events){
      await this.queue.add(event.type,{eventId:event.id},{jobId:event.id,attempts:5,backoff:{type:'exponential',delay:1000},removeOnComplete:1000,removeOnFail:false});
      await this.db.outboxEvent.updateMany({where:{id:event.id,publishedAt:null},data:{publishedAt:new Date()}});
    }
  }
  async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.queue?.close();await this.connection?.quit()}
}
