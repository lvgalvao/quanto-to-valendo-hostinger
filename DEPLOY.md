# Deploy na VPS (187.77.232.213)

Deploy manual (o PRD deixa automação fora de escopo). Backend na porta 3001, painel na 5173.

## Pré-requisitos na VPS
- Node 20+ e pm2 (`npm i -g pm2`).
- A porta 3001 e 5173 liberadas no firewall (o painel e o WhatsApp falam com o backend na 3001).

## Passos

```bash
# 1. Clonar
git clone git@github.com:lvgalvao/quanto-to-valendo-hostinger.git
cd quanto-to-valendo-hostinger

# 2. Backend
cd backend
cp .env.example .env
#   preencha: ANTHROPIC_API_KEY, ADMIN_TOKEN (forte), MODELO_AGENTE, PORT=3001
npm install
cd ..

# 3. Frontend (build usa as VITE_* em tempo de build!)
cd frontend
cp .env.example .env
#   VITE_API_URL e VITE_SOCKET_URL = http://187.77.232.213:3001
npm install
npm run build
cd ..

# 4. Subir com pm2
pm2 start ecosystem.config.cjs
pm2 save            # + `pm2 startup` uma vez, para sobreviver a reboot
pm2 logs
```

## Acessos
- Painel: `http://187.77.232.213:5173` (login com o `ADMIN_TOKEN`).
- Backend/health: `http://187.77.232.213:3001/health`.

## Conectar o primeiro número
Painel → Conexões → Nova Conexão → Conectar → escanear o QR no WhatsApp
(Aparelhos conectados). Use um **número dedicado**.

## Atualizações futuras
```bash
git pull
cd frontend && npm run build && cd ..
pm2 restart ecosystem.config.cjs
```

> `ANTHROPIC_API_KEY` e `ADMIN_TOKEN` vivem só no `backend/.env` da VPS — nunca no git.
