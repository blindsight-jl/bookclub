import { supabase } from '/js/supabase-client.js';

const container = document.getElementById('book-archive');

function formatMonth(dateStr) {
	if (!dateStr) return 'Unknown';
	const [year, month] = dateStr.split('-');
	return new Date(parseInt(year), parseInt(month) - 1, 1)
		.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

async function init() {
	const { data: books, error } = await supabase
		.from('books')
		.select('slug, title, author, cover_url, genre, month_read')
		.order('month_read', { ascending: false })
		.order('created_at', { ascending: false });

	container.innerHTML = '';

	if (error || !books || books.length === 0) {
		container.innerHTML = '<p class="loading-message">No books yet.</p>';
		return;
	}

	const byMonth = new Map();
	for (const book of books) {
		const key = book.month_read ? book.month_read.slice(0, 7) : 'unknown';
		if (!byMonth.has(key)) byMonth.set(key, { label: formatMonth(book.month_read), books: [] });
		byMonth.get(key).books.push(book);
	}

	for (const { label, books: monthBooks } of byMonth.values()) {
		const section = document.createElement('section');
		section.className = 'book-archive-month';

		const heading = document.createElement('h2');
		heading.className = 'book-archive-heading';
		heading.textContent = label;
		section.appendChild(heading);

		const list = document.createElement('ul');
		list.className = 'book-archive-list';

		for (const book of monthBooks) {
			const li = document.createElement('li');
			li.className = 'book-archive-item';

			const a = document.createElement('a');
			a.href = `/book/?slug=${book.slug}`;

			if (book.cover_url) {
				const img = document.createElement('img');
				img.src = book.cover_url;
				img.alt = '';
				img.className = 'book-archive-cover';
				a.appendChild(img);
			}

			const text = document.createElement('span');
			text.className = 'book-archive-text';

			const titleEl = document.createElement('span');
			titleEl.className = 'book-archive-title';
			titleEl.textContent = book.title;

			const authorEl = document.createElement('span');
			authorEl.className = 'book-archive-author';
			authorEl.textContent = book.author;

			text.append(titleEl, authorEl);
			a.appendChild(text);
			li.appendChild(a);
			list.appendChild(li);
		}

		section.appendChild(list);
		container.appendChild(section);
	}
}

init();
