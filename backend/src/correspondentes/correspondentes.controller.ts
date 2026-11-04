import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Usuario, UsuarioLogado } from '../common/auth';
import { CorrespondenteDto } from './correspondentes.dto';
import { CorrespondentesService } from './correspondentes.service';

@Controller('correspondentes')
export class CorrespondentesController {
  constructor(private readonly svc: CorrespondentesService) {}

  @Get()
  listar(
    @Usuario() u: UsuarioLogado,
    @Query('q') q?: string,
    @Query('cidadeId') cidadeId?: string,
    @Query('servicoId') servicoId?: string,
    @Query('favorito') favorito?: string,
  ) {
    return this.svc.listar(u.tenantId, {
      q,
      cidadeId: cidadeId ? Number(cidadeId) : undefined,
      servicoId: servicoId ? Number(servicoId) : undefined,
      favorito: favorito === 'true',
    });
  }

  @Get('sugestoes')
  sugerir(
    @Usuario() u: UsuarioLogado,
    @Query('cidadeId') cidadeId: string,
    @Query('servicoId') servicoId?: string,
    @Query('apenasAdvogados') apenasAdvogados?: string,
  ) {
    return this.svc.sugerir(u.tenantId, Number(cidadeId), servicoId ? Number(servicoId) : undefined, apenasAdvogados === 'true');
  }

  @Get(':id')
  obter(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.obter(u.tenantId, id);
  }

  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CorrespondenteDto) {
    return this.svc.criar(u.tenantId, dto);
  }

  @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body() dto: CorrespondenteDto) {
    return this.svc.atualizar(u.tenantId, id, dto);
  }

  @Post(':id/favorito')
  favoritar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Body('favorito') favorito: boolean) {
    return this.svc.favoritar(u.tenantId, id, !!favorito);
  }

  @Delete(':id')
  remover(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.remover(u.tenantId, id);
  }
}
