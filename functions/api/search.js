import { searchDocs } from "../../src/docs-kb.mjs";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";

  try {
    const results = searchDocs(q);
    return json({ query: q, count: results.length, results }, 200);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
