import {
  binaryTag, CORE_SCHEMA, defineMappingTag, defineScalarTag, intCoreTag,
  legacyMapTag, loadAll, mergeTag, NOT_RESOLVED, omapTag, pairsTag,
  timestampTag, YAMLException, type Schema,
} from "js-yaml";

export const MIHOMO_YAML_INTEGER_TAG = defineScalarTag("tag:yaml.org,2002:int", {
  ...intCoreTag,
  resolve: (value) => {
    const unsigned = value.replace(/^[+-]/, "");
    if (!/^(?:\d+|0x[\da-fA-F]+|0o[0-7]+|0b[01]+)$/.test(unsigned)) return NOT_RESOLVED;
    const number = unsigned === "0" ? 0 : Number(unsigned) * (value.startsWith("-") ? -1 : 1);
    return Number.isFinite(number) ? number : NOT_RESOLVED;
  },
});

const setTag = defineMappingTag("tag:yaml.org,2002:set", {
  ...legacyMapTag,
  addPair: (set, key, value) => value === null
    ? legacyMapTag.addPair(set, key, value)
    : "Set entries must have null values",
  identify: () => false,
});

// Preserve subscription merge keys, scalar tags and mapping keys across YAML upgrades.
export const MIHOMO_YAML_SCHEMA = CORE_SCHEMA.withTags(
  binaryTag, timestampTag, mergeTag, legacyMapTag, omapTag, pairsTag, setTag, MIHOMO_YAML_INTEGER_TAG,
);

export function loadMihomoYaml(content: string, schema: Schema = MIHOMO_YAML_SCHEMA): unknown {
  const documents = loadAll(content, { schema });
  if (documents.length > 1) throw new YAMLException("expected a single document in the stream, but found more");
  // The previous loader distinguished space/LF-only streams from empty documents.
  return documents.length ? documents[0] : /^[ \n]*$/.test(content.replace(/^\uFEFF/, "")) ? undefined : null;
}
