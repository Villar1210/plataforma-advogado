import { Controller, Delete, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Usuario, UsuarioLogado } from '../common/auth';
import { AnexosService } from './anexos.service';

@Controller('anexos')
export class AnexosController {
  constructor(private readonly svc: AnexosService) {}

  @Get(':id')
  async baixar(@Usuario() u: UsuarioLogado, @Param('id') id: string, @Res() res: Response) {
    const a = await this.svc.doEscritorio(u.tenantId, id);
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.nomeArquivo)}`);
    res.sendFile(this.svc.caminhoAbsoluto(a.caminho));
  }

  @Delete(':id')
  remover(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.remover(u.tenantId, id);
  }
}
