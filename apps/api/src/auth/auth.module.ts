import {Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {JwtAuthGuard} from './jwt-auth.guard';

const jwtSecret=process.env.JWT_SECRET;
if(!jwtSecret&&process.env.NODE_ENV==='production'){
  throw new Error('JWT_SECRET is required in production');
}

@Module({
  imports:[JwtModule.register({
    secret:jwtSecret??'development-only-secret',
    signOptions:{expiresIn:'15m'},
  })],
  controllers:[AuthController],
  providers:[AuthService,JwtAuthGuard],
  exports:[JwtModule,JwtAuthGuard],
})
export class AuthModule{}
