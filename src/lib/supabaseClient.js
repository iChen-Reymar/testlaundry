import { createClient } from '@supabase/supabase-js';

function readConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim() || '';
  return { url, key };
}

export const supabaseConfigError = (() => {
  const { url, key } = readConfig();

  if (!url && !key) {
    return 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.';
  }
  if (!url) {
    return 'VITE_SUPABASE_URL is missing. Add it in Vercel Environment Variables (e.g. https://zqlxsnhgqmdjhjmlvicb.supabase.co), then redeploy.';
  }
  if (!key) {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY is missing. Add your Supabase publishable/anon key in Vercel Environment Variables, then redeploy.';
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
    return `VITE_SUPABASE_URL looks invalid: "${url}". Copy the exact Project URL from Supabase → Project Settings → API.`;
  }
  return null;
})();

let client = null;

function getClient() {
  if (client) return client;

  const { url, key } = readConfig();
  if (!url || !key) {
    throw new Error(supabaseConfigError || 'Supabase is not configured.');
  }

  client = createClient(url, key);
  return client;
}

/** Lazy client — avoids crash at import when env vars are missing on Vercel. */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = getClient()[prop];
      return typeof value === 'function' ? value.bind(getClient()) : value;
    },
  }
);

export default supabase;
