import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizar } from '../common/util';

@Controller()
export class CatalogoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('cidades')
  async cidades(@Query('q') q = '', @Query('uf') uf?: string) {
    const termo = normalizar(q);
    if (termo.length < 2) return [];
    // primeiro quem começa com o termo, depois quem contém
    const where = { ...(uf ? { uf: uf.toUpperCase() } : {}) };
    const inicio = await this.prisma.cidade.findMany({
      where: { ...where, busca: { startsWith: termo } },
      orderBy: [{ nome: 'asc' }],
      take: 15,
    });
    const limpar = (l: typeof inicio) => l.map(({ id, nome, uf }) => ({ id, nome, uf }));
    if (inicio.length >= 15) return limpar(inicio);
    const contem = await this.prisma.cidade.findMany({
      where: { ...where, busca: { contains: termo }, id: { notIn: inicio.map((c) => c.id) } },
      orderBy: [{ nome: 'asc' }],
      take: 15 - inicio.length,
    });
    return limpar([...inicio, ...contem]);
  }

  @Get('servicos')
  servicos() {
    return this.prisma.servico.findMany({ where: { ativo: true }, orderBy: [{ grupo: 'asc' }, { nome: 'asc' }] });
  }
}
