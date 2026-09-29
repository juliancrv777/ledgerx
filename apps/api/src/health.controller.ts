import {Controller,Get,ServiceUnavailableException} from '@nestjs/common';
import IORedis from 'ioredis';
import {PrismaService} from './prisma/prisma.service';
@Controller('health')
export class HealthController{
  constructor(private readonly db:PrismaService){}
  @Get() health(){return{status:'ok',service:'ledgerx-api'} as const}
  @Get('live') live(){return{status:'ok',service:'ledgerx-api',check:'liveness'} as const}
  @Get('ready') async ready(){
    const checks:{postgres:'ok'|'error';redis:'ok'|'disabled'|'error'}={postgres:'error',redis:'disabled'};
    try{await this.db.$queryRaw`SELECT 1`;checks.postgres='ok'}catch{}
    const url=process.env.REDIS_URL;
    if(url){const redis=new IORedis(url,{lazyConnect:true,connectTimeout:5000,maxRetriesPerRequest:1,enableReadyCheck:true});redis.on('error',()=>{});try{await redis.connect();await redis.ping();checks.redis='ok'}catch(error){checks.redis='error';const safe=error instanceof Error?{name:error.name,message:error.message,code:(error as Error&{code?:string}).code??null}:{name:'UnknownError',message:'Unknown Redis error',code:null};console.error(JSON.stringify({level:'error',event:'health.redis_failed',...safe}))}finally{redis.disconnect()}}
    if(checks.postgres!=='ok'||checks.redis==='error')throw new ServiceUnavailableException({status:'not_ready',checks});
    return{status:'ready',checks};
  }
}
