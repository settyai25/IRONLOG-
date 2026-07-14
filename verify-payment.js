import crypto from "node:crypto";
import { json, readBody, requireMethod } from "./_utils.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = "monthly"
    } = await readBody(req);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(res, 400, { error: "Missing Razorpay payment fields" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return json(res, 500, { error: "Razorpay secret is not configured" });

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return json(res, 400, { error: "Payment signature verification failed" });
    }

    const now = new Date();
    const accessUntil = new Date(now);
    accessUntil.setDate(accessUntil.getDate() + (plan === "yearly" ? 365 : 31));

    json(res, 200, {
      ok: true,
      plan,
      paymentId: razorpay_payment_id,
      accessUntil: accessUntil.toISOString()
    });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
