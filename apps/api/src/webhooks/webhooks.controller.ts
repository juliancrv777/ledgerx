import {Body,Controller,Get,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthenticatedRequest} from '../auth/auth.types';
import {CreateWebhookDto} from './dto/create-webhook.dto';
import {UpdateWebhookDto} from './dto/update-webhook.dto';
import {WebhooksService} from './webhooks.service';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController{
  constructor(private readonly webhooks:WebhooksService){}
  @Post()create(@Req()req:AuthenticatedRequest,@Body()dto:CreateWebhookDto){return this.webhooks.create(req.user.sub,dto.url)}
  @Get()list(@Req()req:AuthenticatedRequest){return this.webhooks.list(req.user.sub)}
  @Patch(':id')update(@Req()req:AuthenticatedRequest,@Param('id')id:string,@Body()dto:UpdateWebhookDto){return this.webhooks.setActive(req.user.sub,id,dto.active)}
  @Get('deliveries')deliveries(@Req()req:AuthenticatedRequest){return this.webhooks.deliveries(req.user.sub)}
}
