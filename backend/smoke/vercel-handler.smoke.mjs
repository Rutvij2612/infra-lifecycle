// Verification that the Vercel serverless handler (api/index.ts) initializes and serves requests correctly.
import handler from '../../api/index.ts';
import http from 'http';

// Create a local test server using the exact Vercel handler
const server = http.createServer(handler);

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Vercel serverless handler test server listening on ephemeral port ${port}`);

  try {
    // 1. Health check via /api/health
    const resHealth = await fetch(`http://localhost:${port}/api/health`);
    const healthJson = await resHealth.json();
    console.log(`GET /api/health -> ${resHealth.status}`, healthJson);
    if (resHealth.status !== 200 || healthJson.status !== 'ok') {
      throw new Error('Health check failed on Vercel handler');
    }

    // 2. Health check via /health directly (handling fallback rewrite)
    const resRootHealth = await fetch(`http://localhost:${port}/health`);
    const rootHealthJson = await resRootHealth.json();
    console.log(`GET /health -> ${resRootHealth.status}`, rootHealthJson);
    if (resRootHealth.status !== 200 || rootHealthJson.status !== 'ok') {
      throw new Error('Direct route failed on Vercel handler');
    }

    // 3. Auth login check
    const resLogin = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'officer@demo.local', password: 'Demo@12345' }),
    });
    const loginJson = await resLogin.json();
    console.log(`POST /api/auth/login -> ${resLogin.status}`, loginJson.data ? `User: ${loginJson.data.user.email}` : loginJson);
    if (resLogin.status !== 200 || !loginJson.data?.token) {
      throw new Error('Auth login failed on Vercel handler');
    }

    const token = loginJson.data.token;

    // 4. Representative asset API check
    const resAssets = await fetch(`http://localhost:${port}/api/assets?limit=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const assetsJson = await resAssets.json();
    console.log(`GET /api/assets -> ${resAssets.status}`, `Found ${assetsJson.data?.length} assets`);
    if (resAssets.status !== 200 || !Array.isArray(assetsJson.data)) {
      throw new Error('Asset list failed on Vercel handler');
    }

    // 5. Representative lifecycle validation check (reject invalid transition PLANNED -> DECOMMISSIONED)
    const plannedAsset = assetsJson.data.find(a => a.lifecycle_status === 'PLANNED') || assetsJson.data[0];
    if (plannedAsset) {
      const resInvalid = await fetch(`http://localhost:${port}/api/assets/${plannedAsset.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: 'DECOMMISSIONED', event_date: '2026-09-28', title: 'Invalid' }),
      });
      const invalidJson = await resInvalid.json();
      console.log(`POST invalid lifecycle transition -> ${resInvalid.status}`, invalidJson.error?.code);
      if (plannedAsset.lifecycle_status === 'PLANNED' && invalidJson.error?.code !== 'INVALID_LIFECYCLE_TRANSITION') {
        throw new Error('Lifecycle validation failed on Vercel handler');
      }
    }

    console.log('\n ALL VERCEL SERVERLESS HANDLER CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\n Vercel serverless handler check failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
