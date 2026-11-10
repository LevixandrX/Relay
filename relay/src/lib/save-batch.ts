type Write<Patch> = (patch: Patch, announce: boolean) => Promise<void>;

type Batch<Patch> = { patch: Patch; announce: boolean; write: Write<Patch> };

/** Keep one latest patch behind the active write, with a deadline for long edits. */
export class SaveBatch<Patch extends object> {
  private pending: Batch<Patch> | null = null;
  private active: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private since = 0;

  constructor(private delay = 1200, private maxWait = 6000) {}

  stage(patch: Patch, write: Write<Patch>, announce = true) {
    if (!this.pending || this.timer === undefined) this.since = Date.now();
    this.pending = {
      patch: { ...this.pending?.patch, ...patch },
      announce: announce || this.pending?.announce === true,
      write,
    };
    clearTimeout(this.timer);
    const remaining = Math.max(0, this.since + this.maxWait - Date.now());
    this.timer = setTimeout(() => this.flushInBackground(), Math.min(this.delay, remaining));
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.active) {
      await this.active;
      return this.flush();
    }
    const batch = this.pending;
    if (!batch) return;
    this.pending = null;

    const write = async () => {
      try {
        await batch.write(batch.patch, batch.announce);
      } catch (error) {
        const newer = this.pending;
        this.pending = {
          patch: { ...batch.patch, ...newer?.patch },
          announce: batch.announce || newer?.announce === true,
          write: newer?.write ?? batch.write,
        };
        throw error;
      } finally {
        this.active = null;
      }
    };
    this.active = Promise.resolve().then(write);
    return this.active;
  }

  flushInBackground = () => {
    // The writer reports the error. Keep the patch for the next edit or flush.
    void this.flush().catch(() => undefined);
  };

  discardPending() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
  }
}
