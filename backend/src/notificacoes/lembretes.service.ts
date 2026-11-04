import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from './notificacoes.service';
import { DemandasService } from '../demandas/demandas.service';
import { msgLembrete } from '../demandas/mensagens';
import { formatarDataHora, linkWhatsapp } from '../common/util';

/**
 * A cada 15 minutos: avisa o escritório sobre prazos (D-1, 2h antes, atrasada)
 * com um link de WhatsApp pronto para cobrar o correspondente.
 * Fase 2: o agente de WhatsApp envia a mensagem sozinho (MensagemSaida).
 */
@Injectable()
export class LembretesService {
  private readonly log = new Logger(LembretesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly demandas: DemandasService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async verificarPrazos() {
    const agora = Date.now();
    const candidatas = await this.prisma.demanda.findMany({
      where: {
        status: { in: ['AGUARDANDO', 'ACEITA', 'EM_EXECUCAO'] },
        prazo: { not: null, lte: new Date(agora + 24 * 3600e3) },
      },
      include: {
        tenant: { select: { nome: true } },
        servico: { select: { nome: true } },
        cidade: { select: { nome: true, uf: true } },
        correspondente: { select: { nome: true, whatsapp: true } },
        envios: { select: { token: true, correspondenteId: true } },
      },
    });

    for (const d of candidatas) {
      const falta = d.prazo!.getTime() - agora;
      const marco = falta < 0 ? 'atrasada' : falta <= 2 * 3600e3 ? 'h-2' : 'd-1';
      if (d.lembretesEnviados.includes(marco)) continue;
      // não dispara "d-1" se a demanda foi criada já dentro das 24h
      if (marco === 'd-1' && d.createdAt.getTime() > d.prazo!.getTime() - 24 * 3600e3) {
        await this.prisma.demanda.update({ where: { id: d.id }, data: { lembretesEnviados: { push: marco } } });
        continue;
      }

      const quando = marco === 'atrasada' ? 'PRAZO VENCIDO' : marco === 'h-2' ? 'faltam menos de 2 horas' : 'o prazo é amanhã';
      const servico = d.servico?.nome ?? d.servicoTexto ?? 'Serviço';
      let link: string | undefined;
      if (d.correspondente && d.status !== 'AGUARDANDO') {
        const envio = d.envios.find((e) => e.correspondenteId === d.correspondenteId);
        if (envio) {
          const texto = msgLembrete(
            this.demandas.dadosMensagem(d, { token: envio.token, correspondente: d.correspondente }),
            quando,
          );
          link = linkWhatsapp(d.correspondente.whatsapp, texto);
          await this.prisma.mensagemSaida.create({
            data: { tenantId: d.tenantId, demandaId: d.id, destino: d.correspondente.whatsapp, texto, status: 'PENDENTE' },
          });
        }
      }
      const quem = d.status === 'AGUARDANDO' ? 'Ainda sem correspondente!' : `Com ${d.correspondente?.nome}.`;
      await this.notificacoes.criar(
        d.tenantId,
        `${marco === 'atrasada' ? 'Prazo vencido' : 'Prazo próximo'} — demanda #${d.numero}`,
        `${servico} em ${d.cidade.nome}/${d.cidade.uf}, ${formatarDataHora(d.prazo)}. ${quem}`,
        link ?? `/demandas/${d.id}`,
      );
      await this.prisma.demanda.update({ where: { id: d.id }, data: { lembretesEnviados: { push: marco } } });
      this.log.log(`Lembrete ${marco} da demanda ${d.id}`);
    }
  }
}
