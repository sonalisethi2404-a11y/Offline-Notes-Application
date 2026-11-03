/* NoteSpace – vanilla JS. Notes live in LocalStorage; old data is auto-migrated (never deleted). */
(() => {
    'use strict';
    const KEY = 'notespace.notes.v1';
    const COLORS = ['lavender', 'rose', 'mint', 'peach', 'sky', 'lemon'];
    const DEFAULT_CATS = ['General', 'Work', 'Personal', 'Study', 'Ideas'];
    const WEEK = 7 * 864e5;
    const $ = (id) => document.getElementById(id);
    const ic = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const state = { notes: [], view: 'dashboard', cat: 'All', q: '' };

    /* ---------- Storage + migration ---------- */
    const toISO = (v, fb) => {
        if (v == null || v === '') return fb;
        const d = typeof v === 'number' ? new Date(v) : new Date(Date.parse(v));
        return isNaN(d) ? fb : d.toISOString();
    };
    function normalize(n, i) {
        if (typeof n === 'string') n = { title: n.slice(0, 40), content: n };
        const now = new Date().toISOString();
        const idNum = Number(n.id);
        const created = toISO(n.createdAt ?? n.created ?? n.createdDate ?? n.date ?? n.timestamp ?? (idNum > 1e12 ? idNum : null), now);
        return {
            id: String(n.id ?? Date.now() + '-' + i),
            title: String(n.title ?? n.heading ?? n.name ?? 'Untitled'),
            content: String(n.content ?? n.body ?? n.text ?? n.description ?? n.note ?? ''),
            category: String(n.category ?? n.tag ?? 'General'),
            color: COLORS.includes(n.color) ? n.color : COLORS[i % COLORS.length],
            pinned: !!(n.pinned ?? n.isPinned ?? n.pin),
            createdAt: created,
            updatedAt: toISO(n.updatedAt ?? n.updated ?? n.modifiedAt ?? n.lastModified ?? n.modified, created),
        };
    }
    function findLegacy() {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k === KEY) continue;
            try {
                const v = JSON.parse(localStorage.getItem(k));
                if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' || (x && typeof x === 'object' &&
                    ('title' in x || 'content' in x || 'body' in x || 'text' in x)))) return v;
            } catch (e) { /* not JSON */ }
        }
        return null;
    }
    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) { state.notes = JSON.parse(raw).map(normalize); return; }
        } catch (e) { /* fall through */ }
        const legacy = findLegacy();
        if (legacy) { state.notes = legacy.map(normalize); save(); toast(`Imported ${legacy.length} notes from your old app`); }
    }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state.notes)); } catch (e) { toast('Storage is full or blocked'); } };

    /* ---------- Helpers ---------- */
    const fmt = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const byPinThenUpdated = (a, b) => (b.pinned - a.pinned) || (new Date(b.updatedAt) - new Date(a.updatedAt));
    const byUpdated = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
    const categories = () => [...new Set([...DEFAULT_CATS, ...state.notes.map((n) => n.category)])];
    const isRecent = (n) => Date.now() - new Date(n.updatedAt) < WEEK;
    let toastTimer;
    function toast(msg) {
        const t = $('toast'); t.textContent = msg; t.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
    }

    /* ---------- Render ---------- */
    const TITLES = { dashboard: 'Recent notes', all: 'All Notes', pinned: 'Pinned Notes', recent: 'Recently Edited', categories: 'Categories' };
    function visibleNotes() {
        const q = state.q.trim().toLowerCase();
        let list = [...state.notes];
        if (state.view === 'pinned') list = list.filter((n) => n.pinned);
        if (state.view === 'recent') list = list.filter(isRecent).sort(byUpdated);
        else list.sort(byPinThenUpdated);
        if (state.cat !== 'All') list = list.filter((n) => n.category === state.cat);
        if (q) list = state.notes.filter((n) => (n.title + ' ' + n.content + ' ' + n.category).toLowerCase().includes(q))
            .filter((n) => state.cat === 'All' || n.category === state.cat).sort(byPinThenUpdated);
        else if (state.view === 'dashboard') list = list.slice(0, 6);
        return list;
    }
    function cardHTML(n) {
        return `<article class="note c-${n.color}" data-id="${esc(n.id)}">
      <div class="note-top"><span class="tag">${esc(n.category)}</span>${n.pinned ? `<span class="pin-flag" title="Pinned">${ic('pin')}</span>` : ''}</div>
      <h3>${esc(n.title)}</h3>
      <p class="preview">${esc(n.content.slice(0, 220)) || '<em>No content</em>'}</p>
      <div class="note-dates"><span>Created ${fmt(n.createdAt)}</span><span>Updated ${fmt(n.updatedAt)}</span></div>
      <div class="note-actions">
        <button data-act="pin" class="${n.pinned ? 'on' : ''}" aria-label="${n.pinned ? 'Unpin' : 'Pin'} note" title="${n.pinned ? 'Unpin' : 'Pin'}">${ic('pin')}</button>
        <button data-act="edit" aria-label="Edit note" title="Edit">${ic('edit')}</button>
        <button data-act="del" class="del" aria-label="Delete note" title="Delete">${ic('trash')}</button>
      </div></article>`;
    }
    function render() {
        const total = state.notes.length, pinned = state.notes.filter((n) => n.pinned).length;
        $('statTotal').textContent = total; $('statPinned').textContent = pinned;
        $('statRecent').textContent = state.notes.filter(isRecent).length;
        $('navAll').textContent = total; $('navPinned').textContent = pinned;
        const h = new Date().getHours();
        $('greeting').textContent = `Good ${h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'}, Welcome Back!`;
        $('subtitle').textContent = total
            ? `You have ${total} ${total === 1 ? 'note' : 'notes'} saved on this device. Pick up where you left off.`
            : 'Capture ideas the moment they arrive. Everything you write is saved on this device.';

        document.body.dataset.view = state.view;
        document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
        const isSettings = state.view === 'settings';
        $('settingsSection').hidden = !isSettings; $('notesSection').hidden = isSettings;
        if (isSettings) return;

        const chips = ['All', ...categories()];
        $('categoryChips').innerHTML = chips.map((c) =>
            `<button class="chip ${c === state.cat ? 'active' : ''}" data-cat="${esc(c)}" role="tab">${esc(c)}</button>`).join('');
        $('notesTitle').textContent = state.q.trim() ? 'Search results' : TITLES[state.view];

        const grid = $('notesGrid'), empty = $('emptyState');
        if (state.view === 'categories' && state.cat === 'All' && !state.q.trim()) {
            $('notesCount').textContent = `${categories().length} categories`;
            grid.innerHTML = categories().map((c, i) => `<article class="note cat-card c-${COLORS[i % COLORS.length]}" data-cat="${esc(c)}">
        <div class="note-top"><span class="tag">${ic('folder')}</span></div><h3>${esc(c)}</h3>
        <strong>${state.notes.filter((n) => n.category === c).length}</strong><span class="muted">notes</span></article>`).join('');
            empty.hidden = true; return;
        }
        const list = visibleNotes();
        $('notesCount').textContent = `${list.length} ${list.length === 1 ? 'note' : 'notes'}`;
        grid.innerHTML = list.map(cardHTML).join('');
        empty.hidden = list.length > 0;
        if (!list.length) {
            const searching = state.q.trim() || state.cat !== 'All';
            $('emptyTitle').textContent = searching ? 'No notes found' : state.view === 'pinned' ? 'Nothing pinned yet' : state.view === 'recent' ? 'No recent edits' : 'Your space is ready';
            $('emptyText').textContent = searching ? 'Try a different search or category.' : state.view === 'pinned' ? 'Pin a note to keep it at the top.' : 'Write your first note. It saves automatically to this device.';
        }
    }

    /* ---------- Editor ---------- */
    const form = $('noteForm'), modal = $('editorModal');
    const words = () => ($('noteContent').value.trim().match(/\S+/g) || []).length;
    function setColor(c) {
        form.dataset.color = c;
        form.querySelector(`input[value="${c}"]`).checked = true;
    }
    function openEditor(id) {
        const n = state.notes.find((x) => x.id === id);
        form.reset(); $('noteTitle').classList.remove('invalid');
        $('noteCategory').innerHTML = categories().map((c) => `<option>${esc(c)}</option>`).join('');
        $('editorHeading').textContent = n ? 'Edit note' : 'New note';
        $('noteId').value = n ? n.id : '';
        $('noteTitle').value = n ? n.title : '';
        $('noteContent').value = n ? n.content : '';
        $('noteCategory').value = n ? n.category : (state.cat !== 'All' ? state.cat : 'General');
        $('notePinned').checked = n ? n.pinned : state.view === 'pinned';
        setColor(n ? n.color : 'lavender');
        $('wordCount').textContent = `${words()} words`;
        modal.hidden = false; document.body.style.overflow = 'hidden';
        setTimeout(() => $('noteTitle').focus(), 50);
    }
    function closeEditor() { modal.hidden = true; document.body.style.overflow = ''; }
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = $('noteTitle').value.trim();
        if (!title) { $('noteTitle').classList.add('invalid'); $('noteTitle').focus(); toast('Add a title to save this note'); return; }
        const now = new Date().toISOString(), id = $('noteId').value;
        const data = {
            title, content: $('noteContent').value, category: $('noteCategory').value,
            color: form.dataset.color, pinned: $('notePinned').checked
        };
        if (id) Object.assign(state.notes.find((n) => n.id === id), data, { updatedAt: now });
        else state.notes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: now, updatedAt: now, ...data });
        save(); closeEditor(); render(); toast(id ? 'Note updated' : 'Note saved');
    });
    $('colorPicker').addEventListener('change', (e) => setColor(e.target.value));
    $('noteContent').addEventListener('input', () => $('wordCount').textContent = `${words()} words`);
    $('noteTitle').addEventListener('input', (e) => e.target.classList.remove('invalid'));
    $('cancelBtn').onclick = $('editorClose').onclick = closeEditor;
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeEditor(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.hidden) closeEditor(); else toggleMenu(false); } });

    /* ---------- Interactions ---------- */
    $('newNoteBtn').onclick = $('emptyCta').onclick = () => openEditor();
    $('searchInput').addEventListener('input', (e) => {
        state.q = e.target.value;
        if (state.q.trim() && state.view === 'settings') state.view = 'all';
        render();
    });
    $('categoryChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { state.cat = b.dataset.cat; render(); } });
    $('notesGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.note'); if (!card) return;
        if (card.classList.contains('cat-card')) { state.cat = card.dataset.cat; render(); return; }
        const id = card.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
        const n = state.notes.find((x) => x.id === id); if (!n) return;
        if (act === 'pin') { n.pinned = !n.pinned; save(); render(); toast(n.pinned ? 'Note pinned' : 'Note unpinned'); }
        else if (act === 'edit') openEditor(id);
        else if (act === 'del') { if (confirm(`Delete "${n.title}"? This cannot be undone.`)) { state.notes = state.notes.filter((x) => x.id !== id); save(); render(); toast('Note deleted'); } }
        else openEditor(id);
    });
    document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => {
        state.view = b.dataset.view; state.cat = 'All';
        if (state.view === 'settings') { state.q = ''; $('searchInput').value = ''; }
        render(); toggleMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    function toggleMenu(open) { $('sidebar').classList.toggle('open', open); $('overlay').classList.toggle('show', open); }
    $('menuBtn').onclick = () => toggleMenu(true);
    $('closeMenuBtn').onclick = $('overlay').onclick = () => toggleMenu(false);

    /* ---------- Settings: export / import / clear ---------- */
    $('exportBtn').onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(state.notes, null, 2)], { type: 'application/json' }));
        a.download = `notespace-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
        toast('Backup downloaded');
    };
    $('importInput').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const arr = JSON.parse(await f.text()); if (!Array.isArray(arr)) throw 0;
            const have = new Set(state.notes.map((n) => n.id));
            const fresh = arr.map(normalize).filter((n) => !have.has(n.id));
            state.notes.push(...fresh); save(); render(); toast(`Imported ${fresh.length} notes`);
        } catch (err) { toast('That file is not a valid NoteSpace backup'); }
        e.target.value = '';
    });
    $('clearBtn').onclick = () => {
        if (state.notes.length && confirm('Delete ALL notes from this device? This cannot be undone.')) { state.notes = []; save(); render(); toast('All notes deleted'); }
    };

    /* ---------- Online / offline ---------- */
    function updateStatus() {
        const on = navigator.onLine, t = on ? 'Online' : 'Offline';
        [$('statusPill'), $('statusChip')].forEach((el) => { el.dataset.online = on; });
        $('statusText').textContent = t; $('statusChip').querySelector('span').textContent = t;
        document.querySelectorAll('#statusPill use, #statusChip use').forEach((u) => u.setAttribute('href', on ? '#i-wifi' : '#i-wifi-off'));
    }
    window.addEventListener('online', () => { updateStatus(); toast('Back online'); });
    window.addEventListener('offline', () => { updateStatus(); toast('You are offline. Notes still save on this device.'); });

    /* ---------- PWA install + service worker ---------- */
    let deferred;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBtn').hidden = false; });
    $('installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('installBtn').hidden = true; };
    window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('NoteSpace installed'); });
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => { }));

    load(); updateStatus(); render();
})();
