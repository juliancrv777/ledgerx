import {ValidationPipe} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/prisma/prisma.service';

describe('LedgerX financial flow (e2e)',()=>{
  let app:INestApplication;
  let db:PrismaService;

  beforeAll(async()=>{
    process.env.RATE_LIMIT_DISABLED='true';
    const moduleRef=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.init();
    db=app.get(PrismaService);
    await db.transfer.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.ledgerTransaction.deleteMany();
    await db.ledgerAccount.deleteMany();
    await db.wallet.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async()=>{
    delete process.env.RATE_LIMIT_DISABLED;
    await app.close();
  });

  async function register(label:string){
    const response=await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({name:label,email:`${label.toLowerCase()}@example.com`,password:'E2E-password-123!'})
      .expect(201);
    const token=response.body.accessToken as string;
    const refreshCookie=(response.headers['set-cookie'] as unknown as string[]|undefined)?.find(value=>value.startsWith('ledgerx_refresh='));
    expect(refreshCookie).toContain('HttpOnly');
    const refreshed=await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie',refreshCookie??'').expect(201);
    expect(typeof refreshed.body.accessToken).toBe('string');
    const rotatedCookie=(refreshed.headers['set-cookie'] as unknown as string[]|undefined)?.find(value=>value.startsWith('ledgerx_refresh='));
    expect(rotatedCookie).toBeDefined();
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie',refreshCookie??'').expect(401);
    const wallets=await request(app.getHttpServer())
      .get('/api/wallets')
      .set('Authorization',`Bearer ${token}`)
      .expect(200);
    return{token,walletId:wallets.body[0].id as string};
  }

  it('keeps money conserved, idempotent and safe under concurrent spending',async()=>{
    const a=await register('Alice');
    const b=await register('Bob');

    const funded=await request(app.getHttpServer())
      .post(`/api/wallets/${a.walletId}/fund`)
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','fund-alice-1')
      .send({amountMinor:10000})
      .expect(201);
    expect(funded.body.replayed).toBe(false);

    const replayedFunding=await request(app.getHttpServer())
      .post(`/api/wallets/${a.walletId}/fund`)
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','fund-alice-1')
      .send({amountMinor:10000})
      .expect(201);
    expect(replayedFunding.body.replayed).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/wallets/${a.walletId}/fund`)
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','fund-alice-1')
      .send({amountMinor:10001})
      .expect(409);

    const transfer=await request(app.getHttpServer())
      .post('/api/transfers')
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','alice-to-bob-1')
      .send({fromWalletId:a.walletId,toWalletId:b.walletId,amountMinor:3000})
      .expect(201);
    expect(transfer.body.amountMinor).toBe('3000');
    expect(transfer.body.replayed).toBe(false);

    const replay=await request(app.getHttpServer())
      .post('/api/transfers')
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','alice-to-bob-1')
      .send({fromWalletId:a.walletId,toWalletId:b.walletId,amountMinor:3000})
      .expect(201);
    expect(replay.body.id).toBe(transfer.body.id);
    expect(replay.body.replayed).toBe(true);

    await request(app.getHttpServer())
      .post('/api/transfers')
      .set('Authorization',`Bearer ${a.token}`)
      .set('Idempotency-Key','alice-to-bob-1')
      .send({fromWalletId:a.walletId,toWalletId:b.walletId,amountMinor:3001})
      .expect(409);

    const aWallets=await request(app.getHttpServer())
      .get('/api/wallets').set('Authorization',`Bearer ${a.token}`).expect(200);
    const bWallets=await request(app.getHttpServer())
      .get('/api/wallets').set('Authorization',`Bearer ${b.token}`).expect(200);
    expect(aWallets.body[0].balanceMinor).toBe('7000');
    expect(bWallets.body[0].balanceMinor).toBe('3000');

    const c=await register('Carol');
    await request(app.getHttpServer())
      .post(`/api/wallets/${c.walletId}/fund`)
      .set('Authorization',`Bearer ${c.token}`)
      .set('Idempotency-Key','fund-carol-1')
      .send({amountMinor:10000})
      .expect(201);

    const attempts=await Promise.all([
      request(app.getHttpServer()).post('/api/transfers')
        .set('Authorization',`Bearer ${c.token}`)
        .set('Idempotency-Key','carol-spend-1')
        .send({fromWalletId:c.walletId,toWalletId:b.walletId,amountMinor:8000}),
      request(app.getHttpServer()).post('/api/transfers')
        .set('Authorization',`Bearer ${c.token}`)
        .set('Idempotency-Key','carol-spend-2')
        .send({fromWalletId:c.walletId,toWalletId:b.walletId,amountMinor:8000}),
    ]);
    expect(attempts.map(x=>x.status).sort()).toEqual([201,409]);

    const cWallets=await request(app.getHttpServer())
      .get('/api/wallets').set('Authorization',`Bearer ${c.token}`).expect(200);
    expect(cWallets.body[0].balanceMinor).toBe('2000');

    const stress=await register('Stress');
    await request(app.getHttpServer())
      .post(`/api/wallets/${stress.walletId}/fund`)
      .set('Authorization',`Bearer ${stress.token}`)
      .set('Idempotency-Key','fund-stress-1')
      .send({amountMinor:10000})
      .expect(201);

    const concurrent=await Promise.all(Array.from({length:100},(_,index)=>
      request(app.getHttpServer()).post('/api/transfers')
        .set('Authorization',`Bearer ${stress.token}`)
        .set('Idempotency-Key',`stress-spend-${index}`)
        .send({fromWalletId:stress.walletId,toWalletId:b.walletId,amountMinor:200})
    ));
    const posted=concurrent.filter(response=>response.status===201);
    const rejected=concurrent.filter(response=>response.status===409);
    expect(posted).toHaveLength(50);
    expect(rejected).toHaveLength(50);

    const stressWallets=await request(app.getHttpServer())
      .get('/api/wallets').set('Authorization',`Bearer ${stress.token}`).expect(200);
    expect(stressWallets.body[0].balanceMinor).toBe('0');

    const webhook=await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization',`Bearer ${a.token}`)
      .send({url:'https://1.1.1.1/ledgerx-webhook'})
      .expect(201);
    expect(webhook.body.active).toBe(true);
    expect(typeof webhook.body.secret).toBe('string');

    const disabledWebhook=await request(app.getHttpServer())
      .patch(`/api/webhooks/${webhook.body.id}`)
      .set('Authorization',`Bearer ${a.token}`)
      .send({active:false})
      .expect(200);
    expect(disabledWebhook.body.active).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/webhooks/${webhook.body.id}`)
      .set('Authorization',`Bearer ${b.token}`)
      .send({active:true})
      .expect(404);

    const ledgerTransactions=await db.ledgerTransaction.findMany({include:{entries:true}});
    expect(ledgerTransactions.length).toBeGreaterThan(0);
    for(const tx of ledgerTransactions){
      const total=tx.entries.reduce((sum,entry)=>sum+entry.amountMinor,0n);
      expect(total).toBe(0n);
    }
  });
});
