import { describe, expect, it } from "vitest";
import { loadMihomoYaml } from "./yaml-schema";

describe("Mihomo YAML schema", () => {
  it("keeps decimal and signed base-prefixed integers without YAML 1.1 boolean coercion", () => {
    expect(loadMihomoYaml("decimal: 00123\nhex: -0xff\noctal: +0o17\nbinary: 0b101\nlabel: yes"))
      .toEqual({ decimal: 123, hex: -255, octal: 15, binary: 5, label: "yes" });
  });

  it("preserves explicit sets, ordered mappings and pairs as ordinary objects and arrays", () => {
    expect(loadMihomoYaml("set: !!set {a: null, b: null}\nomap: !!omap [{a: 1}, {b: 2}]\npairs: !!pairs [{a: 1}, {a: 2}]"))
      .toEqual({ set: { a: null, b: null }, omap: [{ a: 1 }, { b: 2 }], pairs: [["a", 1], ["a", 2]] });
    expect(() => loadMihomoYaml("!!set {a: 1}")).toThrow("Set entries must have null values");
  });

  it("lets explicit mapping values override merged defaults", () => {
    expect(loadMihomoYaml("<<: &defaults {port: 443, tls: true}\nport: 8443"))
      .toEqual({ port: 8443, tls: true });
  });

  it("preserves empty-document results and rejects a document stream", () => {
    expect(loadMihomoYaml("")).toBeUndefined();
    expect(loadMihomoYaml("\uFEFF")).toBeUndefined();
    expect(loadMihomoYaml(" \n")).toBeUndefined();
    expect(loadMihomoYaml("\r\n")).toBeNull();
    expect(loadMihomoYaml("# comment\n")).toBeNull();
    expect(loadMihomoYaml("---\n")).toBeNull();
    expect(() => loadMihomoYaml("a: 1\n---\na: 2")).toThrow("expected a single document");
  });

  it("keeps zero signs and overflowing integer strings compatible", () => {
    expect(loadMihomoYaml("a: -0\nb: -00")).toEqual({ a: 0, b: -0 });
    const decimal = "9".repeat(400);
    const hexadecimal = `0x${"f".repeat(400)}`;
    expect(loadMihomoYaml(`a: ${decimal}\nb: ${hexadecimal}`))
      .toEqual({ a: decimal, b: hexadecimal });
    expect(() => loadMihomoYaml(`a: !!int ${decimal}`)).toThrow();
  });

  it("preserves complex mapping keys without changing the object prototype", () => {
    const value = loadMihomoYaml("[one, two]: pair\n__proto__: {safe: true}");
    expect(value).toEqual({ "one,two": "pair", ["__proto__"]: { safe: true } });
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });
});
