import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Catálogo inicial (baseado no mercado de correspondência jurídica).
// checklist = o que o correspondente precisa entregar.
const SERVICOS: { grupo: string; itens: [string, boolean, string[]][] }[] = [
  {
    grupo: 'Audiências',
    itens: [
      ['Audiência Cível', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência Trabalhista', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência Criminal', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência Juizado Especial Cível', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência Juizado Especial Criminal', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência Online', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência PROCON', true, ['Ata da audiência', 'Relato do ocorrido']],
      ['Audiência de Conciliação', true, ['Termo de acordo ou ata']],
      ['Mediação', true, ['Termo de mediação']],
      ['Sustentação Oral', true, ['Relato da sessão']],
      ['Preposto', true, ['Carta de preposição assinada', 'Ata da audiência']],
    ],
  },
  {
    grupo: 'Diligências no processo',
    itens: [
      ['Protocolo de Petição', true, ['Comprovante de protocolo']],
      ['Cópias de Processo', false, ['Cópias digitalizadas']],
      ['Exame de Processo', false, ['Relatório do andamento']],
      ['Carga de Processo', false, ['Comprovante de carga']],
      ['Acompanhamento Processual', false, ['Relatório de andamento']],
      ['Despachar com o Juiz', true, ['Relato do despacho']],
      ['Retirada de Alvará', false, ['Cópia do alvará']],
      ['Emissão de Guias', true, ['Guia emitida']],
      ['Distribuição de Ação', true, ['Comprovante de distribuição']],
    ],
  },
  {
    grupo: 'Órgãos e cartórios',
    itens: [
      ['Serviços em Cartório', false, ['Certidão ou documento obtido']],
      ['Certidões', false, ['Certidão digitalizada']],
      ['Demanda em Delegacia', false, ['Cópia do B.O. ou documento']],
      ['Demanda em Prefeitura', false, ['Comprovante ou documento']],
      ['Demanda no PROCON', false, ['Comprovante ou documento']],
      ['Serviços de Despachante', false, ['Comprovante']],
      ['Vigilância Sanitária', false, ['Comprovante']],
      ['Processo de Licitação', true, ['Comprovante de participação']],
    ],
  },
  {
    grupo: 'Externos',
    itens: [
      ['Notificação Extrajudicial', true, ['Comprovante de entrega']],
      ['Visita In Loco', false, ['Fotos', 'Relatório da visita']],
      ['Busca e Apreensão', true, ['Auto de busca e apreensão', 'Fotos']],
      ['Entrega Amigável de Veículo', false, ['Termo de entrega', 'Fotos do veículo']],
      ['Citação / Intimação (oficial)', true, ['Certidão']],
    ],
  },
  {
    grupo: 'Intelectuais',
    itens: [
      ['Elaboração de Peça', true, ['Peça em arquivo editável']],
      ['Parecer', true, ['Parecer em PDF']],
      ['Consulta Jurídica', false, ['Resumo da consulta']],
      ['Análise de Processo', false, ['Relatório de análise']],
      ['Perícia Judicial', true, ['Laudo']],
    ],
  },
];

async function main() {
  // Cidades (IBGE)
  const total = await prisma.cidade.count();
  if (total === 0) {
    const cidades: [number, string, string][] = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'cidades.json'), 'utf-8'),
    );
    const lote = 1000;
    for (let i = 0; i < cidades.length; i += lote) {
      await prisma.cidade.createMany({
        data: cidades.slice(i, i + lote).map(([id, nome, uf]) => ({ id, nome, uf, busca: normalizar(nome) })),
        skipDuplicates: true,
      });
    }
    console.log(`Cidades: ${await prisma.cidade.count()}`);
  }

  // Serviços
  for (const g of SERVICOS) {
    for (const [nome, prazoObrigatorio, checklist] of g.itens) {
      await prisma.servico.upsert({
        where: { nome },
        update: { grupo: g.grupo, prazoObrigatorio, checklist },
        create: { nome, grupo: g.grupo, prazoObrigatorio, checklist },
      });
    }
  }
  console.log(`Serviços: ${await prisma.servico.count()}`);

  // Planos (Fase 3) — valores provisórios, ajustar antes de comercializar
  const planos = [
    { nome: 'Interno', precoMensal: 0, limiteDemandas: null, limiteUsuarios: null },
    { nome: 'Essencial', precoMensal: 97, limiteDemandas: 50, limiteUsuarios: 2 },
    { nome: 'Escritório', precoMensal: 247, limiteDemandas: 300, limiteUsuarios: 10 },
  ];
  for (const p of planos) {
    await prisma.plano.upsert({ where: { nome: p.nome }, update: {}, create: p });
  }

  // Escritório inicial (opcional, via variáveis de ambiente)
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_SENHA;
  if (email && senha) {
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (!existe) {
      const plano = await prisma.plano.findUniqueOrThrow({ where: { nome: 'Interno' } });
      const nomeEscritorio = process.env.SEED_ESCRITORIO || 'Escritório';
      await prisma.tenant.create({
        data: {
          nome: nomeEscritorio,
          slug: normalizar(nomeEscritorio).replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36),
          usuarios: {
            create: {
              nome: process.env.SEED_ADMIN_NOME || 'Administrador',
              email,
              senhaHash: await bcrypt.hash(senha, 10),
              papel: 'ADMIN',
              superAdmin: true,
            },
          },
          assinatura: { create: { planoId: plano.id, status: 'CORTESIA' } },
        },
      });
      console.log(`Escritório criado com admin ${email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
