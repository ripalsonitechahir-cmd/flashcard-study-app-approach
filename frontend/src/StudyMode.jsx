import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export default function StudyMode({ deck, onProgress }) {
  const [shuffle, setShuffle] = useState(false);
  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [seen, setSeen] = useState([]);
  const [results, setResults] = useState([]); // { card, result }
  const [phase, setPhase] = useState('loading'); // loading | studying | empty | summary
  const [error, setError] = useState('');

  const loadNext = useCallback(async (exclude, hasResults) => {
    try {
      setCard(await api.nextCard(deck, exclude, shuffle));
      setRevealed(false);
      setPhase('studying');
    } catch (e) {
      setCard(null);
      if (e.status === 404) setPhase(hasResults ? 'summary' : 'empty');
      else { setError(e.message); setPhase('empty'); }
    }
  }, [deck, shuffle]);

  const start = useCallback(() => {
    setSeen([]);
    setResults([]);
    setError('');
    setPhase('loading');
    loadNext([], false);
  }, [loadNext]);

  useEffect(() => { start(); }, [start]);

  const answer = async (result) => {
    try {
      await api.recordResult(card.id, result);
      const nextSeen = [...seen, card.id];
      const nextResults = [...results, { card, result }];
      setSeen(nextSeen);
      setResults(nextResults);
      onProgress();
      loadNext(nextSeen, true);
    } catch (e) {
      setError(e.message);
      if (e.status === 404) { onProgress(); loadNext(seen, results.length > 0); }
    }
  };

  const knew = results.filter((r) => r.result === 'knew').length;

  return (
    <section className="study">
      <label className="inline">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Shuffle order
      </label>
      {error && <p className="error" role="alert">{error}</p>}

      {phase === 'loading' && <p className="empty">Loading…</p>}

      {phase === 'empty' && (
        <p className="empty">
          {deck ? `The "${deck}" deck has no cards to study yet.` : 'No cards to study yet.'} Add some on the Cards tab.
        </p>
      )}

      {phase === 'studying' && card && (
        <div className="flashcard">
          <small>{card.deck} · {seen.length + 1}{card.status === 'practice' ? ' · needs practice' : ''}</small>
          <div className="face front" data-testid="study-front">{card.front}</div>
          {revealed ? (
            <>
              <div className="face back" data-testid="study-back">{card.back}</div>
              <div className="actions">
                <button className="success" onClick={() => answer('knew')}>Knew it</button>
                <button className="warn" onClick={() => answer('practice')}>Need practice</button>
              </div>
            </>
          ) : (
            <button className="primary" onClick={() => setRevealed(true)}>Show answer</button>
          )}
        </div>
      )}

      {phase === 'summary' && (
        <div className="summary">
          <h2>Round complete!</h2>
          <p>You studied {results.length} card{results.length === 1 ? '' : 's'}: <b>{knew}</b> known, <b>{results.length - knew}</b> need practice.</p>
          {results.length - knew > 0 && (
            <ul>
              {results.filter((r) => r.result === 'practice').map((r) => <li key={r.card.id}>{r.card.front}</li>)}
            </ul>
          )}
          <button className="primary" onClick={start}>Study again</button>
        </div>
      )}
    </section>
  );
}
