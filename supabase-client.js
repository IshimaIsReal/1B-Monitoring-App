(() => {
    const config = window.MONITOR_SUPABASE_CONFIG || {};
    const hasProjectUrl = typeof config.url === 'string'
        && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url);
    const hasPublishableKey = typeof config.anonKey === 'string'
        && config.anonKey.length > 20
        && !config.anonKey.includes('YOUR_');

    window.monitorSupabaseConfigured = hasProjectUrl && hasPublishableKey;

    if (!window.monitorSupabaseConfigured) {
        window.monitorSupabaseError = 'Shared storage is not configured. Add your Supabase URL and publishable key to supabase-config.js, then follow SUPABASE_SETUP.md.';
        return;
    }
    if (typeof window.supabase?.createClient !== 'function') {
        window.monitorSupabaseError = 'The Supabase client did not load. Check your internet connection and reload the page.';
        return;
    }

    window.monitorSupabase = window.supabase.createClient(config.url, config.anonKey);
})();
