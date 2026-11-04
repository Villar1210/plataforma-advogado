'use client';

import { MessageCircle, Plus, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { moeda, telefone } from '@/lib/formato';
import type { Cidade, Correspondente } from '@/lib/tipos';
import { CidadeBusca } from '@/components/CidadeBusca';
import { FormCorrespondente } from '@/components/FormCorrespondente';
import { Botao, Carregando, cx, Entrada, Modal, Vazio } from '@/components/ui';

export default function CorrespondentesPage() {
  return (
    <Suspense>
      <Correspondentes />
    </Suspense>
  );
}

function Correspondentes() {
  const params = useSearchParams();
  const [lista, setLista] = useState<Correspondente[] | null>(null);
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [favoritos, setFavoritos] = useState(false);
  const [novo, setNovo] = useState(params.get('novo') === '1');

  const carregar = useCallback(() => {
    const q = new URLSearchParams();
    if (busca.trim()) q.set('q', busca.trim());
    if (cidade) q.set('cidadeId', String(cidade.id));
    if (favoritos) q.set('favorito', 'true');
    return api<Correspondente[]>(`/correspondentes?${q}`).then(setLista).catch(() => setLista([]));
  }, [busca, cidade, favoritos]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const favoritar = async (c: Correspondente) => {
    await api(`/correspondentes/${c.id}/favorito`, { body: { favorito: !c.favorito } }).catch(() => {});
    carregar();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Correspondentes</h1>
          <p className="text-sm text-gray-500">Sua rede de confiança, por cidade e serviço.</p>
        </div>
        <Botao onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" /> Cadastrar
        </Botao>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_16rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Entrada className="pl-9" placeholder="Nome, OAB ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <CidadeBusca valor={cidade} aoEscolher={setCidade} placeholder="Filtrar por cidade" />
        <button
          onClick={() => setFavoritos(!favoritos)}
          className={cx('flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1', favoritos ? 'bg-ouro-100 text-ouro-600 ring-ouro-500' : 'bg-white text-gray-600 ring-gray-300')}
        >
          <Star className={cx('h-4 w-4', favoritos && 'fill-ouro-500')} /> Favoritos
        </button>
      </div>

      {!lista ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio
          titulo={busca || cidade || favoritos ? 'Ninguém encontrado' : 'Nenhum correspondente cadastrado'}
          texto="Cadastre os correspondentes com quem o escritório trabalha, com as cidades que atendem e a chave Pix."
          acao={
            <Botao onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Cadastrar correspondente
            </Botao>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {lista.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <button onClick={() => favoritar(c)} aria-label={c.favorito ? 'Remover dos favoritos' : 'Favoritar'}>
                  <Star className={cx('h-5 w-5', c.favorito ? 'fill-ouro-500 text-ouro-500' : 'text-gray-300 hover:text-gray-400')} />
                </button>
                <Link href={`/correspondentes/${c.id}`} className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {c.nome}
                    {c.notaMedia ? <span className="ml-2 text-xs font-normal text-gray-500">★ {c.notaMedia.toFixed(1)}</span> : null}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {c.ehAdvogado ? `OAB ${c.oab ?? '—'}/${c.oabUf ?? ''}` : 'Não advogado'} · {c.cidades.map((x) => `${x.nome}/${x.uf}`).join(', ') || 'sem cidades'}
                  </p>
                </Link>
                <div className="hidden text-right text-xs text-gray-500 sm:block">
                  <p>{c.demandasConcluidas} concluída(s)</p>
                  {c.valorReferencia && <p>ref. {moeda(c.valorReferencia)}</p>}
                </div>
                <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer" title={telefone(c.whatsapp)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50">
                  <MessageCircle className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal aberto={novo} aoFechar={() => setNovo(false)} titulo="Cadastrar correspondente" largura="max-w-2xl">
        <FormCorrespondente
          aoCancelar={() => setNovo(false)}
          aoSalvar={() => {
            setNovo(false);
            carregar();
          }}
        />
      </Modal>
    </div>
  );
}
