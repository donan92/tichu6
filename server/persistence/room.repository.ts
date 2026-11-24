import type { LoungeData } from '../types.ts';

// The storage key and object shape are unchanged, including old idle baselines.
export class RoomRepository {
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
    this.data.activity ||= {};
    for (const room of Object.values(this.data.rooms))
      room.lastProgress ??= now;
  }
  async save() {
    await this.storage.put('lounge', this.data);
  }
}
