import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use PostgreSQL driver for Docker production or Neon for development
let pool: any;
let db: any;

if (process.env.USE_PG_DRIVER === 'true' || (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL.includes('@db:'))) {
  // Docker/PostgreSQL environment
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  db = drizzle(pool, { schema });
  console.log('Using PostgreSQL driver for database connection');
} else {
  // Development/Neon environment
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
  const ws = await import('ws');
  
  neonConfig.webSocketConstructor = ws.default;
  
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool, schema });
  console.log('Using Neon driver for database connection');
}

export { pool, db };
