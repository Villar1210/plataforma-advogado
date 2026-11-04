'use client';

import { ArrowLeft, MessageCircle, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dataHora, moeda, telefone } from '@/lib/formato';
import { Correspondente, DemandaStatus, STATUS } from '@/lib/tipos';
import { FormCorrespondente } from '@/components/FormCorrespondente';
import { Botao, Carregando, Cartao, Modal, Selo, useAcao } from '@/components/ui';

interface Perfil extends Correspondente {
  historico: {
    id: string;
    numero: number;
    status: DemandaStatus;
    prazo: string | null;
    valorAcordado: string | null;
    servico: { nome: string } | null;
    servicoTexto: string | null;
    cidade: { nome: string; uf: string };
    avaliacao: { nota: number; noPrazo: boolean } | null;
  }[];
}

export default function PerfilCorrespondente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { executar, carregando } = useAcao();
  const [c, setC] = useState<Perfil | null>(null);
  const [erro, setErro] = useState('');
  const [editar, setEditar] = useState(false);

  const carregar = useCallback(() => api<Perfil>(`/correspondentes/${id}`).then(setC).catch((e) => setErro(e.message)), [id]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  if (erro) return <p className="py-16 text-center text-gray-500">{erro}</p>;
  if (!c) return <Carregando />;

  const pagas = c.historico.filter((h) => h.status === 'PAGA' || h.status === 'APROVADA');
  const total = pagas.reduce((s, h) => s + Number(h.valorAcordado ?? 0), 0);
  const noPrazo = c.historico.filter((h) => h.avaliacao).length
    ? Math.round((c.historico.filter((h) => h.avaliacao?.noPrazo).length / c.historico.filter((h) => h.avaliacao).length) * 100)
    : null;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/correspondentes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Correspondentes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-100 text-xl font-semibold text-marca-800">{c.nome[0]}</div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
              {c.nome} {c.favorito && <Star className="h-5 w-5 fill-ouro-500 text-ouro-500" />}
            </h1>
            <p className="text-sm text-gray-600">
              {c.ehAdvogado ? `Advogado(a) · OAB ${c.oab ?? '—'}/${c.oabUf ?? ''}` : 'Não advogado'} · {telefone(c.whatsapp)}
              {c.email && ` · ${c.email}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer">
            <Botao variante="secundario" tamanho="sm">
              <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
            </Botao>
          </a>
          <Link href={`/demandas/nova?correspondente=${c.id}`}>
            <Botao tamanho="sm">
              <Plus className="h-4 w-4" /> Nova demanda
            </Botao>
          </Link>
          <Botao variante="secundario" tamanho="sm" onClick={() => setEditar(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Botao>
          <Botao
            variante="perigo"
            tamanho="sm"
            carregando={carregando === 'rm'}
            onClick={() => {
              if (confirm(`Remover ${c.nome} da sua lista?`))
                executar('rm', () => api(`/correspondentes/${c.id}`, { method: 'DELETE' }), 'Removido da lista').then((r) => r && router.replace('/correspondentes'));
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Botao>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Concluídas" valor={c.demandasConcluidas} />
        <Numero rotulo="Nota média" valor={c.notaMedia ? `★ ${c.notaMedia.toFixed(1)}` : '—'} detalhe={c.totalAvaliacoes ? `${c.totalAvaliacoes} avaliação(ões)` : undefined} />
        <Numero rotulo="No prazo" valor={noPrazo === null ? '—' : `${noPrazo}%`} />
        <Numero rotulo="Total contratado" valor={moeda(total)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Cartao titulo="Cadastro" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Cidades</dt>
              <dd>{c.cidades.map((x) => `${x.nome}/${x.uf}`).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Serviços</dt>
              <dd>{c.servicos.map((s) => s.nome).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Pix ({c.pixTipo ?? '—'})</dt>
              <dd className="font-mono">{c.pixChave || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Valor de referência</dt>
              <dd>{moeda(c.valorReferencia)}</dd>
            </div>
            {c.observacoes && (
              <div>
                <dt className="text-xs text-gray-500">Observações</dt>
                <dd className="whitespace-pre-line">{c.observacoes}</dd>
              </div>
            )}
          </dl>
        </Cartao>

        <Cartao titulo="Demandas com o escritório" className="lg:col-span-2">
          {c.historico.length === 0 ? (
            <p className="text-sm text-gray-500">Ainda nenhuma demanda com este correspondente.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {c.historico.map((h) => (
                <li key={h.id}>
                  <Link href={`/demandas/${h.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        #{h.numero} · {h.servico?.nome ?? h.servicoTexto}
                      </p>
                      <p className="text-xs text-gray-500">
                        {h.cidade.nome}/{h.cidade.uf} · {dataHora(h.prazo)}
                        {h.avaliacao && ` · ★ ${h.avaliacao.nota}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-sm text-gray-600 sm:inline">{moeda(h.valorAcordado)}</span>
                      <Selo cor={STATUS[h.status].cor}>{STATUS[h.status].rotulo}</Selo>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Modal aberto={editar} aoFechar={() => setEditar(false)} titulo="Editar correspondente" largura="max-w-2xl">
        <FormCorrespondente
          inicial={c}
          aoCancelar={() => setEditar(false)}
          aoSalvar={() => {
            setEditar(false);
            carregar();
          }}
        />
      </Modal>
    </div>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: React.ReactNode; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{valor}</p>
      {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}
