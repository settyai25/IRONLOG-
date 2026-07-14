import { json } from "./_utils.js";

export default function handler(_req, res) {
  json(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
}
