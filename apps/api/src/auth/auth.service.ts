import {ConflictException,Injectable,UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {Prisma} from '@prisma/client';
import {compare,hash} from 'bcryptjs';
import {PrismaService} from '../prisma/prisma.service';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';

@Injectable()
export class AuthService{
  constructor(private readonly db:PrismaService,private readonly jwt:JwtService){}

  private async session(user:{id:string;email:string;name:string}){
    return{
      accessToken:await this.jwt.signAsync({sub:user.id,email:user.email}),
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
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto:LoginDto){
    const email=dto.email.trim().toLowerCase();
    const user=await this.db.user.findUnique({where:{email}});
    if(!user||!(await compare(dto.password,user.passwordHash))){
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.session({id:user.id,email:user.email,name:user.name});
  }

  async me(userId:string){
    const user=await this.db.user.findUnique({
      where:{id:userId},
      select:{id:true,email:true,name:true,createdAt:true},
    });
    if(!user)throw new UnauthorizedException();
    return user;
  }
}
