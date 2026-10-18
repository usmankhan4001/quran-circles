import cluster from 'node:cluster';
import { createServer } from 'node:http';
import { superviseWorkers } from '../../cluster';
import { createLogger } from '../../middleware/logger';
import {
  SharedLimitClient,
  SharedLimitStore,
  processChannel,
  sharedBucketLimiter,
} from '../../middleware/shared-limits';

/**
 * A stand-in for `index.ts` for `cluster.test.ts`: the same supervisor and shared limits, but each
 * worker serves a tiny HTTP server instead of the API, so the test needs no database.
 *
 * - `GET /hit`: takes one slot of a shared bucket (25 a minute); 200 or 429.
 * - `GET /slow`: answers after 400 ms (a request in flight during shutdown).
 * - `GET /crash`: the worker exits with code 3.
 * - Every answer carries the worker's pid in `x-pid`.
 *
 * Environment: `PORT`, `API_PROCESSES`. Restart waits are short so the test is quick.
 */
const port = Number(process.env.PORT);
const processes = Number(process.env.API_PROCESSES ?? 2);
const logger = createLogger();

if (cluster.isPrimary) {
  const store = new SharedLimitStore();
  const supervisor = superviseWorkers({
    cluster,
    processes,
    logger,
    restartBaseMs: 200,
    restartMaxMs: 1_000,
    shutdownTimeoutMs: 5_000,
    onMessage: (worker, message) => {
      void store.handle(message).then((reply) => {
        if (reply && worker.isConnected()) worker.send(reply, undefined, () => undefined);
      });
    },
    exit: (code) => process.exit(code),
  });
  process.on('SIGTERM', () => supervisor.shutdown('SIGTERM'));
  process.on('SIGINT', () => supervisor.shutdown('SIGINT'));
} else {
  const limiter = sharedBucketLimiter(new SharedLimitClient(processChannel()));
  const server = createServer((req, res) => {
    res.setHeader('x-pid', String(process.pid));
    res.setHeader('connection', 'close');
    if (req.url === '/hit') {
      void limiter.consume('default:fixture', { limit: 25, windowSeconds: 60 }, Date.now()).then(
        (r) => {
          res.statusCode = r.allowed ? 200 : 429;
          res.end();
        },
        () => {
          res.statusCode = 500;
          res.end();
        },
      );
    } else if (req.url === '/slow') {
      setTimeout(() => res.end('done'), 400);
    } else if (req.url === '/crash') {
      res.end();
      setTimeout(() => process.exit(3), 10);
    } else {
      res.end();
    }
  });
  server.listen(port);
  const stop = (): void => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('disconnect', stop);
}
