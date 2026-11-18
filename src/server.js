const db = require('./db');
const seed = require('./seed');
const createApp = require('./app');

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  await db.connect();
  await seed();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`\nGestão de Estudos rodando:`);
    console.log(`  Site Web ............ http://localhost:${PORT}`);
    console.log(`  API REST ............ http://localhost:${PORT}/api`);
    console.log(`  Swagger UI .......... http://localhost:${PORT}/api-docs`);
    console.log(`  Swagger YAML ........ http://localhost:${PORT}/api-docs/swagger.yaml\n`);
  });

  const shutdown = async () => {
    server.close();
    await db.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
