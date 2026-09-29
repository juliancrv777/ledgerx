export type LedgerDraftEntry={accountId:string;amountMinor:bigint};

export function assertBalanced(entries:LedgerDraftEntry[]){
  if(entries.length<2)throw new Error('A ledger transaction requires at least two entries');
  const total=entries.reduce((sum,entry)=>sum+entry.amountMinor,0n);
  if(total!==0n)throw new Error('Ledger transaction is not balanced');
}

export function assertPositiveAmount(amountMinor:bigint){
  if(amountMinor<=0n)throw new Error('Amount must be positive');
}
