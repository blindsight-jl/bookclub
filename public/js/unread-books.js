import { supabase } from '/js/supabase-client.js';

const listContainer = document.getElementById('unread-list');
const form = document.getElementById('unread-form');
const errorEl = document.getElementById('unread-form-error');
const submitBtn = document.getElementById('unread-submit');

let state = { books: [], session: null, editingId: null };

async function init() {
	const [{ data: books }, { data: { session } }] = await Promise.all([
		supabase.from('unread_books').select('*').order('genre').order('title'),
		supabase.auth.getSession(),
	]);

	state.books = books || [];
	state.session = session;

	render();
	setupForm();
}

function render() {
	const { books, session, editingId } = state;
	listContainer.innerHTML = '';

	if (books.length === 0) {
		listContainer.innerHTML = '<p class="loading-message">No books yet — add one above.</p>';
		return;
	}

	const byGenre = new Map();
	for (const book of books) {
		if (!byGenre.has(book.genre)) byGenre.set(book.genre, []);
		byGenre.get(book.genre).push(book);
	}

	for (const [genre, genreBooks] of byGenre.entries()) {
		const section = document.createElement('section');
		section.className = 'unread-section';

		const heading = document.createElement('h2');
		heading.className = 'unread-genre-heading';
		heading.textContent = genre;
		section.appendChild(heading);

		const table = document.createElement('table');
		table.className = 'unread-table';

		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		for (const label of ['Title', 'Author', 'Pages', 'Year', '']) {
			const th = document.createElement('th');
			th.textContent = label;
			headerRow.appendChild(th);
		}
		thead.appendChild(headerRow);
		table.appendChild(thead);

		const tbody = document.createElement('tbody');
		for (const book of genreBooks) {
			if (session && book.id === editingId) {
				tbody.appendChild(buildEditRow(book, table.colSpan));
			} else {
				tbody.appendChild(buildReadRow(book, session));
			}
		}

		table.appendChild(tbody);
		section.appendChild(table);
		listContainer.appendChild(section);
	}
}

function buildReadRow(book, session) {
	const row = document.createElement('tr');

	const titleCell = document.createElement('td');
	if (book.link) {
		const a = document.createElement('a');
		a.href = book.link;
		a.target = '_blank';
		a.rel = 'noopener noreferrer';
		a.textContent = book.title;
		titleCell.appendChild(a);
	} else {
		titleCell.textContent = book.title;
	}

	const authorCell = document.createElement('td');
	authorCell.textContent = book.author;

	const pagesCell = document.createElement('td');
	pagesCell.className = 'unread-num';
	pagesCell.textContent = book.page_count ?? '—';

	const yearCell = document.createElement('td');
	yearCell.className = 'unread-num';
	yearCell.textContent = book.release_year ?? '—';

	const actionCell = document.createElement('td');
	actionCell.className = 'unread-actions';
	if (session) {
		const editBtn = document.createElement('button');
		editBtn.className = 'unread-edit-btn';
		editBtn.textContent = '✎';
		editBtn.setAttribute('aria-label', `Edit ${book.title}`);
		editBtn.addEventListener('click', () => { state.editingId = book.id; render(); });

		const delBtn = document.createElement('button');
		delBtn.className = 'comment-delete';
		delBtn.textContent = '×';
		delBtn.setAttribute('aria-label', `Remove ${book.title}`);
		delBtn.addEventListener('click', () => removeBook(book.id));

		actionCell.append(editBtn, delBtn);
	}

	row.append(titleCell, authorCell, pagesCell, yearCell, actionCell);
	return row;
}

function buildEditRow(book) {
	const row = document.createElement('tr');
	row.className = 'unread-edit-row';

	const cell = document.createElement('td');
	cell.colSpan = 5;

	const editForm = document.createElement('form');
	editForm.className = 'unread-inline-form';

	const errorEl = document.createElement('p');
	errorEl.className = 'form-error';
	errorEl.hidden = true;
	editForm.appendChild(errorEl);

	const fields = document.createElement('div');
	fields.className = 'unread-inline-fields';

	function inlineField(labelText, input) {
		const label = document.createElement('label');
		label.textContent = labelText;
		label.htmlFor = input.id;
		const wrap = document.createElement('div');
		wrap.className = 'field';
		wrap.append(label, input);
		return wrap;
	}

	const titleInput = Object.assign(document.createElement('input'), { type: 'text', id: 'ue-title', value: book.title, required: true });
	const authorInput = Object.assign(document.createElement('input'), { type: 'text', id: 'ue-author', value: book.author, required: true });
	const genreInput = Object.assign(document.createElement('input'), { type: 'text', id: 'ue-genre', value: book.genre, required: true });
	const pagesInput = Object.assign(document.createElement('input'), { type: 'number', id: 'ue-pages', value: book.page_count ?? '', min: 1, max: 9999 });
	const yearInput = Object.assign(document.createElement('input'), { type: 'number', id: 'ue-year', value: book.release_year ?? '', min: 1900, max: 2099 });
	const linkInput = Object.assign(document.createElement('input'), { type: 'url', id: 'ue-link', value: book.link ?? '', placeholder: 'https://…' });

	fields.append(
		inlineField('Title', titleInput),
		inlineField('Author', authorInput),
		inlineField('Genre', genreInput),
		inlineField('Pages', pagesInput),
		inlineField('Year', yearInput),
		inlineField('Link', linkInput),
	);
	editForm.appendChild(fields);

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
	cancelBtn.addEventListener('click', () => { state.editingId = null; render(); });

	btnRow.append(saveBtn, cancelBtn);
	editForm.appendChild(btnRow);

	editForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		errorEl.hidden = true;
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving…';

		const updates = {
			title: titleInput.value.trim(),
			author: authorInput.value.trim(),
			genre: genreInput.value.trim(),
			page_count: pagesInput.value ? parseInt(pagesInput.value) : null,
			release_year: yearInput.value ? parseInt(yearInput.value) : null,
			link: linkInput.value.trim() || null,
		};

		const { data, error } = await supabase
			.from('unread_books').update(updates).eq('id', book.id).select().single();

		if (error) {
			console.error('Unread update failed:', error);
			errorEl.textContent = 'Failed to save. Please try again.';
			errorEl.hidden = false;
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save';
			return;
		}

		state.books = state.books
			.map(b => b.id === data.id ? data : b)
			.sort((a, b) => a.genre.localeCompare(b.genre) || a.title.localeCompare(b.title));
		state.editingId = null;
		render();
	});

	cell.appendChild(editForm);
	row.appendChild(cell);
	return row;
}

async function removeBook(id) {
	if (!confirm('Remove this book from the list?')) return;
	const { error } = await supabase.from('unread_books').delete().eq('id', id);
	if (error) { console.error('Unread delete failed:', error); return; }
	state.books = state.books.filter(b => b.id !== id);
	state.editingId = null;
	render();
}

function setupForm() {
	if (!form || !state.session) return;

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		errorEl.hidden = true;

		const title = document.getElementById('unread-title').value.trim();
		const author = document.getElementById('unread-author').value.trim();
		const genre = document.getElementById('unread-genre').value.trim();
		const pageCount = document.getElementById('unread-pages').value ? parseInt(document.getElementById('unread-pages').value) : null;
		const releaseYear = document.getElementById('unread-year').value ? parseInt(document.getElementById('unread-year').value) : null;
		const link = document.getElementById('unread-link').value.trim() || null;

		submitBtn.disabled = true;
		submitBtn.textContent = 'Adding…';

		const { data, error } = await supabase
			.from('unread_books')
			.insert({ title, author, genre, page_count: pageCount, release_year: releaseYear, link, added_by: state.session.user.id })
			.select()
			.single();

		submitBtn.disabled = false;
		submitBtn.textContent = 'Add book';

		if (error) {
			console.error('Unread insert failed:', error);
			errorEl.textContent = 'Failed to add book. Please try again.';
			errorEl.hidden = false;
			return;
		}

		state.books = [...state.books, data].sort((a, b) =>
			a.genre.localeCompare(b.genre) || a.title.localeCompare(b.title)
		);
		render();
		form.reset();
		document.querySelector('.unread-add').removeAttribute('open');
	});
}

init();
