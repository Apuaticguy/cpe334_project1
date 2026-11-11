import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`QuickOrder server running on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

