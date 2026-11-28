import type {
  TrainingArchive,
  TrainingDecision,
  TrainingSession,
} from './records.ts';

const encoder = new TextEncoder();
const eventSizes = new WeakMap<
  TrainingDecision,
  { json: string; bytes: number }
>();
const jsonBytes = (value: unknown) =>
  encoder.encode(JSON.stringify(value)).byteLength;

// Accepted decisions are owned immutable snapshots. Freeze the complete graph
// before caching: a shallow freeze would allow nested hand/action edits to make
// the byte count stale. Weak keys do not retain pruned events or old archives.
function freezeSnapshot(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) freezeSnapshot(child);
  Object.freeze(value);
}

function serializedEvent(event: TrainingDecision) {
  const cached = eventSizes.get(event);
  if (cached !== undefined) return cached;
  freezeSnapshot(event);
  const json = JSON.stringify(event);
  const value = { json, bytes: encoder.encode(json).byteLength };
  eventSizes.set(event, value);
  return value;
}

// Retain JSON.stringify's key order, omitted undefined properties and escaping.
// Only the owned array field uses already-serialized immutable fragments.
function withArray(value: object, key: string, array: string): string {
  return (
    '{' +
    Object.entries(value)
      .flatMap(([name, entry]) => {
        const json = name === key ? array : JSON.stringify(entry);
        return json === undefined ? [] : [JSON.stringify(name) + ':' + json];
      })
      .join(',') +
    '}'
  );
}

export function serializeTrainingArchive(archive: TrainingArchive): string {
  return withArray(
    archive,
    'sessions',
    '[' +
      archive.sessions
        .map((session) =>
          withArray(
            session,
            'events',
            '[' +
              session.events
                .map((event) => serializedEvent(event).json)
                .join(',') +
              ']',
          ),
        )
        .join(',') +
      ']',
  );
}

export function trainingSessionBytes(session: TrainingSession): number {
  // Serialize only mutable metadata. This preserves omitted/null fields,
  // escaping, Unicode, timestamp widths, outcome and truncated exactly.
  return (
    jsonBytes({ ...session, events: [] }) +
    session.events.reduce(
      (sum, event) => sum + serializedEvent(event).bytes,
      0,
    ) +
    Math.max(0, session.events.length - 1)
  );
}

export function trainingArchiveBytes(archive: TrainingArchive): number {
  return (
    jsonBytes({ ...archive, sessions: [] }) +
    archive.sessions.reduce(
      (sum, session) => sum + trainingSessionBytes(session),
      0,
    ) +
    Math.max(0, archive.sessions.length - 1)
  );
}
