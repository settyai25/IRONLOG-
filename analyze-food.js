import { json, openAIResponse, outputText, readBody, requireMethod, requireSupabaseUser } from "./_utils.js";

const foodSchema = {
  type: "json_schema",
  name: "meal_nutrition_estimate",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      foodName: { type: "string" },
      portion: { type: "string" },
      calories: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      fiber_g: { type: "number" },
      keyNutrients: { type: "array", items: { type: "string" }, maxItems: 5 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      notes: { type: "string" }
    },
    required: ["foodName", "portion", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "keyNutrients", "confidence", "notes"]
  }
};

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  const user = await requireSupabaseUser(req, res);
  if (!user) return; // requireSupabaseUser already sent the error response

  try {
    const { imageBase64, mediaType = "image/jpeg", profile = {} } = await readBody(req);
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json(res, 400, { error: "imageBase64 is required" });
    }

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mediaType};base64,${imageBase64}`;

    const response = await openAIResponse({
      instructions: "You are a sports nutritionist. Estimate visible meal nutrition from the photo. Return only valid JSON matching the schema. Be useful but honest about uncertainty.",
      textFormat: foodSchema,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Analyze this meal for a user with this profile: ${JSON.stringify(profile)}.` },
          { type: "input_image", image_url: dataUrl }
        ]
      }]
    });

    json(res, 200, { result: JSON.parse(outputText(response)) });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
