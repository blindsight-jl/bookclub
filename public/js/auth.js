import { supabase } from '/js/supabase-client.js';

function displayName(session) {
	return session.user.email.split('@')[0];
}

function updateNav(session) {
	const nav = document.querySelector('.nav');
	if (!nav) return;

	// Remove any previously injected auth item
	nav.querySelectorAll('.nav-item-auth').forEach(el => el.remove());

	const li = document.createElement('li');
	li.className = 'nav-item nav-item-auth';

	if (session) {
		const span = document.createElement('span');
		span.className = 'nav-user';
		span.textContent = displayName(session);

		const sep = document.createTextNode(' · ');

		const btn = document.createElement('button');
		btn.className = 'nav-logout';
		btn.textContent = 'Logout';
		btn.addEventListener('click', async () => {
			await supabase.auth.signOut();
			window.location.reload();
		});

		li.append(span, sep, btn);
	} else {
		const a = document.createElement('a');
		a.href = '/login/';
		// Mark active if we're on the login page
		if (window.location.pathname === '/login/') {
			a.setAttribute('aria-current', 'page');
		}
		a.textContent = 'Login';
		li.appendChild(a);
	}

	nav.appendChild(li);
}

// Initial state
supabase.auth.getSession().then(({ data: { session } }) => {
	updateNav(session);
});

// Keep in sync on any auth change
supabase.auth.onAuthStateChange((_event, session) => {
	updateNav(session);
});
