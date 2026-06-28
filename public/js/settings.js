import { supabase } from '/js/supabase-client.js';

const form = document.getElementById('settings-form');
const nameInput = document.getElementById('display-name');
const feedback = document.getElementById('settings-feedback');

async function init() {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		window.location.href = '/login/';
		return;
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('username')
		.eq('id', session.user.id)
		.maybeSingle();

	nameInput.value = profile?.username || session.user.email.split('@')[0];

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const btn = form.querySelector('button[type="submit"]');
		const username = nameInput.value.trim();

		if (!username) {
			showFeedback('Display name cannot be empty.', 'form-error');
			return;
		}

		btn.disabled = true;
		btn.textContent = 'Saving…';
		feedback.textContent = '';
		feedback.className = '';

		let error;
		if (profile) {
			({ error } = await supabase
				.from('profiles')
				.update({ username })
				.eq('id', session.user.id));
		} else {
			({ error } = await supabase
				.from('profiles')
				.insert({ id: session.user.id, username }));
		}

		btn.disabled = false;
		btn.textContent = 'Save';

		if (error) {
			console.error('Profile save failed:', error);
			showFeedback('Failed to save. Please try again.', 'form-error');
		} else {
			showFeedback('Saved!', 'form-success');
		}
	});
}

function showFeedback(message, className) {
	feedback.textContent = message;
	feedback.className = className;
}

init();
