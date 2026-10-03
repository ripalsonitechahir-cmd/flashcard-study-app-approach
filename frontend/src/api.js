async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  listCards: (deck, q) => request('GET', `/cards${qs({ deck, q })}`),
  listDecks: () => request('GET', '/decks'),
  createCard: (card) => request('POST', '/cards', card),
  updateCard: (id, card) => request('PUT', `/cards/${id}`, card),
  deleteCard: (id) => request('DELETE', `/cards/${id}`),
  stats: (deck) => request('GET', `/stats${qs({ deck })}`),
  nextCard: (deck, exclude, shuffle) =>
    request('GET', `/study/next${qs({ deck, exclude: exclude.join(','), shuffle: shuffle ? 'true' : '' })}`),
  recordResult: (id, result) => request('POST', `/cards/${id}/result`, { result }),
};
