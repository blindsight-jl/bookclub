import { supabase } from '/js/supabase-client.js';

const form = document.getElementById('book-form');
const errorEl = document.getElementById('book-form-error');
const submitBtn = document.getElementById('book-submit');

function slugify(text) {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

async function init() {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		window.location.href = '/login/';
		return;
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		errorEl.hidden = true;

		const title = document.getElementById('book-title').value.trim();
		const author = document.getElementById('book-author').value.trim();
		const coverUrl = document.getElementById('book-cover').value.trim() || null;
		const genre = document.getElementById('book-genre').value.trim() || null;
		const monthValue = document.getElementById('book-month').value;
		const monthRead = monthValue ? monthValue + '-01' : null;
		const description = document.getElementById('book-description').value.trim() || null;

		const slug = slugify(title);
		if (!slug) {
			showError('Title is required.');
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = 'Adding…';

		const { data, error } = await supabase
			.from('books')
			.insert({ slug, title, author, cover_url: coverUrl, genre, month_read: monthRead, description, added_by: session.user.id })
			.select('slug')
			.single();

		submitBtn.disabled = false;
		submitBtn.textContent = 'Add book';

		if (error) {
			console.error('Book insert failed:', error);
			showError(error.code === '23505' ? 'A book with this title already exists.' : 'Failed to add book. Please try again.');
			return;
		}

		window.location.href = `/book/?slug=${data.slug}`;
	});
}

function showError(msg) {
	errorEl.textContent = msg;
	errorEl.hidden = false;
}

init();
