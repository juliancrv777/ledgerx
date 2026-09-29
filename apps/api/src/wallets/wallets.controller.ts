import {Body,Controller,Get,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import type {AuthenticatedRequest} from '../auth/auth.types';
import {FundWalletDto} from './dto/fund-wallet.dto';
import {WalletsService} from './wallets.service';

@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController{
  constructor(private readonly wallets:WalletsService){}

  @Get()
  list(@Req()request:AuthenticatedRequest){return this.wallets.list(request.user.sub)}

  @Post(':id/fund')
  fund(
    @Req()request:AuthenticatedRequest,
    @Param('id')walletId:string,
    @Body()dto:FundWalletDto,
    @Headers('idempotency-key')idempotencyKey:string|undefined,
  ){
    return this.wallets.fund(request.user.sub,walletId,dto.amountMinor,idempotencyKey??'');
  }
}
