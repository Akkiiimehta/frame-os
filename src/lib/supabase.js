import { createClient } from "@supabase/supabase-js";

// ✅ Environment variables are injected at build time
// Add these to .env.local (local dev) or Netlify UI (production)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that env vars exist
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Make sure .env.local has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: Check if client is ready
export const isSupabaseReady = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
