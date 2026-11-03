import { runDocsChainAgent } from "../../src/agent.mjs";

const MAX_BODY = 4096;
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?nampharos\.web\.id$/;

// Concurrency guard: limit maximum in-flight requests per isolate
const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;

// Rate limiter: sliding window rate limiter per client IP
const ipRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute

function isRateLimited(clientIp) {
  const now = Date.now();

  // Periodic cleanup if map grows large
  if (ipRateLimits.size > 1000) {
    for (const [ip, timestamps] of ipRateLimits.entries()) {
      const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) ipRateLimits.delete(ip);
      else ipRateLimits.set(ip, valid);
    }
  }

  const timestamps = (ipRateLimits.get(clientIp) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  timestamps.push(now);
  ipRateLimits.set(clientIp, timestamps);
  return false;
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Send POST request." }, 405, { Allow: "POST" });
  }

  const origin = request.headers.get("Origin");
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin && !ALLOWED_ORIGIN.test(origin)) {
    return json({ error: "Cross-origin requests are not accepted." }, 403);
  }

  // Rate Limiting Guard
  const clientIp = request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "default-client";
  if (isRateLimited(clientIp)) {
    return json(
      { error: "Rate limit exceeded. Too many requests, please retry in 1 minute." },
      429,
      { "Retry-After": "60" }
    );
  }

  // Concurrency Guard
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return json(
      { error: "Server is currently at capacity. Please retry shortly." },
      429,
      { "Retry-After": "2" }
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY)) {
    return json({ error: "Request body is too large." }, 413);
  }

  let bodyData;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY) {
      return json({ error: "Request body is too large." }, 413);
    }
    bodyData = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { contractAddress, functionQuery, args = [], allowEoa = false, rawProbe = false } = bodyData || {};
  if (!contractAddress || !functionQuery) {
    return json({ error: "contractAddress and functionQuery are required fields." }, 400);
  }

  activeRequests++;
  try {
    const result = await runDocsChainAgent({
      contractAddress,
      functionQuery,
      args: Array.isArray(args) ? args : [args],
      allowEoa: Boolean(allowEoa || rawProbe),
      rawProbe: Boolean(rawProbe || allowEoa),
      timeoutMs: 25_000
    });
    return json(result, 200);
  } catch (error) {
    const message = String(error?.message || "Agent execution failed.").slice(0, 400);
    return json({ success: false, error: message }, 502);
  } finally {
    activeRequests--;
  }
}
