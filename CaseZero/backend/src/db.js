import mongoose from 'mongoose';

/**
 * Safely masks database credentials from a connection string for logging.
 */
export function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '<empty>';
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '****';
    }
    if (parsed.username) {
      parsed.username = parsed.username.slice(0, 2) + '***';
    }
    return parsed.toString();
  } catch {
    // Fallback regex masking for non-standard URIs
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  }
}

/**
 * Diagnostic analysis of MongoDB connection errors
 */
export function diagnoseMongoError(err) {
  const msg = err?.message || String(err);
  const code = err?.code || '';

  if (msg.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') || msg.includes('SSL alert number 80')) {
    return 'TLS handshake terminated by MongoDB Atlas (SSL alert 80). Atlas drops TLS connections from unrecognized IPs. Check MongoDB Atlas -> Network Access and add 0.0.0.0/0 (Allow Access from Anywhere) for Render dynamic IPs.';
  }
  if (msg.includes('querySrv ENOTFOUND') || msg.includes('ENOTFOUND')) {
    return 'DNS lookup failed for MongoDB host. Check that MONGO_URI has a valid Atlas cluster hostname and that username/password do not contain unencoded special characters like @, #, or :.';
  }
  if (msg.includes('Authentication failed') || msg.includes('bad auth')) {
    return 'MongoDB authentication failed. Verify the Database User username and password in MongoDB Atlas -> Database Access (note: this is the DB user, not your Atlas web login).';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('Server selection timed out')) {
    return 'Connection timed out while selecting MongoDB server. Atlas cluster may be paused, network access may be blocked, or cluster is unreachable.';
  }
  return `MongoDB connection error: ${msg}${code ? ` (Code: ${code})` : ''}`;
}

export async function connectDB(mongoUri) {
  if (!mongoUri) {
    console.error('[Database] FATAL: MONGO_URI environment variable is not defined.');
    return false;
  }

  const sanitized = sanitizeMongoUri(mongoUri);
  console.log(`[Database] Connecting to MongoDB: ${sanitized}...`);

  mongoose.connection.on('connected', () => {
    console.log('[Database] MongoDB connection established successfully.');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Database] MongoDB connection restored.');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[Database] MongoDB connection error: ${diagnoseMongoError(err)}`);
  });

  const connectionOptions = {
    serverSelectionTimeoutMS: 10000, // Fail fast (10s) instead of hanging 30s
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    retryWrites: true
  };

  try {
    await mongoose.connect(mongoUri, connectionOptions);
    return true;
  } catch (err) {
    console.error(`[Database] Failed initial connection to MongoDB:`);
    console.error(`[Database] Reason: ${diagnoseMongoError(err)}`);
    return false;
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function getDbState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}
