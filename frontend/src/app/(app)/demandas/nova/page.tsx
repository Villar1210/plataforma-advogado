'use client';

import { Check, Star, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { localParaIso, moeda } from '@/lib/formato';
import type { Cidade, Correspondente, Servico } from '@/lib/tipos';
import { CidadeBusca } from '@/components/CidadeBusca';
import { FormCorrespondente } from '@/components/FormCorrespondente';
import { Area, Botao, Campo, Cartao, cx, Entrada, Modal, Selecao, useAviso } from '@/components/ui';

export default function NovaDemandaPage() {
  return (
    <Suspense>
      <NovaDemanda />
    </Suspense>
  );
}

function NovaDemanda() {
  const router = useRouter();
  const params = useSearchParams();
  const avisar = useAviso();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [servicoId, setServicoId] = useState<number | ''>('');
  const [servicoTexto, setServicoTexto] = useState('');
  const [f, setF] = useState({
    modo: 'DIRETO',
    tipoCorrespondente: 'TODOS',
    processoNumero: '',
    partes: '',
    orgao: '',
    local: '',
    prazo: '',
    valor: '',
    descricao: '',
    instrucoes: '',
  });
  const [sugestoes, setSugestoes] = useState<Correspondente[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [novoCorr, setNovoCorr] = useState(false);
  const [salvando, setSalvando] = useState<'rascunho' | 'enviar' | null>(null);

  useEffect(() => {
    api<Servico[]>('/servicos').then(setServicos).catch(() => {});
  }, []);

  // pré-seleciona correspondente vindo do perfil dele
  const preSel = params.get('correspondente');

  const servico = servicos.find((s) => s.id === servicoId);

  const carregarSugestoes = async () => {
    if (!cidade) return setSugestoes(null);
    const q = new URLSearchParams({ cidadeId: String(cidade.id) });
    if (servicoId) q.set('servicoId', String(servicoId));
    if (f.tipoCorrespondente === 'APENAS_ADVOGADOS') q.set('apenasAdvogados', 'true');
    const lista = await api<Correspondente[]>(`/correspondentes/sugestoes?${q}`).catch(() => []);
    setSugestoes(lista);
    setEscolhidos((e) => {
      const validos = e.filter((id) => lista.some((c) => c.id === id));
      if (preSel && lista.some((c) => c.id === preSel) && !validos.includes(preSel)) validos.push(preSel);
      return validos;
    });
  };

  useEffect(() => {
    carregarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidade, servicoId, f.tipoCorrespondente]);

  const grupos = useMemo(() => servicos.reduce<Record<string, Servico[]>>((g, s) => ((g[s.grupo] ??= []).push(s), g), {}), [servicos]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: FormEvent, enviar: boolean) {
    e.preventDefault();
    if (!cidade) return avisar('Escolha a cidade', 'erro');
    if (enviar && escolhidos.length === 0) return avisar('Escolha pelo menos um correspondente', 'erro');
    setSalvando(enviar ? 'enviar' : 'rascunho');
    try {
      const d = await api<{ id: string }>('/demandas', {
        body: {
          cidadeId: cidade.id,
          servicoId: servicoId || undefined,
          servicoTexto: servicoId ? undefined : servicoTexto,
          modo: f.modo,
          tipoCorrespondente: f.tipoCorrespondente,
          processoNumero: f.processoNumero || undefined,
          partes: f.partes || undefined,
          orgao: f.orgao || undefined,
          local: f.local || undefined,
          prazo: localParaIso(f.prazo),
          valor: f.valor ? Number(f.valor.replace(/\./g, '').replace(',', '.')) : undefined,
          descricao: f.descricao,
          instrucoes: f.instrucoes || undefined,
        },
      });
      if (enviar) await api(`/demandas/${d.id}/enviar`, { body: { correspondenteIds: escolhidos } });
      router.push(`/demandas/${d.id}${enviar ? '?enviada=1' : ''}`);
    } catch (e: any) {
      avisar(e.message, 'erro');
      setSalvando(null);
    }
  }

  return (
    <>
    <form onSubmit={(e) => salvar(e, true)} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Nova demanda</h1>
        <p className="text-sm text-gray-500">Preencha o que o correspondente precisa saber e escolha para quem enviar.</p>
      </div>

      <Cartao titulo="1. O quê e onde">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Cidade do serviço">
            <CidadeBusca valor={cidade} aoEscolher={setCidade} />
          </Campo>
          <Campo rotulo="Serviço">
            <Selecao value={servicoId} onChange={(e) => setServicoId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Outro (digitar)</option>
              {Object.entries(grupos).map(([g, itens]) => (
                <optgroup key={g} label={g}>
                  {itens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Selecao>
          </Campo>
          {!servicoId && (
            <Campo rotulo="Qual serviço?" className="sm:col-span-2">
              <Entrada required value={servicoTexto} onChange={(e) => setServicoTexto(e.target.value)} placeholder="Ex.: Retirada de documentos no cartório" />
            </Campo>
          )}
          {servico && servico.checklist.length > 0 && (
            <p className="text-xs text-gray-500 sm:col-span-2">
              O correspondente deverá entregar: <strong>{servico.checklist.join(', ')}</strong>
            </p>
          )}
          <Campo rotulo={`Prazo${servico?.prazoObrigatorio ? '' : ' (opcional)'}`}>
            <Entrada type="datetime-local" required={servico?.prazoObrigatorio} value={f.prazo} onChange={(e) => set('prazo', e.target.value)} />
          </Campo>
          <Campo rotulo="Valor oferecido (R$, opcional)">
            <Entrada inputMode="decimal" placeholder="150,00" value={f.valor} onChange={(e) => set('valor', e.target.value)} />
          </Campo>
          <Campo rotulo="Órgão / vara (opcional)">
            <Entrada value={f.orgao} onChange={(e) => set('orgao', e.target.value)} placeholder="Ex.: 2ª Vara Cível" />
          </Campo>
          <Campo rotulo="Endereço / local (opcional)">
            <Entrada value={f.local} onChange={(e) => set('local', e.target.value)} placeholder="Ex.: Fórum de Campinas, sala 12" />
          </Campo>
        </div>
      </Cartao>

      <Cartao titulo="2. Processo e instruções">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nº do processo (opcional)">
            <Entrada value={f.processoNumero} onChange={(e) => set('processoNumero', e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
          </Campo>
          <Campo rotulo="Partes (opcional)">
            <Entrada value={f.partes} onChange={(e) => set('partes', e.target.value)} placeholder="Autor x Réu" />
          </Campo>
          <Campo rotulo="Descrição do serviço" className="sm:col-span-2">
            <Area required rows={4} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="O que precisa ser feito, com o máximo de contexto." />
          </Campo>
          <Campo rotulo="O que deve ser entregue (opcional)" className="sm:col-span-2">
            <Area value={f.instrucoes} onChange={(e) => set('instrucoes', e.target.value)} placeholder="Ex.: ata assinada em PDF + resumo por escrito até 2h após a audiência." />
          </Campo>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Nº do processo, partes, endereço e anexos só ficam visíveis para o correspondente depois que ele aceitar. Procuração e documentos podem ser anexados na próxima tela.
        </p>
      </Cartao>

      <Cartao
        titulo="3. Para quem enviar"
        acao={
          cidade && (
            <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setNovoCorr(true)}>
              <UserPlus className="h-4 w-4" /> Cadastrar correspondente
            </Botao>
          )
        }
      >
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Como contratar">
            <Selecao value={f.modo} onChange={(e) => set('modo', e.target.value)}>
              <option value="DIRETO">Direto — o primeiro que aceitar fica com a demanda</option>
              <option value="PROPOSTAS">Propostas — cada um manda um valor e eu escolho</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Tipo de correspondente">
            <Selecao value={f.tipoCorrespondente} onChange={(e) => set('tipoCorrespondente', e.target.value)}>
              <option value="TODOS">Qualquer correspondente</option>
              <option value="APENAS_ADVOGADOS">Apenas advogados</option>
            </Selecao>
          </Campo>
        </div>

        {!cidade ? (
          <p className="text-sm text-gray-500">Escolha a cidade para ver quem atende lá.</p>
        ) : sugestoes === null ? null : sugestoes.length === 0 ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Nenhum correspondente seu atende {cidade.nome}/{cidade.uf}
            {f.tipoCorrespondente === 'APENAS_ADVOGADOS' && ' (advogados)'}.{' '}
            <button type="button" onClick={() => setNovoCorr(true)} className="font-semibold underline">
              Cadastre um agora
            </button>{' '}
            ou salve como rascunho.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {sugestoes.map((c) => {
              const on = escolhidos.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEscolhidos(on ? escolhidos.filter((i) => i !== c.id) : [...escolhidos, c.id])}
                    className={cx('flex w-full items-center gap-3 px-3 py-2.5 text-left', on ? 'bg-marca-50' : 'hover:bg-gray-50')}
                  >
                    <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-marca-700 bg-marca-700 text-white' : 'border-gray-300')}>
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                        {c.nome} {c.favorito && <Star className="h-3.5 w-3.5 fill-ouro-500 text-ouro-500" />}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {c.ehAdvogado ? `OAB ${c.oab ?? ''}/${c.oabUf ?? ''}` : 'Não advogado'} · {c.demandasConcluidas} concluída(s)
                        {c.notaMedia ? ` · ★ ${c.notaMedia.toFixed(1)}` : ''}
                        {servicoId && c.servicos.some((s) => s.id === servicoId) ? ' · faz este serviço' : ''}
                      </span>
                    </span>
                    {c.valorReferencia && <span className="text-xs text-gray-500">ref. {moeda(c.valorReferencia)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {escolhidos.length > 1 && f.modo === 'DIRETO' && (
          <p className="mt-2 text-xs text-gray-500">Vários receberão o convite; o primeiro que aceitar fica com a demanda e os convites dos demais são encerrados.</p>
        )}
      </Cartao>

      <div className="flex flex-col-reverse gap-2 pb-8 sm:flex-row sm:justify-end">
        <Botao type="button" variante="secundario" carregando={salvando === 'rascunho'} disabled={!!salvando} onClick={(e) => salvar(e as any, false)}>
          Salvar rascunho
        </Botao>
        <Botao type="submit" carregando={salvando === 'enviar'} disabled={!!salvando}>
          Salvar e enviar {escolhidos.length > 0 && `(${escolhidos.length})`}
        </Botao>
      </div>
    </form>

      <Modal aberto={novoCorr} aoFechar={() => setNovoCorr(false)} titulo="Cadastrar correspondente" largura="max-w-2xl">
        <FormCorrespondente
          cidadeSugerida={cidade}
          aoCancelar={() => setNovoCorr(false)}
          aoSalvar={async (c) => {
            setNovoCorr(false);
            await carregarSugestoes();
            setEscolhidos((e) => [...new Set([...e, c.id])]);
          }}
        />
      </Modal>
    </>
  );
}
