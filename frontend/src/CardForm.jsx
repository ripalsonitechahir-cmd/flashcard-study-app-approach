import { useState } from 'react';
import { api } from './api.js';

export default function CardForm({ card, decks, onSaved, onCancel }) {
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [deck, setDeck] = useState(card && card.deck !== 'General' ? card.deck : card ? 'General' : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError('Both front and back are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { front, back, deck };
      if (card) await api.updateCard(card.id, payload);
      else await api.createCard(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="card-form" onSubmit={submit}>
      <h2>{card ? 'Edit card' : 'Add a card'}</h2>
      <label>Front
        <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} placeholder="Question or term" />
      </label>
      <label>Back
        <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} placeholder="Answer or definition" />
      </label>
      <label>Deck (optional)
        <input list="deck-options" value={deck} onChange={(e) => setDeck(e.target.value)} placeholder="General" />
        <datalist id="deck-options">
          {decks.map((d) => <option key={d.name} value={d.name} />)}
        </datalist>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>{card ? 'Save changes' : 'Add card'}</button>
        {card && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
