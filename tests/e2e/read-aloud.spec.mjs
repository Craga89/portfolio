// Reading answers aloud: the natural voice from the ask.sh service plays a little faster with its
// pitch kept; over the day's AI budget, the browser's own voice reads it instead.
import { test, expect } from '../fixtures.mjs';

/** A short silent WAV, standing in for the service's audio. */
function silentWav() {
  const samples = 4000;
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples * 2, 40);
  return b;
}

const BUDGET = { status: 503, json: { error: 'budget' } };

test.describe('read aloud', { tag: '@desktop' }, () => {
  test.beforeEach(async ({ page }) => {
    // Record what the browser's own voice is asked to say, and finish straight away; and keep
    // hold of the audio element the natural voice plays in.
    await page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.src) w.__audio = this;
        return play.call(this);
      };
      w.__spoken = [];
      if (!window.speechSynthesis) return;
      window.speechSynthesis.speak = (u) => {
        w.__spoken.push({ rate: u.rate, lang: u.lang });
        setTimeout(() => {
          u.dispatchEvent(new SpeechSynthesisEvent('start', { utterance: u }));
          u.dispatchEvent(new SpeechSynthesisEvent('end', { utterance: u }));
        }, 50);
      };
      window.speechSynthesis.cancel = () => {};
    });
  });

  /** @param {import('@playwright/test').Page} page */
  async function askAndListen(page) {
    await page.goto('/#ask');
    await page.locator('#c-ask-field').fill('How long has he led teams?');
    await page.locator('#c-ask-field').press('Enter');
    await page.locator('#ask [data-ask-say]').first().click();
  }

  test('the natural voice plays at 1.15×, pitch kept, and the button resets', async ({ page, services }) => {
    services.ask = {
      status: 200,
      json: { answer: 'He has led engineering teams for twelve years.', sources: ['intro'] },
    };
    services.speak = { status: 200, contentType: 'audio/wav', body: silentWav() };
    await askAndListen(page);
    const audio = () =>
      page.evaluate(() => {
        const a = /** @type {any} */ (window).__audio;
        return a ? { rate: a.playbackRate, pitch: a.preservesPitch } : null;
      });
    await expect.poll(audio).toEqual({ rate: 1.15, pitch: true });
    // Half a second of audio, then the button goes back to "read aloud".
    await expect(page.locator('[data-ask-say][data-on="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => /** @type {any} */ (window).__spoken)).toEqual([]);
  });

  test("over the AI budget, ask.sh says why it's searching and the browser voice reads, a little faster", async ({
    page,
    services,
  }) => {
    services.ask = BUDGET;
    services.speak = BUDGET;
    await askAndListen(page);
    await expect(page.locator('#ask [data-ask-log]')).toContainText("today's free AI allowance");
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__spoken.length)).toBe(1);
    const [spoken] = await page.evaluate(() => /** @type {any} */ (window).__spoken);
    expect(spoken.rate).toBeGreaterThan(1);
  });
});
