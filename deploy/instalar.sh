#!/usr/bin/env bash
# Instalador da Plataforma de Correspondentes no VPS.
# Uso (como root):
#   curl -fsSL https://raw.githubusercontent.com/Villar1210/plataforma-advogado/main/deploy/instalar.sh -o /root/instalar.sh && bash /root/instalar.sh
# Pode ser rodado de novo com segurança: o que já existe é reaproveitado.
set -euo pipefail

DOMINIO="${DOMINIO:-correspondentes.ivillar.com.br}"
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
passo "Banco de dados PostgreSQL"
PSQL=""
DB_HOST="127.0.0.1"
DB_PORTA=""
# Prefere o container do gestordevendas (porta 5434); senão, o primeiro PostgreSQL encontrado.
CONTAINER=$(docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | awk '$2 ~ /postgres/ && $0 ~ /:5434->/ {print $1; exit}' || true)
[ -n "$CONTAINER" ] || CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk '$2 ~ /postgres/ {print $1; exit}' || true)
if [ -n "$CONTAINER" ]; then
  PGU=$(docker exec "$CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo postgres)
  PSQL="docker exec -i $CONTAINER psql -v ON_ERROR_STOP=1 -U $PGU -d postgres -tA"
  DB_PORTA=$(docker port "$CONTAINER" 5432/tcp 2>/dev/null | head -1 | sed 's/.*://')
  [ -n "$DB_PORTA" ] || erro "o container $CONTAINER não publica a porta 5432 no servidor"
  verde "Usando o PostgreSQL do container '$CONTAINER' (porta $DB_PORTA)"
elif id postgres >/dev/null 2>&1 && command -v psql >/dev/null; then
  DB_PORTA=$(su - postgres -c "psql -tAc 'show port'" 2>/dev/null || echo 5432)
  PSQL="su - postgres -c 'psql -v ON_ERROR_STOP=1 -p $DB_PORTA -tA'"
  verde "Usando o PostgreSQL instalado no servidor (porta $DB_PORTA)"
else
  erro "não encontrei PostgreSQL (nem container Docker, nem instalado)"
fi

rodar_sql() { eval "$PSQL" <<<"$1"; }

ENV_BACK="$PASTA/backend/.env"
if [ -f "$ENV_BACK" ] && grep -q '^DATABASE_URL=' "$ENV_BACK"; then
  amarelo "Já existe $ENV_BACK — mantendo o banco e as senhas atuais"
  DB_URL=$(grep '^DATABASE_URL=' "$ENV_BACK" | cut -d= -f2- | tr -d '"')
else
  DB_SENHA=$(openssl rand -hex 16)
  if [ "$(rodar_sql "select 1 from pg_roles where rolname='$DB_USER'")" = "1" ]; then
    rodar_sql "alter user $DB_USER with password '$DB_SENHA'" >/dev/null
  else
    rodar_sql "create user $DB_USER with password '$DB_SENHA'" >/dev/null
  fi
  if [ "$(rodar_sql "select 1 from pg_database where datname='$DB_NOME'")" != "1" ]; then
    rodar_sql "create database $DB_NOME owner $DB_USER" >/dev/null
  fi
  DB_URL="postgresql://$DB_USER:$DB_SENHA@$DB_HOST:$DB_PORTA/$DB_NOME"
  verde "Banco $DB_NOME e usuário $DB_USER prontos"
fi

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
  sed "s/correspondentes.ivillar.com.br/$DOMINIO/g" "$PASTA/deploy/nginx.conf" > "$CONF"
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
