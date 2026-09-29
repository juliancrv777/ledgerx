import {ConflictException,Injectable,UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {Prisma} from '@prisma/client';
import {compare,hash} from 'bcryptjs';
import {createHash,randomBytes} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';

const REFRESH_DAYS=7;
const refreshHash=(token:string)=>createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService{
  constructor(private readonly db:PrismaService,private readonly jwt:JwtService){}

  private async session(user:{id:string;email:string;name:string}){
    const refreshToken=randomBytes(48).toString('base64url');
    const expiresAt=new Date(Date.now()+REFRESH_DAYS*24*60*60*1000);
    await this.db.refreshSession.create({data:{userId:user.id,tokenHash:refreshHash(refreshToken),expiresAt}});
    return{
      accessToken:await this.jwt.signAsync({sub:user.id,email:user.email}),
      refreshToken,
      user,
    };
  }

  async register(dto:RegisterDto){
    const email=dto.email.trim().toLowerCase();
    try{
      const user=await this.db.$transaction(async tx=>{
        const created=await tx.user.create({
          data:{email,name:dto.name.trim(),passwordHash:await hash(dto.password,12)},
          select:{id:true,email:true,name:true},
        });
        const wallet=await tx.wallet.create({data:{userId:created.id,currency:'BRL'}});
        await tx.ledgerAccount.createMany({data:[
          {walletId:wallet.id,type:'LIABILITY',name:'wallet-balance'},
          {walletId:wallet.id,type:'EQUITY',name:'funding-clearing'},
        ]});
        return created;
      });
      return this.session(user);
    }catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(dto:LoginDto){
    const email=dto.email.trim().toLowerCase();
    const user=await this.db.user.findUnique({where:{email}});
    if(!user||!(await compare(dto.password,user.passwordHash)))throw new UnauthorizedException('Invalid credentials');
    return this.session({id:user.id,email:user.email,name:user.name});
  }

  async refresh(token:string){
    const tokenHash=refreshHash(token);
    const existing=await this.db.refreshSession.findUnique({where:{tokenHash},include:{user:true}});
    if(!existing||existing.revokedAt||existing.expiresAt<=new Date())throw new UnauthorizedException('Invalid refresh session');

    const nextToken=randomBytes(48).toString('base64url');
    const nextHash=refreshHash(nextToken);
    const expiresAt=new Date(Date.now()+REFRESH_DAYS*24*60*60*1000);
    await this.db.$transaction([
      this.db.refreshSession.update({where:{id:existing.id},data:{revokedAt:new Date()}}),
      this.db.refreshSession.create({data:{userId:existing.userId,tokenHash:nextHash,expiresAt}}),
    ]);
    return{
      accessToken:await this.jwt.signAsync({sub:existing.user.id,email:existing.user.email}),
      refreshToken:nextToken,
      user:{id:existing.user.id,email:existing.user.email,name:existing.user.name},
    };
  }

  async logout(token?:string){
    if(token)await this.db.refreshSession.updateMany({where:{tokenHash:refreshHash(token),revokedAt:null},data:{revokedAt:new Date()}});
    return{ok:true};
  }

  async me(userId:string){
    const user=await this.db.user.findUnique({where:{id:userId},select:{id:true,email:true,name:true,createdAt:true}});
    if(!user)throw new UnauthorizedException();
    return user;
  }
}
