import {
  v5Formula,
  v5BarrierEquation,
  calculateKeywordSimilarity,
  calculateTimeDecay,
  adjustV5Params,
} from "./scorer.js";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("v5Formula 边界值校验", () => {
  it("应正确处理空值输入", () => {
    assert.strictEqual(v5Formula(null), 0);
    assert.strictEqual(v5Formula(undefined), 0);
    assert.strictEqual(v5Formula(NaN), 0);
  });

  it("应正确处理正常输入", () => {
    const result = v5Formula(0.5);
    assert.ok(result >= 0 && result <= 1);
  });

  it("应正确处理边界输入", () => {
    assert.ok(v5Formula(0) >= 0 && v5Formula(0) <= 1);
    assert.ok(v5Formula(1) >= 0 && v5Formula(1) <= 1);
    assert.ok(v5Formula(-1) >= 0 && v5Formula(-1) <= 1);
    assert.ok(v5Formula(2) >= 0 && v5Formula(2) <= 1);
  });

  it("应正确处理 gamma 边界值", () => {
    assert.strictEqual(v5Formula(0.5, 0), 0.5);
    assert.strictEqual(v5Formula(0.5, 2.5), v5Formula(0.5, 2.0));
    assert.strictEqual(v5Formula(0.5, -1), v5Formula(0.5, 0.1));
  });

  it("应正确处理 barrier 边界值", () => {
    assert.ok(v5Formula(0.5, 0.85, 0) >= 0);
    assert.ok(v5Formula(0.5, 0.85, 1) >= 0);
    assert.ok(v5Formula(0.5, 0.85, -0.5) >= 0);
    assert.ok(v5Formula(0.5, 0.85, 1.5) <= 1);
  });

  it("应正确处理 gamma 空值", () => {
    const result = v5Formula(0.5, null);
    assert.ok(result >= 0 && result <= 1);
    assert.strictEqual(v5Formula(0.5, undefined), v5Formula(0.5, 0.85));
  });

  it("v5BarrierEquation 应与 v5Formula 等价", () => {
    assert.strictEqual(v5BarrierEquation(0.5), v5Formula(0.5));
  });
});

describe("calculateKeywordSimilarity", () => {
  it("应正确处理空输入", () => {
    assert.strictEqual(calculateKeywordSimilarity("", "test"), 0);
    assert.strictEqual(calculateKeywordSimilarity("test", ""), 0);
    assert.strictEqual(calculateKeywordSimilarity(null, "test"), 0);
  });

  it("应正确计算相似度", () => {
    assert.strictEqual(
      calculateKeywordSimilarity("hello world", "hello world"),
      1,
    );
    assert.strictEqual(calculateKeywordSimilarity("hello", "world"), 0);
  });
});

describe("calculateTimeDecay", () => {
  it("应正确处理空值", () => {
    assert.strictEqual(calculateTimeDecay(null), 1);
    assert.strictEqual(calculateTimeDecay(undefined), 1);
  });
});

describe("adjustV5Params", () => {
  it("应正确调整参数", () => {
    const result = adjustV5Params(
      { gamma: 0.85, barrier: 0.5 },
      { irrelevant: true },
    );
    assert.ok(result.gamma > 0.85);

    const result2 = adjustV5Params(
      { gamma: 0.85, barrier: 0.5 },
      { useful: true },
    );
    assert.ok(result2.gamma < 0.85);
  });
});
