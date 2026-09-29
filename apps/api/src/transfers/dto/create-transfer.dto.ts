import {IsInt,IsString,Max,Min,MinLength} from 'class-validator';

export class CreateTransferDto{
  @IsString() @MinLength(1)
  fromWalletId!:string;

  @IsString() @MinLength(1)
  toWalletId!:string;

  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!:number;
}
