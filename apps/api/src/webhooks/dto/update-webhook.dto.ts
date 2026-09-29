import {IsBoolean} from 'class-validator';

export class UpdateWebhookDto{
  @IsBoolean()
  active!:boolean;
}
