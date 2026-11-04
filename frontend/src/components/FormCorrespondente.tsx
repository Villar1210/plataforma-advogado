'use client';

import { X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Cidade, Correspondente, Servico } from '@/lib/tipos';
import { CidadeBusca } from './CidadeBusca';
import { Area, Botao, Campo, Entrada, Selecao, useAviso } from './ui';

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

export function FormCorrespondente({
  inicial,
  cidadeSugerida,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Correspondente | null;
  cidadeSugerida?: Cidade | null;
  aoSalvar: (c: Correspondente) => void;
  aoCancelar: () => void;
}) {
  const avisar = useAviso();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    nome: inicial?.nome ?? '',
    whatsapp: inicial?.whatsapp?.replace(/^55/, '') ?? '',
    email: inicial?.email ?? '',
    ehAdvogado: inicial?.ehAdvogado ?? true,
    oab: inicial?.oab ?? '',
    oabUf: inicial?.oabUf ?? 'SP',
    cpfCnpj: inicial?.cpfCnpj ?? '',
    pixTipo: inicial?.pixTipo ?? 'CPF',
    pixChave: inicial?.pixChave ?? '',
    valorReferencia: inicial?.valorReferencia ? String(inicial.valorReferencia) : '',
    observacoes: inicial?.observacoes ?? '',
    favorito: inicial?.favorito ?? false,
  });
  const [cidades, setCidades] = useState<Cidade[]>(inicial?.cidades ?? (cidadeSugerida ? [cidadeSugerida] : []));
  const [servicoIds, setServicoIds] = useState<number[]>(inicial?.servicos.map((s) => s.id) ?? []);

  useEffect(() => {
    api<Servico[]>('/servicos').then(setServicos).catch(() => {});
  }, []);

  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const body = {
        ...f,
        whatsapp: f.whatsapp.replace(/\D/g, ''),
        email: f.email || undefined,
        oab: f.ehAdvogado ? f.oab || undefined : undefined,
        oabUf: f.ehAdvogado && f.oab ? f.oabUf : undefined,
        cpfCnpj: f.cpfCnpj || undefined,
        pixTipo: f.pixChave ? f.pixTipo : undefined,
        pixChave: f.pixChave || undefined,
        valorReferencia: f.valorReferencia ? Number(f.valorReferencia.replace(',', '.')) : undefined,
        observacoes: f.observacoes || undefined,
        cidadeIds: cidades.map((c) => c.id),
        servicoIds,
      };
      const c = inicial
        ? await api<Correspondente>(`/correspondentes/${inicial.id}`, { method: 'PATCH', body })
        : await api<Correspondente>('/correspondentes', { body });
      avisar(inicial ? 'Correspondente atualizado' : 'Correspondente cadastrado');
      aoSalvar(c);
    } catch (e: any) {
      avisar(e.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const grupos = servicos.reduce<Record<string, Servico[]>>((g, s) => ((g[s.grupo] ??= []).push(s), g), {});

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome completo" className="sm:col-span-2">
          <Entrada required value={f.nome} onChange={(e) => set('nome', e.target.value)} />
        </Campo>
        <Campo rotulo="WhatsApp (com DDD)">
          <Entrada required inputMode="tel" placeholder="11 99999-9999" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.ehAdvogado} onChange={(e) => set('ehAdvogado', e.target.checked)} className="rounded" />
        É advogado(a)
      </label>
      {f.ehAdvogado && (
        <div className="grid grid-cols-3 gap-4">
          <Campo rotulo="OAB nº" className="col-span-2">
            <Entrada value={f.oab} onChange={(e) => set('oab', e.target.value)} />
          </Campo>
          <Campo rotulo="UF">
            <Selecao value={f.oabUf} onChange={(e) => set('oabUf', e.target.value)}>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Selecao>
          </Campo>
        </div>
      )}

      <Campo rotulo="Cidades que atende" dica="Usamos isso para sugerir o correspondente certo em cada demanda.">
        <CidadeBusca limparAoEscolher aoEscolher={(c) => c && !cidades.some((x) => x.id === c.id) && setCidades([...cidades, c])} placeholder="Adicionar cidade" />
        {cidades.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cidades.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-marca-50 px-2.5 py-1 text-xs font-medium text-marca-800">
                {c.nome}/{c.uf}
                <button type="button" onClick={() => setCidades(cidades.filter((x) => x.id !== c.id))} aria-label={`Remover ${c.nome}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Campo>

      <details className="rounded-lg border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Serviços que realiza {servicoIds.length > 0 && <span className="text-gray-500">({servicoIds.length})</span>}
        </summary>
        <div className="mt-3 space-y-3">
          {Object.entries(grupos).map(([g, itens]) => (
            <div key={g}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {itens.map((s) => {
                  const on = servicoIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setServicoIds(on ? servicoIds.filter((i) => i !== s.id) : [...servicoIds, s.id])}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${on ? 'bg-marca-700 text-white ring-marca-700' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'}`}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Tipo de chave Pix">
          <Selecao value={f.pixTipo} onChange={(e) => set('pixTipo', e.target.value)}>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
            <option value="EMAIL">E-mail</option>
            <option value="TELEFONE">Telefone</option>
            <option value="ALEATORIA">Aleatória</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Chave Pix" className="sm:col-span-2">
          <Entrada value={f.pixChave} onChange={(e) => set('pixChave', e.target.value)} />
        </Campo>
        <Campo rotulo="CPF/CNPJ">
          <Entrada value={f.cpfCnpj} onChange={(e) => set('cpfCnpj', e.target.value)} />
        </Campo>
        <Campo rotulo="Valor de referência (R$)" className="sm:col-span-2" dica="Quanto costuma cobrar por diligência">
          <Entrada inputMode="decimal" value={f.valorReferencia} onChange={(e) => set('valorReferencia', e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Observações internas">
        <Area value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.favorito} onChange={(e) => set('favorito', e.target.checked)} className="rounded" />
        Marcar como favorito (aparece primeiro nas sugestões)
      </label>

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Botao type="button" variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}
