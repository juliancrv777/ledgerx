import {HealthController} from './health.controller';

describe('HealthController',()=>{
  it('reports the API as healthy',()=>{
    expect(new HealthController().health()).toEqual({status:'ok',service:'ledgerx-api'});
  });
});
