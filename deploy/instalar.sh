#!/usr/bin/env bash
# Instalador da Plataforma de Correspondentes no VPS.
# Uso (como root):
#   curl -fsSL https://raw.githubusercontent.com/Villar1210/plataforma-advogado/main/deploy/instalar.sh -o /root/instalar.sh && bash /root/instalar.sh
# Pode ser rodado de novo com segurança: o que já existe é reaproveitado.
set -euo pipefail

DOMINIO="${DOMINIO:-plataforma-advogado.ivillar.com.br}"
PASTA="${PASTA:-/var/www/plataforma-advogado}"
REPO="https://github.com/Villar1210/plataforma-advogado.git"
PORTA_API=3340
PORTA_WEB=3006
DB_NOME="advogado_db"
DB_USER="advogado_admin"

verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
amarelo() { printf '\033[1;33m%s\033[0m\n' "$*"; }
erro() { printf '\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }
passo() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
trap 'printf "\033[1;31mERRO na linha %s: %s\033[0m\n" "$LINENO" "$BASH_COMMAND" >&2' ERR

[ "$(id -u)" = "0" ] || erro "rode como root (entre com: su -   ou   ssh root@...)"

# ───────────────────────── pré-requisitos ─────────────────────────
passo "Conferindo o servidor"
command -v git >/dev/null || erro "git não instalado"
command -v node >/dev/null || erro "Node.js não instalado"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || erro "Node.js $NODE_MAJOR encontrado; precisa ser 20 ou mais novo"
command -v pm2 >/dev/null || { amarelo "PM2 não encontrado, instalando..."; npm i -g pm2; }
command -v nginx >/dev/null || erro "nginx não instalado"
command -v openssl >/dev/null || erro "openssl não instalado"
verde "Node $(node -v), PM2 e nginx ok"

for p in $PORTA_API $PORTA_WEB; do
  if ss -ltnH "( sport = :$p )" | grep -q .; then
    if pm2 jlist 2>/dev/null | grep -q '"name":"advogado-'; then
      amarelo "Porta $p em uso pela própria plataforma (reinstalação) — ok"
    else
      erro "a porta $p já está em uso por outro serviço. Veja com: ss -ltnp | grep :$p"
    fi
  fi
done

# ───────────────────────── banco de dados ─────────────────────────
passo "Banco de dados PostgreSQL (container próprio, isolado dos outros projetos)"
command -v docker >/dev/null 2>&1 || erro "Docker não encontrado"
DB_CONTAINER="advogado-db"
DB_PORTA=5441
SENHA_ARQ="/root/.advogado-db-senha"
ENV_BACK="$PASTA/backend/.env"

if docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  docker start "$DB_CONTAINER" >/dev/null
  verde "Container $DB_CONTAINER já existe — reaproveitando"
  if [ -f "$SENHA_ARQ" ]; then
    DB_SENHA=$(cat "$SENHA_ARQ")
  elif [ -f "$ENV_BACK" ]; then
    DB_SENHA=$(grep '^DATABASE_URL=' "$ENV_BACK" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')
  else
    erro "o container $DB_CONTAINER existe mas a senha se perdeu. Remova com: docker rm -f $DB_CONTAINER && docker volume rm advogado-db-data  (e rode de novo)"
  fi
else
  if ss -ltnH "( sport = :$DB_PORTA )" | grep -q .; then erro "a porta $DB_PORTA já está em uso"; fi
  DB_SENHA=$(openssl rand -hex 16)
  echo "$DB_SENHA" > "$SENHA_ARQ"; chmod 600 "$SENHA_ARQ"
  docker run -d --name "$DB_CONTAINER" --restart unless-stopped \
    -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_SENHA" -e POSTGRES_DB="$DB_NOME" \
    -p 127.0.0.1:$DB_PORTA:5432 -v advogado-db-data:/var/lib/postgresql/data \
    postgres:16-alpine >/dev/null
  verde "Container $DB_CONTAINER criado (porta $DB_PORTA, só acessível de dentro do servidor)"
fi

echo -n "Aguardando o banco ficar pronto"
for i in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NOME" >/dev/null 2>&1; then break; fi
  echo -n "."; sleep 1
  [ "$i" = 60 ] && { echo; erro "o banco não iniciou. Veja: docker logs $DB_CONTAINER"; }
done
echo
DB_URL="postgresql://$DB_USER:$DB_SENHA@127.0.0.1:$DB_PORTA/$DB_NOME"
verde "Banco pronto"

# ───────────────────────── código ─────────────────────────
passo "Baixando o código"
if [ -d "$PASTA/.git" ]; then
  git -C "$PASTA" pull --ff-only
else
  mkdir -p "$(dirname "$PASTA")"
  git clone "$REPO" "$PASTA"
fi
mkdir -p "$PASTA/uploads"

# ───────────────────────── backend ─────────────────────────
passo "Configurando a API"
cd "$PASTA/backend"
PRIMEIRA_VEZ=0
if [ ! -f .env ]; then
  PRIMEIRA_VEZ=1
  echo
  echo "Dados do primeiro acesso (o login do advogado):"
  read -rp "  Nome do escritório: " ESCRITORIO
  read -rp "  Nome do advogado: " ADMIN_NOME
  read -rp "  E-mail de login: " ADMIN_EMAIL
  while true; do
    read -rsp "  Senha (mínimo 8 caracteres): " ADMIN_SENHA; echo
    [ ${#ADMIN_SENHA} -ge 8 ] && break
    echo "  Senha curta demais, tente de novo."
  done
  cat > .env <<EOF
DATABASE_URL="$DB_URL"
JWT_SECRET="$(openssl rand -hex 32)"
PORT=$PORTA_API
APP_URL="https://$DOMINIO"
CORS_ORIGINS="https://$DOMINIO"
UPLOAD_DIR="$PASTA/uploads"
CADASTRO_ABERTO=false
EOF
  chmod 600 .env
fi

sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"$DB_URL\"#" .env
# mantém o domínio atualizado mesmo se o .env já existia
sed -i "s#^APP_URL=.*#APP_URL=\"https://$DOMINIO\"#; s#^CORS_ORIGINS=.*#CORS_ORIGINS=\"https://$DOMINIO\"#" .env
npm ci --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate

if [ "$PRIMEIRA_VEZ" = "1" ]; then
  SEED_ESCRITORIO="$ESCRITORIO" SEED_ADMIN_NOME="$ADMIN_NOME" SEED_ADMIN_EMAIL="$ADMIN_EMAIL" SEED_ADMIN_SENHA="$ADMIN_SENHA" npx ts-node prisma/seed.ts
  unset ADMIN_SENHA
else
  npx ts-node prisma/seed.ts   # só atualiza catálogos; não recria usuários
fi
npm run build

# ───────────────────────── frontend ─────────────────────────
passo "Construindo as telas"
cd "$PASTA/frontend"
echo "NEXT_PUBLIC_API_URL=https://$DOMINIO/api" > .env.production
npm ci --no-audit --no-fund
NEXT_TELEMETRY_DISABLED=1 npm run build
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# ───────────────────────── PM2 ─────────────────────────
passo "Iniciando os processos (PM2)"
cd "$PASTA"
sed -i "s#/var/www/plataforma-advogado#$PASTA#g" ecosystem.config.js
for app in advogado-api advogado-web; do
  if pm2 describe "$app" >/dev/null 2>&1; then
    pm2 restart "$app" --update-env
  else
    pm2 start ecosystem.config.js --only "$app"
  fi
done
pm2 save
sleep 4
curl -fsS "http://127.0.0.1:$PORTA_API/saude" >/dev/null || erro "a API não respondeu. Veja: pm2 logs advogado-api --lines 50"
curl -fsS -o /dev/null "http://127.0.0.1:$PORTA_WEB/login" || erro "o site não respondeu. Veja: pm2 logs advogado-web --lines 50"
verde "API (porta $PORTA_API) e site (porta $PORTA_WEB) no ar"

# ───────────────────────── nginx ─────────────────────────
passo "Configurando o nginx para $DOMINIO"
# remove configurações desta plataforma criadas antes com outro domínio
for f in /etc/nginx/sites-enabled/* /etc/nginx/sites-available/*; do
  [ -f "$f" ] || continue
  if grep -q "127.0.0.1:$PORTA_WEB" "$f" && grep -q "127.0.0.1:$PORTA_API" "$f" && ! grep -q "server_name[^;]*$DOMINIO" "$f"; then
    amarelo "Removendo configuração antiga da plataforma: $f"
    rm -f "$f"
  fi
done
CONF="/etc/nginx/sites-available/$DOMINIO"
EXISTENTE=$(grep -rl "server_name[^;]*$DOMINIO" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | head -1 || true)
if [ -n "$EXISTENTE" ] && grep -q "location /api/" "$EXISTENTE"; then
  amarelo "Já existe configuração com /api/ em $EXISTENTE — mantendo"
else
  if [ -n "$EXISTENTE" ]; then
    cp "$EXISTENTE" "/root/nginx-$DOMINIO.bak.$(date +%s)"
    amarelo "Configuração anterior salva em /root (backup) e substituída"
    rm -f "$EXISTENTE"
  fi
  sed "s/plataforma-advogado.ivillar.com.br/$DOMINIO/g" "$PASTA/deploy/nginx.conf" > "$CONF"
  ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMINIO"
fi
nginx -t
systemctl reload nginx
verde "nginx recarregado"

if command -v certbot >/dev/null; then
  if ! grep -q "ssl_certificate" "/etc/nginx/sites-enabled/$DOMINIO" 2>/dev/null; then
    passo "Gerando o certificado HTTPS"
    certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
      || amarelo "Não consegui gerar o HTTPS agora (o DNS já aponta para este servidor?). Rode depois: certbot --nginx -d $DOMINIO"
  fi
else
  amarelo "certbot não instalado — o site fica só em http por enquanto"
fi

echo
verde "════════════════════════════════════════════"
verde " Pronto! Acesse: https://$DOMINIO"
verde "════════════════════════════════════════════"
echo "Processos: pm2 status | logs: pm2 logs advogado-api"
echo "Arquivos enviados ficam em $PASTA/uploads (inclua no backup)."
