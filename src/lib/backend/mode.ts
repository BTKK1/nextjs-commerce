export type DataBackend = "supabase" | "local";

type BackendEnvironment = {
  DATA_BACKEND?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
};

export function resolveDataBackend(env: BackendEnvironment = process.env): DataBackend {
  if (env.DATA_BACKEND === "local") return "local";
  if (env.DATA_BACKEND === "supabase") return "supabase";
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") return "supabase";
  return "local";
}

export function isSupabaseBackend(env: BackendEnvironment = process.env): boolean {
  return resolveDataBackend(env) === "supabase";
}
