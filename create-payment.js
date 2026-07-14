import { basicAuth, json, readBody, requireMethod } from "./_utils.js";

const plans = {
  monthly: { amount: 19900, label: "IRONLOG Monthly", period: "monthly" },
  yearly: { amount: 200000, label: "IRONLOG Yearly", period: "yearly" }
};

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const { plan = "monthly", email = "" } = await readBody(req);
    const selected = plans[plan];
    if (!selected) return json(res, 400, { error: "Invalid plan" });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return json(res, 500, { error: "Razorpay credentials are not configured" });
    }

    const receipt = `ironlog_${plan}_${Date.now()}`.slice(0, 40);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": basicAuth(keyId, keySecret),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: selected.amount,
        currency: "INR",
        receipt,
        notes: {
          product: "IRONLOG",
          plan,
          email
        }
      })
    });

    const order = await response.json();
    if (!response.ok) {
      return json(res, response.status, { error: order.error?.description || "Could not create Razorpay order" });
    }

    json(res, 200, {
      key: keyId,
      orderId: order.id,
      amount: selected.amount,
      currency: "INR",
      name: selected.label,
      plan: selected.period
    });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
