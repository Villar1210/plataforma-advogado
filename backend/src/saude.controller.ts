import { Controller, Get } from '@nestjs/common';
import { Publico } from './common/auth';
import { PrismaService } from './prisma/prisma.service';

@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async saude() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, versao: process.env.npm_package_version ?? '0.1.0' };
  }
}
