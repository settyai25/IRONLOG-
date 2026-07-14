export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 8_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    json(res, 405, { error: `Use ${method}` });
    return false;
  }
  return true;
}

export function basicAuth(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

// Verifies the caller is a logged-in Supabase user by checking the bearer
// token against Supabase's own /auth/v1/user endpoint. This does not check
// payment/subscription status (that still needs a database — see docs), but
// it closes the "anyone with the URL can call this for free, unlimited"
// hole that existed with no auth check at all.
export async function requireSupabaseUser(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!supabaseUrl || !anonKey) {
    json(res, 500, { error: "Auth is not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing)" });
    return null;
  }
  if (!token) {
    json(res, 401, { error: "Sign in required" });
    return null;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": anonKey }
    });
    if (!resp.ok) {
      json(res, 401, { error: "Sign in required" });
      return null;
    }
    return await resp.json(); // { id, email, ... }
  } catch {
    json(res, 401, { error: "Sign in required" });
    return null;
  }
}

export async function openAIResponse({ input, instructions, textFormat }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input
  };
  if (instructions) payload.instructions = instructions;
  if (textFormat) payload.text = { format: textFormat };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI request failed");
  }
  return data;
}

export function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}
