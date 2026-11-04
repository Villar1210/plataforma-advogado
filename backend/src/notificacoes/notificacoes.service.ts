import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  criar(tenantId: string, titulo: string, mensagem: string, link?: string, usuarioId?: string) {
    return this.prisma.notificacao.create({ data: { tenantId, titulo, mensagem, link, usuarioId } });
  }

  listar(tenantId: string, usuarioId: string) {
    return this.prisma.notificacao.findMany({
      where: { tenantId, OR: [{ usuarioId: null }, { usuarioId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async naoLidas(tenantId: string, usuarioId: string) {
    return {
      total: await this.prisma.notificacao.count({
        where: { tenantId, lida: false, OR: [{ usuarioId: null }, { usuarioId }] },
      }),
    };
  }

  async marcarLida(tenantId: string, id: string) {
    await this.prisma.notificacao.updateMany({ where: { tenantId, id }, data: { lida: true } });
    return { ok: true };
  }

  async marcarTodas(tenantId: string, usuarioId: string) {
    await this.prisma.notificacao.updateMany({
      where: { tenantId, lida: false, OR: [{ usuarioId: null }, { usuarioId }] },
      data: { lida: true },
    });
    return { ok: true };
  }
}
