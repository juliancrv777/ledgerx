import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class WalletsService{
  constructor(private readonly db:PrismaService){}

  async list(userId:string){
    const wallets=await this.db.wallet.findMany({
      where:{userId},
      orderBy:{createdAt:'asc'},
      include:{accounts:{where:{name:'wallet-balance'},select:{id:true}}},
    });
    return Promise.all(wallets.map(async wallet=>({
      id:wallet.id,
      currency:wallet.currency,
      createdAt:wallet.createdAt,
      balanceMinor:await this.balanceForAccount(wallet.accounts[0]?.id),
    })));
  }

  private async balanceForAccount(accountId?:string){
    if(!accountId)return '0';
    const aggregate=await this.db.ledgerEntry.aggregate({
      where:{accountId},
      _sum:{amountMinor:true},
    });
    return (aggregate._sum.amountMinor??0n).toString();
  }

  async fund(userId:string,walletId:string,amountMinor:number,idempotencyKey:string){
    if(!idempotencyKey.trim())throw new ConflictException('Idempotency-Key header is required');
    const wallet=await this.db.wallet.findUnique({where:{id:walletId}});
    if(!wallet)throw new NotFoundException('Wallet not found');
    if(wallet.userId!==userId)throw new ForbiddenException('Wallet ownership required');

    const referenceKey=`fund:${userId}:${idempotencyKey.trim()}`;
    const existing=await this.db.ledgerTransaction.findUnique({where:{referenceKey}});
    if(existing)return{transactionId:existing.id,replayed:true};

    try{
      const transaction=await this.db.$transaction(async tx=>{
        const accounts=await tx.ledgerAccount.findMany({
          where:{walletId,name:{in:['wallet-balance','funding-clearing']}},
        });
        const balanceAccount=accounts.find(x=>x.name==='wallet-balance');
        const clearingAccount=accounts.find(x=>x.name==='funding-clearing');
        if(!balanceAccount||!clearingAccount)throw new Error('Wallet ledger accounts are missing');

        return tx.ledgerTransaction.create({
          data:{
            referenceKey,
            description:'Simulated wallet funding',
            entries:{create:[
              {accountId:balanceAccount.id,amountMinor:BigInt(amountMinor)},
              {accountId:clearingAccount.id,amountMinor:-BigInt(amountMinor)},
            ]},
          },
        });
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      return{transactionId:transaction.id,replayed:false};
    }catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){
        const replay=await this.db.ledgerTransaction.findUnique({where:{referenceKey}});
        if(replay)return{transactionId:replay.id,replayed:true};
      }
      throw error;
    }
  }
}
