import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import CardForm from './CardForm.jsx';
import StudyMode from './StudyMode.jsx';

export default function App() {
  const [tab, setTab] = useState('manage');
  const [deck, setDeck] = useState('');
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [stats, setStats] = useState({ total: 0, known: 0, practice: 0, new: 0 });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [c, d, s] = await Promise.all([api.listCards(deck, search), api.listDecks(), api.stats(deck)]);
      setCards(c);
      setDecks(d);
      setStats(s);
      setError('');
      if (deck && !d.some((x) => x.name === deck)) setDeck('');
    } catch (e) {
      setError(e.message);
    }
  }, [deck, search]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (card) => {
    if (!window.confirm(`Delete card "${card.front}"?`)) return;
    try {
      await api.deleteCard(card.id);
      if (editing?.id === card.id) setEditing(null);
      refresh();
    } catch (e) {
      setError(e.message);
      refresh();
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Flashcard Study App</h1>
        <nav>
          <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>Cards</button>
          <button className={tab === 'study' ? 'active' : ''} onClick={() => setTab('study')}>Study</button>
        </nav>
      </header>

      <section className="stats" aria-label="Statistics">
        <div><strong data-testid="stat-total">{stats.total}</strong><span>Total cards</span></div>
        <div className="known"><strong data-testid="stat-known">{stats.known}</strong><span>Known</span></div>
        <div className="practice"><strong data-testid="stat-practice">{stats.practice}</strong><span>Need practice</span></div>
      </section>

      <div className="toolbar">
        <label>
          Deck
          <select value={deck} onChange={(e) => setDeck(e.target.value)}>
            <option value="">All decks</option>
            {decks.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.count})</option>)}
          </select>
        </label>
        {tab === 'manage' && (
          <input
            type="search"
            placeholder="Search cards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {tab === 'manage' ? (
        <>
          <CardForm
            key={editing?.id ?? 'new'}
            card={editing}
            decks={decks}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); refresh(); }}
          />
          <section>
            <h2>{deck || 'All'} cards</h2>
            {cards.length === 0 ? (
              <p className="empty">
                {search || deck
                  ? 'No cards match. Try another deck or search.'
                  : 'No cards yet. Add your first card above!'}
              </p>
            ) : (
              <ul className="card-list">
                {cards.map((c) => (
                  <li key={c.id}>
                    <div className="card-text">
                      <div><b>{c.front}</b></div>
                      <div className="back">{c.back}</div>
                      <small>
                        <span className="deck-tag">{c.deck}</span>
                        <span className={`status ${c.status}`}>{c.status === 'practice' ? 'needs practice' : c.status}</span>
                      </small>
                    </div>
                    <div className="actions">
                      <button onClick={() => { setEditing(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                      <button className="danger" onClick={() => remove(c)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <StudyMode deck={deck} onProgress={refresh} />
      )}
    </div>
  );
}
