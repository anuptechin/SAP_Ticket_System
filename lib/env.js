// Load .env before any other module reads process.env (imported first by server.js).
try { process.loadEnvFile('.env'); } catch { /* no .env file — rely on the real environment */ }
