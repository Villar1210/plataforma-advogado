'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import { Botao, Campo, Cartao, Carregando, Entrada, Modal, Selecao, Selo, useAcao } from '@/components/ui';
import { useSessao } from '@/components/sessao';

interface Escritorio {
  nome: string;
  documento: string | null;
  oab: string | null;
  email: string | null;
  telefone: string | null;
  assinatura: { status: string; plano: { nome: string } } | null;
}

interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'ADVOGADO' | 'ASSISTENTE';
  ativo: boolean;
  ultimoLogin: string | null;
}

const PAPEL = { ADMIN: 'Administrador', ADVOGADO: 'Advogado', ASSISTENTE: 'Assistente' };

export default function Configuracoes() {
  const sessao = useSessao();
  const admin = sessao.papel === 'ADMIN';
  const { executar, carregando } = useAcao();
  const [esc, setEsc] = useState<Escritorio | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [novo, setNovo] = useState(false);
  const [senha, setSenha] = useState({ senhaAtual: '', novaSenha: '' });

  const carregar = useCallback(() => {
    api<Escritorio>('/escritorio').then(setEsc).catch(() => {});
    api<Membro[]>('/escritorio/usuarios').then(setMembros).catch(() => {});
  }, []);
  useEffect(carregar, [carregar]);

  if (!esc) return <Carregando />;
  const set = (k: keyof Escritorio, v: string) => setEsc({ ...esc, [k]: v });

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <h1 className="text-2xl font-semibold text-gray-900">Configurações</h1>

      <Cartao titulo="Escritório" acao={esc.assinatura && <Selo cor="bg-marca-50 text-marca-800 ring-marca-200">Plano {esc.assinatura.plano.nome}</Selo>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" className="sm:col-span-2">
            <Entrada disabled={!admin} value={esc.nome} onChange={(e) => set('nome', e.target.value)} />
          </Campo>
          <Campo rotulo="CNPJ / CPF">
            <Entrada disabled={!admin} value={esc.documento ?? ''} onChange={(e) => set('documento', e.target.value)} />
          </Campo>
          <Campo rotulo="OAB (sociedade ou responsável)">
            <Entrada disabled={!admin} value={esc.oab ?? ''} onChange={(e) => set('oab', e.target.value)} />
          </Campo>
          <Campo rotulo="E-mail">
            <Entrada disabled={!admin} type="email" value={esc.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Campo>
          <Campo rotulo="Telefone">
            <Entrada disabled={!admin} value={esc.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
          </Campo>
        </div>
        <p className="mt-3 text-xs text-gray-500">O nome do escritório aparece nas mensagens enviadas aos correspondentes.</p>
        {admin && (
          <Botao
            className="mt-4"
            carregando={carregando === 'esc'}
            onClick={() =>
              executar(
                'esc',
                () =>
                  api('/escritorio', {
                    method: 'PATCH',
                    body: { nome: esc.nome, documento: esc.documento || undefined, oab: esc.oab || undefined, email: esc.email || undefined, telefone: esc.telefone || undefined },
                  }),
                'Dados salvos',
              )
            }
          >
            Salvar
          </Botao>
        )}
      </Cartao>

      <Cartao
        titulo="Equipe"
        acao={
          admin && (
            <Botao variante="fantasma" tamanho="sm" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Adicionar
            </Botao>
          )
        }
      >
        <ul className="divide-y divide-gray-100">
          {membros.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {m.nome} {!m.ativo && <span className="text-xs text-red-600">(inativo)</span>}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {m.email} · último acesso {dataHora(m.ultimoLogin)}
                </p>
              </div>
              {admin && m.id !== sessao.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Selecao
                    className="w-36"
                    value={m.papel}
                    onChange={(e) => executar('p' + m.id, () => api(`/escritorio/usuarios/${m.id}`, { method: 'PATCH', body: { papel: e.target.value } }), 'Perfil alterado').then(carregar)}
                  >
                    {Object.entries(PAPEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Selecao>
                  <Botao
                    variante={m.ativo ? 'perigo' : 'secundario'}
                    tamanho="sm"
                    onClick={() => executar('a' + m.id, () => api(`/escritorio/usuarios/${m.id}`, { method: 'PATCH', body: { ativo: !m.ativo } })).then(carregar)}
                  >
                    {m.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>
                </div>
              ) : (
                <Selo cor="bg-gray-100 text-gray-700 ring-gray-200">{PAPEL[m.papel]}</Selo>
              )}
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Minha senha">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Senha atual">
            <Entrada type="password" value={senha.senhaAtual} onChange={(e) => setSenha({ ...senha, senhaAtual: e.target.value })} />
          </Campo>
          <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres">
            <Entrada type="password" value={senha.novaSenha} onChange={(e) => setSenha({ ...senha, novaSenha: e.target.value })} />
          </Campo>
        </div>
        <Botao
          className="mt-4"
          variante="secundario"
          disabled={!senha.senhaAtual || senha.novaSenha.length < 8}
          carregando={carregando === 'senha'}
          onClick={() => executar('senha', () => api('/auth/senha', { body: senha }), 'Senha alterada').then((r) => r && setSenha({ senhaAtual: '', novaSenha: '' }))}
        >
          Alterar senha
        </Botao>
      </Cartao>

      <NovoMembro aberto={novo} aoFechar={() => setNovo(false)} aoSalvar={() => { setNovo(false); carregar(); }} />
    </div>
  );
}

function NovoMembro({ aberto, aoFechar, aoSalvar }: { aberto: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const { executar, carregando } = useAcao();
  const [f, setF] = useState({ nome: '', email: '', senha: '', papel: 'ASSISTENTE' });
  useEffect(() => setF({ nome: '', email: '', senha: '', papel: 'ASSISTENTE' }), [aberto]);
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Adicionar à equipe">
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <Entrada value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Campo>
        <Campo rotulo="Senha inicial" dica="Passe para a pessoa; ela pode trocar depois em Configurações.">
          <Entrada value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} />
        </Campo>
        <Campo rotulo="Perfil">
          <Selecao value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })}>
            {Object.entries(PAPEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao carregando={carregando === 'novo'} onClick={() => executar('novo', () => api('/escritorio/usuarios', { body: f }), 'Usuário criado').then((r) => r && aoSalvar())}>
          Adicionar
        </Botao>
      </div>
    </Modal>
  );
}
