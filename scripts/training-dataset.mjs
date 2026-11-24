import { createHash } from 'node:crypto';
import {
  parseTrainingDecision,
  parseTrainingOutcome,
} from '../server/training/records.ts';

// Validate and normalize the complete export before writing any dataset files.
export function prepareDataset(data) {
  if (!data || ![1, 2].includes(data.schema) || !Array.isArray(data.sessions))
    throw Error('Unsupported training export');
  const partitions = { train: [], validation: [], test: [] };
  const sessions = new Set(),
    records = new Set();
  let ignoredBots = 0;
  let legacyRounds = 0;
  for (const session of data.sessions) {
    if (
      !session ||
      typeof session.id !== 'string' ||
      !session.id.length ||
      session.id.length > 128 ||
      sessions.has(session.id) ||
      !Array.isArray(session.events) ||
      !session.events.length ||
      typeof session.truncated !== 'boolean'
    )
      throw Error('Invalid or duplicate training session');
    sessions.add(session.id);
    const outcome = parseTrainingOutcome(session.outcome);
    if (!outcome?.delta) throw Error('Missing or invalid round outcome');
    const groupId = data.schema === 2 ? session.groupId : null;
    if (
      groupId !== null &&
      (typeof groupId !== 'string' || !groupId.length || groupId.length > 128)
    )
      throw Error('Invalid anonymous match group');
    // Old exports lack match boundaries. Keep them out of evaluation splits.
    if (groupId === null) legacyRounds++;
    const bucket =
      groupId === null
        ? 0
        : createHash('sha256').update(groupId).digest().readUInt32BE(0) % 10;
    const partition =
      bucket < 8 ? 'train' : bucket === 8 ? 'validation' : 'test';
    const revisions = new Set();
    let round = null;
    for (const raw of session.events) {
      const event = parseTrainingDecision(raw);
      if (
        !event ||
        !event.recordId.length ||
        records.has(event.recordId) ||
        revisions.has(event.revision) ||
        (round !== null && event.round !== round)
      )
        throw Error('Invalid or duplicate training decision');
      records.add(event.recordId);
      revisions.add(event.revision);
      round = event.round;
      if (event.source === 'bot') {
        ignoredBots++;
        continue;
      }
      partitions[partition].push({
        schema: 2,
        matchGroup: groupId,
        roundId: session.id,
        recordId: event.recordId,
        truncated: session.truncated,
        seat: event.seat,
        revision: event.revision,
        observation: { ...event.publicState, ownHand: event.ownHand },
        action: event.action,
        outcome,
      });
    }
  }
  return { partitions, ignoredBots, legacyRounds };
}
