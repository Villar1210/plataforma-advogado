import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnexoTipo } from '@prisma/client';
import { Usuario, UsuarioLogado } from '../common/auth';
import { AnexosService, ArquivoRecebido, LIMITE_ARQUIVO } from '../anexos/anexos.service';
import { AvaliarDto, DemandaDto, EnviarDto, FiltroDemandasDto, MotivoDto } from './demandas.dto';
import { DemandasService } from './demandas.service';

@Controller('demandas')
export class DemandasController {
  constructor(
    private readonly svc: DemandasService,
    private readonly anexos: AnexosService,
  ) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroDemandasDto) {
    return this.svc.listar(u.tenantId, f);
  }

  @Get('resumo')
  resumo(@Usuario() u: UsuarioLogado) {
    return this.svc.resumo(u.tenantId);
  }

  @Get(':id')
  obter(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.obter(u.tenantId, id);
  }

  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: DemandaDto) {
    return this.svc.criar(u, dto);
  }

  @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: DemandaDto) {
    return this.svc.atualizar(u, id, dto);
  }

  @Post(':id/enviar')
  enviar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: EnviarDto) {
    return this.svc.enviar(u, id, dto.correspondenteIds);
  }

  @Post(':id/envios/:envioId/escolher')
  escolher(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Param('envioId') envioId: string) {
    return this.svc.escolher(u, id, envioId);
  }

  @Post(':id/envios/:envioId/cancelar')
  cancelarEnvio(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Param('envioId') envioId: string) {
    return this.svc.cancelarEnvio(u, id, envioId);
  }

  @Post(':id/iniciar')
  async iniciar(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    await this.svc.iniciar(u.tenantId, id, { usuarioId: u.id });
    return this.svc.obter(u.tenantId, id);
  }

  @Post(':id/aprovar')
  aprovar(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.aprovar(u, id);
  }

  @Post(':id/devolver')
  devolver(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: MotivoDto) {
    return this.svc.devolver(u, id, dto.motivo);
  }

  @Post(':id/cancelar')
  cancelar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: MotivoDto) {
    return this.svc.cancelar(u, id, dto.motivo);
  }

  @Post(':id/avaliar')
  avaliar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: AvaliarDto) {
    return this.svc.avaliar(u, id, dto);
  }

  @Post(':id/anexos')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: LIMITE_ARQUIVO } }))
  async anexar(
    @Usuario() u: UsuarioLogado,
    @Param('id') id: string,
    @UploadedFile() arquivo: ArquivoRecebido,
    @Body('tipo') tipo: AnexoTipo,
  ) {
    await this.svc.buscar(u.tenantId, id);
    const t = Object.values(AnexoTipo).includes(tipo) ? tipo : AnexoTipo.OUTRO;
    const a = await this.anexos.salvar(u.tenantId, id, arquivo, t, { usuarioId: u.id });
    await this.svc.registrar(id, 'ANEXO', `Arquivo anexado: ${a.nomeArquivo}`, { usuarioId: u.id });
    return this.svc.obter(u.tenantId, id);
  }
}
