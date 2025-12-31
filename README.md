# AciTracker Gateway

Secure gateway proxy for the AciTracker backend with bearer token authentication and in-memory caching.

## Features

- Bearer token authentication on all routes
- In-memory response caching (configurable TTL)
- Read-only GET endpoints only
- Security hardening (header size limits, no generic proxy)
- Allowlist-based route forwarding

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GATEWAY_BEARER_TOKEN` | Yes | - | Bearer token for authenticating requests |
| `PORT` | No | `10000` | Port to listen on |
| `CACHE_TTL_MS` | No | `30000` | Cache TTL in milliseconds (30 seconds) |

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file or set environment variables:
```bash
export GATEWAY_BEARER_TOKEN="your-secret-token-here"
export PORT=10000
export CACHE_TTL_MS=30000
```

3. Start the server:
```bash
npm start
```

Or use watch mode for development:
```bash
npm run dev
```

## Available Endpoints

All endpoints require the `Authorization: Bearer <token>` header.

- `GET /health` - Health check (JSON)
- `GET /report` - Report data (Markdown)
- `GET /manifest` - Manifest data (JSON)
- `GET /new` - New entries (CSV)
- `GET /api/must-reads` - Must-read items (JSON)
- `GET /api/must-reads/md` - Must-read items (Markdown)
- `GET /api/summaries` - Summaries (JSON)

## Usage Examples

### Health Check
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  http://localhost:10000/health
```

### Get Report
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  http://localhost:10000/report
```

### Get Must-Reads
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  http://localhost:10000/api/must-reads
```

### Get Summaries
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  http://localhost:10000/api/summaries
```

## Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variable:
   - `GATEWAY_BEARER_TOKEN`: Your secret bearer token
5. Optional environment variables:
   - `CACHE_TTL_MS`: Cache duration in milliseconds
6. Deploy

Your service will be available at: `https://your-service-name.onrender.com`

## ChatGPT Custom GPT Action Setup

To use this gateway with a ChatGPT Custom GPT:

1. Deploy the gateway to Render (or another hosting platform)
2. Note your deployed URL: `https://your-service-name.onrender.com`
3. In ChatGPT Custom GPT settings, go to "Actions"
4. Set the **Server URL** to your deployed gateway URL
5. Configure **Authentication**:
   - Type: **Bearer**
   - Token: Your `GATEWAY_BEARER_TOKEN` value
6. Add actions for each endpoint you want to use:

Example action schema:
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "AciTracker Gateway",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://your-service-name.onrender.com"
    }
  ],
  "paths": {
    "/health": {
      "get": {
        "operationId": "getHealth",
        "summary": "Get health status"
      }
    },
    "/api/must-reads": {
      "get": {
        "operationId": "getMustReads",
        "summary": "Get must-read items"
      }
    },
    "/api/summaries": {
      "get": {
        "operationId": "getSummaries",
        "summary": "Get summaries"
      }
    }
  }
}
```

7. Test the action in the GPT builder

## Security Notes

- Only GET requests are allowed (405 for other methods)
- Requests with headers exceeding 8KB are rejected
- No generic proxy routes - only allowlisted endpoints
- Bearer token required on all routes
- Upstream headers are not forwarded (except User-Agent)

## Cache Behavior

- Responses are cached in-memory per route
- Cache key is the request path
- Cache TTL is configurable via `CACHE_TTL_MS`
- Response includes `X-Cache: HIT` or `X-Cache: MISS` header
- Cache is process-local (resets on restart)

## Upstream Backend

Proxies to: `https://acitracker-backend.onrender.com`
