import 'reflect-metadata';
import {ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import helmet from 'helmet';
import {AppModule} from './app.module';

async function bootstrap(){
  const app=await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy',1);
  app.setGlobalPrefix('api');
  app.use(helmet());

  const configuredOrigins=(process.env.WEB_ORIGIN??'http://localhost:3000')
    .split(',')
    .map(origin=>origin.trim().replace(/\/$/,''))
    .filter(Boolean);

  app.enableCors({
    origin:(origin:string|undefined,callback:(error:Error|null,allow?:boolean)=>void)=>{
      // Requests without an Origin header are server-to-server/health checks.
      if(!origin)return callback(null,true);
      const normalizedOrigin=origin.replace(/\/$/,'');
      if(configuredOrigins.includes(normalizedOrigin))return callback(null,true);
      console.warn(JSON.stringify({
        level:'warn',
        event:'cors.origin_rejected',
        origin,
        allowedOrigins:configuredOrigins
      }));
      return callback(new Error('Origin not allowed by CORS'),false);
    },
    methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders:['Content-Type','Authorization','Idempotency-Key','X-Request-Id'],
    exposedHeaders:['X-Request-Id'],
    credentials:true,
    optionsSuccessStatus:204
  });

  app.use((req:any,res:any,next:any)=>{
    if(req.method==='OPTIONS'){
      console.log(JSON.stringify({
        level:'info',
        event:'cors.preflight',
        origin:req.headers.origin??null,
        path:req.originalUrl??req.url,
        requestedMethod:req.headers['access-control-request-method']??null,
        requestedHeaders:req.headers['access-control-request-headers']??null
      }));
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.listen(Number(process.env.PORT??4000),'0.0.0.0');
}
void bootstrap();
