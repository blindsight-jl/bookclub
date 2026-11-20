import { supabase } from '/js/supabase-client.js';

const tabs = Array.from(document.querySelectorAll('[data-ranking-view]'));
const groupPanel = document.getElementById('group-panel');
const missingPanel = document.getElementById('missing-panel');
const rankingsResults = document.getElementById('rankings-results');
const missingResults = document.getElementById('missing-results');
const rankingsYearHeading = document.getElementById('rankings-year-heading');
const yearFilter = document.getElementById('year-filter');
const yearSelect = document.getElementById('rankings-year');
const missingCount = document.getElementById('missing-count');
const progressText = document.getElementById('rating-progress-text');
const progressBadge = document.getElementById('rating-progress-badge');
const progressTrack = document.getElementById('rating-progress-track');
const progressBar = document.getElementById('rating-progress-bar');
const status = document.getElementById('rankings-status');

const state = {
	books: [],
	ratings: [],
	session: null,
	view: 'group',
	year: null,
	loaded: false,
	loadError: false,
	saving: new Set(),
	errors: new Map(),
};

function yearKey(book) {
	return book.month_read ? book.month_read.slice(0, 4) : 'undated';
}

function yearLabel(key) {
	return key === 'undated' ? 'Undated' : key;
}

function sortedYears(books) {
	return [...new Set(books.map(yearKey))].sort((a, b) => {
		if (a === 'undated') return 1;
		if (b === 'undated') return -1;
		return Number(b) - Number(a);
	});
}

function formatMonth(dateStr) {
	if (!dateStr) return 'Read month not set';
	const [year, month] = dateStr.split('-');
	return new Date(Number(year), Number(month) - 1, 1)
		.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function ratingsByBook() {
	const grouped = new Map();
	for (const rating of state.ratings) {
		if (!grouped.has(rating.book_slug)) grouped.set(rating.book_slug, []);
		grouped.get(rating.book_slug).push(rating);
	}
	return grouped;
}

function missingBooks() {
	if (!state.session) return [];
	return state.books.filter(book => !state.ratings.some(rating =>
		rating.book_slug === book.slug && rating.user_id === state.session.user.id
	));
}

function buildEmptyState(title, description, actionLabel, action) {
	const wrap = document.createElement('div');
	wrap.className = 'rankings-empty';

	const heading = document.createElement('h3');
	heading.textContent = title;
	const text = document.createElement('p');
	text.textContent = description;
	wrap.append(heading, text);

	if (actionLabel && action) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'btn-secondary';
		button.textContent = actionLabel;
		button.addEventListener('click', action);
		wrap.appendChild(button);
	}
	return wrap;
}

function buildCover(book, className) {
	if (book.cover_url) {
		const image = document.createElement('img');
		image.className = className;
		image.src = book.cover_url;
		image.alt = '';
		image.loading = 'lazy';
		return image;
	}

	const placeholder = document.createElement('span');
	placeholder.className = `${className} book-cover-placeholder`;
	placeholder.setAttribute('aria-hidden', 'true');
	placeholder.textContent = book.title.charAt(0).toUpperCase();
	return placeholder;
}

function switchView(view, moveFocus = false) {
	state.view = view;
	for (const tab of tabs) {
		const selected = tab.dataset.rankingView === view;
		tab.setAttribute('aria-selected', String(selected));
		tab.tabIndex = selected ? 0 : -1;
		if (selected && moveFocus) tab.focus();
	}
	groupPanel.hidden = view !== 'group';
	missingPanel.hidden = view !== 'missing';
}

function populateYears() {
	const years = sortedYears(state.books);
	state.year = years[0] || null;
	yearSelect.replaceChildren();
	yearFilter.hidden = years.length === 0;

	for (const year of years) {
		const option = document.createElement('option');
		option.value = year;
		option.textContent = yearLabel(year);
		yearSelect.appendChild(option);
	}
}

function buildRankingItem(book, stats, index) {
	const item = document.createElement('li');
	item.className = 'ranking-item';
	if (index === 0) item.classList.add('ranking-item-first');

	const position = document.createElement('span');
	position.className = 'ranking-position';
	position.setAttribute('aria-hidden', 'true');
	position.textContent = String(index + 1);

	const link = document.createElement('a');
	link.className = 'ranking-book';
	link.href = `/book/?slug=${encodeURIComponent(book.slug)}`;
	link.appendChild(buildCover(book, 'ranking-cover'));

	const text = document.createElement('span');
	text.className = 'ranking-book-text';
	const title = document.createElement('span');
	title.className = 'ranking-book-title';
	title.textContent = book.title;
	const author = document.createElement('span');
	author.className = 'ranking-book-author';
	author.textContent = book.author;
	text.append(title, author);
	link.appendChild(text);

	const score = document.createElement('span');
	score.className = 'ranking-score';
	const average = stats.reduce((sum, rating) => sum + rating.rating, 0) / stats.length;
	score.setAttribute('aria-label', `${average.toFixed(1)} out of 5 from ${stats.length} rating${stats.length === 1 ? '' : 's'}`);
	const value = document.createElement('strong');
	value.textContent = average.toFixed(1);
	const outOf = document.createElement('span');
	outOf.className = 'ranking-out-of';
	outOf.textContent = '/ 5';
	const votes = document.createElement('span');
	votes.className = 'ranking-votes';
	votes.textContent = `${stats.length} rating${stats.length === 1 ? '' : 's'}`;
	score.append(value, outOf, votes);

	item.append(position, link, score);
	return item;
}

function buildUnrankedSection(books) {
	const section = document.createElement('section');
	section.className = 'unranked-section';
	const heading = document.createElement('h3');
	heading.textContent = 'Not ranked yet';
	const description = document.createElement('p');
	description.textContent = 'These books need their first group rating before they can take a position.';
	const list = document.createElement('ul');
	list.className = 'unranked-list';

	for (const book of books) {
		const item = document.createElement('li');
		const link = document.createElement('a');
		link.href = `/book/?slug=${encodeURIComponent(book.slug)}`;
		link.textContent = book.title;
		item.appendChild(link);
		if (book.author) item.appendChild(document.createTextNode(` — ${book.author}`));
		list.appendChild(item);
	}

	section.append(heading, description, list);
	return section;
}

function renderRankings() {
	rankingsResults.replaceChildren();
	if (state.loadError) {
		rankingsResults.appendChild(buildEmptyState(
			'Rankings could not load',
			'Check your connection and try loading the page again.',
			'Try again',
			() => window.location.reload(),
		));
		return;
	}
	if (!state.loaded) return;
	if (state.books.length === 0) {
		rankingsYearHeading.textContent = 'Group rankings';
		rankingsResults.appendChild(buildEmptyState(
			'The bookshelf is empty',
			'Add your first read to start the group rankings.',
		));
		return;
	}

	rankingsYearHeading.textContent = state.year === 'undated'
		? 'Undated book rankings'
		: `${state.year} book rankings`;
	const books = state.books.filter(book => yearKey(book) === state.year);
	const grouped = ratingsByBook();
	const ranked = books
		.filter(book => grouped.has(book.slug))
		.sort((a, b) => {
			const aRatings = grouped.get(a.slug);
			const bRatings = grouped.get(b.slug);
			const aAverage = aRatings.reduce((sum, rating) => sum + rating.rating, 0) / aRatings.length;
			const bAverage = bRatings.reduce((sum, rating) => sum + rating.rating, 0) / bRatings.length;
			return bAverage - aAverage || bRatings.length - aRatings.length || a.title.localeCompare(b.title);
		});
	const unranked = books
		.filter(book => !grouped.has(book.slug))
		.sort((a, b) => a.title.localeCompare(b.title));

	if (ranked.length > 0) {
		const list = document.createElement('ol');
		list.className = 'ranking-list';
		ranked.forEach((book, index) => {
			list.appendChild(buildRankingItem(book, grouped.get(book.slug), index));
		});
		rankingsResults.appendChild(list);
	} else {
		rankingsResults.appendChild(buildEmptyState(
			`No rated books for ${yearLabel(state.year).toLowerCase()} yet`,
			'Add your missing ratings to help put this year’s books in order.',
			'Rate missing books',
			() => switchView('missing'),
		));
	}

	if (unranked.length > 0) rankingsResults.appendChild(buildUnrankedSection(unranked));
}

function previewStars(wrap, value) {
	wrap.querySelectorAll('.quick-star').forEach(star => {
		star.classList.toggle('filled', Number(star.dataset.rating) <= value);
	});
}

function buildQuickRatingCard(book) {
	const card = document.createElement('article');
	card.className = 'quick-rating-card';
	card.dataset.bookSlug = book.slug;
	const saving = state.saving.has(book.slug);
	card.setAttribute('aria-busy', String(saving));

	const bookLink = document.createElement('a');
	bookLink.className = 'quick-rating-book';
	bookLink.href = `/book/?slug=${encodeURIComponent(book.slug)}`;
	bookLink.appendChild(buildCover(book, 'quick-rating-cover'));

	const bookText = document.createElement('span');
	bookText.className = 'quick-rating-book-text';
	const title = document.createElement('h3');
	title.textContent = book.title;
	const author = document.createElement('p');
	author.className = 'quick-rating-author';
	author.textContent = book.author;
	const month = document.createElement('p');
	month.className = 'quick-rating-month';
	month.textContent = formatMonth(book.month_read);
	bookText.append(title, author, month);
	bookLink.appendChild(bookText);

	const stars = document.createElement('div');
	stars.className = 'rating-stars quick-rating-stars';
	stars.setAttribute('role', 'group');
	stars.setAttribute('aria-label', `Rate ${book.title}`);
	for (let value = 1; value <= 5; value++) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'star quick-star';
		button.dataset.rating = String(value);
		button.textContent = '★';
		button.disabled = saving;
		button.setAttribute('aria-label', `Rate ${book.title} ${value} out of 5 stars`);
		button.addEventListener('mouseenter', () => previewStars(stars, value));
		button.addEventListener('mouseleave', () => previewStars(stars, 0));
		button.addEventListener('focus', () => previewStars(stars, value));
		button.addEventListener('blur', () => previewStars(stars, 0));
		button.addEventListener('click', () => submitRating(book, value));
		stars.appendChild(button);
	}

	const hint = document.createElement('p');
	hint.className = 'quick-rating-hint';
	hint.textContent = saving ? 'Saving your rating…' : 'Choose your rating';
	card.append(bookLink, stars, hint);

	if (state.errors.has(book.slug)) {
		const error = document.createElement('p');
		error.className = 'quick-rating-error';
		error.setAttribute('role', 'alert');
		error.textContent = state.errors.get(book.slug);
		card.appendChild(error);
	}
	return card;
}

function updateProgress() {
	const total = state.books.length;
	const missing = missingBooks();
	const rated = state.session ? total - missing.length : 0;
	const percent = total > 0 ? Math.round((rated / total) * 100) : 0;
	progressText.textContent = state.session
		? `You’ve rated ${rated} of ${total} book${total === 1 ? '' : 's'}.`
		: 'Sign in to add your missing ratings.';
	progressBadge.textContent = `${percent}%`;
	progressTrack.setAttribute('aria-valuenow', String(percent));
	progressBar.style.width = `${percent}%`;
	missingCount.textContent = String(missing.length);
	missingCount.hidden = !state.loaded || !state.session || missing.length === 0;
}

function renderMissing() {
	missingResults.replaceChildren();
	updateProgress();
	if (state.loadError) {
		missingResults.appendChild(buildEmptyState(
			'Your ratings could not load',
			'Check your connection and try loading the page again.',
			'Try again',
			() => window.location.reload(),
		));
		return;
	}
	if (!state.loaded) return;
	if (!state.session) {
		missingResults.appendChild(buildEmptyState(
			'Sign in to rate books',
			'Your missing ratings will appear here once you are signed in.',
			'Go to login',
			() => { window.location.href = '/login/'; },
		));
		return;
	}
	if (state.books.length === 0) {
		missingResults.appendChild(buildEmptyState(
			'No books to rate yet',
			'Once a book reaches the shelf, you can add your rating here.',
		));
		return;
	}

	const missing = missingBooks();
	if (missing.length === 0) {
		missingResults.appendChild(buildEmptyState(
			'You’re all caught up',
			'You’ve rated every book on our shelf. The group rankings are ready for you.',
			'See group rankings',
			() => switchView('group'),
		));
		return;
	}

	for (const year of sortedYears(missing)) {
		const section = document.createElement('section');
		section.className = 'missing-year';
		const heading = document.createElement('h3');
		heading.className = 'missing-year-heading';
		const booksForYear = missing.filter(book => yearKey(book) === year);
		heading.textContent = `${yearLabel(year)} · ${booksForYear.length} to rate`;
		const grid = document.createElement('div');
		grid.className = 'quick-rating-grid';
		booksForYear.forEach(book => grid.appendChild(buildQuickRatingCard(book)));
		section.append(heading, grid);
		missingResults.appendChild(section);
	}
}

function renderAll() {
	renderRankings();
	renderMissing();
}

async function submitRating(book, rating) {
	if (!state.session || state.saving.has(book.slug)) return;
	state.saving.add(book.slug);
	state.errors.delete(book.slug);
	renderMissing();
	let saved = false;

	try {
		const { error } = await supabase.from('ratings').insert({
			book_slug: book.slug,
			user_id: state.session.user.id,
			rating,
		});
		if (error) throw error;
		state.ratings.push({ book_slug: book.slug, user_id: state.session.user.id, rating });
		status.textContent = `Saved ${rating} out of 5 stars for ${book.title}.`;
		saved = true;
	} catch (error) {
		console.error('Quick rating failed:', error);
		state.errors.set(book.slug, 'Your rating could not be saved. Check your connection and try again.');
		status.textContent = `The rating for ${book.title} could not be saved.`;
	} finally {
		state.saving.delete(book.slug);
		renderAll();
		if (state.view === 'missing') {
			if (saved) {
				missingPanel.focus({ preventScroll: true });
			} else {
				const card = Array.from(document.querySelectorAll('.quick-rating-card'))
					.find(element => element.dataset.bookSlug === book.slug);
				card?.querySelector(`[data-rating="${rating}"]`)?.focus();
			}
		}
	}
}

tabs.forEach((tab, index) => {
	tab.addEventListener('click', () => switchView(tab.dataset.rankingView));
	tab.addEventListener('keydown', event => {
		let nextIndex;
		if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
		if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
		if (event.key === 'Home') nextIndex = 0;
		if (event.key === 'End') nextIndex = tabs.length - 1;
		if (nextIndex === undefined) return;
		event.preventDefault();
		switchView(tabs[nextIndex].dataset.rankingView, true);
	});
});

yearSelect.addEventListener('change', () => {
	state.year = yearSelect.value;
	renderRankings();
});

async function init() {
	const [booksResult, ratingsResult, sessionResult] = await Promise.all([
		supabase.from('books').select('slug, title, author, cover_url, month_read, created_at').order('month_read', { ascending: false }).order('created_at', { ascending: false }),
		supabase.from('ratings').select('book_slug, user_id, rating'),
		supabase.auth.getSession(),
	]);

	const loadError = booksResult.error || ratingsResult.error;
	if (loadError) {
		console.error('Rankings could not load:', loadError);
		state.loadError = true;
	} else {
		state.books = booksResult.data || [];
		state.ratings = ratingsResult.data || [];
		state.session = sessionResult.data.session;
		populateYears();
	}
	state.loaded = true;
	renderAll();
}

init();
