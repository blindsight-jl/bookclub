import { supabase } from '/js/supabase-client.js';

const slug = window.BOOK_SLUG;
const container = document.getElementById('comments-widget');

let state = { comments: [], session: null, displayName: '', loading: false, error: null, draft: '' };

function formatDate(iso) {
	return new Date(iso).toLocaleDateString(undefined, {
		year: 'numeric', month: 'long', day: 'numeric',
	});
}

function render() {
	container.innerHTML = '';

	const { comments, session, loading, error, draft } = state;

	if (comments.length > 0) {
		const list = document.createElement('div');
		list.className = 'comments-list';

		for (const c of comments) {
			const article = document.createElement('article');
			article.className = 'comment';

			const header = document.createElement('div');
			header.className = 'comment-header';

			const author = document.createElement('span');
			author.className = 'comment-author';
			author.textContent = c.display_name;

			const date = document.createElement('time');
			date.className = 'comment-date';
			date.dateTime = c.created_at;
			date.textContent = formatDate(c.created_at);

			const body = document.createElement('p');
			body.className = 'comment-body';
			body.textContent = c.body;

			header.append(author, date);

			// Delete button for own comments
			if (session && c.user_id === session.user.id) {
				const delBtn = document.createElement('button');
				delBtn.className = 'comment-delete';
				delBtn.textContent = '×';
				delBtn.setAttribute('aria-label', 'Delete comment');
				delBtn.addEventListener('click', () => deleteComment(c.id));
				header.appendChild(delBtn);
			}

			article.append(header, body);
			list.appendChild(article);
		}

		container.appendChild(list);
	}

	if (session) {
		const form = document.createElement('form');
		form.className = 'comment-form';

		if (error) {
			const errEl = document.createElement('p');
			errEl.className = 'form-error';
			errEl.textContent = error;
			form.appendChild(errEl);
		}

		const field = document.createElement('div');
		field.className = 'field';

		const label = document.createElement('label');
		label.htmlFor = 'comment-body';
		label.textContent = comments.length === 0 ? 'Be the first to comment' : 'Add a comment';

		const textarea = document.createElement('textarea');
		textarea.id = 'comment-body';
		textarea.className = 'comment-input';
		textarea.rows = 3;
		textarea.placeholder = 'What did you think?';
		textarea.value = draft;
		textarea.required = true;

		const btn = document.createElement('button');
		btn.type = 'submit';
		btn.className = 'btn-primary';
		btn.textContent = loading ? 'Posting…' : 'Post comment';
		btn.disabled = loading;

		field.append(label, textarea);
		form.append(field, btn);
		form.addEventListener('submit', handleSubmit);
		container.appendChild(form);
	} else {
		const prompt = document.createElement('p');
		prompt.className = 'comments-login-prompt';
		const link = document.createElement('a');
		link.href = '/login/';
		link.textContent = 'Login';
		prompt.append(link, ' to leave a comment');
		container.appendChild(prompt);
	}
}

async function handleSubmit(e) {
	e.preventDefault();
	const body = e.target.querySelector('textarea').value.trim();
	state.draft = body;
	if (!body) return;

	state.loading = true;
	state.error = null;
	render();

	const { data, error } = await supabase
		.from('comments')
		.insert({
			user_id: state.session.user.id,
			book_slug: slug,
			display_name: state.displayName,
			body,
		})
		.select()
		.single();

	if (error) {
		console.error('Comment insert failed:', error);
		state.loading = false;
		state.error = 'Failed to post comment. Please try again.';
		render();
		return;
	}

	state.comments.push(data);
	state.draft = '';
	state.loading = false;
	render();
}

async function deleteComment(id) {
	const { error } = await supabase
		.from('comments')
		.delete()
		.eq('id', id);

	if (error) {
		console.error('Comment delete failed:', error);
		return;
	}

	state.comments = state.comments.filter(c => c.id !== id);
	render();
}

async function init() {
	container.innerHTML = '<p class="comments-loading">Loading comments…</p>';

	const [{ data: comments }, { data: { session } }] = await Promise.all([
		supabase
			.from('comments')
			.select('id, user_id, display_name, body, created_at')
			.eq('book_slug', slug)
			.order('created_at', { ascending: true }),
		supabase.auth.getSession(),
	]);

	let displayName = '';
	if (session) {
		const { data: profile } = await supabase
			.from('profiles')
			.select('username')
			.eq('id', session.user.id)
			.maybeSingle();
		displayName = profile?.username || session.user.email.split('@')[0];
	}

	state.comments = comments || [];
	state.session = session;
	state.displayName = displayName;
	render();
}

init();
