import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,TransferStatus} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {CreateTransferDto} from './dto/create-transfer.dto';
import {assertBalanced,assertPositiveAmount} from './ledger.rules';

@Injectable()
export class TransfersService{
  constructor(private readonly db:PrismaService){}

  private serialize(transfer:{id:string;fromWalletId:string;toWalletId:string;amountMinor:bigint;currency:string;status:TransferStatus;createdAt:Date},replayed:boolean){
    return{...transfer,amountMinor:transfer.amountMinor.toString(),replayed};
  }
  private sameRequest(existing:{fromWalletId:string;toWalletId:string;amountMinor:bigint},dto:CreateTransferDto){
    return existing.fromWalletId===dto.fromWalletId&&existing.toWalletId===dto.toWalletId&&existing.amountMinor===BigInt(dto.amountMinor);
  }
  private async runSerializable<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
    const maxAttempts=5;
    for(let attempt=0;attempt<maxAttempts;attempt++){
      try{
        return await this.db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      }catch(error){
        const retryable=error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034';
        if(!retryable)throw error;
        if(attempt===maxAttempts-1){
          throw new ConflictException('Concurrent transfer conflict; retry with the same idempotency key');
        }
        await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
      }
    }
    throw new ConflictException('Concurrent transfer conflict');
  }

  async create(userId:string,idempotencyKey:string,dto:CreateTransferDto){
    const key=idempotencyKey.trim();
    if(!key)throw new BadRequestException('Idempotency-Key header is required');
    if(dto.fromWalletId===dto.toWalletId)throw new BadRequestException('Wallets must be different');
    const amount=BigInt(dto.amountMinor);assertPositiveAmount(amount);
    const previous=await this.db.transfer.findUnique({where:{requestedById_idempotencyKey:{requestedById:userId,idempotencyKey:key}}});
    if(previous){
      if(!this.sameRequest(previous,dto))throw new ConflictException('Idempotency key was already used with a different request');
      return this.serialize(previous,true);
    }
    try{
      const created=await this.runSerializable(async tx=>{
        const replay=await tx.transfer.findUnique({where:{requestedById_idempotencyKey:{requestedById:userId,idempotencyKey:key}}});
        if(replay){
          if(!this.sameRequest(replay,dto))throw new ConflictException('Idempotency key was already used with a different request');
          return replay;
        }
        const [fromWallet,toWallet]=await Promise.all([tx.wallet.findUnique({where:{id:dto.fromWalletId}}),tx.wallet.findUnique({where:{id:dto.toWalletId}})]);
        if(!fromWallet||!toWallet)throw new NotFoundException('Wallet not found');
        if(fromWallet.userId!==userId)throw new ForbiddenException('Source wallet ownership required');
        if(fromWallet.currency!==toWallet.currency)throw new BadRequestException('Wallet currencies must match');
        const accounts=await tx.ledgerAccount.findMany({where:{walletId:{in:[fromWallet.id,toWallet.id]},name:'wallet-balance'}});
        const fromAccount=accounts.find(x=>x.walletId===fromWallet.id),toAccount=accounts.find(x=>x.walletId===toWallet.id);
        if(!fromAccount||!toAccount)throw new Error('Wallet balance account is missing');
        const aggregate=await tx.ledgerEntry.aggregate({where:{accountId:fromAccount.id},_sum:{amountMinor:true}});
        if((aggregate._sum.amountMinor??0n)<amount)throw new ConflictException('Insufficient funds');
        const entries=[{accountId:fromAccount.id,amountMinor:-amount},{accountId:toAccount.id,amountMinor:amount}];assertBalanced(entries);
        const ledger=await tx.ledgerTransaction.create({data:{referenceKey:`transfer:${userId}:${key}`,description:'Wallet transfer',entries:{create:entries}}});
        const transfer=await tx.transfer.create({data:{requestedById:userId,idempotencyKey:key,fromWalletId:fromWallet.id,toWalletId:toWallet.id,amountMinor:amount,currency:fromWallet.currency,status:TransferStatus.POSTED,ledgerTransactionId:ledger.id}});
        await tx.outboxEvent.create({data:{
          type:'transfer.posted',
          aggregateId:transfer.id,
          payload:{transferId:transfer.id,userId,fromWalletId:fromWallet.id,toWalletId:toWallet.id,amountMinor:amount.toString(),currency:fromWallet.currency,status:'POSTED'},
        }});
        return transfer;
      });
      return this.serialize(created,false);
    }catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){
        const replay=await this.db.transfer.findUnique({where:{requestedById_idempotencyKey:{requestedById:userId,idempotencyKey:key}}});
        if(replay&&this.sameRequest(replay,dto))return this.serialize(replay,true);
      }
      throw error;
    }
  }
  async list(userId:string){
    const rows=await this.db.transfer.findMany({where:{OR:[{requestedById:userId},{fromWallet:{userId}},{toWallet:{userId}}]},orderBy:{createdAt:'desc'},take:100});
    return rows.map(row=>this.serialize(row,false));
  }
}
