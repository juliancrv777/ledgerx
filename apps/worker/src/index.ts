import {PrismaClient} from '@prisma/client';
import {Queue,Worker} from 'bullmq';
import IORedis from 'ioredis';
import {signWebhook} from './webhook-signature.js';
import {assertSafeWebhookTarget} from './webhook-target.security.js';

const redisUrl=process.env.REDIS_URL??'redis://localhost:6379';
const queuePrefix=process.env.BULLMQ_PREFIX??'ledgerx';
const connection=new IORedis(redisUrl,{maxRetriesPerRequest:null});
const dlqConnection=new IORedis(redisUrl,{maxRetriesPerRequest:null});
const db=new PrismaClient();
const dlq=new Queue('webhooks-dlq',{connection:dlqConnection,prefix:queuePrefix});

const worker=new Worker('webhooks',async job=>{
  const event=await db.outboxEvent.findUnique({where:{id:String(job.data.eventId)}});
  if(!event)throw new Error('Outbox event not found');

  const payload=event.payload as Record<string,unknown>;
  const userId=typeof payload.userId==='string'?payload.userId:undefined;
  if(!userId)throw new Error('Event userId missing');

  const endpoints=await db.webhookEndpoint.findMany({where:{userId,active:true},orderBy:{createdAt:'asc'}});
  const body=JSON.stringify({id:event.id,type:event.type,createdAt:event.createdAt.toISOString(),data:payload});
  const failures:string[]=[];
  let attempted=0;
  let skipped=0;

  for(const endpoint of endpoints){
    const alreadyDelivered=await db.webhookDelivery.findFirst({
      where:{eventId:event.id,endpointId:endpoint.id,success:true},
      select:{id:true},
    });
    if(alreadyDelivered){skipped++;continue}

    attempted++;
    const timestamp=Math.floor(Date.now()/1000).toString();
    const signature=signWebhook(endpoint.secret,timestamp,body);

    try{
      const safeUrl=await assertSafeWebhookTarget(endpoint.url);
      const response=await fetch(safeUrl,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-ledgerx-timestamp':timestamp,
          'x-ledgerx-signature':signature,
        },
        body,
        signal:AbortSignal.timeout(5000),
        redirect:'error',
      });

      await db.webhookDelivery.create({
        data:{
          eventId:event.id,
          endpointId:endpoint.id,
          statusCode:response.status,
          attempt:job.attemptsMade+1,
          success:response.ok,
        },
      });

      if(!response.ok)failures.push(`${endpoint.id}: HTTP ${response.status}`);
    }catch(error){
      await db.webhookDelivery.create({
        data:{
          eventId:event.id,
          endpointId:endpoint.id,
          statusCode:0,
          attempt:job.attemptsMade+1,
          success:false,
        },
      });
      failures.push(`${endpoint.id}: ${error instanceof Error?error.message:'delivery failed'}`);
    }
  }

  if(failures.length>0){
    throw new Error(`Webhook delivery failed for ${failures.length} endpoint(s): ${failures.join('; ')}`);
  }

  await db.outboxEvent.update({where:{id:event.id},data:{processedAt:new Date()}});
  console.log(JSON.stringify({
    event:'webhook.processed',
    eventId:event.id,
    endpoints:endpoints.length,
    attempted,
    skipped,
  }));
},{connection,prefix:queuePrefix});

worker.on('failed',async(job,error)=>{
  if(!job)return;
  const maxAttempts=Number(job.opts.attempts??1);
  console.warn(JSON.stringify({
    event:'webhook.failed',
    eventId:job.data.eventId,
    attempt:job.attemptsMade,
    maxAttempts,
    message:error.message,
  }));

  if(job.attemptsMade>=maxAttempts){
    await dlq.add('webhook.dead-letter',{
      eventId:job.data.eventId,
      failedJobId:job.id,
      error:error.message,
    },{jobId:`dlq-${job.id}`});
    console.error(JSON.stringify({
      event:'webhook.dead_lettered',
      eventId:job.data.eventId,
      failedJobId:job.id,
    }));
  }
});

async function shutdown(){
  await worker.close();
  await dlq.close();
  await connection.quit();
  await dlqConnection.quit();
  await db.$disconnect();
}
process.on('SIGTERM',()=>void shutdown());
process.on('SIGINT',()=>void shutdown());
console.log(JSON.stringify({event:'worker.ready',queue:'webhooks',prefix:queuePrefix}));
