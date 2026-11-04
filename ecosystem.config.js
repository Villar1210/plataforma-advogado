// PM2 — rodar com: pm2 start ecosystem.config.js
// (nunca usar pm2 restart all: o VPS é compartilhado)
module.exports = {
  apps: [
    {
      name: 'advogado-api',
      cwd: '/var/www/plataforma-advogado/backend',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
    {
      name: 'advogado-web',
      cwd: '/var/www/plataforma-advogado/frontend',
      script: '.next/standalone/server.js',
      env: { NODE_ENV: 'production', PORT: 3006, HOSTNAME: '127.0.0.1' },
      max_memory_restart: '300M',
    },
  ],
};
