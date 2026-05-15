import { enrichAdminCards } from './cards';

describe('enrichAdminCards', () => {
  it('combina cards con perfiles y eventos recientes', () => {
    const cards = [{ id: 'card-1', profile_id: 'profile-1' }];
    const profiles = [{ id: 'profile-1', full_name: 'Carlos Alvarez', slug: 'carlos' }];
    const events = [
      { card_id: 'card-1', event_type: 'activated', created_at: '2026-05-14T12:00:00Z' },
      { card_id: 'card-1', event_type: 'assigned', created_at: '2026-05-14T11:00:00Z' },
    ];

    const [result] = enrichAdminCards({ cards, profiles, events });

    expect(result.profile_name).toBe('Carlos Alvarez');
    expect(result.profile_slug).toBe('carlos');
    expect(result.last_event).toEqual(events[0]);
    expect(result.events).toEqual(events);
  });

  it('tolera cards sin perfil ni eventos', () => {
    const [result] = enrichAdminCards({ cards: [{ id: 'card-2', profile_id: null }], profiles: [], events: [] });

    expect(result.profile_name).toBeNull();
    expect(result.profile_slug).toBeNull();
    expect(result.last_event).toBeNull();
    expect(result.events).toEqual([]);
  });
});
