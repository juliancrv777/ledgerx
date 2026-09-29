import {Injectable} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class WebhooksService{
  constructor(private readonly db:PrismaService){}
  async create(userId:string,url:string){
    const secret=randomBytes(32).toString('hex');
    const endpoint=await this.db.webhookEndpoint.create({data:{userId,url,secret}});
    return{id:endpoint.id,url:endpoint.url,secret,createdAt:endpoint.createdAt};
  }
  async list(userId:string){
    return this.db.webhookEndpoint.findMany({where:{userId},select:{id:true,url:true,active:true,createdAt:true}});
  }
}
