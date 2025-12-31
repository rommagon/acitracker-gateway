import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;
const UPSTREAM_BASE = 'https://acitracker-backend.onrender.com';
const GATEWAY_BEARER_TOKEN = process.env.GATEWAY_BEARER_TOKEN;
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '30000', 10);
const MAX_HEADER_SIZE = 8192;

const cache = new Map();

const ALLOWED_ROUTES = {
  '/health': { upstream: '/health', contentType: 'application/json' },
  '/report': { upstream: '/report', contentType: 'text/markdown' },
  '/manifest': { upstream: '/manifest', contentType: 'application/json' },
  '/new': { upstream: '/new', contentType: 'text/csv' },
  '/api/must-reads': { upstream: '/api/must-reads', contentType: 'application/json' },
  '/api/must-reads/md': { upstream: '/api/must-reads/md', contentType: 'text/markdown' },
  '/api/summaries': { upstream: '/api/summaries', contentType: 'application/json' }
};

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!GATEWAY_BEARER_TOKEN) {
    return res.status(500).json({ error: 'Server configuration error: GATEWAY_BEARER_TOKEN not set' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  if (token !== GATEWAY_BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function checkHeaderSize(req, res, next) {
  const headerSize = JSON.stringify(req.headers).length;
  if (headerSize > MAX_HEADER_SIZE) {
    return res.status(413).json({ error: 'Request headers too large' });
  }
  next();
}

function getCacheKey(path) {
  return path;
}

function getCachedResponse(path) {
  const key = getCacheKey(path);
  const cached = cache.get(key);

  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return cached;
}

function setCachedResponse(path, status, contentType, body) {
  const key = getCacheKey(path);
  cache.set(key, {
    timestamp: Date.now(),
    status,
    contentType,
    body
  });
}

async function forwardGet(upstreamPath, defaultContentType) {
  const url = `${UPSTREAM_BASE}${upstreamPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'AciTracker-Gateway/1.0'
    }
  });

  const contentType = response.headers.get('content-type') || defaultContentType;
  const body = await response.text();

  return {
    status: response.status,
    contentType,
    body
  };
}

app.use(express.json({ limit: '1kb' }));
app.use(checkHeaderSize);

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
});

app.get('/privacy', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AciTrack GPT Privacy Policy</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #34495e;
      margin-top: 30px;
    }
    p {
      margin: 10px 0;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin: 5px 0;
    }
    .contact {
      margin-top: 30px;
      padding: 15px;
      background-color: #f8f9fa;
      border-left: 4px solid #3498db;
    }
  </style>
</head>
<body>
  <h1>AciTrack GPT Privacy Policy</h1>

  <p><strong>Last Updated:</strong> December 31, 2025</p>

  <h2>1. Data Processing</h2>
  <p>When you use the AciTrack GPT, the following data may be processed:</p>
  <ul>
    <li>User prompts sent through ChatGPT may be transmitted to the AciTrack Gateway API</li>
    <li>Requests are used solely to retrieve read-only AciTrack content, including reports, manifests, CSV files, and summaries</li>
    <li>No user-specific data is extracted or analyzed beyond what is necessary to fulfill your request</li>
  </ul>

  <h2>2. Data Storage</h2>
  <p>The AciTrack Gateway maintains minimal data storage practices:</p>
  <ul>
    <li>User prompts and request content are not intentionally stored by this service</li>
    <li>Basic operational logs may be retained temporarily, including:
      <ul>
        <li>Request timestamps</li>
        <li>Endpoints accessed</li>
        <li>HTTP status codes</li>
      </ul>
    </li>
    <li>These logs are maintained solely for reliability monitoring, debugging, and security purposes</li>
    <li>Response data may be cached in-memory for up to 30 seconds to improve performance</li>
  </ul>

  <h2>3. Data Sharing</h2>
  <p>We respect your privacy and handle your data responsibly:</p>
  <ul>
    <li>We do not sell user data to third parties</li>
    <li>Data is not shared with external parties except as required to operate the service (e.g., communication with the upstream AciTrack backend)</li>
    <li>We may disclose data if required by law or to protect the security and integrity of the service</li>
  </ul>

  <h2>4. Third-Party Services</h2>
  <p>This service interacts with:</p>
  <ul>
    <li><strong>OpenAI ChatGPT:</strong> Your prompts are processed according to OpenAI's privacy policy</li>
    <li><strong>AciTrack Backend:</strong> Requests are forwarded to retrieve public AciTrack data</li>
  </ul>

  <h2>5. Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>Request information about data processing</li>
    <li>Request deletion of any stored data</li>
    <li>Opt out of using this service at any time</li>
  </ul>

  <div class="contact">
    <h2>6. Contact Information</h2>
    <p>For questions or concerns about this privacy policy, please contact:</p>
    <p><strong>Email:</strong> <a href="mailto:contact@acitrack.example">contact@acitrack.example</a></p>
  </div>

  <p style="margin-top: 40px; font-size: 0.9em; color: #7f8c8d;">
    This privacy policy applies to the AciTrack Gateway service. Please also review the privacy policies of OpenAI and the AciTrack platform for comprehensive information about data handling.
  </p>
</body>
</html>`;

  res.status(200).set('Content-Type', 'text/html').send(html);
});

Object.keys(ALLOWED_ROUTES).forEach(route => {
  app.get(route, requireAuth, async (req, res) => {
    try {
      const cached = getCachedResponse(route);
      if (cached) {
        res.status(cached.status);
        res.set('Content-Type', cached.contentType);
        res.set('X-Cache', 'HIT');
        return res.send(cached.body);
      }

      const routeConfig = ALLOWED_ROUTES[route];
      const result = await forwardGet(routeConfig.upstream, routeConfig.contentType);

      setCachedResponse(route, result.status, result.contentType, result.body);

      res.status(result.status);
      res.set('Content-Type', result.contentType);
      res.set('X-Cache', 'MISS');
      res.send(result.body);

    } catch (error) {
      console.error(`Error forwarding ${route}:`, error.message);
      res.status(502).json({ error: 'Bad gateway' });
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`AciTracker Gateway listening on port ${PORT}`);
  console.log(`Upstream: ${UPSTREAM_BASE}`);
  console.log(`Cache TTL: ${CACHE_TTL_MS}ms`);
  console.log(`Bearer token configured: ${!!GATEWAY_BEARER_TOKEN}`);
});
