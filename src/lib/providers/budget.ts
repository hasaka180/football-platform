/**
 * Quota protection for metered providers: a sliding-window request budget,
 * retries with exponential backoff, and a circuit breaker. Free tiers are
 * small, so every call goes through here and is counted.
 */

export class QuotaExhausted extends Error {}
export class CircuitOpen extends Error {}

type Opts = {
  perMinute: number
  maxRetries?: number
  failureThreshold?: number
  cooldownMs?: number
  /** Called once per request actually sent, for the api_usage counter. */
  onRequest?: () => Promise<void> | void
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export class RequestBudget {
  private sent: number[] = []
  private failures = 0
  private openUntil = 0
  private readonly o: Required<Opts>

  constructor(opts: Opts) {
    this.o = {
      maxRetries: 3, failureThreshold: 5, cooldownMs: 10 * 60_000, onRequest: () => {},
      sleep: ms => new Promise(r => setTimeout(r, ms)), now: () => Date.now(),
      ...opts,
    }
  }

  /** Waits for room in the per-minute window, then runs `send` with retries. */
  async run(send: () => Promise<Response>): Promise<Response> {
    if (this.o.now() < this.openUntil) throw new CircuitOpen('Provider circuit is open after repeated failures')
    for (let attempt = 0; ; attempt++) {
      await this.waitForSlot()
      this.sent.push(this.o.now())
      await this.o.onRequest()
      let res: Response | undefined
      let error: unknown
      try { res = await send() } catch (err) { error = err }

      if (res && res.ok) { this.failures = 0; return res }
      if (res && res.status >= 400 && res.status < 500 && res.status !== 429) {
        return res // a client error won't fix itself; let the caller report it
      }
      if (++this.failures >= this.o.failureThreshold) {
        this.openUntil = this.o.now() + this.o.cooldownMs
        throw new CircuitOpen(`Provider failing (${res ? `HTTP ${res.status}` : String(error)}); pausing calls`)
      }
      if (attempt >= this.o.maxRetries) {
        if (res?.status === 429) throw new QuotaExhausted('Provider quota exhausted')
        throw error ?? new Error(`Provider returned HTTP ${res?.status}`)
      }
      // Respect the provider's reset hint on 429, else back off exponentially.
      const reset = Number(res?.headers.get('X-RequestCounter-Reset'))
      await this.o.sleep(res?.status === 429 && reset > 0 ? reset * 1000 : 1000 * 2 ** attempt)
    }
  }

  private async waitForSlot() {
    for (;;) {
      const now = this.o.now()
      this.sent = this.sent.filter(t => now - t < 60_000)
      if (this.sent.length < this.o.perMinute) return
      await this.o.sleep(60_000 - (now - this.sent[0]) + 50)
    }
  }
}
