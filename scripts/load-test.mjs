import http from 'node:http';

const targetBase = process.env.LOAD_TEST_TARGET || 'http://localhost:3000';
const totalRequests = Number(process.env.LOAD_TEST_REQUESTS || 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20);

function makeRequest(path) {
  const url = new URL(path, targetBase);
  const start = process.hrtime.bigint();

  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume(); // discard body
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        resolve({ statusCode: res.statusCode || 0, durationMs });
      });
    });

    req.on('error', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      resolve({ statusCode: 0, durationMs });
    });
  });
}

async function runLoadTest() {
  console.log(`[load] Target: ${targetBase}/health`);
  console.log(`[load] Total requests: ${totalRequests}, concurrency: ${concurrency}`);

  let completed = 0;
  let failed = 0;
  let sum = 0;
  let max = 0;

  const worker = async () => {
    while (true) {
      const current = completed + failed;
      if (current >= totalRequests) break;

      const { statusCode, durationMs } = await makeRequest('/health');
      if (statusCode >= 200 && statusCode < 400) {
        completed++;
      } else {
        failed++;
      }
      sum += durationMs;
      if (durationMs > max) max = durationMs;
    }
  };

  const workers = [];
  const workerCount = Math.min(concurrency, totalRequests);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  const startAll = Date.now();
  await Promise.all(workers);
  const totalDuration = Date.now() - startAll;

  const total = completed + failed;
  const avg = total > 0 ? sum / total : 0;

  console.log('\n[load] Results');
  console.log(`  Requests:       ${total}`);
  console.log(`  Success:        ${completed}`);
  console.log(`  Failed:         ${failed}`);
  console.log(`  Avg latency:    ${avg.toFixed(2)} ms`);
  console.log(`  Max latency:    ${max.toFixed(2)} ms`);
  console.log(`  Total duration: ${totalDuration} ms`);
}

runLoadTest().catch((err) => {
  console.error('[load] Error during load test:', err);
  process.exit(1);
});

