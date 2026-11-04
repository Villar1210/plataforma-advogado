'use client';

import { Bell, BarChart3, FileText, Plus, LogOut, Menu, Scale, Settings, Users, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import { Carregando, cx } from '@/components/ui';
import { Sessao, SessaoCtx } from '@/components/sessao';

const MENU = [
  { href: '/demandas', rotulo: 'Demandas', icone: FileText },
  { href: '/correspondentes', rotulo: 'Correspondentes', icone: Users },
  { href: '/pagamentos', rotulo: 'Pagamentos', icone: Wallet },
  { href: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Sessao>('/auth/me')
      .then(setSessao)
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => setMenuAberto(false), [caminho]);

  if (!sessao) return <Carregando />;

  const sair = () => {
    setToken(null);
    router.replace('/login');
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      <Link
        href="/demandas/nova"
        className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-ouro-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-ouro-600"
      >
        <Plus className="h-4 w-4" /> Nova demanda
      </Link>
      {MENU.map(({ href, rotulo, icone: Icone }) => {
        const ativo = caminho === href || (caminho.startsWith(href + '/') && !caminho.startsWith('/demandas/nova'));
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              ativo ? 'bg-white/10 text-white' : 'text-marca-200 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icone className="h-4 w-4" /> {rotulo}
          </Link>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-white/10 p-3">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-white">{sessao.nome}</p>
        <p className="truncate text-xs text-marca-200">{sessao.tenant.nome}</p>
      </div>
      <button onClick={sair} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-marca-200 hover:bg-white/5 hover:text-white">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );

  const marca = (
    <div className="flex items-center gap-2 px-6 py-5 text-white">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ouro-500">
        <Scale className="h-4 w-4" />
      </div>
      <span className="font-semibold">Correspondentes</span>
    </div>
  );

  return (
    <SessaoCtx.Provider value={sessao}>
      <div className="min-h-screen lg:pl-60">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-marca-900 lg:flex">
          {marca}
          {nav}
          {rodape}
        </aside>

        {menuAberto && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-gray-900/50" onClick={() => setMenuAberto(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-marca-900">
              <div className="flex items-center justify-between pr-3">
                {marca}
                <button onClick={() => setMenuAberto(false)} className="text-marca-200" aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              {rodape}
            </aside>
          </div>
        )}

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button onClick={() => setMenuAberto(true)} className="text-gray-600 lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-medium text-gray-500 lg:hidden">{sessao.tenant.nome}</span>
          <span className="hidden lg:block" />
          <Notificacoes />
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </SessaoCtx.Provider>
  );
}

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  lida: boolean;
  createdAt: string;
}

function Notificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);

  const contar = useCallback(() => {
    api<{ total: number }>('/notificacoes/nao-lidas')
      .then((r) => setNaoLidas(r.total))
      .catch(() => {});
  }, []);

  useEffect(() => {
    contar();
    const t = setInterval(contar, 60_000);
    return () => clearInterval(t);
  }, [contar]);

  const abrir = async () => {
    setAberto((a) => !a);
    if (!aberto) setLista(await api<Notificacao[]>('/notificacoes').catch(() => []));
  };

  const clicar = async (n: Notificacao) => {
    if (!n.lida) await api(`/notificacoes/${n.id}/lida`, { method: 'POST' }).catch(() => {});
    setAberto(false);
    contar();
    if (n.link?.startsWith('http')) window.open(n.link, '_blank');
    else if (n.link) router.push(n.link);
  };

  const lerTodas = async () => {
    await api('/notificacoes/lidas', { method: 'POST' }).catch(() => {});
    setLista((l) => l.map((n) => ({ ...n, lida: true })));
    setNaoLidas(0);
  };

  return (
    <div className="relative">
      <button onClick={abrir} className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Notificações">
        <Bell className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold">Notificações</span>
              {naoLidas > 0 && (
                <button onClick={lerTodas} className="text-xs font-medium text-marca-600 hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {lista.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">Nada por aqui.</li>}
              {lista.map((n) => (
                <li key={n.id}>
                  <button onClick={() => clicar(n)} className={cx('w-full px-4 py-3 text-left hover:bg-gray-50', !n.lida && 'bg-marca-50/60')}>
                    <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                    <p className="mt-0.5 text-sm text-gray-600">{n.mensagem}</p>
                    <p className="mt-1 text-xs text-gray-400">{dataHora(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
