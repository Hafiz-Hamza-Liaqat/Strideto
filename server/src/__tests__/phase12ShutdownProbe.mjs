/**
 * Isolated process probe for graceful shutdown. No Docker, no protected volumes.
 * Listen on an ephemeral port, register SIGTERM handlers, then self-signal.
 */
import http from 'node:http';

process.env.SHUTDOWN_TIMEOUT_MS = process.env.SHUTDOWN_TIMEOUT_MS || '4000';
delete process.env.REDIS_URL;

const { registerGracefulShutdown } = await import('../config/shutdown.js');

const server = http.createServer((_req, res) => {
  res.statusCode = 200;
  res.end('ok');
});

registerGracefulShutdown(server);

server.listen(0, '127.0.0.1', () => {
  // Windows does not reliably deliver OS SIGTERM to Node handlers.
  process.emit('SIGTERM');
});
