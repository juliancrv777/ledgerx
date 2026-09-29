import {Body,Controller,Get,Headers,Post,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthenticatedRequest} from '../auth/auth.types';
import {CreateTransferDto} from './dto/create-transfer.dto';
import {TransfersService} from './transfers.service';

@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController{
  constructor(private readonly transfers:TransfersService){}

  @Post()
  create(
    @Req()request:AuthenticatedRequest,
    @Headers('idempotency-key')key:string|undefined,
    @Body()dto:CreateTransferDto,
  ){
    return this.transfers.create(request.user.sub,key??'',dto);
  }

  @Get()
  list(@Req()request:AuthenticatedRequest){
    return this.transfers.list(request.user.sub);
  }
}
