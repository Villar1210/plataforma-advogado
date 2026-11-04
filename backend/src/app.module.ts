import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthGuard } from './common/auth';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { CorrespondentesController } from './correspondentes/correspondentes.controller';
import { CorrespondentesService } from './correspondentes/correspondentes.service';
import { DemandasController } from './demandas/demandas.controller';
import { DemandasService } from './demandas/demandas.service';
import { AnexosController } from './anexos/anexos.controller';
import { AnexosService } from './anexos/anexos.service';
import { PortalController } from './portal/portal.controller';
import { PagamentosController } from './pagamentos/pagamentos.controller';
import { RelatoriosController } from './relatorios/relatorios.controller';
import { NotificacoesController } from './notificacoes/notificacoes.controller';
import { NotificacoesService } from './notificacoes/notificacoes.service';
import { LembretesService } from './notificacoes/lembretes.service';
import { EscritorioController } from './escritorio/escritorio.controller';
import { SaudeController } from './saude.controller';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    SaudeController,
    AuthController,
    CatalogoController,
    CorrespondentesController,
    DemandasController,
    AnexosController,
    PortalController,
    PagamentosController,
    RelatoriosController,
    NotificacoesController,
    EscritorioController,
  ],
  providers: [
    AuthService,
    CorrespondentesService,
    DemandasService,
    AnexosService,
    NotificacoesService,
    LembretesService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
