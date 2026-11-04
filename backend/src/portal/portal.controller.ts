import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Publico } from '../common/auth';
import { AnexosService, ArquivoRecebido, LIMITE_ARQUIVO } from '../anexos/anexos.service';
import { DemandasService } from '../demandas/demandas.service';
import { AceiteDto, EntregaDto } from '../demandas/demandas.dto';

/** Portal do correspondente: acesso só pelo token do link enviado no WhatsApp. */
@Publico()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('portal/:token')
export class PortalController {
  constructor(
    private readonly demandas: DemandasService,
    private readonly anexos: AnexosService,
  ) {}

  @Get()
  ver(@Param('token') token: string) {
    return this.demandas.portalVer(token);
  }

  @Post('aceitar')
  aceitar(@Param('token') token: string, @Body() dto: AceiteDto) {
    return this.demandas.portalAceitar(token, dto.valorProposto, dto.mensagem);
  }

  @Post('recusar')
  recusar(@Param('token') token: string, @Body('motivo') motivo?: string) {
    return this.demandas.portalRecusar(token, motivo);
  }

  @Post('iniciar')
  iniciar(@Param('token') token: string) {
    return this.demandas.portalIniciar(token);
  }

  @Post('entregar')
  @UseInterceptors(FilesInterceptor('arquivos', 10, { limits: { fileSize: LIMITE_ARQUIVO } }))
  async entregar(
    @Param('token') token: string,
    @Body() dto: EntregaDto,
    @UploadedFiles() arquivos: ArquivoRecebido[] = [],
  ) {
    const e = await this.demandas.envioPorToken(token);
    this.demandas.exigirExecutor(e);
    if (!['ACEITA', 'EM_EXECUCAO'].includes(e.demanda.status)) {
      throw new BadRequestException('A demanda não está aguardando entrega');
    }
    for (const a of arquivos) {
      await this.anexos.salvar(e.demanda.tenantId, e.demandaId, a, 'COMPROVANTE_ENTREGA', {
        correspondenteId: e.correspondenteId,
      });
    }
    return this.demandas.portalEntregar(token, dto.observacao, arquivos.length);
  }

  @Get('anexos/:anexoId')
  async baixar(@Param('token') token: string, @Param('anexoId') anexoId: string, @Res() res: Response) {
    const e = await this.demandas.envioPorToken(token);
    this.demandas.exigirExecutor(e);
    const a = e.demanda.anexos.find((x) => x.id === anexoId);
    if (!a || (a.tipo === 'COMPROVANTE_PAGAMENTO' && e.demanda.status !== 'PAGA')) {
      throw new NotFoundException('Arquivo não encontrado');
    }
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.nomeArquivo)}`);
    res.sendFile(this.anexos.caminhoAbsoluto(a.caminho));
  }
}
