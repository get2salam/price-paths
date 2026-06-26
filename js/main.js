import {
  SPEC,
  STORAGE_KEY,
  bestActiveItem,
  bumpDate,
  clamp,
  completedStates,
  daysFromToday,
  isValidISODate,
  nextSelectionId,
  normalize,
  priority,
  safeLoad,
  seedState,
  todayISO,
} from './state.js';

const refs = {
  boardTitle: document.querySelector('[data-role="board-title"]'),
  boardSubtitle: document.querySelector('[data-role="board-subtitle"]'),
  stats: document.querySelector('[data-role="stats"]'),
  insights: document.querySelector('[data-role="insights"]'),
  count: document.querySelector('[data-role="count"]'),
  resultsSummary: document.querySelector('[data-role="results-summary"]'),
  list: document.querySelector('[data-role="list"]'),
  editor: document.querySelector('[data-role="editor"]'),
  secondaryPrimary: document.querySelector('[data-role="secondary-primary"]'),
  secondarySecondary: document.querySelector('[data-role="secondary-secondary"]'),
  search: document.querySelector('[data-field="search"]'),
  category: document.querySelector('[data-field="category"]'),
  status: document.querySelector('[data-field="status"]'),
  importFile: document.querySelector('#import-file'),
};

const toastHost = (() => {
  const host = document.createElement('div');
  host.className = 'toast-host';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'true');
  document.body.appendChild(host);
  return host;
})();

function showToast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 200);
  }, 2200);
}

function formatDate(value) {
  if (!isValidISODate(value)) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toneForDate(item) {
  if (completedStates().has(item.state)) return 'success';
  const days = daysFromToday(item.date);
  if (days <= 0) return 'danger';
  if (days <= 2) return 'warn';
  return 'success';
}

function filterDescription() {
  const parts = [];
  const search = state.ui.search.trim();
  if (search) parts.push(`matching “${search}”`);
  if (state.ui.category !== 'all') parts.push(`in ${state.ui.category}`);
  if (state.ui.status !== 'all') parts.push(`with status ${state.ui.status}`);
  return parts.length ? parts.join(', ') : 'with no filters applied';
}

function visibleResultsCopy(items) {
  if (!state.items.length) return `No ${SPEC.itemPluralLabel.toLowerCase()} yet. Add a path to start comparing options.`;
  const noun = items.length === 1 ? SPEC.itemLabel : SPEC.itemPluralLabel.toLowerCase();
  if (!items.length) return `No ${SPEC.itemPluralLabel.toLowerCase()} found ${filterDescription()}. Try widening the filters.`;
  return `${items.length} ${noun} visible ${filterDescription()}.`;
}

function itemA11yLabel(item) {
  return `${item.title}. ${item.state} ${SPEC.itemLabel}. Priority ${priority(item)}. ${SPEC.date.label}: ${formatDate(item.date)}. ${SPEC.metric.label}: ${item.metric} of ${SPEC.metric.max}.`;
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return safeLoad(JSON.parse(raw));
  } catch (error) {
    console.warn('Falling back to seed state', error);
    return seedState();
  }
}

let state = hydrate();
if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function filteredItems() {
  const query = state.ui.search.trim().toLowerCase();
  return [...state.items]
    .filter((item) => state.ui.category === 'all' || item.category === state.ui.category)
    .filter((item) => state.ui.status === 'all' || item.state === state.ui.status)
    .filter((item) => !query || `${item.title} ${item.note} ${item.category} ${item.state} ${item.textOne} ${item.textTwo}`.toLowerCase().includes(query))
    .sort((a, b) => priority(b) - priority(a) || daysFromToday(a.date) - daysFromToday(b.date));
}

function selectedItem() {
  return state.items.find((item) => item.id === state.ui.selectedId) || filteredItems()[0] || null;
}

function moveListSelection(key) {
  const items = filteredItems();
  const selectedId = nextSelectionId(items, state.ui.selectedId, key);
  if (selectedId && selectedId !== state.ui.selectedId) {
    commit({ ...state, ui: { ...state.ui, selectedId } });
  }
}

function commit(nextState) {
  state = nextState;
  if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;
  persist();
  render();
}

function updateSelected(field, value) {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => {
      if (item.id !== target.id) return item;
      const next = { ...item, [field]: value };
      if (['score', 'effort', 'metric'].includes(field)) {
        const bounds = field === 'metric' ? SPEC.metric : { min: 1, max: 10 };
        next[field] = clamp(value, bounds.min, bounds.max);
      }
      return next;
    }),
  });
}

function addItem() {
  const item = normalize({ title: `New ${SPEC.itemLabel}`, note: SPEC.defaults.note, textOne: SPEC.textOne.default, textTwo: SPEC.textTwo.default });
  commit({
    ...state,
    items: [item, ...state.items],
    ui: { ...state.ui, selectedId: item.id },
  });
  showToast(`Added a new ${SPEC.itemLabel}.`);
}

function removeSelected() {
  const target = selectedItem();
  if (!target) return;
  const nextItems = state.items.filter((item) => item.id !== target.id);
  commit({
    ...state,
    items: nextItems,
    ui: { ...state.ui, selectedId: nextItems[0]?.id || null },
  });
  showToast(`Removed ${SPEC.itemLabel}.`);
}

function exportState() {
  const blob = new Blob([JSON.stringify({ schema: `${SPEC.slug}/v3`, ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${SPEC.slug}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded backup.');
}

async function importState(file) {
  const raw = await file.text();
  commit(safeLoad(JSON.parse(raw)));
  showToast('Imported backup.');
}

async function copyValue(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`Copied ${label}.`);
  } catch {
    window.prompt(`Copy ${label}:`, value);
  }
}

function runAction(action) {
  const target = selectedItem();
  if (!target) return;
  if (action.mode === 'copy') {
    copyValue(target[action.key] || '', action.label.toLowerCase());
    return;
  }

  const metricMin = SPEC.metric.min;
  const metricMax = SPEC.metric.max;

  commit({
    ...state,
    items: state.items.map((item) => {
      if (item.id !== target.id) return item;
      const next = { ...item };
      if (action.state) next.state = action.state;
      if (action.days !== undefined) next.date = bumpDate(action.fromToday ? todayISO() : item.date, action.days);
      if (action.metricDelta) next.metric = clamp(item.metric + action.metricDelta, metricMin, metricMax);
      if (action.scoreDelta) next.score = clamp(item.score + action.scoreDelta, 1, 10);
      if (action.effortDelta) next.effort = clamp(item.effort + action.effortDelta, 1, 10);
      return next;
    }),
  });
  showToast(action.toast || action.label);
}

function renderStats(items) {
  const completed = state.items.filter((item) => completedStates().has(item.state)).length;
  const inMotion = state.items.filter((item) => !completedStates().has(item.state) && item.state !== SPEC.states[0]).length;
  const dueSoon = state.items.filter((item) => !completedStates().has(item.state) && daysFromToday(item.date) <= 3).length;
  const avgMetric = state.items.length ? (state.items.reduce((sum, item) => sum + item.metric, 0) / state.items.length).toFixed(1) : '0.0';
  const cards = [
    [SPEC.stats.totalLabel || SPEC.itemPluralLabel, String(state.items.length), `tracked ${SPEC.itemPluralLabel.toLowerCase()} on the board`],
    [SPEC.stats.motionLabel || 'In motion', String(inMotion), `${completed} completed or parked`],
    [SPEC.stats.dueLabel || 'Due soon', String(dueSoon), `${items.length} visible under current filters`],
    [SPEC.metric.label, avgMetric, `average ${SPEC.metric.label.toLowerCase()} across the board`],
  ];
  refs.stats.innerHTML = cards.map(([label, valueText, note]) => `
    <article class="card stat">
      <span>${label}</span>
      <strong>${valueText}</strong>
      <small>${note}</small>
    </article>
  `).join('');
  refs.count.textContent = items[0] ? `Top: ${items[0].title}` : `No ${SPEC.itemPluralLabel.toLowerCase()}`;
  refs.resultsSummary.textContent = visibleResultsCopy(items);
}

function renderInsights() {
  const nextSlot = [...state.items].filter((item) => !completedStates().has(item.state)).sort((a, b) => daysFromToday(a.date) - daysFromToday(b.date))[0];
  const strongestMetric = [...state.items].sort((a, b) => b.metric - a.metric)[0];
  // The "best current bet" should reflect what to act on next, so it must
  // exclude validated and dropped paths even when they have high upside.
  const bestBet = bestActiveItem(state.items);
  const cards = [
    {
      label: SPEC.insights.topLabel || 'Best current bet',
      title: bestBet?.title || `No ${SPEC.itemLabel} yet`,
      body: bestBet ? `Priority ${priority(bestBet)} with ${SPEC.metric.label.toLowerCase()} ${bestBet.metric}/${SPEC.metric.max}.` : 'Add a record and the best current bet will surface here.',
    },
    {
      label: SPEC.insights.dateLabel || SPEC.date.label,
      title: nextSlot?.title || 'Nothing queued',
      body: nextSlot ? `${formatDate(nextSlot.date)} with ${SPEC.textTwo.label.toLowerCase()}: ${escapeHtml(nextSlot.textTwo)}.` : 'Your next review slot will surface here.',
    },
    {
      label: SPEC.insights.metricLabel || `Highest ${SPEC.metric.label.toLowerCase()}`,
      title: strongestMetric?.title || `No ${SPEC.itemLabel} yet`,
      body: strongestMetric ? `${SPEC.metric.label} ${strongestMetric.metric}/${SPEC.metric.max} and state ${escapeHtml(strongestMetric.state)}.` : 'Metric standouts appear here once the board has data.',
    },
  ];
  refs.insights.innerHTML = cards.map((card) => `
    <article class="card insight-card">
      <p class="eyebrow">${card.label}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${card.body}</p>
    </article>
  `).join('');
}

function renderList(items) {
  if (!items.length) {
    refs.list.innerHTML = `
      <div class="empty">
        <strong>${state.items.length ? 'No matching price paths' : SPEC.emptyTitle}</strong>
        <p>${state.items.length ? 'Search, path type, or status filters are hiding every path. Clear a filter or re-seed the sample board.' : SPEC.emptyBody}</p>
      </div>
    `;
    return;
  }

  refs.list.innerHTML = items.map((item) => `
    <button class="item ${item.id === state.ui.selectedId ? 'is-selected' : ''}" type="button" data-id="${item.id}" role="option" aria-selected="${item.id === state.ui.selectedId}" aria-label="${escapeHtml(itemA11yLabel(item))}">
      <div class="item-top">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="score">${priority(item)}</span>
      </div>
      <p>${escapeHtml(item.note)}</p>
      <div class="badge-row">
        <span class="pill ${toneForDate(item)}">${formatDate(item.date)}</span>
        <span class="pill">${escapeHtml(item.textOne)}</span>
        <span class="pill">${SPEC.metric.label} ${item.metric}/${SPEC.metric.max}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.state)}</span>
        <span>${SPEC.textTwo.label}: ${escapeHtml(item.textTwo)}</span>
        <span>Friction ${item.effort}/10</span>
      </div>
    </button>
  `).join('');
}

function renderEditor(item) {
  if (!item) {
    refs.editor.innerHTML = `
      <div class="empty">
        <strong>No selection</strong>
        <p>Pick a ${SPEC.itemLabel} or create a new one.</p>
      </div>
    `;
    return;
  }

  refs.editor.innerHTML = `
    <div class="editor-head">
      <div>
        <p class="eyebrow">${SPEC.editorEyebrow || `${SPEC.itemLabel} editor`}</p>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <span class="score">Priority ${priority(item)}</span>
    </div>
    <div class="editor-grid">
      <label class="field">
        <span>${SPEC.labels.title}</span>
        <input type="text" data-item-field="title" value="${escapeHtml(item.title)}" />
      </label>
      <label class="field">
        <span>${SPEC.textOne.label}</span>
        <input type="text" data-item-field="textOne" value="${escapeHtml(item.textOne)}" />
      </label>
      <label class="field">
        <span>${SPEC.textTwo.label}</span>
        <input type="text" data-item-field="textTwo" value="${escapeHtml(item.textTwo)}" />
      </label>
      <label class="field">
        <span>${SPEC.labels.note}</span>
        <textarea data-item-field="note">${escapeHtml(item.note)}</textarea>
      </label>
      <div class="field-grid">
        <label class="field">
          <span>${SPEC.labels.category}</span>
          <select data-item-field="category">${SPEC.categories.map((entry) => `<option value="${entry}" ${item.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
        </label>
        <label class="field">
          <span>${SPEC.labels.state}</span>
          <select data-item-field="state">${SPEC.states.map((entry) => `<option value="${entry}" ${item.state === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
        </label>
      </div>
      <div class="field-grid">
        <label class="field">
          <span>${SPEC.date.label}</span>
          <input type="date" data-item-field="date" value="${escapeHtml(item.date)}" />
        </label>
        <label class="field range-wrap">
          <span>${SPEC.metric.label}</span>
          <input type="range" min="${SPEC.metric.min}" max="${SPEC.metric.max}" data-item-field="metric" value="${item.metric}" />
          <output>${item.metric} / ${SPEC.metric.max}</output>
        </label>
      </div>
      <div class="field-grid three">
        <label class="field range-wrap">
          <span>${SPEC.labels.score}</span>
          <input type="range" min="1" max="10" data-item-field="score" value="${item.score}" />
          <output>${item.score} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>${SPEC.labels.effort}</span>
          <input type="range" min="1" max="10" data-item-field="effort" value="${item.effort}" />
          <output>${item.effort} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>Priority</span>
          <input type="range" min="0" max="100" value="${Math.min(100, priority(item))}" disabled />
          <output>${priority(item)}</output>
        </label>
      </div>
      <div class="quick-actions">
        ${SPEC.actions.map((action) => `<button class="btn" type="button" data-action-id="${action.id}" aria-label="${escapeHtml(`${action.label} for ${item.title}`)}">${action.label}</button>`).join('')}
      </div>
      <div class="editor-actions">
        <span class="helper">${SPEC.date.label} ${formatDate(item.date)} and ${SPEC.metric.label.toLowerCase()} ${item.metric}/${SPEC.metric.max}.</span>
        <button class="btn btn-danger" type="button" data-action="remove-current">Remove</button>
      </div>
    </div>
  `;
}

function renderPanels() {
  const queue = [...state.items].filter((item) => !completedStates().has(item.state)).sort((a, b) => daysFromToday(a.date) - daysFromToday(b.date));
  refs.secondaryPrimary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">${SPEC.queue.eyebrow}</p>
        <h3>${SPEC.queue.title}</h3>
      </div>
      <span class="chip">${queue.length} pending</span>
    </div>
    <div class="stack">
      ${queue.slice(0, 4).map((item) => `
        <div class="mini-card">
          <div class="inline-split">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="pill ${toneForDate(item)}">${formatDate(item.date)}</span>
          </div>
          <p>${escapeHtml(item.textOne)} · ${escapeHtml(item.textTwo)} · ${SPEC.metric.label.toLowerCase()} ${item.metric}/${SPEC.metric.max}.</p>
        </div>
      `).join('') || `<div class="empty"><strong>No pending ${SPEC.itemPluralLabel.toLowerCase()}</strong><p>${SPEC.queue.empty}</p></div>`}
    </div>
  `;

  const byCategory = SPEC.categories.map((entry) => ({ entry, count: state.items.filter((item) => item.category === entry).length }));
  const strongest = state.items.length ? [...state.items].sort((a, b) => b.metric - a.metric)[0].title : '—';
  refs.secondarySecondary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">${SPEC.mix.eyebrow}</p>
        <h3>${SPEC.mix.title}</h3>
      </div>
      <span class="chip">${state.items.length} total</span>
    </div>
    <ul class="metric-list">
      ${byCategory.map(({ entry, count }) => `<li><span>${escapeHtml(entry)}</span><strong>${count}</strong></li>`).join('')}
      <li><span>Strongest ${SPEC.metric.label.toLowerCase()}</span><strong>${escapeHtml(strongest)}</strong></li>
    </ul>
  `;
}

function render() {
  refs.boardTitle.textContent = state.boardTitle;
  refs.boardSubtitle.textContent = state.boardSubtitle;
  refs.search.value = state.ui.search;
  refs.category.innerHTML = `<option value="all">All ${SPEC.labels.category.toLowerCase()}</option>${SPEC.categories.map((entry) => `<option value="${entry}" ${state.ui.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  refs.status.innerHTML = `<option value="all">All ${SPEC.labels.state.toLowerCase()}</option>${SPEC.states.map((entry) => `<option value="${entry}" ${state.ui.status === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  const items = filteredItems();
  if (!items.some((item) => item.id === state.ui.selectedId)) state.ui.selectedId = items[0]?.id || null;
  renderStats(items);
  renderInsights();
  renderList(items);
  renderEditor(selectedItem());
  renderPanels();
}

document.addEventListener('click', (event) => {
  const itemButton = event.target.closest('.item');
  if (itemButton) {
    commit({ ...state, ui: { ...state.ui, selectedId: itemButton.dataset.id } });
    return;
  }

  const explicit = event.target.closest('[data-action]')?.dataset.action;
  if (explicit === 'new') { addItem(); return; }
  if (explicit === 'reset') { commit(seedState()); showToast('Re-seeded sample board.'); return; }
  if (explicit === 'remove-current') { removeSelected(); return; }
  if (explicit === 'export') { exportState(); return; }
  if (explicit === 'import') { refs.importFile.click(); return; }

  const actionId = event.target.closest('[data-action-id]')?.dataset.actionId;
  if (actionId) {
    const action = SPEC.actions.find((entry) => entry.id === actionId);
    if (action) runAction(action);
  }
});

document.addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  if (field === 'search') {
    commit({ ...state, ui: { ...state.ui, search: event.target.value } });
    return;
  }
  const itemField = event.target.dataset.itemField;
  if (itemField) updateSelected(itemField, event.target.value);
});

document.addEventListener('change', async (event) => {
  const field = event.target.dataset.field;
  if (field === 'category' || field === 'status') {
    commit({ ...state, ui: { ...state.ui, [field]: event.target.value } });
    return;
  }
  if (event.target.id === 'import-file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importState(file);
    } catch (error) {
      console.error(error);
      showToast('Import failed.');
    } finally {
      event.target.value = '';
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && event.target === refs.search) {
    if (refs.search.value) {
      commit({ ...state, ui: { ...state.ui, search: '' } });
    }
    refs.search.blur();
    return;
  }
  if (event.target.closest('input, textarea, select')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    moveListSelection(event.key);
    return;
  }
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    addItem();
  }
  if (event.key === '/') {
    event.preventDefault();
    refs.search.focus();
  }
});

render();
