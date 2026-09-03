/** 结束层：盖满 #ui-root。规范见 docs/FEEL-LOOP.md。 */

export const OVERLAY_HTML = `
    <div class="g-overlay hidden" id="g-overlay">
      <div class="g-over-top">
        <p class="g-over-score-label">本局分数</p>
        <p class="g-over-score" id="g-over-score">0</p>
        <p class="g-over-msg" id="g-over-msg">没有可走的步了</p>
      </div>
      <div class="g-over-bottom">
        <button type="button" id="g-retry">再来</button>
      </div>
    </div>
`;

export type Overlay = {
  root: HTMLElement;
  show: (score: number, msg: string) => void;
  hide: () => void;
};

export function bindOverlay(host: HTMLElement): Overlay {
  const root = host.querySelector('#g-overlay') as HTMLElement;
  const scoreEl = host.querySelector('#g-over-score') as HTMLElement;
  const msgEl = host.querySelector('#g-over-msg') as HTMLElement;
  return {
    root,
    show(score, msg) {
      scoreEl.textContent = String(score);
      msgEl.textContent = msg;
      root.classList.remove('hidden');
      root.classList.add('g-overlay-in');
    },
    hide() {
      root.classList.add('hidden');
      root.classList.remove('g-overlay-in');
    },
  };
}
