import { json, openAIResponse, outputText, readBody, requireMethod, requireSupabaseUser } from "./_utils.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  const user = await requireSupabaseUser(req, res);
  if (!user) return;

  try {
    const { message, history = [], profile = {}, today = {}, recovery = null } = await readBody(req);
    if (!message || typeof message !== "string") {
      return json(res, 400, { error: "message is required" });
    }

    const safeHistory = history.slice(-12).map(entry => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: String(entry.text || "").slice(0, 2000)
    }));

    const instructions = [
      "You are IRONLOG Coach, a direct and encouraging fitness, nutrition, and recovery coach.",
      "Give practical answers personalized to the user's profile and logged day.",
      "Keep answers under 180 words unless the user asks for a detailed plan.",
      "Do not diagnose disease or replace a doctor. For injury, illness, pregnancy, eating disorders, or severe symptoms, recommend professional care.",
      "Do not claim unlimited medical certainty. Be clear when something is an estimate."
    ].join(" ");

    const context = {
      profile,
      today,
      recovery,
      note: "Use this context to personalize the answer."
    };

    const response = await openAIResponse({
      instructions,
      input: [
        { role: "system", content: JSON.stringify(context) },
        ...safeHistory,
        { role: "user", content: message }
      ]
    });

    json(res, 200, { reply: outputText(response) || "I could not generate a reply. Try again." });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
