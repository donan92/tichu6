import { serializeTrainingArchive } from '../training/bytes.ts';
import { Alarm } from './alarm.ts';
import { syncDeadline } from '../../src/game-clock.ts';
import {
  createTrainingArchive,
  loadTrainingArchive,
  pruneTrainingArchive,
  type TrainingArchive,
} from '../training/records.ts';
import type { LoungeData } from '../types.ts';

// The storage key and object shape are unchanged, including old idle baselines.
export class RoomRepository {
  readonly alarm: Alarm;
  private savedLounge: string | undefined;
  private savedTraining: string | undefined;
  private trainingDirty = true;
  markTrainingDirty() {
    this.trainingDirty = true;
  }
  training: TrainingArchive = createTrainingArchive();
  readonly storage: DurableObjectStorage;
  data: LoungeData = { rooms: {}, activity: {} };
  constructor(storage: DurableObjectStorage) {
    this.storage = storage;
    this.alarm = new Alarm(storage);
  }
  async load(now = Date.now()) {
    this.data = (await this.storage.get<LoungeData>('lounge')) || {
      rooms: {},
      activity: {},
    };
    this.savedLounge = JSON.stringify(this.data);
    const rawTraining = await this.storage.get('training-v1');
    this.savedTraining = JSON.stringify(rawTraining);
    this.training = loadTrainingArchive(rawTraining, now);
    this.trainingDirty = true;
    this.data.activity ||= {};
    for (const room of Object.values(this.data.rooms)) {
      room.lastProgress ??= now;
      syncDeadline(room.state, now);
    }
  }
  async save() {
    const count = this.training.sessions.length;
    pruneTrainingArchive(this.training);
    if (count !== this.training.sessions.length) this.trainingDirty = true;
    // Lounge mutations span membership, clocks and activity as well as revision.
    // Compare the complete value rather than risk an incomplete revision shortcut.
    const lounge = JSON.stringify(this.data);
    const training = this.trainingDirty
      ? serializeTrainingArchive(this.training)
      : this.savedTraining;
    const writes: Record<string, unknown> = {};
    if (lounge !== this.savedLounge) writes.lounge = this.data;
    if (training !== this.savedTraining) writes['training-v1'] = this.training;
    if (Object.keys(writes).length) await this.storage.put(writes);
    // A rejected put must leave both comparisons dirty for a safe retry.
    this.savedLounge = lounge;
    this.savedTraining = training;
    this.trainingDirty = false;
  }
}
