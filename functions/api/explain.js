import { explainFunction } from "../../src/docs-kb.mjs";

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

  let query = url.searchParams.get("q") || url.searchParams.get("function");

  if (request.method === "POST") {
    try {
      const body = await request.json();
      query = body.functionQuery || body.q || query;
    } catch {
      // ignore
    }
  }

  if (!query) {
    return json({ error: "Query parameter 'q' or 'functionQuery' is required." }, 400);
  }

  try {
    const doc = explainFunction(query);
    return json(doc, 200);
  } catch (error) {
    return json({ error: error.message }, 404);
  }
}
