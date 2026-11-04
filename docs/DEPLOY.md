# Deploy no VPS (mesmo servidor do gestordevendas)

Subdomínio: `plataforma-advogado.ivillar.com.br` · API na porta **3340** · web na porta **3006**.

## Jeito rápido: instalador automático
Com o DNS do subdomínio já apontando para o VPS, entre como **root** e rode:
```bash
curl -fsSL https://raw.githubusercontent.com/Villar1210/plataforma-advogado/main/deploy/instalar.sh -o /root/instalar.sh && bash /root/instalar.sh
```
Ele cria um banco PostgreSQL próprio num container Docker isolado (`advogado-db`, porta 5441 só local), baixa o código, pede o nome do escritório e o login do advogado, compila, sobe no PM2, configura o nginx e gera o HTTPS. Pode ser rodado de novo para atualizar.

## Jeito manual
Antes, confirme que as portas estão livres: `ss -ltnp | grep -E ':3340|:3006'`.

## 1. DNS
Registro A `correspondentes` → IP do VPS.

## 2. Banco
```bash
sudo -u postgres psql -p 5434 -c "CREATE USER advogado_admin WITH PASSWORD 'SENHA_FORTE';"
sudo -u postgres psql -p 5434 -c "CREATE DATABASE advogado_db OWNER advogado_admin;"
```
(Ajuste a porta se usar outro cluster PostgreSQL.)

## 3. Código
```bash
cd /var/www
git clone https://github.com/Villar1210/plataforma-advogado.git
cd plataforma-advogado
mkdir -p uploads
```

## 4. Backend
```bash
cd /var/www/plataforma-advogado/backend
cp .env.example .env    # DATABASE_URL, JWT_SECRET (openssl rand -hex 32), APP_URL, UPLOAD_DIR, SEED_*
npm ci
npx prisma migrate deploy
npx prisma generate
npm run db:seed         # cria cidades, serviços, planos e o escritório do advogado
npm run build
```
Depois do seed, apague `SEED_ADMIN_SENHA` do `.env`.

## 5. Frontend
```bash
cd /var/www/plataforma-advogado/frontend
echo 'NEXT_PUBLIC_API_URL=https://plataforma-advogado.ivillar.com.br/api' > .env.production
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

## 6. PM2
```bash
cd /var/www/plataforma-advogado
pm2 start ecosystem.config.js
pm2 save
```

## 7. nginx + HTTPS
```bash
cp deploy/nginx.conf /etc/nginx/sites-available/plataforma-advogado.ivillar.com.br
ln -s /etc/nginx/sites-available/plataforma-advogado.ivillar.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d plataforma-advogado.ivillar.com.br
```

## Atualizações
```bash
cd /var/www/plataforma-advogado && git pull
cd backend && npx prisma migrate deploy && npx prisma generate && npm run build && pm2 restart advogado-api --update-env
cd ../frontend && npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && pm2 restart advogado-web
```
Nunca `pm2 restart all`.

## Backup
Banco: `pg_dump` diário. Arquivos: a pasta `uploads/` (procurações e comprovantes) precisa entrar no backup.
