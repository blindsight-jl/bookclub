import { supabase } from '/js/supabase-client.js';

const grid = document.getElementById('book-grid');

async function init() {
	const [{ data: books }, { data: ratings }] = await Promise.all([
		supabase.from('books').select('slug, title, author, cover_url').order('month_read', { ascending: false }).order('created_at', { ascending: false }).limit(4),
		supabase.from('ratings').select('book_slug, rating'),
	]);

	grid.innerHTML = '';

	if (!books || books.length === 0) {
		grid.innerHTML = '<p class="loading-message">No books yet.</p>';
		return;
	}

	const avgBySlug = {};
	if (ratings) {
		const grouped = {};
		for (const r of ratings) {
			if (!grouped[r.book_slug]) grouped[r.book_slug] = [];
			grouped[r.book_slug].push(r.rating);
		}
		for (const [slug, list] of Object.entries(grouped)) {
			avgBySlug[slug] = list.reduce((s, r) => s + r, 0) / list.length;
		}
	}

	for (const book of books) {
		const a = document.createElement('a');
		a.href = `/book/?slug=${book.slug}`;
		a.className = 'book-card';

		if (book.cover_url) {
			const img = document.createElement('img');
			img.src = book.cover_url;
			img.alt = `Cover of ${book.title}`;
			img.className = 'book-card-cover';
			a.appendChild(img);
		}

		const info = document.createElement('div');
		info.className = 'book-card-info';

		const titleEl = document.createElement('span');
		titleEl.className = 'book-card-title';
		titleEl.textContent = book.title;

		const authorEl = document.createElement('span');
		authorEl.className = 'book-card-author';
		authorEl.textContent = book.author;

		info.append(titleEl, authorEl);

		const avg = avgBySlug[book.slug];
		if (avg !== undefined) {
			const ratingEl = document.createElement('div');
			ratingEl.className = 'book-card-rating';
			const stars = document.createElement('span');
			stars.className = 'book-card-stars';
			const filled = Math.round(avg);
			stars.textContent = '★'.repeat(filled) + '☆'.repeat(5 - filled);
			stars.setAttribute('aria-label', `${avg.toFixed(1)} out of 5 stars`);
			const score = document.createElement('span');
			score.className = 'book-card-rating-score';
			score.textContent = avg.toFixed(1);
			ratingEl.append(stars, score);
			info.appendChild(ratingEl);
		}

		a.appendChild(info);
		grid.appendChild(a);
	}
}

init();
