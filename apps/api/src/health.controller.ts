import {Controller,Get,ServiceUnavailableException} from '@nestjs/common';
import IORedis from 'ioredis';
import {lookup} from 'node:dns/promises';
import {connect as connectTls} from 'node:tls';
import {PrismaService} from './prisma/prisma.service';

type DiagnosticStage='url'|'dns'|'tls'|'redis';

@Controller('health')
export class HealthController{
  constructor(private readonly db:PrismaService){}
  @Get() health(){return{status:'ok',service:'ledgerx-api'} as const}
  @Get('live') live(){return{status:'ok',service:'ledgerx-api',check:'liveness'} as const}

  private safeError(error:unknown){
    return error instanceof Error
      ?{name:error.name,message:error.message,code:(error as Error&{code?:string}).code??null}
      :{name:'UnknownError',message:'Unknown error',code:null};
  }

  private async diagnoseRedis(url:string){
    let parsed:URL;
    try{parsed=new URL(url)}catch(error){return{stage:'url' as DiagnosticStage,...this.safeError(error)}}
    if(parsed.protocol!=='rediss:')return{stage:'url' as DiagnosticStage,name:'ConfigurationError',message:'REDIS_URL must use rediss://',code:null};

    try{await lookup(parsed.hostname)}catch(error){return{stage:'dns' as DiagnosticStage,...this.safeError(error)}}

    try{
      await new Promise<void>((resolve,reject)=>{
        const socket=connectTls({
          host:parsed.hostname,
          port:Number(parsed.port||6379),
          servername:parsed.hostname,
          rejectUnauthorized:true,
        },()=>{socket.end();resolve()});
        socket.setTimeout(5000,()=>socket.destroy(new Error('TLS connection timed out')));
        socket.once('error',reject);
      });
    }catch(error){return{stage:'tls' as DiagnosticStage,...this.safeError(error)}}

    const redis=new IORedis(url,{lazyConnect:true,connectTimeout:5000,maxRetriesPerRequest:1,enableReadyCheck:true});
    let socketError:Error|null=null;
    redis.on('error',(error:Error)=>{socketError=error});
    try{
      await redis.connect();
      await redis.ping();
      return null;
    }catch(error){
      return{stage:'redis' as DiagnosticStage,...this.safeError(socketError??error)};
    }finally{
      redis.disconnect();
    }
  }

  @Get('ready') async ready(){
    const checks:{postgres:'ok'|'error';redis:'ok'|'disabled'|'error'}={postgres:'error',redis:'disabled'};
    try{await this.db.$queryRaw`SELECT 1`;checks.postgres='ok'}catch{}

    const url=process.env.REDIS_URL;
    if(url){
      const failure=await this.diagnoseRedis(url);
      if(failure){
        checks.redis='error';
        console.error(JSON.stringify({level:'error',event:'health.redis_failed',...failure}));
      }else checks.redis='ok';
    }

    if(checks.postgres!=='ok'||checks.redis==='error')throw new ServiceUnavailableException({status:'not_ready',checks});
    return{status:'ready',checks};
  }
}
