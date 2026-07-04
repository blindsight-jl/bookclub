import { supabase } from '/js/supabase-client.js';

const featureContainer = document.getElementById('book-feature');
const previousSection = document.getElementById('previous-books');
const grid = document.getElementById('book-grid');

function formatMonth(dateStr) {
	if (!dateStr) return '';
	const [year, month] = dateStr.split('-');
	return new Date(parseInt(year), parseInt(month) - 1, 1)
		.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function buildRating(avg) {
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
	return ratingEl;
}

function buildFeature(book, avg) {
	const a = document.createElement('a');
	a.href = `/book/?slug=${book.slug}`;
	a.className = 'book-feature-link';

	if (book.cover_url) {
		const img = document.createElement('img');
		img.src = book.cover_url;
		img.alt = `Cover of ${book.title}`;
		img.className = 'book-feature-cover';
		a.appendChild(img);
	}

	const info = document.createElement('div');
	info.className = 'book-feature-info';

	const eyebrow = document.createElement('p');
	eyebrow.className = 'book-feature-eyebrow';
	eyebrow.textContent = book.month_read ? formatMonth(book.month_read) : 'Latest read';

	const titleEl = document.createElement('p');
	titleEl.className = 'book-feature-title';
	titleEl.textContent = book.title;

	const authorEl = document.createElement('p');
	authorEl.className = 'book-feature-author';
	authorEl.textContent = book.author;

	info.append(eyebrow, titleEl, authorEl);
	if (avg !== undefined) info.appendChild(buildRating(avg));

	a.appendChild(info);
	return a;
}

function buildCard(book, avg) {
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
	if (avg !== undefined) info.appendChild(buildRating(avg));

	a.appendChild(info);
	return a;
}

async function init() {
	const [{ data: books }, { data: ratings }] = await Promise.all([
		supabase.from('books').select('slug, title, author, cover_url, month_read').order('month_read', { ascending: false }).order('created_at', { ascending: false }).limit(5),
		supabase.from('ratings').select('book_slug, rating'),
	]);

	featureContainer.innerHTML = '';

	if (!books || books.length === 0) {
		featureContainer.innerHTML = '<p class="loading-message">No books yet.</p>';
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

	const [latest, ...previous] = books;
	featureContainer.appendChild(buildFeature(latest, avgBySlug[latest.slug]));

	if (previous.length > 0) {
		for (const book of previous) {
			grid.appendChild(buildCard(book, avgBySlug[book.slug]));
		}
		previousSection.hidden = false;
	}
}

init();
