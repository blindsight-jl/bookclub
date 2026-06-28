import { supabase } from '/js/supabase-client.js';

const slug = window.BOOK_SLUG;
const container = document.getElementById('book-detail');

function formatMonth(dateStr) {
	if (!dateStr) return '';
	const [year, month] = dateStr.split('-');
	return new Date(parseInt(year), parseInt(month) - 1, 1)
		.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function renderBook(book, session) {
	container.innerHTML = '';

	const article = document.createElement('article');
	article.className = 'book-detail';

	if (book.cover_url) {
		const cover = document.createElement('img');
		cover.src = book.cover_url;
		cover.alt = `Cover of ${book.title}`;
		cover.className = 'book-detail-cover';
		article.appendChild(cover);
	}

	const info = document.createElement('div');
	info.className = 'book-detail-info';

	const title = document.createElement('h1');
	title.className = 'book-detail-title';
	title.textContent = book.title;

	const meta = document.createElement('p');
	meta.className = 'book-detail-meta';
	const parts = [book.author];
	if (book.genre) parts.push(book.genre);
	if (book.month_read) parts.push(formatMonth(book.month_read));
	meta.textContent = parts.join(' · ');

	info.append(title, meta);

	if (session) {
		const delBtn = document.createElement('button');
		delBtn.className = 'btn-danger';
		delBtn.textContent = 'Delete book';
		delBtn.addEventListener('click', () => deleteBook(book.id));
		info.appendChild(delBtn);
	}

	if (book.description) {
		const descSection = document.createElement('div');
		descSection.className = 'book-description';
		for (const para of book.description.split('\n\n')) {
			const p = document.createElement('p');
			p.textContent = para.trim();
			if (p.textContent) descSection.appendChild(p);
		}
		info.appendChild(descSection);
	}

	article.appendChild(info);
	container.appendChild(article);

	document.title = `${book.title} – ${document.title}`;
}

async function deleteBook(id) {
	if (!confirm('Delete this book? Ratings and comments will remain in the database.')) return;
	const { error } = await supabase.from('books').delete().eq('id', id);
	if (error) {
		console.error('Book delete failed:', error);
		alert('Failed to delete. Please try again.');
		return;
	}
	window.location.href = '/blog/';
}

async function init() {
	if (!slug) {
		container.innerHTML = '<p>No book specified.</p>';
		return;
	}

	container.innerHTML = '<p class="loading-message">Loading…</p>';

	const [{ data: book, error }, { data: { session } }] = await Promise.all([
		supabase.from('books').select('*').eq('slug', slug).maybeSingle(),
		supabase.auth.getSession(),
	]);

	if (error || !book) {
		container.innerHTML = '<p>Book not found.</p>';
		return;
	}

	renderBook(book, session);
}

init();
