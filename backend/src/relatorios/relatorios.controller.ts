import { Controller, Get, Query, Res } from '@nestjs/common';
import { DemandaStatus, PagamentoStatus, Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Usuario, UsuarioLogado } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { ROTULO_STATUS } from '../demandas/demandas.service';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('demandas')
  async demandas(
    @Usuario() u: UsuarioLogado,
    @Res({ passthrough: true }) res: Response,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('servicoId') servicoId?: string,
    @Query('cidadeId') cidadeId?: string,
    @Query('correspondenteId') correspondenteId?: string,
    @Query('status') status?: string,
    @Query('pagamento') pagamento?: PagamentoStatus,
    @Query('formato') formato?: 'json' | 'csv',
  ) {
    const where: Prisma.DemandaWhereInput = { tenantId: u.tenantId };
    if (inicio || fim) {
      where.createdAt = {
        ...(inicio ? { gte: new Date(`${inicio}T00:00:00-03:00`) } : {}),
        ...(fim ? { lte: new Date(`${fim}T23:59:59-03:00`) } : {}),
      };
    }
    if (servicoId) where.servicoId = Number(servicoId);
    if (cidadeId) where.cidadeId = Number(cidadeId);
    if (correspondenteId) where.correspondenteId = correspondenteId;
    const lista = (status ?? '')
      .split(',')
      .filter((s): s is DemandaStatus => (Object.values(DemandaStatus) as string[]).includes(s));
    if (lista.length) where.status = { in: lista };
    if (pagamento && Object.values(PagamentoStatus).includes(pagamento)) where.pagamento = { status: pagamento };

    const rows = await this.prisma.demanda.findMany({
      where,
      include: {
        cidade: { select: { nome: true, uf: true } },
        servico: { select: { nome: true } },
        correspondente: { select: { nome: true } },
        pagamento: { select: { status: true, valor: true, pagoEm: true } },
        avaliacao: { select: { nota: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const linhas = rows.map((d) => ({
      id: d.id,
      numero: d.numero,
      criadaEm: d.createdAt,
      servico: d.servico?.nome ?? d.servicoTexto ?? '',
      cidade: `${d.cidade.nome}/${d.cidade.uf}`,
      processo: d.processoNumero ?? '',
      correspondente: d.correspondente?.nome ?? '',
      prazo: d.prazo,
      status: d.status,
      statusRotulo: ROTULO_STATUS[d.status],
      valor: Number(d.valorAcordado ?? d.valor ?? 0),
      pagamento: d.pagamento?.status ?? '',
      pagoEm: d.pagamento?.pagoEm ?? null,
      nota: d.avaliacao?.nota ?? null,
    }));
    const totais = {
      demandas: linhas.length,
      valorTotal: linhas.reduce((s, l) => s + l.valor, 0),
      valorPago: linhas.filter((l) => l.pagamento === 'PAGO').reduce((s, l) => s + l.valor, 0),
      valorPendente: linhas.filter((l) => l.pagamento === 'PENDENTE').reduce((s, l) => s + l.valor, 0),
    };

    if (formato === 'csv') {
      const data = (x: Date | null) => (x ? x.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const cab = ['Nº', 'Criada em', 'Serviço', 'Cidade', 'Processo', 'Correspondente', 'Prazo', 'Status', 'Valor', 'Pagamento', 'Pago em', 'Nota'];
      const corpo = linhas.map((l) =>
        [l.numero, data(l.criadaEm), l.servico, l.cidade, l.processo, l.correspondente, data(l.prazo), l.statusRotulo,
          l.valor.toFixed(2).replace('.', ','), l.pagamento, data(l.pagoEm), l.nota ?? '']
          .map(esc)
          .join(';'),
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-demandas.csv"');
      return '﻿' + [cab.map(esc).join(';'), ...corpo].join('\r\n');
    }
    return { linhas, totais };
  }
}
