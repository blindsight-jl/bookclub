import { supabase } from '/js/supabase-client.js';

const slug = window.BOOK_SLUG;
const container = document.getElementById('book-detail');
let state = { book: null, session: null };

function formatMonth(dateStr) {
	if (!dateStr) return '';
	const [year, month] = dateStr.split('-');
	return new Date(parseInt(year), parseInt(month) - 1, 1)
		.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function toMonthInput(dateStr) {
	return dateStr ? dateStr.slice(0, 7) : '';
}

function renderBook() {
	const { book, session } = state;
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
		const actions = document.createElement('div');
		actions.className = 'book-actions';

		const editBtn = document.createElement('button');
		editBtn.className = 'btn-secondary';
		editBtn.textContent = 'Edit';
		editBtn.addEventListener('click', renderEditForm);

		const delBtn = document.createElement('button');
		delBtn.className = 'btn-danger';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => deleteBook(book.id));

		actions.append(editBtn, delBtn);
		info.appendChild(actions);
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

function renderEditForm() {
	const { book } = state;
	container.innerHTML = '';

	const form = document.createElement('form');
	form.className = 'book-edit-form';

	const errorEl = document.createElement('p');
	errorEl.className = 'form-error';
	errorEl.hidden = true;
	form.appendChild(errorEl);

	function field(labelText, input) {
		const div = document.createElement('div');
		div.className = 'field';
		const label = document.createElement('label');
		label.textContent = labelText;
		label.htmlFor = input.id;
		div.append(label, input);
		return div;
	}

	const titleInput = Object.assign(document.createElement('input'), { type: 'text', id: 'edit-title', value: book.title, required: true });
	const authorInput = Object.assign(document.createElement('input'), { type: 'text', id: 'edit-author', value: book.author, required: true });
	const coverInput = Object.assign(document.createElement('input'), { type: 'url', id: 'edit-cover', value: book.cover_url || '', placeholder: 'https://…' });
	const genreInput = Object.assign(document.createElement('input'), { type: 'text', id: 'edit-genre', value: book.genre || '' });
	const monthInput = Object.assign(document.createElement('input'), { type: 'month', id: 'edit-month', value: toMonthInput(book.month_read) });
	const descInput = Object.assign(document.createElement('textarea'), { id: 'edit-desc', className: 'comment-input', rows: 8, value: book.description || '' });

	form.append(
		field('Title', titleInput),
		field('Author', authorInput),
		field('Cover image URL', coverInput),
		field('Genre', genreInput),
		field('Month read', monthInput),
		field('Description', descInput),
	);

	const btnRow = document.createElement('div');
	btnRow.className = 'book-actions';

	const saveBtn = document.createElement('button');
	saveBtn.type = 'submit';
	saveBtn.className = 'btn-primary';
	saveBtn.textContent = 'Save';

	const cancelBtn = document.createElement('button');
	cancelBtn.type = 'button';
	cancelBtn.className = 'btn-secondary';
	cancelBtn.textContent = 'Cancel';
	cancelBtn.addEventListener('click', renderBook);

	btnRow.append(saveBtn, cancelBtn);
	form.appendChild(btnRow);

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		errorEl.hidden = true;
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving…';

		const updates = {
			title: titleInput.value.trim(),
			author: authorInput.value.trim(),
			cover_url: coverInput.value.trim() || null,
			genre: genreInput.value.trim() || null,
			month_read: monthInput.value ? monthInput.value + '-01' : null,
			description: descInput.value.trim() || null,
		};

		const { data, error } = await supabase
			.from('books').update(updates).eq('id', book.id).select().single();

		if (error) {
			console.error('Book update failed:', error);
			errorEl.textContent = 'Failed to save. Please try again.';
			errorEl.hidden = false;
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save';
			return;
		}

		state.book = data;
		renderBook();
	});

	container.appendChild(form);
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

	state = { book, session };
	renderBook();
}

init();
