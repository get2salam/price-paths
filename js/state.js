export const SPEC = {
  "slug": "price-paths",
  "title": "Price Paths",
  "description": "Sketch pricing experiments and compare which paths feel strongest.",
  "lede": "Track pricing experiments with audience, risk, confidence, and next review dates.",
  "heroEyebrow": "Pricing workspace",
  "boardTitle": "Price paths board",
  "boardSubtitle": "A local-first board for testing price structures without losing the reasoning behind them.",
  "accent": "Pricing gets clearer when audience, risk, confidence, and review timing are visible for each path.",
  "itemLabel": "price path",
  "itemPluralLabel": "Price paths",
  "labels": {
    "title": "Price path",
    "note": "Pricing note",
    "category": "Path type",
    "state": "Status",
    "score": "Upside",
    "effort": "Risk"
  },
  "metric": {
    "label": "Confidence",
    "min": 1,
    "max": 10,
    "default": 6
  },
  "textOne": {
    "label": "Audience",
    "default": "Who this price path is for"
  },
  "textTwo": {
    "label": "Risk",
    "default": "What could make this fail"
  },
  "date": {
    "label": "Review date"
  },
  "categories": [
    "Entry",
    "Core",
    "Premium",
    "Experiment"
  ],
  "states": [
    "Exploring",
    "Testing",
    "Validated",
    "Dropped"
  ],
  "completedStates": [
    "Validated",
    "Dropped"
  ],
  "stateWeights": {
    "Exploring": 2,
    "Testing": 8,
    "Validated": 4,
    "Dropped": 1
  },
  "defaults": {
    "note": "Write the pricing logic here so the path can be judged on evidence, not mood."
  },
  "stats": {
    "totalLabel": "Paths",
    "motionLabel": "Being tested",
    "dueLabel": "Reviews soon"
  },
  "insights": {
    "topLabel": "Best pricing bet",
    "dateLabel": "Next pricing review",
    "metricLabel": "Highest confidence"
  },
  "queue": {
    "eyebrow": "Pricing queue",
    "title": "What to pressure-test next",
    "empty": "Validated and dropped paths leave the active queue."
  },
  "mix": {
    "eyebrow": "Pricing mix",
    "title": "How the paths are distributed"
  },
  "emptyTitle": "No price paths yet",
  "emptyBody": "Add entry, core, premium, and experiment paths you want to compare.",
  "actions": [
    {
      "id": "start-test",
      "label": "Start test",
      "mode": "advance",
      "state": "Testing",
      "days": 3,
      "fromToday": true,
      "toast": "Moved this price path into testing."
    },
    {
      "id": "raise-confidence",
      "label": "Raise confidence",
      "mode": "advance",
      "metricDelta": 1,
      "toast": "Raised confidence on this path."
    },
    {
      "id": "drop",
      "label": "Drop path",
      "mode": "advance",
      "state": "Dropped",
      "days": 0,
      "fromToday": true,
      "toast": "Dropped this price path for now."
    }
  ],
  "theme": {
    "primary": "#f97316",
    "secondary": "#facc15",
    "panel": "#1a1108",
    "edge": "#6d4b1f",
    "glow": "rgba(249, 115, 22, 0.22)"
  },
  "items": [
    {
      "title": "Low-friction pilot",
      "category": "Entry",
      "state": "Testing",
      "score": 8,
      "effort": 3,
      "metric": 7,
      "textOne": "First-time buyer",
      "textTwo": "Too cheap may feel low-trust",
      "date": "2026-04-26",
      "note": "The pilot price should lower hesitation without making the work feel disposable."
    },
    {
      "title": "Core monthly retainer",
      "category": "Core",
      "state": "Exploring",
      "score": 9,
      "effort": 4,
      "metric": 6,
      "textOne": "Growing firms",
      "textTwo": "Scope creep risk",
      "date": "2026-04-29",
      "note": "This could become the stable spine if scope is bounded hard enough."
    },
    {
      "title": "Premium advisory path",
      "category": "Premium",
      "state": "Validated",
      "score": 7,
      "effort": 2,
      "metric": 8,
      "textOne": "High-trust buyer",
      "textTwo": "Needs stronger exclusivity framing",
      "date": "2026-04-24",
      "note": "Works when the proof stack is strong enough to justify premium trust."
    }
  ]
};

export const STORAGE_KEY = `${SPEC.slug}/state/v3`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  // Reject silent calendar rollover ("2026-04-31" -> May 1, "2026-02-29" -> Mar 1).
  return toLocalISO(date) === value;
}

export function todayISO(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toLocalISO(date);
}

export function daysFromToday(value, today = todayISO()) {
  if (!isValidISODate(value)) return 999;
  const todayDate = new Date(`${today}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  return Math.round((target - todayDate) / 86400000);
}

export function bumpDate(value, days) {
  const base = isValidISODate(value) ? value : todayISO();
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalISO(date);
}

export function clamp(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function completedStates() {
  return new Set(SPEC.completedStates || []);
}

export function stateWeight(state) {
  return (SPEC.stateWeights || {})[state] ?? 0;
}

export function uid() {
  return `${SPEC.slug}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalize(item = {}) {
  return {
    id: item.id || uid(),
    title: item.title || `New ${SPEC.itemLabel}`,
    note: item.note || SPEC.defaults.note,
    category: SPEC.categories.includes(item.category) ? item.category : SPEC.categories[0],
    state: SPEC.states.includes(item.state) ? item.state : SPEC.states[0],
    score: clamp(item.score ?? 7, 1, 10),
    effort: clamp(item.effort ?? 3, 1, 10),
    metric: clamp(item.metric ?? SPEC.metric.default ?? 6, SPEC.metric.min, SPEC.metric.max),
    textOne: item.textOne || SPEC.textOne.default,
    textTwo: item.textTwo || SPEC.textTwo.default,
    date: isValidISODate(item.date) ? item.date : todayISO(3),
  };
}

export function priority(item, today = todayISO()) {
  const completed = completedStates().has(item.state);
  const dueBoost = completed ? 0 : Math.max(0, 4 - Math.max(daysFromToday(item.date, today), 0)) * 4;
  return item.score * 6 + item.metric * 5 + dueBoost + stateWeight(item.state) - item.effort * 4;
}

function hasSpecificText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length >= 12 && text !== fallback;
}

export function pricePathReadiness(item = {}, today = todayISO()) {
  const candidate = normalize(item);
  const blockers = [];
  const strengths = [];
  let score = 0;

  if (candidate.state === 'Dropped') {
    blockers.push('Path is dropped, so it should not be evaluated as a live test.');
  } else if (candidate.state === 'Validated') {
    score += 12;
    strengths.push('Validated paths have enough signal to preserve the learning.');
  } else if (candidate.state === 'Testing') {
    score += 20;
    strengths.push('Testing status shows this path is already in motion.');
  } else {
    score += 12;
  }

  if (candidate.metric >= 7) {
    score += 20;
    strengths.push('Confidence is strong enough to justify a live pricing test.');
  } else if (candidate.metric >= 5) {
    score += 12;
  } else {
    blockers.push('Confidence is below 5/10.');
  }

  const upsideMargin = candidate.score - candidate.effort;
  if (upsideMargin >= 4) {
    score += 20;
    strengths.push('Upside is clearly higher than risk.');
  } else if (upsideMargin >= 2) {
    score += 14;
  } else if (upsideMargin >= 0) {
    score += 8;
  } else {
    blockers.push('Risk is higher than upside.');
  }

  if (hasSpecificText(candidate.textOne, SPEC.textOne.default)) score += 10;
  else blockers.push('Audience needs a specific buyer segment.');

  if (hasSpecificText(candidate.textTwo, SPEC.textTwo.default)) score += 10;
  else blockers.push('Risk needs a concrete failure mode.');

  const daysUntilReview = daysFromToday(candidate.date, today);
  if (daysUntilReview < 0) {
    score += 4;
    blockers.push('Review date is overdue.');
  } else if (daysUntilReview <= 7) {
    score += 20;
    strengths.push('Review date is soon enough to force a decision.');
  } else if (daysUntilReview <= 14) {
    score += 14;
  } else {
    score += 8;
    blockers.push('Review date is too far away for a tight price test.');
  }

  return {
    score: clamp(score, 0, 100),
    grade: score >= 80 ? 'ready' : score >= 60 ? 'watch' : 'needs-work',
    blockers,
    strengths,
  };
}

export function bestActiveItem(items, today = todayISO()) {
  const completed = completedStates();
  const active = items.filter((item) => item && !completed.has(item.state));
  if (active.length === 0) return null;
  return active.slice().sort((a, b) =>
    priority(b, today) - priority(a, today)
    || daysFromToday(a.date, today) - daysFromToday(b.date, today)
  )[0];
}

export function nextSelectionId(items = [], selectedId = null, key = '') {
  if (!Array.isArray(items) || items.length === 0) return null;
  const ids = items.map((item) => item?.id).filter(Boolean);
  if (ids.length === 0) return null;

  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];

  const currentIndex = ids.indexOf(selectedId);
  if (key === 'ArrowDown') {
    return ids[currentIndex >= 0 ? Math.min(currentIndex + 1, ids.length - 1) : 0];
  }
  if (key === 'ArrowUp') {
    return ids[currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : ids.length - 1];
  }

  return selectedId;
}

export function seedState() {
  return {
    boardTitle: SPEC.boardTitle,
    boardSubtitle: SPEC.boardSubtitle,
    items: SPEC.items.map((item) => normalize(item)),
    ui: { search: '', category: 'all', status: 'all', selectedId: null },
  };
}

export function safeLoad(parsed) {
  const seed = seedState();
  if (!parsed || typeof parsed !== 'object') return seed;
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const rawUi = parsed.ui && typeof parsed.ui === 'object' ? parsed.ui : {};
  return {
    ...seed,
    boardTitle: typeof parsed.boardTitle === 'string' ? parsed.boardTitle : seed.boardTitle,
    boardSubtitle: typeof parsed.boardSubtitle === 'string' ? parsed.boardSubtitle : seed.boardSubtitle,
    items: rawItems.map((item) => normalize(item)),
    ui: { ...seed.ui, ...rawUi },
  };
}
