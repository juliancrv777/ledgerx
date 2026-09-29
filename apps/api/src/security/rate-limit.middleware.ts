import type {NextFunction,Request,Response} from 'express';
import IORedis from 'ioredis';

type Policy={scope:string;limit:number;windowSeconds:number};
type LocalEntry={count:number;resetAt:number};

const prefix=process.env.BULLMQ_PREFIX??'ledgerx';
const local=new Map<string,LocalEntry>();
const redisUrl=process.env.REDIS_URL;
const redis=redisUrl?new IORedis(redisUrl,{
  maxRetriesPerRequest:1,
  enableOfflineQueue:false,
  connectTimeout:1000,
}):undefined;
redis?.on('error',()=>{});

export function rateLimitPolicy(req:Pick<Request,'method'|'path'>):Policy{
  const method=req.method.toUpperCase();
  const path=req.path;
  if(method==='POST'&&(path==='/api/auth/login'||path==='/api/auth/register'||path==='/api/auth/refresh')){
    return{scope:'auth',limit:10,windowSeconds:60};
  }
  if(['POST','PUT','PATCH','DELETE'].includes(method)&&(
    path.startsWith('/api/transfers')||
    path.includes('/fund')||
    path.startsWith('/api/webhooks')
  )){
    return{scope:'mutation',limit:30,windowSeconds:60};
  }
  return{scope:'general',limit:120,windowSeconds:60};
}

function localIncrement(key:string,windowSeconds:number){
  const now=Date.now();
  const existing=local.get(key);
  if(!existing||existing.resetAt<=now){
    const entry={count:1,resetAt:now+windowSeconds*1000};
    local.set(key,entry);
    return{count:1,retryAfter:windowSeconds};
  }
  existing.count++;
  return{count:existing.count,retryAfter:Math.max(1,Math.ceil((existing.resetAt-now)/1000))};
}

async function increment(key:string,windowSeconds:number){
  if(redis){
    try{
      const result=await redis.eval(
        "local current=redis.call('INCR',KEYS[1]); if current==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; local ttl=redis.call('TTL',KEYS[1]); return {current,ttl};",
        1,key,String(windowSeconds),
      ) as [number,number];
      return{count:Number(result[0]),retryAfter:Math.max(1,Number(result[1]))};
    }catch{
      // Rate limiting must continue even if Redis is temporarily unavailable.
    }
  }
  return localIncrement(key,windowSeconds);
}

export async function rateLimitMiddleware(req:Request,res:Response,next:NextFunction){
  if(req.method==='OPTIONS')return next();
  const policy=rateLimitPolicy(req);
  const ip=req.ip||req.socket.remoteAddress||'unknown';
  const key=`${prefix}:ratelimit:${policy.scope}:${ip}`;
  const state=await increment(key,policy.windowSeconds);

  res.setHeader('X-RateLimit-Limit',String(policy.limit));
  res.setHeader('X-RateLimit-Remaining',String(Math.max(0,policy.limit-state.count)));

  if(state.count>policy.limit){
    res.setHeader('Retry-After',String(state.retryAfter));
    res.status(429).json({
      statusCode:429,
      error:'Too Many Requests',
      message:'Rate limit exceeded. Retry later.',
    });
    return;
  }
  next();
}
