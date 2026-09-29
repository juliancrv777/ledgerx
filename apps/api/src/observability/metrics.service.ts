import {Injectable} from '@nestjs/common';
import {Counter,Histogram,Registry,collectDefaultMetrics} from 'prom-client';

@Injectable()
export class MetricsService{
  readonly registry=new Registry();
  readonly requests=new Counter({name:'ledgerx_http_requests_total',help:'HTTP requests',labelNames:['method','route','status'] as const,registers:[this.registry]});
  readonly duration=new Histogram({name:'ledgerx_http_request_duration_seconds',help:'HTTP request duration',labelNames:['method','route','status'] as const,registers:[this.registry]});
  constructor(){collectDefaultMetrics({register:this.registry,prefix:'ledgerx_api_'})}
}
