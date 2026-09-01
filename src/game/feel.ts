export type Feel = {
  /** 按下后位移小过此值（设计 px）→ 当点按，不算滑 */
  slopPx: number;
  /** 主方向位移达到此值（设计 px）才出手走棋 */
  commitPx: number;
  /** 主轴长度必须 ≥ 副轴 × 此倍数，否则太斜、不出手 */
  axisRatio: number;
  /** 穿过 1 格所用时间（毫秒）。走几格就 × 几，速度不变 */
  tileMoveMs: number;
  /** 走棋后多久内不再接受下一手（毫秒）。只改输入锁 */
  inputLockMs: number;
  /** 锁解开后，按住转向再出手还要再等多少毫秒 */
  rearmMs: number;
  /** 无效滑时棋盘左右抖多远（设计 px） */
  nudgePx: number;
  /** 无效滑抖动持续（毫秒） */
  nudgeMs: number;
  /** 按住不抬、同一方向继续拖，是否再走一步 */
  sameDirRepeat: boolean;
};

export const FEEL_DEFAULT: Feel = {
  slopPx: 10,
  commitPx: 36,
  axisRatio: 1.25,
  tileMoveMs: 100,
  inputLockMs: 160,
  rearmMs: 20,
  nudgePx: 4,
  nudgeMs: 140,
  sameDirRepeat: false,
};

const KEY = 'swipe2048.feel';

export const FEEL_FIELDS: {
  key: keyof Feel;
  label: string;
  why: string;
  kind: 'range' | 'check';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}[] = [
  {
    key: 'slopPx',
    label: '点按死区',
    why: '手指移动少于此值，当成点按，不开始识别滑动。',
    kind: 'range',
    min: 0,
    max: 24,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'commitPx',
    label: '出手距离',
    why: '主方向累计位移达到此值才走棋。不影响方向怎么判。',
    kind: 'range',
    min: 8,
    max: 80,
    step: 1,
    unit: '设计px',
  },
  {
    key: 'axisRatio',
    label: '主轴/副轴倍数',
    why: '本段先看清横或竖再锁轴。出手后尾部斜向不能改轴。不够直则本段作废。1=容易抢轴；1.4 必须更直。',
    kind: 'range',
    min: 1,
    max: 2,
    step: 0.05,
    unit: '倍',
  },
  {
    key: 'tileMoveMs',
    label: '每格用时',
    why: '方块穿过 1 格要多少毫秒。走 4 格就是 4 倍时间，速度相同。只改位移快慢。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms/格',
  },
  {
    key: 'inputLockMs',
    label: '输入锁时长',
    why: '方块滑到位之后再隔这么久才接下一段。锁定期的手指位移不算进下一段。',
    kind: 'range',
    min: 0,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'rearmMs',
    label: '转向再出手续等',
    why: '输入锁结束后，按住换方向再出手还要再等这么久。0=锁一开就能转向。',
    kind: 'range',
    min: 0,
    max: 300,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'nudgePx',
    label: '无效抖动幅度',
    why: '方向无效或太斜时，棋盘左右抖的距离。',
    kind: 'range',
    min: 0,
    max: 16,
    step: 1,
    unit: 'px',
  },
  {
    key: 'nudgeMs',
    label: '无效抖动时长',
    why: '上述抖动播放多久。',
    kind: 'range',
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms',
  },
  {
    key: 'sameDirRepeat',
    label: '同向按住连走',
    why: '打开后：不松手、同一方向继续拖，会再走一步。关闭则必须转向或抬手。',
    kind: 'check',
  },
];

function clampFeel(raw: Partial<Feel>): Feel {
  const next = { ...FEEL_DEFAULT, ...raw };
  for (const f of FEEL_FIELDS) {
    if (f.kind !== 'range') continue;
    const k = f.key as Exclude<keyof Feel, 'sameDirRepeat'>;
    const n = Number(next[k]);
    const v = Number.isFinite(n) ? n : (FEEL_DEFAULT[k] as number);
    next[k] = Math.min(f.max ?? v, Math.max(f.min ?? v, v)) as never;
  }
  next.sameDirRepeat = Boolean(next.sameDirRepeat);
  return next;
}

export function loadFeel(): Feel {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FEEL_DEFAULT };
    return clampFeel(JSON.parse(raw) as Partial<Feel>);
  } catch {
    return { ...FEEL_DEFAULT };
  }
}

export function saveFeel(feel: Feel): void {
  localStorage.setItem(KEY, JSON.stringify(feel));
}

export function applyFeelCss(feel: Feel, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--g-tile-ms', `${feel.tileMoveMs}ms`);
  root.style.setProperty('--g-nudge-ms', `${feel.nudgeMs}ms`);
  root.style.setProperty('--g-nudge-px', `${feel.nudgePx}px`);
}
