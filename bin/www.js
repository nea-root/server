/* eslint-disable n/no-process-exit */
import 'dotenv/config';
import { httpServer, app } from '../app.js';
import debugLib from 'debug';

const debug = debugLib('server:server');

const port = normalizePort(process.env.PORT || '9000');
app.set('port', port);

httpServer.listen(port);
httpServer.on('error', onError);
httpServer.on('listening', onListening);

function normalizePort(val) {
  const p = parseInt(val, 10);
  if (isNaN(p)) return val;
  if (p >= 0) return p;
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;
  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;
  if (error.code === 'EACCES') {
    console.error(`${bind} requires elevated privileges`);
    process.exit(1);
  }
  if (error.code === 'EADDRINUSE') {
    console.error(`${bind} is already in use`);
    process.exit(1);
  }
  throw error;
}

function onListening() {
  const addr = httpServer.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
  console.info(`\nNevereveralone API running on http://localhost:${addr.port}`);
  console.info(`GraphQL playground: http://localhost:${addr.port}/graphql`);
  console.info(`Health check:       http://localhost:${addr.port}/health\n`);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  httpServer.close(() => process.exit(1));
});
