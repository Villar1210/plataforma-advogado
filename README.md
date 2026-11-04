# Plataforma de Correspondentes Jurídicos

Gestão de diligências do escritório: o advogado cria a demanda, envia ao correspondente pelo WhatsApp, recebe o comprovante, aprova e registra o pagamento — tudo com histórico.

Feita para uso interno primeiro (Fase 1) e já multi-tenant para virar SaaS (Fase 3). Veja [docs/ROADMAP.md](docs/ROADMAP.md).

## Como funciona

1. **Nova demanda** — cidade (IBGE), serviço (38 no catálogo, com checklist do que entregar), prazo, valor, processo, partes.
2. **Envio** — o sistema sugere correspondentes que atendem a cidade (favoritos e melhor avaliados primeiro). Cada convite gera um link de WhatsApp com a mensagem pronta.
3. **Portal do correspondente** (`/p/<token>`, sem senha, feito para celular) — ele aceita (ou manda proposta), vê processo, partes, endereço e anexos só depois de aceitar, e envia o comprovante (fotos, PDF, relato).
4. **Conferência** — o escritório aprova ou devolve para ajuste.
5. **Pagamento** — gerado ao aprovar; registra Pix/TED com comprovante e encerra a demanda. O correspondente vê o comprovante pelo link.
6. **Avaliação, relatórios (CSV), lembretes automáticos de prazo** (D-1, 2h antes e vencido).

## Estrutura

```
backend/   NestJS 11 + Prisma 6 (PostgreSQL)  — API na porta 3340
frontend/  Next.js 15 + Tailwind 4             — web na porta 3005 (dev) / 3006 (VPS)
deploy/    nginx
docs/      roadmap e deploy
```

## Rodar localmente

```bash
# backend
cd backend
cp .env.example .env          # preencha DATABASE_URL, JWT_SECRET e o SEED_*
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed               # cidades, serviços, planos e o primeiro escritório
npm run dev

# frontend (outro terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3005
```

Deploy no VPS: [docs/DEPLOY.md](docs/DEPLOY.md).
