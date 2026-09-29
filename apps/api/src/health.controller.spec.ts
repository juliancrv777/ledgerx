import {HealthController} from './health.controller';

describe('HealthController',()=>{
  it('reports the API as healthy',()=>{
    const db={$queryRaw:jest.fn()} as never;
    expect(new HealthController(db).health()).toEqual({status:'ok',service:'ledgerx-api'});
  });
});
