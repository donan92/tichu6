import {
  createTrainingArchive,
  loadTrainingArchive,
  pruneTrainingArchive,
  type TrainingArchive,
} from '../training/records.ts';
import type { LoungeData } from '../types.ts';

// The storage key and object shape are unchanged, including old idle baselines.
export class RoomRepository {
  training: TrainingArchive = createTrainingArchive();
  readonly storage: DurableObjectStorage;
  data: LoungeData = { rooms: {}, activity: {} };
  constructor(storage: DurableObjectStorage) {
    this.storage = storage;
  }
  async load(now = Date.now()) {
    this.data = (await this.storage.get<LoungeData>('lounge')) || {
      rooms: {},
      activity: {},
    };
    this.training = loadTrainingArchive(
      await this.storage.get('training-v1'),
      now,
    );
    this.data.activity ||= {};
    for (const room of Object.values(this.data.rooms))
      room.lastProgress ??= now;
  }
  async save() {
    pruneTrainingArchive(this.training);
    await this.storage.put({ lounge: this.data, 'training-v1': this.training });
  }
}
