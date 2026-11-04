# CLAUDE.md — Plataforma de Correspondentes

Contexto para sessões de desenvolvimento com Claude.

## Produto
Plataforma de gestão de correspondentes jurídicos para um escritório de advocacia (uso interno), que depois será comercializada como SaaS. Concorrente analisado: Correspondente Dinâmico (marketplace de anúncios sem gestão de entrega/pagamento).

## Stack
- backend: NestJS 11, Prisma 6.19 (PostgreSQL), JWT, @nestjs/schedule (lembretes), multer (uploads em disco)
- frontend: Next.js 15 App Router, React 19, Tailwind v4 (cores em `@theme` no `globals.css` — não existe tailwind.config), lucide-react
- Prisma usa `engineType = "client"` + `@prisma/adapter-pg` (sem binário de query engine). Todo `new PrismaClient()` precisa do adapter.

## Regras
- Multi-tenant: toda consulta de dados do escritório filtra por `tenantId` do usuário logado. Nunca buscar por id sem o tenant.
- `Correspondente` é global (o mesmo WhatsApp = mesma pessoa); o vínculo com cada escritório fica em `TenantCorrespondente`. Dados globais só são editados se o escritório for o único vinculado.
- Portal do correspondente é público e autenticado só pelo `token` do `Envio`. Processo, partes, endereço e anexos só aparecem para quem foi atribuído.
- Fluxo de status da demanda (em `demandas.service.ts`): RASCUNHO → AGUARDANDO → ACEITA → EM_EXECUCAO → COMPROVANTE_ENVIADO → APROVADA → PAGA (ou CANCELADA). Devolução volta para EM_EXECUCAO. Toda transição registra `DemandaEvento`.
- Mensagens ao correspondente: Fase 1 gera link `wa.me` com texto pronto (o usuário toca em enviar). `MensagemSaida` guarda a fila para o envio automático da Fase 2.
- Textos da interface em português do Brasil.

## Fluxo de trabalho (Villar)
- Desenvolvimento em fatias pequenas; revisar `git diff` antes de commitar; `git add` com arquivos específicos; commits semânticos.
- Deploy: `git pull → npx prisma migrate deploy → npx prisma generate → npm run build → pm2 restart advogado-api --update-env` (frontend separado). Nunca `pm2 restart all` — o VPS é compartilhado.

## Comandos
- `cd backend && npx tsc --noEmit` — checagem de tipos
- `cd frontend && npx tsc --noEmit && npx next build`
