import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MetodoPagamento, PagamentoStatus, Prisma } from '@prisma/client';
import { Usuario, UsuarioLogado } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { AnexosService, ArquivoRecebido, LIMITE_ARQUIVO } from '../anexos/anexos.service';
import { DemandasService } from '../demandas/demandas.service';

@Controller('pagamentos')
export class PagamentosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demandas: DemandasService,
    private readonly anexos: AnexosService,
  ) {}

  @Get()
  async listar(@Usuario() u: UsuarioLogado, @Query('status') status?: PagamentoStatus) {
    const where: Prisma.PagamentoWhereInput = { demanda: { tenantId: u.tenantId } };
    if (status && Object.values(PagamentoStatus).includes(status)) where.status = status;
    return this.prisma.pagamento.findMany({
      where,
      include: {
        comprovante: { select: { id: true, nomeArquivo: true } },
        demanda: {
          select: {
            id: true,
            numero: true,
            servico: { select: { nome: true } },
            servicoTexto: true,
            cidade: { select: { nome: true, uf: true } },
            correspondente: { select: { id: true, nome: true, pixTipo: true, pixChave: true, whatsapp: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { vencimento: { sort: 'asc', nulls: 'last' } }],
      take: 500,
    });
  }

  private async doEscritorio(tenantId: string, id: string) {
    const p = await this.prisma.pagamento.findFirst({ where: { id, demanda: { tenantId } } });
    if (!p) throw new NotFoundException('Pagamento não encontrado');
    return p;
  }

  @Patch(':id')
  async atualizar(
    @Usuario() u: UsuarioLogado,
    @Param('id') id: string,
    @Body() body: { valor?: number; vencimento?: string | null },
  ) {
    const p = await this.doEscritorio(u.tenantId, id);
    if (p.status !== 'PENDENTE') throw new BadRequestException('Só pagamentos pendentes podem ser alterados');
    if (body.valor !== undefined && (isNaN(Number(body.valor)) || Number(body.valor) < 0)) {
      throw new BadRequestException('Valor inválido');
    }
    return this.prisma.pagamento.update({
      where: { id },
      data: {
        valor: body.valor !== undefined ? Number(body.valor) : undefined,
        vencimento: body.vencimento === null ? null : body.vencimento ? new Date(body.vencimento) : undefined,
      },
    });
  }

  /** Registra o pagamento (com comprovante opcional) e encerra a demanda. */
  @Post(':id/pagar')
  @UseInterceptors(FileInterceptor('comprovante', { limits: { fileSize: LIMITE_ARQUIVO } }))
  async pagar(
    @Usuario() u: UsuarioLogado,
    @Param('id') id: string,
    @Body('metodo') metodo: MetodoPagamento,
    @Body('pagoEm') pagoEm?: string,
    @UploadedFile() comprovante?: ArquivoRecebido,
  ) {
    const p = await this.doEscritorio(u.tenantId, id);
    if (p.status !== 'PENDENTE') throw new BadRequestException('Este pagamento já foi registrado');
    if (!Object.values(MetodoPagamento).includes(metodo)) throw new BadRequestException('Informe a forma de pagamento');
    let comprovanteId: string | undefined;
    if (comprovante) {
      const a = await this.anexos.salvar(u.tenantId, p.demandaId, comprovante, 'COMPROVANTE_PAGAMENTO', { usuarioId: u.id });
      comprovanteId = a.id;
    }
    await this.prisma.pagamento.update({
      where: { id },
      data: { status: 'PAGO', metodo, pagoEm: pagoEm ? new Date(pagoEm) : new Date(), comprovanteId },
    });
    return this.demandas.marcarPaga(u.tenantId, p.demandaId, u.id);
  }
}
