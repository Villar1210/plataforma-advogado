import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DemandaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsuarioLogado } from '../common/auth';
import { gerarToken, linkWhatsapp } from '../common/util';
import { AvaliarDto, DemandaDto, FiltroDemandasDto } from './demandas.dto';
import { DadosMensagem, msgAprovada, msgDevolvida, msgNovaDemanda, msgPaga } from './mensagens';

export interface Autor {
  usuarioId?: string;
  correspondenteId?: string;
}

/** Status em que a demanda ainda está "viva" (aparece no quadro). */
export const STATUS_ABERTOS: DemandaStatus[] = [
  'RASCUNHO',
  'AGUARDANDO',
  'ACEITA',
  'EM_EXECUCAO',
  'COMPROVANTE_ENVIADO',
  'APROVADA',
];

const INCLUDE_LISTA = {
  cidade: { select: { id: true, nome: true, uf: true } },
  servico: { select: { id: true, nome: true, grupo: true } },
  correspondente: { select: { id: true, nome: true, whatsapp: true } },
  pagamento: { select: { id: true, status: true, valor: true } },
  _count: { select: { envios: true, anexos: true } },
  envios: { select: { status: true } },
} satisfies Prisma.DemandaInclude;

const INCLUDE_DETALHE = {
  cidade: { select: { id: true, nome: true, uf: true } },
  servico: true,
  correspondente: {
    select: { id: true, nome: true, whatsapp: true, email: true, oab: true, oabUf: true, pixTipo: true, pixChave: true },
  },
  criadoPor: { select: { id: true, nome: true } },
  envios: {
    include: { correspondente: { select: { id: true, nome: true, whatsapp: true, ehAdvogado: true, notaMedia: true } } },
    orderBy: { createdAt: 'asc' },
  },
  anexos: { orderBy: { createdAt: 'asc' } },
  eventos: {
    include: {
      autorUsuario: { select: { nome: true } },
      autorCorrespondente: { select: { nome: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  pagamento: { include: { comprovante: true } },
  avaliacao: true,
  tenant: { select: { nome: true } },
} satisfies Prisma.DemandaInclude;

@Injectable()
export class DemandasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  // ───────────── consultas ─────────────

  async listar(tenantId: string, f: FiltroDemandasDto) {
    const where: Prisma.DemandaWhereInput = { tenantId };
    if (f.status) where.status = f.status;
    else if (f.incluirEncerradas !== 'true') where.status = { in: STATUS_ABERTOS };
    if (f.cidadeId) where.cidadeId = f.cidadeId;
    if (f.correspondenteId) where.correspondenteId = f.correspondenteId;
    if (f.q) {
      const n = Number(f.q.replace(/\D/g, ''));
      where.OR = [
        { descricao: { contains: f.q, mode: 'insensitive' } },
        { processoNumero: { contains: f.q } },
        { partes: { contains: f.q, mode: 'insensitive' } },
        { servicoTexto: { contains: f.q, mode: 'insensitive' } },
        { servico: { nome: { contains: f.q, mode: 'insensitive' } } },
        { cidade: { nome: { contains: f.q, mode: 'insensitive' } } },
        { correspondente: { nome: { contains: f.q, mode: 'insensitive' } } },
        ...(n && String(n) === f.q.trim() ? [{ numero: n }] : []),
      ];
    }
    const demandas = await this.prisma.demanda.findMany({
      where,
      include: INCLUDE_LISTA,
      orderBy: [{ prazo: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 500,
    });
    return demandas.map(({ envios, ...d }) => ({
      ...d,
      propostas: envios.filter((e) => e.status === 'PROPOSTA').length,
      recusas: envios.filter((e) => e.status === 'RECUSADO').length,
    }));
  }

  async resumo(tenantId: string) {
    const porStatus = await this.prisma.demanda.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    const agora = new Date();
    const em48h = new Date(agora.getTime() + 48 * 3600e3);
    const [prazosProximos, atrasadas, pagar] = await Promise.all([
      this.prisma.demanda.count({
        where: { tenantId, status: { in: ['AGUARDANDO', 'ACEITA', 'EM_EXECUCAO'] }, prazo: { gte: agora, lte: em48h } },
      }),
      this.prisma.demanda.count({
        where: { tenantId, status: { in: ['AGUARDANDO', 'ACEITA', 'EM_EXECUCAO'] }, prazo: { lt: agora } },
      }),
      this.prisma.pagamento.aggregate({
        where: { status: 'PENDENTE', demanda: { tenantId } },
        _sum: { valor: true },
        _count: { _all: true },
      }),
    ]);
    return {
      porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s._count._all])),
      prazosProximos,
      atrasadas,
      pagamentosPendentes: { quantidade: pagar._count._all, valor: pagar._sum.valor ?? 0 },
    };
  }

  async obter(tenantId: string, id: string) {
    const d = await this.prisma.demanda.findFirst({ where: { id, tenantId }, include: INCLUDE_DETALHE });
    if (!d) throw new NotFoundException('Demanda não encontrada');
    return {
      ...d,
      envios: d.envios.map((e) => ({
        ...e,
        linkPortal: this.linkPortal(e.token),
        linkWhatsapp: linkWhatsapp(e.correspondente.whatsapp, msgNovaDemanda(this.dadosMensagem(d, e))),
      })),
    };
  }

  // ───────────── criação e edição ─────────────

  async criar(u: UsuarioLogado, dto: DemandaDto) {
    await this.validarServico(dto);
    const numero = await this.proximoNumero(u.tenantId);
    const d = await this.prisma.demanda.create({
      data: {
        ...this.dados(dto),
        numero,
        tenantId: u.tenantId,
        criadoPorId: u.id,
        cidadeId: dto.cidadeId,
        descricao: dto.descricao,
        status: 'RASCUNHO',
      },
    });
    await this.registrar(d.id, 'CRIADA', 'Demanda criada', { usuarioId: u.id });
    return this.obter(u.tenantId, d.id);
  }

  async atualizar(u: UsuarioLogado, id: string, dto: DemandaDto) {
    const d = await this.buscar(u.tenantId, id);
    if (['PAGA', 'CANCELADA'].includes(d.status)) throw new BadRequestException('Demanda encerrada não pode ser editada');
    await this.validarServico(dto);
    await this.prisma.demanda.update({
      where: { id },
      data: { ...this.dados(dto), cidadeId: dto.cidadeId, descricao: dto.descricao },
    });
    await this.registrar(id, 'EDITADA', 'Dados da demanda atualizados', { usuarioId: u.id });
    return this.obter(u.tenantId, id);
  }

  private dados(dto: DemandaDto) {
    return {
      servicoId: dto.servicoId ?? null,
      servicoTexto: dto.servicoId ? null : dto.servicoTexto?.trim() || null,
      tipoCorrespondente: dto.tipoCorrespondente ?? 'TODOS',
      modo: dto.modo ?? 'DIRETO',
      processoNumero: dto.processoNumero || null,
      partes: dto.partes || null,
      orgao: dto.orgao || null,
      local: dto.local || null,
      prazo: dto.prazo ? new Date(dto.prazo) : null,
      valor: dto.valor ?? null,
      instrucoes: dto.instrucoes || null,
    };
  }

  private async validarServico(dto: DemandaDto) {
    if (!dto.servicoId && !dto.servicoTexto?.trim()) throw new BadRequestException('Escolha ou digite o serviço');
    if (dto.servicoId) {
      const s = await this.prisma.servico.findUnique({ where: { id: dto.servicoId } });
      if (!s) throw new BadRequestException('Serviço inválido');
      if (s.prazoObrigatorio && !dto.prazo) throw new BadRequestException(`Informe o prazo para ${s.nome}`);
    }
  }

  private async proximoNumero(tenantId: string) {
    const t = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { contadorDemandas: { increment: 1 } },
      select: { contadorDemandas: true },
    });
    return t.contadorDemandas;
  }

  // ───────────── envio aos correspondentes ─────────────

  async enviar(u: UsuarioLogado, id: string, correspondenteIds: string[]) {
    const d = await this.buscar(u.tenantId, id);
    if (!['RASCUNHO', 'AGUARDANDO'].includes(d.status)) {
      throw new BadRequestException('A demanda já tem correspondente definido');
    }
    // modo DIRETO com vários destinatários: o primeiro a aceitar fica com a demanda
    const vinculos = await this.prisma.tenantCorrespondente.findMany({
      where: { tenantId: u.tenantId, correspondenteId: { in: correspondenteIds }, bloqueado: false },
      include: { correspondente: true },
    });
    if (vinculos.length !== new Set(correspondenteIds).size) {
      throw new BadRequestException('Correspondente fora da sua lista');
    }
    if (d.tipoCorrespondente === 'APENAS_ADVOGADOS' && vinculos.some((v) => !v.correspondente.ehAdvogado)) {
      throw new BadRequestException('Esta demanda exige correspondente advogado');
    }

    const novos: string[] = [];
    for (const v of vinculos) {
      const existe = await this.prisma.envio.findUnique({
        where: { demandaId_correspondenteId: { demandaId: id, correspondenteId: v.correspondenteId } },
      });
      if (existe && existe.status !== 'CANCELADO') continue;
      if (existe) {
        await this.prisma.envio.update({ where: { id: existe.id }, data: { status: 'ENVIADO', respondidoEm: null } });
      } else {
        await this.prisma.envio.create({ data: { demandaId: id, correspondenteId: v.correspondenteId, token: gerarToken() } });
      }
      novos.push(v.correspondente.nome);
    }
    if (d.status === 'RASCUNHO') await this.prisma.demanda.update({ where: { id }, data: { status: 'AGUARDANDO' } });
    if (novos.length) {
      await this.registrar(id, 'ENVIADA', `Enviada para ${novos.join(', ')}`, { usuarioId: u.id });
    }
    return this.obter(u.tenantId, id);
  }

  async cancelarEnvio(u: UsuarioLogado, id: string, envioId: string) {
    const d = await this.buscar(u.tenantId, id);
    const e = await this.prisma.envio.findFirst({ where: { id: envioId, demandaId: id }, include: { correspondente: true } });
    if (!e) throw new NotFoundException('Envio não encontrado');
    if (e.status === 'ACEITO') throw new BadRequestException('Este correspondente já está executando a demanda');
    await this.prisma.envio.update({ where: { id: envioId }, data: { status: 'CANCELADO' } });
    await this.registrar(id, 'ENVIO_CANCELADO', `Envio para ${e.correspondente.nome} cancelado`, { usuarioId: u.id });
    const ativos = await this.prisma.envio.count({ where: { demandaId: id, status: { notIn: ['CANCELADO', 'RECUSADO'] } } });
    if (!ativos && d.status === 'AGUARDANDO') await this.prisma.demanda.update({ where: { id }, data: { status: 'RASCUNHO' } });
    return this.obter(u.tenantId, id);
  }

  /** Escritório escolhe uma proposta (ou designa diretamente quem já recebeu). */
  async escolher(u: UsuarioLogado, id: string, envioId: string) {
    const d = await this.buscar(u.tenantId, id);
    this.exigir(d.status, ['AGUARDANDO'], 'escolher um correspondente');
    const e = await this.prisma.envio.findFirst({ where: { id: envioId, demandaId: id }, include: { correspondente: true } });
    if (!e || ['CANCELADO', 'RECUSADO'].includes(e.status)) throw new BadRequestException('Envio indisponível');
    await this.atribuir(d.id, e.id, e.correspondenteId, e.valorProposto ?? d.valor);
    await this.registrar(id, 'ATRIBUIDA', `${e.correspondente.nome} escolhido para executar`, { usuarioId: u.id });
    return this.obter(u.tenantId, id);
  }

  private async atribuir(demandaId: string, envioId: string, correspondenteId: string, valor: Prisma.Decimal | null) {
    await this.prisma.$transaction([
      this.prisma.envio.update({ where: { id: envioId }, data: { status: 'ACEITO', respondidoEm: new Date() } }),
      this.prisma.envio.updateMany({
        where: { demandaId, id: { not: envioId }, status: { in: ['ENVIADO', 'VISUALIZADO', 'PROPOSTA'] } },
        data: { status: 'CANCELADO' },
      }),
      this.prisma.demanda.update({
        where: { id: demandaId },
        data: { status: 'ACEITA', correspondenteId, valorAcordado: valor },
      }),
    ]);
  }

  // ───────────── andamento ─────────────

  async iniciar(tenantId: string, id: string, autor: Autor) {
    const d = await this.buscar(tenantId, id);
    this.exigir(d.status, ['ACEITA'], 'iniciar a execução');
    await this.prisma.demanda.update({ where: { id }, data: { status: 'EM_EXECUCAO' } });
    await this.registrar(id, 'EM_EXECUCAO', 'Execução iniciada', autor);
    return { ok: true };
  }

  async aprovar(u: UsuarioLogado, id: string) {
    const d = await this.buscar(u.tenantId, id);
    this.exigir(d.status, ['COMPROVANTE_ENVIADO'], 'aprovar');
    const valor = d.valorAcordado ?? d.valor ?? new Prisma.Decimal(0);
    await this.prisma.$transaction([
      this.prisma.demanda.update({ where: { id }, data: { status: 'APROVADA', aprovadaEm: new Date(), devolucaoMotivo: null } }),
      this.prisma.pagamento.upsert({
        where: { demandaId: id },
        update: { valor, status: 'PENDENTE' },
        create: { demandaId: id, valor, status: 'PENDENTE', vencimento: new Date(Date.now() + 7 * 864e5) },
      }),
    ]);
    await this.registrar(id, 'APROVADA', 'Entrega aprovada; pagamento pendente', { usuarioId: u.id });
    return this.comMensagem(u.tenantId, id, (dm) => msgAprovada(dm));
  }

  async devolver(u: UsuarioLogado, id: string, motivo: string) {
    const d = await this.buscar(u.tenantId, id);
    this.exigir(d.status, ['COMPROVANTE_ENVIADO'], 'devolver');
    await this.prisma.demanda.update({ where: { id }, data: { status: 'EM_EXECUCAO', devolucaoMotivo: motivo } });
    await this.registrar(id, 'DEVOLVIDA', `Devolvida para ajuste: ${motivo}`, { usuarioId: u.id });
    return this.comMensagem(u.tenantId, id, (dm) => msgDevolvida(dm, motivo));
  }

  async cancelar(u: UsuarioLogado, id: string, motivo: string) {
    const d = await this.buscar(u.tenantId, id);
    if (['PAGA', 'CANCELADA', 'APROVADA'].includes(d.status)) {
      throw new BadRequestException('Esta demanda não pode mais ser cancelada');
    }
    await this.prisma.$transaction([
      this.prisma.demanda.update({
        where: { id },
        data: { status: 'CANCELADA', canceladaEm: new Date(), motivoCancelamento: motivo },
      }),
      this.prisma.envio.updateMany({
        where: { demandaId: id, status: { in: ['ENVIADO', 'VISUALIZADO', 'PROPOSTA', 'ACEITO'] } },
        data: { status: 'CANCELADO' },
      }),
    ]);
    await this.registrar(id, 'CANCELADA', `Cancelada: ${motivo}`, { usuarioId: u.id });
    return this.obter(u.tenantId, id);
  }

  async avaliar(u: UsuarioLogado, id: string, dto: AvaliarDto) {
    const d = await this.buscar(u.tenantId, id);
    this.exigir(d.status, ['APROVADA', 'PAGA'], 'avaliar');
    if (!d.correspondenteId) throw new BadRequestException('Demanda sem correspondente');
    await this.prisma.avaliacao.upsert({
      where: { demandaId: id },
      update: { nota: dto.nota, noPrazo: dto.noPrazo ?? true, comentario: dto.comentario },
      create: {
        demandaId: id,
        correspondenteId: d.correspondenteId,
        nota: dto.nota,
        noPrazo: dto.noPrazo ?? true,
        comentario: dto.comentario,
      },
    });
    const agg = await this.prisma.avaliacao.aggregate({
      where: { correspondenteId: d.correspondenteId },
      _avg: { nota: true },
      _count: { _all: true },
    });
    await this.prisma.correspondente.update({
      where: { id: d.correspondenteId },
      data: { notaMedia: agg._avg.nota, totalAvaliacoes: agg._count._all },
    });
    await this.registrar(id, 'AVALIADA', `Avaliação: ${dto.nota} de 5`, { usuarioId: u.id });
    return this.obter(u.tenantId, id);
  }

  /** Chamado pelo módulo de pagamentos ao registrar o pagamento. */
  async marcarPaga(tenantId: string, id: string, usuarioId: string) {
    await this.prisma.demanda.update({ where: { id }, data: { status: 'PAGA' } });
    await this.registrar(id, 'PAGA', 'Pagamento registrado; demanda encerrada', { usuarioId });
    return this.comMensagem(tenantId, id, (dm) => msgPaga(dm));
  }

  // ───────────── portal do correspondente (acesso por token) ─────────────

  async envioPorToken(token: string) {
    const e = await this.prisma.envio.findUnique({
      where: { token },
      include: { correspondente: true, demanda: { include: INCLUDE_DETALHE } },
    });
    if (!e) throw new NotFoundException('Link inválido ou expirado');
    return e;
  }

  async portalVer(token: string) {
    const e = await this.envioPorToken(token);
    if (e.status === 'ENVIADO') {
      await this.prisma.envio.update({ where: { id: e.id }, data: { status: 'VISUALIZADO', visualizadoEm: new Date() } });
      await this.registrar(e.demandaId, 'VISUALIZADA', `${e.correspondente.nome} abriu a demanda`, {
        correspondenteId: e.correspondenteId,
      });
    }
    const d = e.demanda;
    const ehExecutor = d.correspondenteId === e.correspondenteId;
    // o correspondente só vê dados sensíveis (processo, partes, local, anexos) depois de aceitar
    const liberado = ehExecutor && !['CANCELADA'].includes(d.status);
    return {
      escritorio: d.tenant.nome,
      correspondente: { nome: e.correspondente.nome },
      envio: { status: e.status === 'ENVIADO' ? 'VISUALIZADO' : e.status, valorProposto: e.valorProposto },
      ehExecutor,
      demanda: {
        numero: d.numero,
        status: d.status,
        modo: d.modo,
        servico: d.servico?.nome ?? d.servicoTexto,
        checklist: (d.servico?.checklist as string[]) ?? [],
        cidade: `${d.cidade.nome}/${d.cidade.uf}`,
        prazo: d.prazo,
        valor: d.valorAcordado ?? d.valor,
        descricao: d.descricao,
        instrucoes: d.instrucoes,
        orgao: d.orgao,
        processoNumero: liberado ? d.processoNumero : null,
        partes: liberado ? d.partes : null,
        local: liberado ? d.local : null,
        devolucaoMotivo: liberado ? d.devolucaoMotivo : null,
        entregaObservacao: liberado ? d.entregaObservacao : null,
        anexos: liberado
          ? d.anexos
              .filter((a) => a.tipo !== 'COMPROVANTE_PAGAMENTO' || d.status === 'PAGA')
              .map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho, createdAt: a.createdAt }))
          : [],
        pagamento: liberado && d.pagamento ? { status: d.pagamento.status, valor: d.pagamento.valor, pagoEm: d.pagamento.pagoEm } : null,
      },
    };
  }

  async portalAceitar(token: string, valorProposto?: number, mensagem?: string) {
    const e = await this.envioPorToken(token);
    const d = e.demanda;
    if (['CANCELADO', 'RECUSADO', 'ACEITO'].includes(e.status)) throw new BadRequestException('Este convite não está mais aberto');
    if (d.status !== 'AGUARDANDO') throw new BadRequestException('Esta demanda já foi assumida por outro correspondente');
    const autor = { correspondenteId: e.correspondenteId };

    if (d.modo === 'DIRETO' && valorProposto === undefined) {
      await this.atribuir(d.id, e.id, e.correspondenteId, d.valor);
      if (mensagem) await this.prisma.envio.update({ where: { id: e.id }, data: { mensagem } });
      await this.registrar(d.id, 'ACEITA', `${e.correspondente.nome} aceitou a demanda`, autor);
      await this.notificacoes.criar(
        d.tenantId,
        `Demanda #${d.numero} aceita`,
        `${e.correspondente.nome} aceitou ${d.servico?.nome ?? d.servicoTexto} em ${d.cidade.nome}.`,
        `/demandas/${d.id}`,
      );
    } else {
      if (valorProposto === undefined) throw new BadRequestException('Informe o valor da proposta');
      await this.prisma.envio.update({
        where: { id: e.id },
        data: { status: 'PROPOSTA', valorProposto, mensagem, respondidoEm: new Date() },
      });
      await this.registrar(d.id, 'PROPOSTA', `${e.correspondente.nome} enviou proposta`, autor, { valorProposto });
      await this.notificacoes.criar(
        d.tenantId,
        `Nova proposta na demanda #${d.numero}`,
        `${e.correspondente.nome} propôs ${Number(valorProposto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        `/demandas/${d.id}`,
      );
    }
    return this.portalVer(token);
  }

  async portalRecusar(token: string, motivo?: string) {
    const e = await this.envioPorToken(token);
    if (!['ENVIADO', 'VISUALIZADO', 'PROPOSTA'].includes(e.status)) throw new BadRequestException('Este convite não está mais aberto');
    await this.prisma.envio.update({
      where: { id: e.id },
      data: { status: 'RECUSADO', motivoRecusa: motivo, respondidoEm: new Date() },
    });
    const d = e.demanda;
    await this.registrar(d.id, 'RECUSADA', `${e.correspondente.nome} recusou${motivo ? `: ${motivo}` : ''}`, {
      correspondenteId: e.correspondenteId,
    });
    const restantes = await this.prisma.envio.count({
      where: { demandaId: d.id, status: { in: ['ENVIADO', 'VISUALIZADO', 'PROPOSTA'] } },
    });
    await this.notificacoes.criar(
      d.tenantId,
      `Demanda #${d.numero} recusada`,
      `${e.correspondente.nome} recusou.${restantes ? '' : ' Ninguém mais está com o convite: envie para outro correspondente.'}`,
      `/demandas/${d.id}`,
    );
    return this.portalVer(token);
  }

  async portalIniciar(token: string) {
    const e = await this.envioPorToken(token);
    this.exigirExecutor(e);
    await this.iniciar(e.demanda.tenantId, e.demandaId, { correspondenteId: e.correspondenteId });
    return this.portalVer(token);
  }

  /** Correspondente entrega: arquivos já salvos pelo controller; aqui só muda o status. */
  async portalEntregar(token: string, observacao: string | undefined, arquivos: number) {
    const e = await this.envioPorToken(token);
    this.exigirExecutor(e);
    const d = e.demanda;
    this.exigir(d.status, ['ACEITA', 'EM_EXECUCAO'], 'enviar o comprovante');
    if (!arquivos && !observacao?.trim()) throw new BadRequestException('Envie ao menos um arquivo ou uma observação');
    await this.prisma.demanda.update({
      where: { id: d.id },
      data: { status: 'COMPROVANTE_ENVIADO', entregueEm: new Date(), entregaObservacao: observacao || null },
    });
    await this.registrar(
      d.id,
      'COMPROVANTE_ENVIADO',
      `${e.correspondente.nome} enviou o comprovante${arquivos ? ` (${arquivos} arquivo${arquivos > 1 ? 's' : ''})` : ''}`,
      { correspondenteId: e.correspondenteId },
    );
    await this.notificacoes.criar(
      d.tenantId,
      `Comprovante recebido — demanda #${d.numero}`,
      `${e.correspondente.nome} enviou a entrega. Confira e aprove.`,
      `/demandas/${d.id}`,
    );
    return this.portalVer(token);
  }

  exigirExecutor(e: { correspondenteId: string; demanda: { correspondenteId: string | null } }) {
    if (e.demanda.correspondenteId !== e.correspondenteId) {
      throw new BadRequestException('Esta demanda não está com você');
    }
  }

  // ───────────── utilitários ─────────────

  async buscar(tenantId: string, id: string) {
    const d = await this.prisma.demanda.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Demanda não encontrada');
    return d;
  }

  private exigir(atual: DemandaStatus, permitidos: DemandaStatus[], acao: string) {
    if (!permitidos.includes(atual)) {
      throw new BadRequestException(`Não é possível ${acao} com a demanda em "${ROTULO_STATUS[atual]}"`);
    }
  }

  registrar(demandaId: string, tipo: string, descricao: string, autor: Autor, dados?: Prisma.InputJsonValue) {
    return this.prisma.demandaEvento.create({
      data: {
        demandaId,
        tipo,
        descricao,
        autorUsuarioId: autor.usuarioId,
        autorCorrespondenteId: autor.correspondenteId,
        dados,
      },
    });
  }

  linkPortal(token: string) {
    return `${process.env.APP_URL ?? 'http://localhost:3005'}/p/${token}`;
  }

  dadosMensagem(
    d: {
      tenant: { nome: string };
      servico: { nome: string } | null;
      servicoTexto: string | null;
      cidade: { nome: string; uf: string };
      prazo: Date | null;
      valor: Prisma.Decimal | null;
      valorAcordado: Prisma.Decimal | null;
    },
    e: { token: string; correspondente: { nome: string } },
  ): DadosMensagem {
    return {
      correspondente: e.correspondente.nome,
      escritorio: d.tenant.nome,
      servico: d.servico?.nome ?? d.servicoTexto ?? 'Serviço',
      cidade: `${d.cidade.nome}/${d.cidade.uf}`,
      prazo: d.prazo,
      valor: d.valorAcordado ?? d.valor,
      link: this.linkPortal(e.token),
    };
  }

  /** Devolve a demanda + um link de WhatsApp pronto para avisar o executor. */
  private async comMensagem(tenantId: string, id: string, texto: (d: DadosMensagem) => string) {
    const d = await this.obter(tenantId, id);
    const envio = d.envios.find((e) => e.correspondenteId === d.correspondenteId);
    const aviso =
      envio && d.correspondente
        ? linkWhatsapp(d.correspondente.whatsapp, texto(this.dadosMensagem(d, envio)))
        : null;
    return { ...d, avisoWhatsapp: aviso };
  }
}

export const ROTULO_STATUS: Record<DemandaStatus, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO: 'Aguardando correspondente',
  ACEITA: 'Aceita',
  EM_EXECUCAO: 'Em execução',
  COMPROVANTE_ENVIADO: 'Comprovante enviado',
  APROVADA: 'Aprovada',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
};
