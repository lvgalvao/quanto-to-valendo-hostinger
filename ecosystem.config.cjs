/**
 * Configuração pm2 para a VPS. Sobe backend (3001) e serve o painel já buildado (5173).
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs        # acompanhar
 *   pm2 save        # persistir entre reboots (com pm2 startup)
 *
 * Pré-requisitos: `npm install` em backend/ e frontend/, `npm run build` em frontend/,
 * e os arquivos .env preenchidos (backend/.env e frontend/.env).
 */
module.exports = {
  apps: [
    {
      name: 'qtv-backend',
      cwd: './backend',
      script: 'src/server.js',
      // server.js usa dotenv/config -> lê ./backend/.env (por causa do cwd acima)
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'qtv-frontend',
      // serve o dist/ buildado com o servidor estático embutido do pm2 (SPA)
      script: 'serve',
      env: {
        PM2_SERVE_PATH: './frontend/dist',
        PM2_SERVE_PORT: 5173,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
      autorestart: true,
    },
  ],
};
