// One storage read per object lifetime, not per schedule. All changes pass here.
// Serialize fetch/event schedules too; only publish cached state after success.
export class Alarm {
  private at: number | null | undefined;
  private queue: Promise<void> = Promise.resolve();
  readonly storage: DurableObjectStorage;
  constructor(storage: DurableObjectStorage) {
    this.storage = storage;
  }
  fired() {
    // The runtime consumes the alarm before invoking its handler.
    this.at = null;
  }
  update(at: number | null, onlyEarlier = false) {
    const operation = this.queue.then(async () => {
      if (this.at === undefined) this.at = await this.storage.getAlarm();
      if (onlyEarlier && this.at != null && at != null && this.at <= at) return;
      if (this.at === at) return;
      try {
        if (at == null) await this.storage.deleteAlarm();
        else await this.storage.setAlarm(at);
        this.at = at;
      } catch (error) {
        this.at = undefined;
        throw error;
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
