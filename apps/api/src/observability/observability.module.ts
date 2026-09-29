import {Module} from '@nestjs/common';
import {MetricsController} from './metrics.controller';
import {MetricsService} from './metrics.service';
import {RequestObservabilityMiddleware} from './request-observability.middleware';
@Module({controllers:[MetricsController],providers:[MetricsService,RequestObservabilityMiddleware],exports:[RequestObservabilityMiddleware]})
export class ObservabilityModule{}
