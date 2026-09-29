import {IsUrl,MaxLength} from 'class-validator';
export class CreateWebhookDto{
  @IsUrl({protocols:['https'],require_protocol:true,require_tld:false}) @MaxLength(2048)
  url!:string;
}
