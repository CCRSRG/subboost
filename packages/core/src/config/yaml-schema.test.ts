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

  it.each([":", ":\n", ": value", ":\n  bad", "before:\n: value", "before: 1\n: value", "nested:\n  : value", "- : value"])(
    "rejects a block mapping with no key node: %j", (source) => {
      expect(() => loadMihomoYaml(source)).toThrow("a key node is missed");
    },
  );

  it.each(["?\n: value", "? # comment\n: value", "null: value", "~: value", "!!null : value", "&key : value", "{ : value }"])(
    "preserves explicit and flow null keys: %j", (source) => {
      expect(loadMihomoYaml(source)).toEqual({ null: "value" });
    },
  );

  it.each(['"": value', "'': value", "!!str : value", '? ""\n: value'])(
    "preserves empty string keys: %j", (source) => {
      expect(loadMihomoYaml(source)).toEqual({ "": "value" });
    },
  );

  it("does not mistake scalar contents or completed collections for missing keys", () => {
    expect(loadMihomoYaml('before: {empty:}\n? # comment\n: value'))
      .toEqual({ before: { empty: null }, null: "value" });
    expect(loadMihomoYaml('before: ["?"]\n?\n: value'))
      .toEqual({ before: ["?"], null: "value" });
    expect(loadMihomoYaml('literal: |\n  : value\nquoted: ": value"'))
      .toEqual({ literal: ": value\n", quoted: ": value" });
  });

  it.each(["+.0", "-.0", "+.5", "-.5", "+.5e+2", "-.5E-1"])(
    "preserves signed leading-dot strings and keys: %s", (value) => {
      expect(loadMihomoYaml(`value: ${value}\n${value}: key`))
        .toEqual({ value, [value]: "key" });
      expect(() => loadMihomoYaml(`value: !!float ${value}`)).toThrow();
    },
  );

  it("keeps ordinary floats, infinities and legacy empty-stream distinctions", () => {
    expect(loadMihomoYaml("a: .5\nb: +0.5\nc: -0.5\nd: -.inf"))
      .toEqual({ a: 0.5, b: 0.5, c: -0.5, d: -Infinity });
    expect(loadMihomoYaml("\r")).toBeUndefined();
    expect(loadMihomoYaml("\n\n")).toBeNull();
    expect(loadMihomoYaml("\n ")).toBeNull();
  });
});
