import { describe, expect, it } from "vitest";
import { BACKGROUND, game } from "./game";

describe("Coil game contract", () => {
  it("exports a complete game and stage color", () => {
    expect(BACKGROUND).toMatch(/^#[0-9a-f]{6}$/i);
    expect(game.initialize).toBeTypeOf("function");
    expect(game.update).toBeTypeOf("function");
    expect(game.render).toBeTypeOf("function");
  });
});
