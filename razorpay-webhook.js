import crypto from "node:crypto";
import { json } from "./_utils.js";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST" });

  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const raw = await readRawBody(req);

    if (secret) {
      const signature = req.headers["x-razorpay-signature"];
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (signature !== expected) return json(res, 400, { error: "Invalid webhook signature" });
    }

    const event = JSON.parse(raw.toString("utf8"));
    console.log("Razorpay webhook:", event.event, event.payload?.payment?.entity?.id || "");
    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
