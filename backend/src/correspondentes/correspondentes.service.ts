import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizarWhatsapp } from '../common/util';
import { CorrespondenteDto } from './correspondentes.dto';

const INCLUDE = {
  areas: { include: { cidade: { select: { id: true, nome: true, uf: true } } } },
  servicos: { include: { servico: { select: { id: true, nome: true } } } },
} satisfies Prisma.CorrespondenteInclude;

export interface FiltroCorrespondentes {
  q?: string;
  cidadeId?: number;
  servicoId?: number;
  favorito?: boolean;
  apenasAdvogados?: boolean;
}

@Injectable()
export class CorrespondentesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, f: FiltroCorrespondentes) {
    const where: Prisma.TenantCorrespondenteWhereInput = { tenantId, bloqueado: false };
    if (f.favorito) where.favorito = true;
    const c: Prisma.CorrespondenteWhereInput = { ativo: true };
    if (f.cidadeId) c.areas = { some: { cidadeId: f.cidadeId } };
    if (f.servicoId) c.servicos = { some: { servicoId: f.servicoId } };
    if (f.apenasAdvogados) c.ehAdvogado = true;
    if (f.q) {
      const d = f.q.replace(/\D/g, '');
      c.OR = [
        { nome: { contains: f.q, mode: 'insensitive' } },
        { oab: { contains: f.q, mode: 'insensitive' } },
        ...(d.length >= 4 ? [{ whatsapp: { contains: d } }] : []),
      ];
    }
    where.correspondente = c;

    const vinculos = await this.prisma.tenantCorrespondente.findMany({
      where,
      include: { correspondente: { include: INCLUDE } },
      orderBy: [{ favorito: 'desc' }, { correspondente: { nome: 'asc' } }],
      take: 500,
    });

    // estatísticas do escritório com cada correspondente
    const ids = vinculos.map((v) => v.correspondenteId);
    const stats = ids.length
      ? await this.prisma.demanda.groupBy({
          by: ['correspondenteId'],
          where: { tenantId, correspondenteId: { in: ids }, status: { in: ['APROVADA', 'PAGA'] } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : [];
    const porId = new Map(stats.map((s) => [s.correspondenteId, s]));
    return vinculos.map((v) => this.formatar(v, porId.get(v.correspondenteId)));
  }

  private formatar(v: any, stat?: any) {
    const c = v.correspondente;
    return {
      id: c.id,
      nome: c.nome,
      whatsapp: c.whatsapp,
      email: c.email,
      ehAdvogado: c.ehAdvogado,
      oab: c.oab,
      oabUf: c.oabUf,
      oabValidada: c.oabValidada,
      cpfCnpj: c.cpfCnpj,
      pixTipo: c.pixTipo,
      pixChave: c.pixChave,
      bio: c.bio,
      notaMedia: c.notaMedia,
      totalAvaliacoes: c.totalAvaliacoes,
      cidades: c.areas.map((a: any) => a.cidade),
      servicos: c.servicos.map((s: any) => s.servico),
      favorito: v.favorito,
      valorReferencia: v.valorReferencia,
      observacoes: v.observacoes,
      demandasConcluidas: stat?._count._all ?? 0,
      ultimaContratacao: stat?._max.createdAt ?? null,
    };
  }

  async obter(tenantId: string, id: string) {
    const v = await this.prisma.tenantCorrespondente.findUnique({
      where: { tenantId_correspondenteId: { tenantId, correspondenteId: id } },
      include: { correspondente: { include: INCLUDE } },
    });
    if (!v) throw new NotFoundException('Correspondente não encontrado');
    const historico = await this.prisma.demanda.findMany({
      where: { tenantId, correspondenteId: id },
      select: {
        id: true,
        numero: true,
        status: true,
        prazo: true,
        valorAcordado: true,
        servico: { select: { nome: true } },
        servicoTexto: true,
        cidade: { select: { nome: true, uf: true } },
        avaliacao: { select: { nota: true, noPrazo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const concluidas = historico.filter((d) => ['APROVADA', 'PAGA'].includes(d.status)).length;
    return { ...this.formatar(v, { _count: { _all: concluidas }, _max: { createdAt: null } }), historico };
  }

  /** Cria ou vincula. O cadastro é global: o mesmo WhatsApp é o mesmo correspondente. */
  async criar(tenantId: string, dto: CorrespondenteDto) {
    const whatsapp = normalizarWhatsapp(dto.whatsapp);
    let c = await this.prisma.correspondente.findFirst({ where: { whatsapp } });
    if (c) {
      const ja = await this.prisma.tenantCorrespondente.findUnique({
        where: { tenantId_correspondenteId: { tenantId, correspondenteId: c.id } },
      });
      if (ja) throw new BadRequestException('Este WhatsApp já está na sua lista de correspondentes');
    } else {
      c = await this.prisma.correspondente.create({ data: { ...this.dadosGlobais(dto), whatsapp } });
    }
    await this.prisma.tenantCorrespondente.create({
      data: {
        tenantId,
        correspondenteId: c.id,
        favorito: dto.favorito ?? false,
        valorReferencia: dto.valorReferencia,
        observacoes: dto.observacoes,
      },
    });
    if (await this.podeEditarGlobal(c.id, tenantId)) await this.salvarRelacoes(c.id, dto);
    return this.obter(tenantId, c.id);
  }

  async atualizar(tenantId: string, id: string, dto: Partial<CorrespondenteDto>) {
    await this.obter(tenantId, id);
    await this.prisma.tenantCorrespondente.update({
      where: { tenantId_correspondenteId: { tenantId, correspondenteId: id } },
      data: { favorito: dto.favorito, valorReferencia: dto.valorReferencia, observacoes: dto.observacoes },
    });
    if (await this.podeEditarGlobal(id, tenantId)) {
      const data = this.dadosGlobais(dto);
      if (dto.whatsapp) {
        const whatsapp = normalizarWhatsapp(dto.whatsapp);
        const outro = await this.prisma.correspondente.findFirst({ where: { whatsapp, id: { not: id } } });
        if (outro) throw new BadRequestException('Outro correspondente já usa este WhatsApp');
        Object.assign(data, { whatsapp });
      }
      await this.prisma.correspondente.update({ where: { id }, data });
      await this.salvarRelacoes(id, dto);
    }
    return this.obter(tenantId, id);
  }

  async favoritar(tenantId: string, id: string, favorito: boolean) {
    await this.prisma.tenantCorrespondente.update({
      where: { tenantId_correspondenteId: { tenantId, correspondenteId: id } },
      data: { favorito },
    });
    return { favorito };
  }

  async remover(tenantId: string, id: string) {
    const emAberto = await this.prisma.demanda.count({
      where: { tenantId, correspondenteId: id, status: { in: ['ACEITA', 'EM_EXECUCAO', 'COMPROVANTE_ENVIADO'] } },
    });
    if (emAberto) throw new BadRequestException('Há demandas em andamento com este correspondente');
    await this.prisma.tenantCorrespondente.delete({
      where: { tenantId_correspondenteId: { tenantId, correspondenteId: id } },
    });
    return { ok: true };
  }

  /** Dados globais só podem ser editados por quem é o único escritório vinculado (Fase 3: o próprio correspondente). */
  private async podeEditarGlobal(correspondenteId: string, tenantId: string) {
    const c = await this.prisma.correspondente.findUniqueOrThrow({
      where: { id: correspondenteId },
      include: { vinculos: { select: { tenantId: true } } },
    });
    return c.origem !== 'AUTOCADASTRO' && c.vinculos.every((v) => v.tenantId === tenantId);
  }

  private dadosGlobais(dto: Partial<CorrespondenteDto>) {
    return {
      nome: dto.nome?.trim(),
      email: dto.email?.toLowerCase().trim() || undefined,
      ehAdvogado: dto.ehAdvogado,
      oab: dto.oab,
      oabUf: dto.oabUf?.toUpperCase(),
      cpfCnpj: dto.cpfCnpj,
      pixTipo: dto.pixTipo,
      pixChave: dto.pixChave,
      bio: dto.bio,
    } as Prisma.CorrespondenteUncheckedCreateInput;
  }

  private async salvarRelacoes(id: string, dto: Partial<CorrespondenteDto>) {
    if (dto.cidadeIds) {
      await this.prisma.areaAtendimento.deleteMany({ where: { correspondenteId: id } });
      await this.prisma.areaAtendimento.createMany({
        data: [...new Set(dto.cidadeIds)].map((cidadeId) => ({ correspondenteId: id, cidadeId })),
        skipDuplicates: true,
      });
    }
    if (dto.servicoIds) {
      await this.prisma.correspondenteServico.deleteMany({ where: { correspondenteId: id } });
      await this.prisma.correspondenteServico.createMany({
        data: [...new Set(dto.servicoIds)].map((servicoId) => ({ correspondenteId: id, servicoId })),
        skipDuplicates: true,
      });
    }
  }

  /** Sugestões para uma demanda: atende a cidade (e o serviço), ordenados por favorito, nota e histórico. */
  async sugerir(tenantId: string, cidadeId: number, servicoId?: number, apenasAdvogados?: boolean) {
    const lista = await this.listar(tenantId, { cidadeId, apenasAdvogados });
    const pontuar = (c: any) =>
      (c.favorito ? 100 : 0) +
      (servicoId && c.servicos.some((s: any) => s.id === servicoId) ? 50 : 0) +
      (c.notaMedia ?? 3) * 5 +
      Math.min(c.demandasConcluidas, 20);
    return lista.sort((a, b) => pontuar(b) - pontuar(a));
  }
}
