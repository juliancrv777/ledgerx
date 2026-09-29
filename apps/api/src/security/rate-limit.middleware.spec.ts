import {rateLimitPolicy} from './rate-limit.middleware';

describe('rate limit policy',()=>{
  it('uses strict auth limits',()=>{
    expect(rateLimitPolicy({method:'POST',path:'/api/auth/login'} as any)).toEqual({scope:'auth',limit:10,windowSeconds:60});
    expect(rateLimitPolicy({method:'POST',path:'/api/auth/register'} as any)).toEqual({scope:'auth',limit:10,windowSeconds:60});
  });

  it('uses mutation limits for financial and webhook writes',()=>{
    expect(rateLimitPolicy({method:'POST',path:'/api/transfers'} as any).scope).toBe('mutation');
    expect(rateLimitPolicy({method:'POST',path:'/api/wallets/w1/fund'} as any).scope).toBe('mutation');
    expect(rateLimitPolicy({method:'PATCH',path:'/api/webhooks/w1'} as any).scope).toBe('mutation');
  });

  it('uses the general policy for reads',()=>{
    expect(rateLimitPolicy({method:'GET',path:'/api/wallets'} as any)).toEqual({scope:'general',limit:120,windowSeconds:60});
  });
});
