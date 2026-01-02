import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Supabase Client Configuration
// =============================================================================
// Two clients are provided:
// 1. `supabase` (anon) - For client-side operations, respects RLS
// 2. `supabaseAdmin` (service role) - For server-side operations, bypasses RLS
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// =============================================================================
// Public Client (Anon Key)
// =============================================================================
// Use this client for:
// - Client-side operations
// - Operations that should respect Row-Level Security (RLS)
// - User-facing API endpoints where tenant isolation is enforced by RLS

const globalForSupabase = globalThis as unknown as {
  supabase: SupabaseClient | undefined;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase;
}

// =============================================================================
// Admin Client (Service Role Key)
// =============================================================================
// Use this client for:
// - Server-side operations that need to bypass RLS
// - Background jobs, cron tasks
// - Admin operations
// - Internal service-to-service calls
//
// ⚠️ NEVER expose this client to the browser or client-side code!

const globalForSupabaseAdmin = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

function createAdminClient(): SupabaseClient | null {
  if (!supabaseServiceRoleKey) {
    // Service role key is optional in some environments (e.g., client-only builds)
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Admin client will not be available.');
    return null;
  }

  // supabaseUrl is validated above, safe to assert non-null here
  return createClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = globalForSupabaseAdmin.supabaseAdmin ?? createAdminClient();

if (process.env.NODE_ENV !== 'production' && supabaseAdmin) {
  globalForSupabaseAdmin.supabaseAdmin = supabaseAdmin;
}

// =============================================================================
// Exports
// =============================================================================

export default supabase;
