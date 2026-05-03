import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthModuleId } from './health.constants';
import { HealthService } from './health.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  summary() {
    return this.health.checkAll();
  }

  @Get(':module')
  async module(
    @Param('module', new ParseEnumPipe(HealthModuleId))
    moduleId: HealthModuleId,
  ) {
    const result = await this.health.checkModule(moduleId);
    if (result.status === 'down') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
