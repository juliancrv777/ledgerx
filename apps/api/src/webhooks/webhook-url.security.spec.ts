import {assertSafeWebhookUrl,isPublicAddress} from './webhook-url.security';

describe('webhook URL security',()=>{
  it('accepts public addresses',()=>{
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
  });

  it('blocks private, loopback, link-local and documentation ranges',()=>{
    for(const address of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','203.0.113.10','::1','fc00::1','fe80::1','2001:db8::1']){
      expect(isPublicAddress(address)).toBe(false);
    }
  });

  it('requires HTTPS and blocks embedded credentials',async()=>{
    await expect(assertSafeWebhookUrl('http://1.1.1.1/hook')).rejects.toThrow('HTTPS');
    await expect(assertSafeWebhookUrl('https://user:pass@1.1.1.1/hook')).rejects.toThrow('credentials');
  });

  it('blocks private IP webhook targets without DNS access',async()=>{
    await expect(assertSafeWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow('public IP');
    await expect(assertSafeWebhookUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow('public IP');
  });

  it('accepts a public HTTPS IP target',async()=>{
    await expect(assertSafeWebhookUrl('https://1.1.1.1/hook')).resolves.toBe('https://1.1.1.1/hook');
  });
});
