import {Injectable,NestMiddleware} from '@nestjs/common';
import type {NextFunction,Request,Response} from 'express';
import {randomUUID} from 'node:crypto';
import {MetricsService} from './metrics.service';

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware{
  constructor(private readonly metrics:MetricsService){}
  use(req:Request,res:Response,next:NextFunction){
    const requestId=(typeof req.headers['x-request-id']==='string'&&req.headers['x-request-id'].trim())||randomUUID();
    res.setHeader('x-request-id',requestId);
    const started=process.hrtime.bigint();
    res.on('finish',()=>{
      const seconds=Number(process.hrtime.bigint()-started)/1e9;
      const labels={method:req.method,route:req.path,status:String(res.statusCode)};
      this.metrics.requests.inc(labels);this.metrics.duration.observe(labels,seconds);
      console.log(JSON.stringify({level:'info',event:'http.request',requestId,method:req.method,path:req.originalUrl,statusCode:res.statusCode,durationMs:Math.round(seconds*1000)}));
    });
    next();
  }
}
