'use client';
import {FormEvent,useEffect,useMemo,useState} from 'react';

type Wallet={id:string;currency:string;balanceMinor:string;createdAt:string};
type Transfer={id:string;fromWalletId:string;toWalletId:string;amountMinor:string;currency:string;status:string;createdAt:string};
type User={id:string;name:string;email:string};
const API=process.env.NEXT_PUBLIC_API_URL??'http://localhost:4000/api';
const money=(minor:string|number,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(Number(minor)/100);
const key=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;

export default function Home(){
  const [token,setToken]=useState('');
  const [user,setUser]=useState<User|null>(null);
  const [wallets,setWallets]=useState<Wallet[]>([]);
  const [transfers,setTransfers]=useState<Transfer[]>([]);
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const wallet=wallets[0];

  const api=async(path:string,init:RequestInit={})=>{
    const response=await fetch(`${API}${path}`,{...init,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{}),...init.headers}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message??'Request failed');
    return data;
  };
  const refresh=async(activeToken=token)=>{
    if(!activeToken)return;
    const headers={authorization:`Bearer ${activeToken}`};
    const [me,w,t]=await Promise.all([
      fetch(`${API}/auth/me`,{headers}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`${API}/wallets`,{headers}).then(r=>r.json()),
      fetch(`${API}/transfers`,{headers}).then(r=>r.json()),
    ]);
    setUser(me);setWallets(w);setTransfers(t);
  };
  useEffect(()=>{const saved=localStorage.getItem('ledgerx_token');if(saved){setToken(saved);void refresh(saved).catch(()=>localStorage.removeItem('ledgerx_token'))}},[]);
  const submitAuth=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setBusy(true);setMessage('');
    const fd=new FormData(e.currentTarget);
    try{
      const payload=mode==='register'?{name:fd.get('name'),email:fd.get('email'),password:fd.get('password')}:{email:fd.get('email'),password:fd.get('password')};
      const data=await fetch(`${API}/auth/${mode}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.message);return x});
      localStorage.setItem('ledgerx_token',data.accessToken);setToken(data.accessToken);await refresh(data.accessToken);
    }catch(error){setMessage(error instanceof Error?error.message:'Authentication failed')}finally{setBusy(false)}
  };
  const fund=async()=>{
    if(!wallet)return;setBusy(true);setMessage('');
    try{await api(`/wallets/${wallet.id}/fund`,{method:'POST',headers:{'Idempotency-Key':key('fund')},body:JSON.stringify({amountMinor:10000})});await refresh();setMessage('R$ 100,00 added to the simulated wallet.')}catch(e){setMessage(e instanceof Error?e.message:'Funding failed')}finally{setBusy(false)}
  };
  const transfer=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!wallet)return;setBusy(true);setMessage('');
    const fd=new FormData(e.currentTarget);
    try{await api('/transfers',{method:'POST',headers:{'Idempotency-Key':key('transfer')},body:JSON.stringify({fromWalletId:wallet.id,toWalletId:fd.get('walletId'),amountMinor:Number(fd.get('amount'))})});await refresh();e.currentTarget.reset();setMessage('Transfer posted atomically.')}catch(err){setMessage(err instanceof Error?err.message:'Transfer failed')}finally{setBusy(false)}
  };
  const balance=useMemo(()=>money(wallet?.balanceMinor??'0',wallet?.currency),[wallet]);

  if(!token||!user)return <main className="auth-shell"><section className="hero"><div className="brand">LX</div><p className="eyebrow">FINANCIAL SYSTEMS ENGINEERING</p><h1>Money movement,<br/><span>engineered correctly.</span></h1><p className="lead">A production-minded payment simulation with double-entry accounting, idempotency, serializable transactions, outbox events and signed webhooks.</p><div className="chips"><span>PostgreSQL</span><span>Redis + BullMQ</span><span>Double-entry ledger</span></div></section><section className="auth-card"><div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Sign in</button><button className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Create account</button></div><form onSubmit={submitAuth}>{mode==='register'&&<label>Name<input name="name" required minLength={2}/></label>}<label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" required minLength={8}/></label>{message&&<p className="notice error">{message}</p>}<button className="primary" disabled={busy}>{busy?'Working…':mode==='login'?'Sign in':'Create LedgerX account'}</button></form><small>Portfolio environment · no real money is processed.</small></section></main>;

  return <main className="app-shell"><aside><div className="logo"><b>LX</b><span>LedgerX</span></div><nav><a className="selected">Overview</a><a>Transfers</a><a>Webhooks</a><a>System</a></nav><div className="profile"><div>{user.name.slice(0,1).toUpperCase()}</div><span><b>{user.name}</b><small>{user.email}</small></span></div></aside><section className="content"><header><div><p className="eyebrow">OVERVIEW</p><h2>Financial dashboard</h2></div><button className="ghost" onClick={()=>{localStorage.removeItem('ledgerx_token');setToken('');setUser(null)}}>Sign out</button></header>{message&&<p className="notice">{message}</p>}<div className="stats"><article className="balance-card"><span>Available balance</span><strong>{balance}</strong><small>{wallet?.currency} · simulated funds</small><button onClick={fund} disabled={busy}>+ Add R$ 100</button></article><article><span>Ledger status</span><strong className="good">Balanced</strong><small>Double-entry invariant</small></article><article><span>Transfers</span><strong>{transfers.length}</strong><small>Posted transactions</small></article></div><div className="panels"><section className="panel"><div className="panel-title"><div><p className="eyebrow">NEW TRANSFER</p><h3>Move simulated funds</h3></div></div><form className="transfer-form" onSubmit={transfer}><label>Destination wallet ID<input name="walletId" required placeholder="cuid of another wallet"/></label><label>Amount in cents<input name="amount" type="number" min="1" step="1" required placeholder="2500 = R$ 25,00"/></label><button className="primary" disabled={busy||!wallet}>Post transfer</button></form></section><section className="panel"><p className="eyebrow">YOUR WALLET</p><h3>Wallet identity</h3><div className="wallet-id">{wallet?.id}</div><p className="muted">Share this ID with another LedgerX demo account to receive a transfer.</p></section></div><section className="panel history"><div className="panel-title"><div><p className="eyebrow">LEDGER ACTIVITY</p><h3>Recent transfers</h3></div><span>{transfers.length} records</span></div>{transfers.length===0?<div className="empty">No transfers yet. Fund your wallet and send your first transaction.</div>:<div className="table">{transfers.map(t=><div className="row" key={t.id}><div className="tx-icon">↗</div><div><b>{t.fromWalletId===wallet?.id?'Sent':'Received'}</b><small>{new Date(t.createdAt).toLocaleString('pt-BR')}</small></div><span className={t.fromWalletId===wallet?.id?'negative':'positive'}>{t.fromWalletId===wallet?.id?'-':'+'}{money(t.amountMinor,t.currency)}</span><em>{t.status}</em></div>)}</div>}</section></section></main>;
}
