import mongoose, { type Connection } from 'mongoose';
import { MONGODB_DATABASE, MONGODB_URI } from './env';

/**
 * Server-side only MongoDB Atlas connection with connection pooling.
 *
 * This module is imported exclusively from route handlers, server components
 * and scripts. It is never imported into a client component, therefore the
 * MONGODB_URI never reaches the browser bundle.
 */

interface MongooseCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __evisionMongoose: MongooseCache | undefined;
}

const MONGODB_CONFIG: mongoose.ConnectOptions = {
  dbName: MONGODB_DATABASE,
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 8_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  retryWrites: true,
  compressors: ['zlib'],
  family: 4,
};

export async function connectToDatabase(): Promise<Connection> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured — database access is unavailable.');
  }

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection;
  }

  const cache: MongooseCache = global.__evisionMongoose ?? { conn: null, promise: null };
  global.__evisionMongoose = cache;

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = mongoose
    .connect(MONGODB_URI, MONGODB_CONFIG)
    .then((m) => {
      cache.conn = m.connection;
      return m.connection;
    })
    .catch((err) => {
      cache.promise = null;
      cache.conn = null;
      throw err;
    });

  return cache.promise;
}

/** True when a MongoDB URI has been supplied to the runtime environment. */
export function isDatabaseConfigured(): boolean {
  return Boolean(MONGODB_URI);
}

/**
 * Health probe used by the device page and the /api/health route. Never
 * throws — a failed probe is reported, not raised.
 */
export async function databaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  state: string;
  host: string;
  database: string;
  latencyMs: number | null;
  error: string | null;
  poolSize: number;
}> {
  const base = {
    configured: isDatabaseConfigured(),
    connected: false,
    state: 'disconnected',
    host: '—',
    database: MONGODB_URI ? MONGODB_URI.split('/').pop()?.split('?')[0] ?? '—' : '—',
    latencyMs: null as number | null,
    error: null as string | null,
    poolSize: 0,
  };

  if (!base.configured) {
    return { ...base, state: 'not-configured', error: 'MONGODB_URI missing' };
  }

  try {
    const t0 = Date.now();
    const conn = await connectToDatabase();
    const latencyMs = Date.now() - t0;
    if (!conn.db) throw new Error('No active database handle');
    await conn.db.admin().command({ ping: 1 });
    return {
      ...base,
      connected: true,
      state: 'connected',
      host: conn.host ?? 'atlas',
      latencyMs,
      poolSize: mongoose.connections.reduce((acc, c) => acc + ((c as unknown as { poolSize?: number }).poolSize ?? 0), 0),
    };
  } catch (err) {
    return { ...base, state: 'error', error: err instanceof Error ? err.message : 'Unknown connection error' };
  }
}

/** Disconnect gracefully (used by the seed script and local teardown). */
export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (global.__evisionMongoose) {
    global.__evisionMongoose = { conn: null, promise: null };
  }
}
