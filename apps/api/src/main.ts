import 'reflect-metadata';
import {ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import helmet from 'helmet';
import {AppModule} from './app.module';

async function bootstrap(){
  const app=await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({origin:process.env.WEB_ORIGIN??'http://localhost:3000'});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.listen(Number(process.env.PORT??4000),'0.0.0.0');
}
void bootstrap();
