import {IsInt,Max,Min} from 'class-validator';

export class FundWalletDto{
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!:number;
}
