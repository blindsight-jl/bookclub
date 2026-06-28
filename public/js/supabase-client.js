import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
	throw new Error('Supabase credentials not found. Check your .env file.');
}

export const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
