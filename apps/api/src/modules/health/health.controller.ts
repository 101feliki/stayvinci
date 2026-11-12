import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Health } from '@stayvinci/types';
import { DocResponse } from '../../common/validation.js';
import { Data } from '../../database.js';
import { Public } from '../../security/guards.js';

/** Health checks for the load balancer. They say "ok" or "fail" and nothing else: no versions or hosts. */
@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@Inject(Data) private readonly data: Data) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Is the process up?' })
  @DocResponse(200, Health, 'Running')
  live() {
    return { status: 'ok' as const, checks: {} };
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Can it serve traffic?',
    description: 'Checks the database connection.',
  })
  @DocResponse(200, Health, 'Ready')
  @DocResponse(503, Health, 'Not ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    let db: 'ok' | 'fail' = 'ok';
    try {
      await this.data.raw.runner.query('select 1');
    } catch {
      db = 'fail';
    }
    if (db === 'fail') res.status(503);
    return {
      status: db === 'ok' ? ('ok' as const) : ('degraded' as const),
      checks: { database: db },
    };
  }
}
