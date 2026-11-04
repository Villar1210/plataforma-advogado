'use client';

import { createContext, useContext } from 'react';

export interface Sessao {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'ADVOGADO' | 'ASSISTENTE';
  tenant: { id: string; nome: string };
}

export const SessaoCtx = createContext<Sessao | null>(null);
export const useSessao = () => useContext(SessaoCtx)!;
