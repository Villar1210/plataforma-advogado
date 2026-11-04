import { Controller, Get, Param, Post } from '@nestjs/common';
import { Usuario, UsuarioLogado } from '../common/auth';
import { NotificacoesService } from './notificacoes.service';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly svc: NotificacoesService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado) {
    return this.svc.listar(u.tenantId, u.id);
  }

  @Get('nao-lidas')
  naoLidas(@Usuario() u: UsuarioLogado) {
    return this.svc.naoLidas(u.tenantId, u.id);
  }

  @Post('lidas')
  todas(@Usuario() u: UsuarioLogado) {
    return this.svc.marcarTodas(u.tenantId, u.id);
  }

  @Post(':id/lida')
  lida(@Usuario() u: UsuarioLogado, @Param('id') id: string) {
    return this.svc.marcarLida(u.tenantId, id);
  }
}
