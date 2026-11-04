# Roadmap

Arquitetura (banco e multi-tenant) já preparada para as três fases desde o primeiro commit.

## Fase 1 — MVP interno ✅ (esta versão)
- [x] Login do escritório, multi-tenant (tenant por escritório), equipe com papéis
- [x] Correspondentes: cidades atendidas, serviços, OAB, Pix, valor de referência, favoritos
- [x] Demanda: cidade IBGE, serviço com checklist, processo, partes, órgão, local, prazo, valor, anexos
- [x] Envio direto ou por propostas, com link de WhatsApp pronto e sugestão de correspondentes
- [x] Portal do correspondente por link (aceitar, recusar, propor, enviar comprovante)
- [x] Conferência (aprovar / devolver), pagamento com comprovante, avaliação
- [x] Quadro (kanban), notificações, lembretes automáticos de prazo, relatório com CSV

## Fase 2 — Escala do escritório
- [ ] Importação de demandas e correspondentes por planilha (`ImportacaoLote` já existe)
- [ ] Envio automático de WhatsApp (processar `MensagemSaida` via Chatwoot/API oficial, como no gestordevendas)
- [ ] Agente de IA no WhatsApp (modelo da VIVI): distribui demandas, cobra comprovantes, responde dúvidas do correspondente
- [ ] Ranking de correspondentes por comarca (nota, % no prazo, tempo de resposta)
- [ ] Recuperação de senha por e-mail

## Fase 3 — Comercialização (SaaS)
- [ ] Cadastro aberto de escritórios (já implementado atrás de `CADASTRO_ABERTO=true`) + página de vendas
- [ ] Planos e cobrança recorrente (`Plano`/`Assinatura` já no banco) via Asaas ou similar
- [ ] Autocadastro de correspondentes com login (`senhaHash`, `origem = AUTOCADASTRO`) e validação de OAB no CNA
- [ ] Marketplace: demanda publicada para todos da cidade (`modo = MARKETPLACE`)
- [ ] Pagamento intermediado com Pix e split (`Pagamento.gateway`, `taxaPlataforma`)
- [ ] Termos de uso, política de privacidade (LGPD), painel do super admin

Dependências externas da Fase 3: CNPJ e conta no intermediador de pagamento, consulta à OAB, revisão jurídica dos termos.
