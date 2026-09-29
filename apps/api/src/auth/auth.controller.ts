import {Body,Controller,Get,Post,Req,Res,UseGuards} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AuthService} from './auth.service';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {JwtAuthGuard} from './jwt-auth.guard';
import type {AuthenticatedRequest} from './auth.types';

const COOKIE='ledgerx_refresh';
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'none' as const,path:'/api/auth',maxAge:7*24*60*60*1000};
function readCookie(req:Request,name:string){
  const raw=req.headers.cookie??'';
  for(const item of raw.split(';')){
    const [key,...value]=item.trim().split('=');
    if(key===name)return decodeURIComponent(value.join('='));
  }
  return undefined;
}

@Controller('auth')
export class AuthController{
  constructor(private readonly auth:AuthService){}

  private respond(res:Response,session:{accessToken:string;refreshToken:string;user:unknown}){
    res.cookie(COOKIE,session.refreshToken,cookieOptions);
    return res.json({accessToken:session.accessToken,user:session.user});
  }

  @Post('register')
  async register(@Body()dto:RegisterDto,@Res()res:Response){return this.respond(res,await this.auth.register(dto))}

  @Post('login')
  async login(@Body()dto:LoginDto,@Res()res:Response){return this.respond(res,await this.auth.login(dto))}

  @Post('refresh')
  async refresh(@Req()req:Request,@Res()res:Response){
    const token=readCookie(req,COOKIE);
    if(!token)return res.status(401).json({statusCode:401,message:'Refresh session required'});
    return this.respond(res,await this.auth.refresh(token));
  }

  @Post('logout')
  async logout(@Req()req:Request,@Res()res:Response){
    await this.auth.logout(readCookie(req,COOKIE));
    res.clearCookie(COOKIE,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'none',path:'/api/auth'});
    return res.json({ok:true});
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req()request:AuthenticatedRequest){return this.auth.me(request.user.sub)}
}
