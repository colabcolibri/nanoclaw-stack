import type { AgentTool } from './types.js';
import { getGoogleToken } from './google-auth.js';

export const googleCalendarTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'google_calendar',
      description: 'Queries, creates, and manages events across all user Google Calendars (primary, personal, team, shared).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_calendars', 'list_events', 'create_event', 'search_events'],
            description: 'Action to perform: "list_calendars" (list available calendars), "list_events" (list upcoming events), "search_events" (search events by title/text), "create_event" (schedule new event).',
          },
          calendar_id: {
            type: 'string',
            description: 'Calendar ID (e.g. "primary", or ID from list_calendars). If omitted, searches across all active user calendars.',
          },
          query: {
            type: 'string',
            description: 'Search term (for search_events) or event summary/title (for create_event).',
          },
          date: {
            type: 'string',
            description: 'Event date or start date filter (ISO 8601 or YYYY-MM-DD).',
          },
          start_time: {
            type: 'string',
            description: 'Start time ISO 8601 (for create_event).',
          },
          end_time: {
            type: 'string',
            description: 'End time ISO 8601 (for create_event).',
          },
          description: {
            type: 'string',
            description: 'Description or meeting details of the event.',
          },
          location: {
            type: 'string',
            description: 'Meeting location, physical address, or virtual meeting link.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const token = await getGoogleToken(cwd);
    if (!token) {
      return JSON.stringify({
        status: 'error',
        error: 'Conta do Google não conectada ainda. Conecte sua conta clicando em "Conectar Conta Google" no painel Web (https://uai.sergioluciano.com na aba Servidores MCP).',
      });
    }

    // 1. List all accessible calendars
    if (args.action === 'list_calendars') {
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!calRes.ok) {
        return JSON.stringify({ status: 'error', code: calRes.status, text: await calRes.text() });
      }
      const data = (await calRes.json()) as any;
      const calendars = (data.items || []).map((cal: any) => ({
        id: cal.id,
        summary: cal.summary || '(Sem nome)',
        description: cal.description,
        primary: !!cal.primary,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
      }));
      return JSON.stringify({ status: 'ok', totalCalendars: calendars.length, calendars });
    }

    // 2. Create event on a specific calendar (or primary)
    if (args.action === 'create_event') {
      const targetCal = args.calendar_id || 'primary';
      const startDateTime = args.start_time || args.date || new Date().toISOString();
      const endDateTime = args.end_time || new Date(new Date(startDateTime).getTime() + 3600000).toISOString();

      const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCal)}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: args.query || 'Nova Reunião',
          description: args.description,
          location: args.location,
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
        }),
      });
      const created = await createRes.json();
      return JSON.stringify(created);
    }

    // 3. List or Search events across calendars
    const nowIso = args.date ? (args.date.includes('T') ? args.date : `${args.date}T00:00:00Z`) : new Date().toISOString();
    const searchQuery = args.action === 'search_events' ? args.query : undefined;

    // If a specific calendarId is requested:
    if (args.calendar_id) {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendar_id)}/events?timeMin=${encodeURIComponent(nowIso)}&maxResults=25&singleEvents=true&orderBy=startTime`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      const listRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!listRes.ok) {
        return JSON.stringify({ status: 'error', code: listRes.status, text: await listRes.text() });
      }
      const data = (await listRes.json()) as any;
      const items = (data.items || []).map((ev: any) => ({
        calendarId: args.calendar_id,
        id: ev.id,
        title: ev.summary || '(Sem título)',
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        location: ev.location,
        description: ev.description,
        link: ev.htmlLink,
      }));
      return JSON.stringify({ status: 'ok', totalEventsFound: items.length, events: items });
    }

    // Otherwise, query ALL active calendars the user monitors
    const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` },
    });
    let targetCalendars: Array<{ id: string; summary: string }> = [{ id: 'primary', summary: 'Principal' }];
    if (calListRes.ok) {
      const calData = (await calListRes.json()) as any;
      const items = (calData.items || []).filter((c: any) => !c.id.includes('#holiday') || (searchQuery && /feriado/i.test(searchQuery)));
      if (items.length > 0) {
        targetCalendars = items.map((c: any) => ({ id: c.id, summary: c.summary || c.id }));
      }
    }

    const allEventsPromises = targetCalendars.map(async (cal) => {
      try {
        let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(nowIso)}&maxResults=15&singleEvents=true&orderBy=startTime`;
        if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return [];
        const d = (await r.json()) as any;
        return (d.items || []).map((ev: any) => ({
          calendar: cal.summary,
          calendarId: cal.id,
          id: ev.id,
          title: ev.summary || '(Sem título)',
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          location: ev.location,
          description: ev.description,
          link: ev.htmlLink,
        }));
      } catch {
        return [];
      }
    });

    const settled = await Promise.allSettled(allEventsPromises);
    const flatEvents = settled
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 30);

    return JSON.stringify({
      status: 'ok',
      totalEventsFound: flatEvents.length,
      monitoredCalendars: targetCalendars.map((c) => c.summary),
      events: flatEvents,
    });
  },
};
