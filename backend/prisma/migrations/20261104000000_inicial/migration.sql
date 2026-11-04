-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'ADVOGADO', 'ASSISTENTE');

-- CreateEnum
CREATE TYPE "OrigemCadastro" AS ENUM ('ESCRITORIO', 'AUTOCADASTRO', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "DemandaStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO', 'ACEITA', 'EM_EXECUCAO', 'COMPROVANTE_ENVIADO', 'APROVADA', 'PAGA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ModoContratacao" AS ENUM ('DIRETO', 'PROPOSTAS', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "TipoCorrespondente" AS ENUM ('TODOS', 'APENAS_ADVOGADOS');

-- CreateEnum
CREATE TYPE "EnvioStatus" AS ENUM ('ENVIADO', 'VISUALIZADO', 'ACEITO', 'PROPOSTA', 'RECUSADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AnexoTipo" AS ENUM ('DOCUMENTO_PROCESSO', 'PROCURACAO', 'SUBSTABELECIMENTO', 'COMPROVANTE_ENTREGA', 'COMPROVANTE_PAGAMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "PagamentoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'TED', 'BOLETO', 'DINHEIRO', 'PLATAFORMA');

-- CreateEnum
CREATE TYPE "MensagemStatus" AS ENUM ('PENDENTE', 'ENVIADA', 'ERRO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'CORTESIA');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "documento" TEXT,
    "oab" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contadorDemandas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ADVOGADO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "superAdmin" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" TEXT,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cidade" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "busca" TEXT NOT NULL,

    CONSTRAINT "Cidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "prazoObrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT NOT NULL,
    "ehAdvogado" BOOLEAN NOT NULL DEFAULT false,
    "oab" TEXT,
    "oabUf" CHAR(2),
    "oabValidada" BOOLEAN NOT NULL DEFAULT false,
    "cpfCnpj" TEXT,
    "pixTipo" TEXT,
    "pixChave" TEXT,
    "bio" TEXT,
    "origem" "OrigemCadastro" NOT NULL DEFAULT 'ESCRITORIO',
    "senhaHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "notaMedia" DOUBLE PRECISION,
    "totalAvaliacoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCorrespondente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "correspondenteId" TEXT NOT NULL,
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "valorReferencia" DECIMAL(12,2),
    "observacoes" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantCorrespondente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaAtendimento" (
    "id" TEXT NOT NULL,
    "correspondenteId" TEXT NOT NULL,
    "cidadeId" INTEGER NOT NULL,

    CONSTRAINT "AreaAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenteServico" (
    "correspondenteId" TEXT NOT NULL,
    "servicoId" INTEGER NOT NULL,

    CONSTRAINT "CorrespondenteServico_pkey" PRIMARY KEY ("correspondenteId","servicoId")
);

-- CreateTable
CREATE TABLE "Demanda" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "cidadeId" INTEGER NOT NULL,
    "servicoId" INTEGER,
    "servicoTexto" TEXT,
    "tipoCorrespondente" "TipoCorrespondente" NOT NULL DEFAULT 'TODOS',
    "modo" "ModoContratacao" NOT NULL DEFAULT 'DIRETO',
    "processoNumero" TEXT,
    "partes" TEXT,
    "orgao" TEXT,
    "local" TEXT,
    "prazo" TIMESTAMP(3),
    "valor" DECIMAL(12,2),
    "descricao" TEXT NOT NULL,
    "instrucoes" TEXT,
    "status" "DemandaStatus" NOT NULL DEFAULT 'RASCUNHO',
    "correspondenteId" TEXT,
    "valorAcordado" DECIMAL(12,2),
    "entregaObservacao" TEXT,
    "entregueEm" TIMESTAMP(3),
    "devolucaoMotivo" TEXT,
    "aprovadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "lembretesEnviados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envio" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "correspondenteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "EnvioStatus" NOT NULL DEFAULT 'ENVIADO',
    "valorProposto" DECIMAL(12,2),
    "mensagem" TEXT,
    "motivoRecusa" TEXT,
    "visualizadoEm" TIMESTAMP(3),
    "respondidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "tipo" "AnexoTipo" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "enviadoPorUsuarioId" TEXT,
    "enviadoPorCorrespondenteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandaEvento" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "autorUsuarioId" TEXT,
    "autorCorrespondenteId" TEXT,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3),
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "metodo" "MetodoPagamento",
    "pagoEm" TIMESTAMP(3),
    "comprovanteId" TEXT,
    "gateway" TEXT,
    "gatewayId" TEXT,
    "taxaPlataforma" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "correspondenteId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "noPrazo" BOOLEAN NOT NULL DEFAULT true,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemSaida" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "demandaId" TEXT,
    "destino" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "MensagemStatus" NOT NULL DEFAULT 'PENDENTE',
    "provedor" TEXT NOT NULL DEFAULT 'link',
    "erro" TEXT,
    "enviadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoLote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sucesso" INTEGER NOT NULL DEFAULT 0,
    "erros" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoMensal" DECIMAL(10,2) NOT NULL,
    "limiteDemandas" INTEGER,
    "limiteUsuarios" INTEGER,
    "recursos" JSONB NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" "AssinaturaStatus" NOT NULL DEFAULT 'TRIAL',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaCobranca" TIMESTAMP(3),
    "gateway" TEXT,
    "gatewayId" TEXT,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_tenantId_idx" ON "Usuario"("tenantId");

-- CreateIndex
CREATE INDEX "Cidade_busca_idx" ON "Cidade"("busca");

-- CreateIndex
CREATE INDEX "Cidade_uf_idx" ON "Cidade"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "Servico_nome_key" ON "Servico"("nome");

-- CreateIndex
CREATE INDEX "Correspondente_whatsapp_idx" ON "Correspondente"("whatsapp");

-- CreateIndex
CREATE INDEX "Correspondente_email_idx" ON "Correspondente"("email");

-- CreateIndex
CREATE INDEX "TenantCorrespondente_tenantId_idx" ON "TenantCorrespondente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCorrespondente_tenantId_correspondenteId_key" ON "TenantCorrespondente"("tenantId", "correspondenteId");

-- CreateIndex
CREATE INDEX "AreaAtendimento_cidadeId_idx" ON "AreaAtendimento"("cidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaAtendimento_correspondenteId_cidadeId_key" ON "AreaAtendimento"("correspondenteId", "cidadeId");

-- CreateIndex
CREATE INDEX "Demanda_tenantId_status_idx" ON "Demanda"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Demanda_cidadeId_status_idx" ON "Demanda"("cidadeId", "status");

-- CreateIndex
CREATE INDEX "Demanda_prazo_idx" ON "Demanda"("prazo");

-- CreateIndex
CREATE UNIQUE INDEX "Demanda_tenantId_numero_key" ON "Demanda"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Envio_token_key" ON "Envio"("token");

-- CreateIndex
CREATE INDEX "Envio_correspondenteId_idx" ON "Envio"("correspondenteId");

-- CreateIndex
CREATE UNIQUE INDEX "Envio_demandaId_correspondenteId_key" ON "Envio"("demandaId", "correspondenteId");

-- CreateIndex
CREATE INDEX "Anexo_demandaId_idx" ON "Anexo"("demandaId");

-- CreateIndex
CREATE INDEX "DemandaEvento_demandaId_createdAt_idx" ON "DemandaEvento"("demandaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_demandaId_key" ON "Pagamento"("demandaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_comprovanteId_key" ON "Pagamento"("comprovanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_demandaId_key" ON "Avaliacao"("demandaId");

-- CreateIndex
CREATE INDEX "Avaliacao_correspondenteId_idx" ON "Avaliacao"("correspondenteId");

-- CreateIndex
CREATE INDEX "Notificacao_tenantId_lida_idx" ON "Notificacao"("tenantId", "lida");

-- CreateIndex
CREATE INDEX "MensagemSaida_status_idx" ON "MensagemSaida"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Plano_nome_key" ON "Plano"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_tenantId_key" ON "Assinatura"("tenantId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCorrespondente" ADD CONSTRAINT "TenantCorrespondente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCorrespondente" ADD CONSTRAINT "TenantCorrespondente_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAtendimento" ADD CONSTRAINT "AreaAtendimento_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAtendimento" ADD CONSTRAINT "AreaAtendimento_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "Cidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenteServico" ADD CONSTRAINT "CorrespondenteServico_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenteServico" ADD CONSTRAINT "CorrespondenteServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "Cidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_enviadoPorUsuarioId_fkey" FOREIGN KEY ("enviadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_enviadoPorCorrespondenteId_fkey" FOREIGN KEY ("enviadoPorCorrespondenteId") REFERENCES "Correspondente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaEvento" ADD CONSTRAINT "DemandaEvento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaEvento" ADD CONSTRAINT "DemandaEvento_autorUsuarioId_fkey" FOREIGN KEY ("autorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaEvento" ADD CONSTRAINT "DemandaEvento_autorCorrespondenteId_fkey" FOREIGN KEY ("autorCorrespondenteId") REFERENCES "Correspondente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_comprovanteId_fkey" FOREIGN KEY ("comprovanteId") REFERENCES "Anexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_correspondenteId_fkey" FOREIGN KEY ("correspondenteId") REFERENCES "Correspondente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoLote" ADD CONSTRAINT "ImportacaoLote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

