import {IsUrl,MaxLength} from 'class-validator';
export class CreateWebhookDto{
  @IsUrl({require_tld:false,require_protocol:true}) @MaxLength(2048)
  url!:string;
}
