import {CanActivate,ExecutionContext,Injectable,UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import type {Request} from 'express';
import type {AuthUser} from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate{
  constructor(private readonly jwt:JwtService){}

  async canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest<Request&{user?:AuthUser}>();
    const [type,token]=(request.headers.authorization??'').split(' ');
    if(type!=='Bearer'||!token)throw new UnauthorizedException();
    try{
      request.user=await this.jwt.verifyAsync<AuthUser>(token);
      return true;
    }catch{
      throw new UnauthorizedException();
    }
  }
}
