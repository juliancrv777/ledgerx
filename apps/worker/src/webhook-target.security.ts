import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

function stripIpv6Brackets(value:string){
  return value.startsWith('[')&&value.endsWith(']')?value.slice(1,-1):value;
}

function publicIpv4(address:string){
  const octets=address.split('.').map(Number);
  if(octets.length!==4||octets.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [a,b,c]=octets;
  if(a===0||a===10||a===127)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&b===168)return false;
  if(a===192&&b===0&&c===0)return false;
  if(a===192&&b===0&&c===2)return false;
  if(a===198&&(b===18||b===19))return false;
  if(a===198&&b===51&&c===100)return false;
  if(a===203&&b===0&&c===113)return false;
  if(a>=224)return false;
  return true;
}

function publicIpv6(address:string){
  const normalized=address.toLowerCase();
  if(normalized==='::'||normalized==='::1')return false;
  if(normalized.startsWith('fc')||normalized.startsWith('fd'))return false;
  if(/^fe[89ab]/.test(normalized))return false;
  if(normalized.startsWith('ff'))return false;
  if(normalized.startsWith('2001:db8:'))return false;
  const mapped=normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if(mapped)return publicIpv4(mapped[1]);
  return true;
}

export function isPublicAddress(address:string){
  const value=stripIpv6Brackets(address);
  const version=isIP(value);
  return version===4?publicIpv4(value):version===6?publicIpv6(value):false;
}

export async function assertSafeWebhookTarget(raw:string){
  const url=new URL(raw);
  if(url.protocol!=='https:')throw new Error('Unsafe webhook target: HTTPS is required');
  if(url.username||url.password)throw new Error('Unsafe webhook target: URL credentials are not allowed');
  if(url.port&&url.port!=='443')throw new Error('Unsafe webhook target: non-standard HTTPS port');

  const hostname=stripIpv6Brackets(url.hostname.toLowerCase());
  if(hostname==='localhost'||hostname.endsWith('.localhost')||hostname.endsWith('.local')||hostname.endsWith('.internal')){
    throw new Error('Unsafe webhook target: private hostname');
  }

  if(isIP(hostname)){
    if(!isPublicAddress(hostname))throw new Error('Unsafe webhook target: non-public IP');
    return url.toString();
  }

  const addresses=await lookup(hostname,{all:true,verbatim:true});
  if(addresses.length===0||addresses.some(({address})=>!isPublicAddress(address))){
    throw new Error('Unsafe webhook target: hostname resolves to non-public IP');
  }
  return url.toString();
}
