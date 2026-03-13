import 'dotenv/config';
import assert from 'node:assert';
import http from 'node:http';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function request(method, path, options = {}) {
  const url = new URL(path, API_URL);
  const body = options.body ? JSON.stringify(options.body) : null;

  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode || 0, body: json });
        } catch {
          resolve({ statusCode: res.statusCode || 0, body: null });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log(`Running basic API tests against ${API_URL}`);

  // 1. Health check
  {
    const res = await request('GET', '/health');
    assert.strictEqual(res.statusCode, 200, 'Health endpoint should return 200');
    assert.ok(res.body && res.body.ok === true, 'Health response should contain ok: true');
    console.log('✓ /health OK');
  }

  // 2. Register + login flow (happy path)
  const email = `test_${Date.now()}@example.com`;
  const password = 'password123';

  {
    const res = await request('POST', '/auth/register', {
      body: { email, password, name: 'Test User' },
    });
    assert.strictEqual(res.statusCode, 201, 'Register should return 201');
    console.log('✓ /auth/register OK');
  }

  let token;
  {
    const res = await request('POST', '/auth/login', {
      body: { email, password },
    });
    assert.strictEqual(res.statusCode, 200, 'Login should return 200');
    assert.ok(res.body && res.body.token, 'Login response should contain token');
    token = res.body.token;
    console.log('✓ /auth/login OK');
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 3. Create + list product
  let productId;
  {
    const res = await request('POST', '/products', {
      headers: authHeaders,
      body: {
        url: 'https://example.com/product',
        store: 'demo',
      },
    });
    assert.strictEqual(res.statusCode, 201, 'Create product should return 201');
    assert.ok(res.body && res.body.id, 'Created product should have id');
    productId = res.body.id;
    console.log('✓ POST /products OK');
  }

  {
    const res = await request('GET', '/products', {
      headers: authHeaders,
    });
    assert.strictEqual(res.statusCode, 200, 'List products should return 200');
    assert.ok(Array.isArray(res.body), 'List products should return array');
    console.log('✓ GET /products OK');
  }

  // 4. Product detail
  {
    const res = await request('GET', `/products/${productId}`, {
      headers: authHeaders,
    });
    assert.strictEqual(res.statusCode, 200, 'Product detail should return 200');
    assert.ok(res.body && res.body.product && res.body.product.id === productId, 'Product detail should contain product');
    console.log('✓ GET /products/:id OK');
  }

  console.log('All basic API tests passed.');
}

run().catch((err) => {
  console.error('Tests failed:', err);
  process.exit(1);
});

