import {assertBalanced,assertPositiveAmount} from './ledger.rules';

describe('ledger rules',()=>{
  it('accepts a balanced pair',()=>{
    expect(()=>assertBalanced([
      {accountId:'sender',amountMinor:-500n},
      {accountId:'receiver',amountMinor:500n},
    ])).not.toThrow();
  });

  it('rejects an unbalanced transaction',()=>{
    expect(()=>assertBalanced([
      {accountId:'a',amountMinor:-500n},
      {accountId:'b',amountMinor:499n},
    ])).toThrow('not balanced');
  });

  it('rejects non-positive transfer amounts',()=>{
    expect(()=>assertPositiveAmount(0n)).toThrow('positive');
  });
});
