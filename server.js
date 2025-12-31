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
