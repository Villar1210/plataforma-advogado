import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnexoTipo } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

export const LIMITE_ARQUIVO = 20 * 1024 * 1024; // 20 MB

const EXTENSOES_PERMITIDAS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif',
  '.doc', '.docx', '.odt', '.rtf', '.txt',
  '.xls', '.xlsx', '.ods', '.csv',
  '.zip', '.mp3', '.m4a', '.ogg', '.opus', '.mp4',
]);

export interface ArquivoRecebido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function pastaUploads() {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

@Injectable()
export class AnexosService {
  constructor(private readonly prisma: PrismaService) {}

  async salvar(
    tenantId: string,
    demandaId: string,
    arquivo: ArquivoRecebido,
    tipo: AnexoTipo,
    autor: { usuarioId?: string; correspondenteId?: string },
  ) {
    if (!arquivo?.buffer?.length) throw new BadRequestException('Arquivo vazio');
    if (arquivo.size > LIMITE_ARQUIVO) throw new BadRequestException('Arquivo maior que 20 MB');
    // nomes chegam em latin1 pelo multer
    const nome = Buffer.from(arquivo.originalname, 'latin1').toString('utf8');
    const ext = path.extname(nome).toLowerCase();
    if (!EXTENSOES_PERMITIDAS.has(ext)) throw new BadRequestException(`Tipo de arquivo não permitido (${ext || 'sem extensão'})`);

    const relativo = path.join(tenantId, demandaId, `${randomUUID()}${ext}`);
    const destino = path.join(pastaUploads(), relativo);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    await fs.promises.writeFile(destino, arquivo.buffer);

    return this.prisma.anexo.create({
      data: {
        demandaId,
        tipo,
        nomeArquivo: nome,
        caminho: relativo,
        mime: arquivo.mimetype || 'application/octet-stream',
        tamanho: arquivo.size,
        enviadoPorUsuarioId: autor.usuarioId,
        enviadoPorCorrespondenteId: autor.correspondenteId,
      },
    });
  }

  /** Busca garantindo que o anexo é do escritório. */
  async doEscritorio(tenantId: string, id: string) {
    const a = await this.prisma.anexo.findFirst({ where: { id, demanda: { tenantId } } });
    if (!a) throw new NotFoundException('Arquivo não encontrado');
    return a;
  }

  caminhoAbsoluto(relativo: string) {
    const abs = path.resolve(pastaUploads(), relativo);
    if (!abs.startsWith(pastaUploads() + path.sep)) throw new BadRequestException('Caminho inválido');
    return abs;
  }

  async remover(tenantId: string, id: string) {
    const a = await this.doEscritorio(tenantId, id);
    const emUso = await this.prisma.pagamento.findFirst({ where: { comprovanteId: id } });
    if (emUso) throw new BadRequestException('Este arquivo é o comprovante de um pagamento');
    await this.prisma.anexo.delete({ where: { id } });
    await fs.promises.rm(this.caminhoAbsoluto(a.caminho), { force: true });
    return { ok: true };
  }
}
