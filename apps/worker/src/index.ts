import {Worker} from 'bullmq';
import IORedis from 'ioredis';

const connection=new IORedis(process.env.REDIS_URL??'redis://localhost:6379',{maxRetriesPerRequest:null});

const worker=new Worker(
  'ledgerx-events',
  async job=>console.log(JSON.stringify({event:'job.processed',name:job.name,id:job.id})),
  {connection}
);

worker.on('failed',(job,error)=>console.error(JSON.stringify({event:'job.failed',id:job?.id,error:error.message})));
console.log(JSON.stringify({event:'worker.ready',queue:'ledgerx-events'}));
