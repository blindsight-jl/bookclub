import { supabase } from '/js/supabase-client.js';

async function init() {
	const { data: ratings } = await supabase
		.from('ratings')
		.select('book_slug, rating');

	if (!ratings || ratings.length === 0) return;

	// Group ratings by book slug
	const bySlug = {};
	for (const r of ratings) {
		if (!bySlug[r.book_slug]) bySlug[r.book_slug] = [];
		bySlug[r.book_slug].push(r.rating);
	}

	for (const [slug, list] of Object.entries(bySlug)) {
		const card = document.querySelector(`.book-card[data-slug="${slug}"]`);
		if (!card) continue;

		const avg = list.reduce((s, r) => s + r, 0) / list.length;
		const filled = Math.round(avg);

		const ratingEl = document.createElement('div');
		ratingEl.className = 'book-card-rating';

		const stars = document.createElement('span');
		stars.className = 'book-card-stars';
		stars.textContent = '★'.repeat(filled) + '☆'.repeat(5 - filled);
		stars.setAttribute('aria-label', `${avg.toFixed(1)} out of 5 stars`);

		const score = document.createElement('span');
		score.className = 'book-card-rating-score';
		score.textContent = avg.toFixed(1);

		ratingEl.append(stars, score);
		card.querySelector('.book-card-info').appendChild(ratingEl);
	}
}

init();
