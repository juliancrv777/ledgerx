import {Injectable,NotFoundException} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class WebhooksService{
  constructor(private readonly db:PrismaService){}
  async create(userId:string,url:string){
    const secret=randomBytes(32).toString('hex');
    const endpoint=await this.db.webhookEndpoint.create({data:{userId,url,secret}});
    return{id:endpoint.id,url:endpoint.url,secret,active:endpoint.active,createdAt:endpoint.createdAt};
  }
  async list(userId:string){
    return this.db.webhookEndpoint.findMany({where:{userId},select:{id:true,url:true,active:true,createdAt:true},orderBy:{createdAt:'desc'}});
  }
  async setActive(userId:string,id:string,active:boolean){
    const result=await this.db.webhookEndpoint.updateMany({where:{id,userId},data:{active}});
    if(result.count===0)throw new NotFoundException('Webhook endpoint not found');
    return this.db.webhookEndpoint.findUniqueOrThrow({where:{id},select:{id:true,url:true,active:true,createdAt:true}});
  }
  async deliveries(userId:string){
    return this.db.webhookDelivery.findMany({
      where:{endpoint:{userId}},
      orderBy:{createdAt:'desc'},
      take:100,
      select:{id:true,attempt:true,statusCode:true,success:true,createdAt:true,event:{select:{id:true,type:true,aggregateId:true}},endpoint:{select:{id:true,url:true}}},
    });
  }
}
