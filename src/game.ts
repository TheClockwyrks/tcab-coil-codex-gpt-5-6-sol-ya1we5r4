import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as K from "./constants";
export const BACKGROUND = "#050713";
type R = { x: number; y: number; w: number; h: number };
export interface CoilState {
  screen: K.Screen;
  menuIndex: number;
  titleIndex: number;
  mode: typeof K.MODE;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: K.Direction;
  turns: K.Direction[];
  snake: K.Cell[];
  pellet: K.Cell | null;
  obstacles: K.Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: K.Cell | null;
  accumulator: number;
  biteTime: number;
  pointerArm: number | null;
}
export type CoilSnapshot = Omit<
  CoilState,
  "accumulator" | "biteTime" | "pointerArm"
> & { version: number };
export interface CoilDebugApi {
  version: number;
  reset(s: DeepReadonly<CoilState>): CoilState;
  reconcile(s: DeepReadonly<CoilState>): CoilState;
  snapshot(s: DeepReadonly<CoilState>): CoilSnapshot;
  menuItemRect(s: DeepReadonly<CoilState>, i: number): R | null;
  setScreen(s: DeepReadonly<CoilState>, v: K.Screen): CoilState;
  setMenuIndex(s: DeepReadonly<CoilState>, v: number): CoilState;
  setScore(s: DeepReadonly<CoilState>, v: number): CoilState;
  setBest(s: DeepReadonly<CoilState>, v: number): CoilState;
  setCombo(s: DeepReadonly<CoilState>, v: number): CoilState;
  setComboWindow(s: DeepReadonly<CoilState>, v: number): CoilState;
  setSnake(s: DeepReadonly<CoilState>, v: readonly K.Cell[]): CoilState;
  setDirection(s: DeepReadonly<CoilState>, v: K.Direction): CoilState;
  clearTurns(s: DeepReadonly<CoilState>): CoilState;
  setSnakeSteering(s: DeepReadonly<CoilState>, v: boolean): CoilState;
  setSnakeTravel(s: DeepReadonly<CoilState>, v: boolean): CoilState;
  setPellet(s: DeepReadonly<CoilState>, c: number, r: number): CoilState;
  clearPellet(s: DeepReadonly<CoilState>): CoilState;
  setPelletRespawn(s: DeepReadonly<CoilState>, v: boolean): CoilState;
  setNextPellet(s: DeepReadonly<CoilState>, c: number, r: number): CoilState;
  drawPelletCell(s: DeepReadonly<CoilState>): K.Cell | null;
}
let art: {
  head: ImageBitmap[];
  body: ImageBitmap;
  corner: ImageBitmap;
  tail: ImageBitmap;
} | null = null;
const cells = (a: readonly DeepReadonly<K.Cell>[]) =>
  a.map((x) => ({ col: x.col, row: x.row }));
const eq = (a: DeepReadonly<K.Cell>, b: DeepReadonly<K.Cell>) =>
  a.col === b.col && a.row === b.row;
const inside = (c: DeepReadonly<K.Cell>) =>
  c.col > 0 && c.col < K.GRID_COLS - 1 && c.row > 0 && c.row < K.GRID_ROWS - 1;
const open = (muted = false): CoilState => ({
  screen: "title",
  menuIndex: 0,
  titleIndex: 0,
  mode: K.MODE,
  score: 0,
  best: 0,
  combo: 1,
  comboWindow: 0,
  muted,
  ticks: 0,
  simTime: 0,
  dir: K.START_DIR,
  turns: [],
  snake: cells(K.START_CELLS),
  pellet: null,
  obstacles: cells(K.OBSTACLE_CELLS),
  steering: true,
  travel: true,
  pelletRespawn: true,
  nextPellet: null,
  accumulator: 0,
  biteTime: 0,
  pointerArm: null,
});
const copy = (s: DeepReadonly<CoilState>): CoilState => ({
  ...s,
  turns: [...s.turns],
  snake: cells(s.snake),
  obstacles: cells(s.obstacles),
  pellet: s.pellet && { ...s.pellet },
  nextPellet: s.nextPellet && { ...s.nextPellet },
});
const count = (x: K.Screen) =>
  x === "title"
    ? 2
    : x === "paused"
      ? 3
      : x === "playing"
        ? 0
        : x === "howto"
          ? 1
          : 2;
const rect = (x: K.Screen, i: number): R | null =>
  i >= 0 && i < count(x)
    ? {
        x: 440,
        y: (x === "howto" ? 610 : x === "title" ? 430 : 455) + i * 68,
        w: 400,
        h: 54,
      }
    : null;
function available(s: DeepReadonly<CoilState>) {
  const out: K.Cell[] = [];
  for (let r = 1; r < K.GRID_ROWS - 1; r++)
    for (let c = 1; c < K.GRID_COLS - 1; c++) {
      const p = { col: c, row: r };
      if (
        !s.snake.some((x) => eq(x, p)) &&
        !s.obstacles.some((x) => eq(x, p)) &&
        (!s.pellet || !eq(s.pellet, p))
      )
        out.push(p);
    }
  return out;
}
const draw = (s: DeepReadonly<CoilState>) => {
  const a = available(s);
  return a.length ? a[Math.floor(Math.random() * a.length)] : null;
};
function debug(): CoilDebugApi {
  const set = (s: DeepReadonly<CoilState>, p: Partial<CoilState>) => ({
    ...copy(s),
    ...p,
  });
  const nonneg = (n: number) => {
    if (!Number.isInteger(n) || n < 0) throw new RangeError("invalid value");
  };
  return {
    version: 1,
    reset: (s) => open(s.muted),
    reconcile: copy,
    snapshot: (s) => {
      const { accumulator: _, biteTime: __, pointerArm: ___, ...v } = copy(s);
      return { ...v, version: 1 };
    },
    menuItemRect: (s, i) => {
      nonneg(i);
      return rect(s.screen, i);
    },
    setScreen: (s, v) => {
      if (!K.SCREENS.includes(v)) throw new RangeError("invalid screen");
      return set(s, { screen: v });
    },
    setMenuIndex: (s, v) => {
      if (
        !Number.isInteger(v) ||
        !((count(s.screen) === 0 && v === 0) || (v >= 0 && v < count(s.screen)))
      )
        throw new RangeError("invalid menu");
      return set(s, { menuIndex: v });
    },
    setScore: (s, v) => {
      nonneg(v);
      return set(s, { score: v });
    },
    setBest: (s, v) => {
      nonneg(v);
      return set(s, { best: v });
    },
    setCombo: (s, v) => {
      if (!Number.isInteger(v) || v < 1 || v > K.COMBO_MAX)
        throw new RangeError("invalid combo");
      return set(s, { combo: v });
    },
    setComboWindow: (s, v) => {
      if (v < 0 || v > K.COMBO_WINDOW) throw new RangeError("invalid window");
      return set(s, { comboWindow: v });
    },
    setSnake: (s, v) => {
      const a = cells(v),
        seen = new Set<string>();
      if (
        !a.length ||
        a.some(
          (x, i) =>
            !inside(x) ||
            s.obstacles.some((o) => eq(o, x)) ||
            seen.has(`${x.col},${x.row}`) ||
            (seen.add(`${x.col},${x.row}`),
            i > 0 &&
              Math.abs(x.col - a[i - 1].col) +
                Math.abs(x.row - a[i - 1].row) !==
                1),
        )
      )
        throw new RangeError("invalid snake");
      return set(s, { snake: a });
    },
    setDirection: (s, v) => {
      if (!K.DIRECTIONS.includes(v)) throw new RangeError("invalid direction");
      return set(s, { dir: v });
    },
    clearTurns: (s) => set(s, { turns: [] }),
    setSnakeSteering: (s, v) => set(s, { steering: v }),
    setSnakeTravel: (s, v) => set(s, { travel: v }),
    setPellet: (s, col, row) => {
      const p = { col, row };
      if (
        !Number.isInteger(col) ||
        !Number.isInteger(row) ||
        !inside(p) ||
        s.snake.some((x) => eq(x, p)) ||
        s.obstacles.some((x) => eq(x, p))
      )
        throw new RangeError("invalid pellet");
      return set(s, { pellet: p });
    },
    clearPellet: (s) => set(s, { pellet: null }),
    setPelletRespawn: (s, v) => set(s, { pelletRespawn: v }),
    setNextPellet: (s, col, row) => {
      if (
        !Number.isInteger(col) ||
        !Number.isInteger(row) ||
        col < 0 ||
        row < 0 ||
        col >= K.GRID_COLS ||
        row >= K.GRID_ROWS
      )
        throw new RangeError("invalid next pellet");
      return set(s, { nextPellet: { col, row } });
    },
    drawPelletCell: draw,
  };
}
function spawn(s: CoilState) {
  const a = available(s),
    p = a.length
      ? s.nextPellet && a.some((x) => eq(x, s.nextPellet!))
        ? { ...s.nextPellet }
        : a[Math.floor(Math.random() * a.length)]
      : null;
  return { ...s, pellet: p, nextPellet: null };
}
function round(s: DeepReadonly<CoilState>, api: UpdateApi) {
  let n: CoilState = {
    ...copy(s),
    screen: "playing",
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    dir: K.START_DIR,
    turns: [],
    snake: cells(K.START_CELLS),
    pellet: null,
    accumulator: 0,
    biteTime: 0,
  };
  n = spawn(n);
  api.audio.loop(K.CUES.music);
  return n;
}
const move = (c: DeepReadonly<K.Cell>, d: K.Direction) => ({
  col: c.col + (d === "right" ? 1 : d === "left" ? -1 : 0),
  row: c.row + (d === "down" ? 1 : d === "up" ? -1 : 0),
});
const perp = (a: K.Direction, b: K.Direction) =>
  (a === "left" || a === "right") !== (b === "left" || b === "right");
function tick(s: CoilState, api: UpdateApi) {
  const turns = [...s.turns];
  let dir = s.dir;
  if (s.steering && turns.length) {
    const d = turns.shift()!;
    if (perp(dir, d)) dir = d;
  }
  let n = { ...s, dir, turns, ticks: s.ticks + 1 };
  if (s.travel) {
    const h = move(s.snake[0], dir),
      eat = !!s.pellet && eq(h, s.pellet),
      body = eat ? s.snake : s.snake.slice(0, -1);
    if (!inside(h) || body.some((x) => eq(x, h))) {
      api.audio.play(K.CUES.death);
      api.audio.stop(K.CUES.music);
      return {
        ...n,
        screen: "gameover" as const,
        menuIndex: 0,
        accumulator: 0,
      };
    }
    n = { ...n, snake: [h, ...cells(eat ? s.snake : s.snake.slice(0, -1))] };
    if (eat) {
      const combo = s.comboWindow > 0 ? Math.min(5, s.combo + 1) : 1,
        score = s.score + 10 * combo;
      api.audio.play(K.CUES.eat);
      if (combo > s.combo) api.audio.play(K.CUES.comboUp);
      n = {
        ...n,
        combo,
        score,
        best: Math.max(s.best, score),
        comboWindow: K.COMBO_WINDOW,
        pellet: null,
        biteTime: K.BITE_SECONDS,
      };
      if (s.pelletRespawn) {
        n = spawn(n);
        if (!n.pellet) {
          api.audio.stop(K.CUES.music);
          return {
            ...n,
            screen: "cleared" as const,
            menuIndex: 0,
            accumulator: 0,
          };
        }
      }
    }
  }
  const w = Math.max(0, n.comboWindow - K.TICK_SECONDS);
  return { ...n, comboWindow: w, combo: w ? n.combo : 1 };
}
function confirm(s: CoilState, api: UpdateApi): CoilState {
  if (s.screen === "title")
    return s.menuIndex === 0
      ? round({ ...s, titleIndex: s.menuIndex }, api)
      : { ...s, titleIndex: s.menuIndex, screen: "howto", menuIndex: 0 };
  if (s.screen === "howto")
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  if (s.screen === "paused") {
    if (s.menuIndex === 0) return { ...s, screen: "playing", menuIndex: 0 };
    if (s.menuIndex === 1) return round(s, api);
    api.audio.stop(K.CUES.music);
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  }
  if (s.screen === "gameover" || s.screen === "cleared")
    return s.menuIndex === 0
      ? round(s, api)
      : { ...s, screen: "title", menuIndex: s.titleIndex };
  return s;
}
function update(s0: DeepReadonly<CoilState>, api: UpdateApi, dt: number) {
  let s = copy(s0);
  if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  s.muted = api.audio.muted();
  if (s.screen === "playing") {
    if (api.input.pressed("back") || api.input.pressed("pause"))
      return { ...s, screen: "paused" as const, menuIndex: 0 };
    if (s.steering)
      for (const d of K.DIRECTIONS)
        if (api.input.pressed(d) && s.turns.length < K.TURN_QUEUE_MAX)
          s.turns = [...s.turns, d];
  } else {
    const n = count(s.screen);
    if (api.input.pressed("up")) s.menuIndex = (s.menuIndex + n - 1) % n;
    if (api.input.pressed("down")) s.menuIndex = (s.menuIndex + 1) % n;
    if (s.screen === "paused" && api.input.pressed("pause"))
      s = { ...s, screen: "playing", menuIndex: 0 };
    else if (api.input.pressed("back") && s.screen !== "title") {
      if (s.screen === "paused") s = { ...s, screen: "playing", menuIndex: 0 };
      else {
        api.audio.stop(K.CUES.music);
        s = { ...s, screen: "title", menuIndex: s.titleIndex };
      }
    }
    if (api.input.pressed("confirm")) s = confirm(s, api);
    for (const e of api.input.pointerSamples().filter((x) => x.primary)) {
      const hit = Array.from({ length: count(s.screen) }, (_, i) => i).find(
        (i) => {
          const r = rect(s.screen, i)!;
          return (
            e.x >= r.x && e.x <= r.x + r.w && e.y >= r.y && e.y <= r.y + r.h
          );
        },
      );
      if (hit !== undefined) s.menuIndex = hit;
      if (e.type === "down") s.pointerArm = hit ?? null;
      if (e.type === "up") {
        if (hit !== undefined && s.pointerArm === hit)
          s = confirm({ ...s, menuIndex: hit }, api);
        s.pointerArm = null;
      }
    }
  }
  if (s.screen !== "playing") return s;
  s.simTime += dt;
  s.accumulator += dt;
  s.biteTime = Math.max(0, s.biteTime - dt);
  while (s.accumulator + 1e-9 >= K.TICK_SECONDS && s.screen === "playing") {
    s.accumulator -= K.TICK_SECONDS;
    s = tick(s, api);
  }
  return { ...s, best: Math.max(s.best, s.score) };
}
const turn = (d: K.Direction) =>
  d === "right" ? 0 : d === "down" ? 1 : d === "left" ? 2 : 3;
const between = (
  a: DeepReadonly<K.Cell>,
  b: DeepReadonly<K.Cell>,
): K.Direction =>
  b.col > a.col
    ? "right"
    : b.col < a.col
      ? "left"
      : b.row > a.row
        ? "down"
        : "up";
function sprite(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  t: number,
) {
  ctx.save();
  ctx.translate(x + 16, y + 16);
  ctx.rotate((t * Math.PI) / 2);
  ctx.drawImage(img, -16, -16);
  ctx.restore();
}
function text(
  ctx: CanvasRenderingContext2D,
  v: string,
  x: number,
  y: number,
  size: number,
  color: string = "#eafcff",
) {
  ctx.font = `700 ${size}px monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(v, x, y);
  ctx.shadowBlur = 0;
}
function board(s: DeepReadonly<CoilState>, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#080d22";
  ctx.fillRect(
    K.BOARD_X,
    K.BOARD_Y,
    K.GRID_COLS * K.CELL,
    K.GRID_ROWS * K.CELL,
  );
  ctx.strokeStyle = "#17264a";
  for (let c = 0; c < K.GRID_COLS; c++)
    for (let r = 0; r < K.GRID_ROWS; r++) {
      const x = K.BOARD_X + c * 32,
        y = K.BOARD_Y + r * 32;
      if (c === 0 || r === 0 || c === 29 || r === 17) {
        ctx.fillStyle = (c + r) % 2 ? "#112650" : "#173365";
        ctx.fillRect(x + 1, y + 1, 30, 30);
      } else ctx.strokeRect(x + 0.5, y + 0.5, 32, 32);
    }
  if (s.pellet) {
    ctx.fillStyle = "#ff40d4";
    ctx.shadowColor = "#ff40d4";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(
      K.BOARD_X + s.pellet.col * 32 + 16,
      K.BOARD_Y + s.pellet.row * 32 + 16,
      9,
      0,
      7,
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (art)
    s.snake.forEach((c, i) => {
      const x = K.BOARD_X + c.col * 32,
        y = K.BOARD_Y + c.row * 32;
      if (i === 0)
        sprite(
          ctx,
          art!.head[
            s.biteTime
              ? Math.min(
                  3,
                  1 +
                    Math.floor(
                      (K.BITE_SECONDS - s.biteTime) / (K.BITE_SECONDS / 3),
                    ),
                )
              : 0
          ],
          x,
          y,
          turn(s.dir),
        );
      else if (i === s.snake.length - 1)
        sprite(ctx, art!.tail, x, y, turn(between(c, s.snake[i - 1])));
      else {
        const a = between(c, s.snake[i - 1]),
          b = between(c, s.snake[i + 1]);
        if (perp(a, b)) {
          const set = new Set([a, b]),
            t =
              set.has("right") && set.has("down")
                ? 0
                : set.has("down") && set.has("left")
                  ? 1
                  : set.has("left") && set.has("up")
                    ? 2
                    : 3;
          sprite(ctx, art!.corner, x, y, t);
        } else sprite(ctx, art!.body, x, y, a === "up" || a === "down" ? 1 : 0);
      }
    });
}
function render(s: DeepReadonly<CoilState>, api: RenderApi) {
  const c = api.ctx;
  c.fillStyle = BACKGROUND;
  c.fillRect(0, 0, K.STAGE_W, K.STAGE_H);
  if (s.screen !== "title" && s.screen !== "howto") {
    text(c, `SCORE  ${s.score}`, 260, 65, 25, "#55eaff");
    text(c, `BEST  ${s.best}`, 480, 65, 25);
    text(c, K.MODE_LABEL, 640, 65, 20, "#55eaff");
    if (s.combo > 1)
      text(
        c,
        `×${s.combo}  ${"▰".repeat(Math.ceil((10 * s.comboWindow) / K.COMBO_WINDOW))}`,
        860,
        65,
        25,
        "#ff4bd8",
      );
    text(c, s.muted ? "MUTED [M]" : "SOUND [M]", 1050, 65, 16, "#55eaff");
    board(s, c);
  }
  if (s.screen === "title") {
    text(c, K.TITLE_TEXT, 640, 235, 112, "#55eaff");
    text(c, K.TAGLINE_TEXT, 640, 285, 22, "#ff4bd8");
    text(c, `BEST  ${s.best}`, 640, 360, 18);
  }
  if (s.screen === "howto") {
    text(c, "HOW TO PLAY", 640, 100, 38, "#55eaff");
    const ls = [
      "The coil never stops. Turns land on the next tick.",
      "Turn perpendicular; you cannot double back.",
      "Eat pulses to grow. Walls and your body are fatal.",
      "Eat quickly to build ×5 before the combo expires.",
      "ARROWS / WASD steer   P / ESC pause   M mute",
    ];
    ls.forEach((v, i) => text(c, v, 640, 190 + i * 52, 18));
  }
  if (s.screen !== "playing" && s.screen !== "title" && s.screen !== "howto")
    text(
      c,
      s.screen === "paused"
        ? "PAUSED"
        : s.screen === "gameover"
          ? K.GAMEOVER_TEXT
          : K.CLEARED_TEXT,
      640,
      355,
      42,
      s.screen === "gameover" ? "#ff4bd8" : "#55eaff",
    );
  if (s.screen !== "playing") {
    const items =
      s.screen === "title"
        ? K.TITLE_ITEMS
        : s.screen === "paused"
          ? K.PAUSE_ITEMS
          : s.screen === "gameover" || s.screen === "cleared"
            ? K.OVER_ITEMS
            : ["BACK"];
    items.forEach((v, i) => {
      const r = rect(s.screen, i)!;
      if (i === s.menuIndex) {
        c.strokeStyle = "#55eaff";
        c.strokeRect(r.x, r.y, r.w, r.h);
      }
      text(c, v, 640, r.y + 36, 22, i === s.menuIndex ? "#eafcff" : "#55eaff");
    });
  }
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api: InitApi<CoilState>) {
    for (const a of K.ACTIONS)
      api.input.register(a, { keys: [...K.BINDINGS[a]] });
    const [head, body, corner, tail] = await Promise.all([
      Promise.all(K.SPRITE_PATHS.head.map((p) => api.assets.loadImage(p))),
      api.assets.loadImage(K.SPRITE_PATHS.body),
      api.assets.loadImage(K.SPRITE_PATHS.corner),
      api.assets.loadImage(K.SPRITE_PATHS.tail),
    ]);
    art = { head, body, corner, tail };
    await Promise.all(
      Object.entries(K.CUE_PATHS).map(([n, p]) => api.audio.load(n, p)),
    );
    for (const [n, f] of [
      ["screen", (s: DeepReadonly<CoilState>) => s.screen],
      ["score", (s: DeepReadonly<CoilState>) => s.score],
      ["best", (s: DeepReadonly<CoilState>) => s.best],
      ["combo", (s: DeepReadonly<CoilState>) => s.combo],
      ["direction", (s: DeepReadonly<CoilState>) => s.dir],
      ["length", (s: DeepReadonly<CoilState>) => s.snake.length],
      [
        "head",
        (s: DeepReadonly<CoilState>) => `${s.snake[0].col},${s.snake[0].row}`,
      ],
      [
        "pellet",
        (s: DeepReadonly<CoilState>) =>
          s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none",
      ],
    ] as const)
      api.diagnostics.register(n, f);
    return [open(), debug()];
  },
  update,
  render,
};
