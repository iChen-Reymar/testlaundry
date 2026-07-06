import { supabaseConfigError } from '../lib/supabaseClient.js';

export default function SupabaseConfigGuard({ children }) {
  if (!supabaseConfigError) return children;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-xl border border-red-200 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-red-700 mb-2">Supabase not configured</h1>
        <p className="text-sm text-gray-700 mb-4">{supabaseConfigError}</p>
        <div className="text-sm text-gray-600 space-y-2 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="font-medium text-gray-800">Vercel setup:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open your <strong>laundryapp</strong> project on Vercel</li>
            <li>Settings → Environment Variables</li>
            <li>Add <code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_URL</code></li>
            <li>Add <code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
            <li>Enable Production, Preview, Development</li>
            <li>Redeploy the project</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
