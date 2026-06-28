import { supabase } from '/js/supabase-client.js';

async function guard() {
	if (window.location.pathname === '/login/') {
		document.documentElement.style.visibility = '';
		return;
	}

	try {
		const { data: { session } } = await supabase.auth.getSession();
		if (session) {
			document.documentElement.style.visibility = '';
		} else {
			window.location.href = '/login/';
		}
	} catch (e) {
		console.error('Auth guard failed:', e);
		document.documentElement.style.visibility = '';
	}
}

guard();
