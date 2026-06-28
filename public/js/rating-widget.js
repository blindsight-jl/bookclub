import { supabase } from '/js/supabase-client.js';

const slug = window.BOOK_SLUG;
const container = document.getElementById('rating-widget');

let state = { allRatings: [], myRating: 0, session: null };

function avgText() {
	const n = state.allRatings.length;
	if (!n) return 'No ratings yet';
	const avg = state.allRatings.reduce((sum, r) => sum + r.rating, 0) / n;
	return `${avg.toFixed(1)} · ${n} rating${n !== 1 ? 's' : ''}`;
}

function buildStars(filledUpTo, interactive) {
	const wrap = document.createElement('div');
	wrap.className = 'rating-stars';

	for (let i = 1; i <= 5; i++) {
		const el = document.createElement(interactive ? 'button' : 'span');
		el.className = 'star' + (filledUpTo >= i ? ' filled' : '');
		el.textContent = '★';

		if (interactive) {
			el.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
			el.dataset.value = String(i);

			el.addEventListener('mouseenter', () => {
				wrap.querySelectorAll('.star').forEach(s =>
					s.classList.toggle('filled', Number(s.dataset.value) <= i)
				);
			});
			el.addEventListener('mouseleave', () => {
				wrap.querySelectorAll('.star').forEach(s =>
					s.classList.toggle('filled', Number(s.dataset.value) <= state.myRating)
				);
			});
			el.addEventListener('click', () => submitRating(i));
		}

		wrap.appendChild(el);
	}
	return wrap;
}

function render() {
	container.innerHTML = '';

	const { session, myRating, allRatings } = state;
	const interactive = Boolean(session);

	// Logged-in users see their own rating; guests see the rounded average
	const displayFilled = interactive
		? myRating
		: Math.round(allRatings.reduce((s, r) => s + r.rating, 0) / (allRatings.length || 1));

	container.appendChild(buildStars(allRatings.length ? displayFilled : 0, interactive));

	const summary = document.createElement('p');
	summary.className = 'rating-summary';
	summary.textContent = avgText();
	container.appendChild(summary);

	if (!interactive) {
		const prompt = document.createElement('p');
		prompt.className = 'rating-login-prompt';
		prompt.innerHTML = '<a href="/login/">Login</a> to rate';
		container.appendChild(prompt);
	}
}

async function submitRating(newRating) {
	const { session } = state;
	if (!session) return;

	// Optimistic update
	const prevRating = state.myRating;
	const prevRatings = state.allRatings.slice();
	state.myRating = newRating;
	const idx = state.allRatings.findIndex(r => r.user_id === session.user.id);
	if (idx >= 0) {
		state.allRatings[idx] = { ...state.allRatings[idx], rating: newRating };
	} else {
		state.allRatings = [...state.allRatings, { user_id: session.user.id, rating: newRating }];
	}
	render();

	// Delete any existing rating then insert — simpler than upsert with composite conflict
	const { error: delErr } = await supabase
		.from('ratings')
		.delete()
		.eq('book_slug', slug)
		.eq('user_id', session.user.id);

	if (delErr) {
		console.error('Rating delete failed:', delErr.message, delErr);
		state.myRating = prevRating;
		state.allRatings = prevRatings;
		render();
		return;
	}

	const { error: insErr } = await supabase
		.from('ratings')
		.insert({ user_id: session.user.id, book_slug: slug, rating: newRating });

	if (insErr) {
		console.error('Rating insert failed:', insErr.message, insErr);
		state.myRating = prevRating;
		state.allRatings = prevRatings;
		render();
	}
}

async function init() {
	container.innerHTML = '<p class="rating-loading">…</p>';

	const [{ data: ratings }, { data: { session } }] = await Promise.all([
		supabase.from('ratings').select('rating, user_id').eq('book_slug', slug),
		supabase.auth.getSession(),
	]);

	state.allRatings = ratings || [];
	state.session = session;
	state.myRating = session
		? (state.allRatings.find(r => r.user_id === session.user.id)?.rating ?? 0)
		: 0;

	render();
}

init();
