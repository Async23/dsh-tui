const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');
const load = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const schemas = {
  plugin: load('schemas/dsh-plugin.schema.json'),
  host: load('schemas/host-descriptor.schema.json'),
  message: load('schemas/messages-observe-envelope.schema.json'),
  ledger: load('schemas/effect-ledger-record.schema.json'),
  claim: load('schemas/conformance-claim.schema.json')
};
const registry = load('registry/registry-0.1.json');
const permissionRegistry = load('registry/permissions-0.1.json');

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`external ref is not supported by the zero-dependency runner: ${ref}`);
  return ref.slice(2).split('/').reduce((v, key) => v[key.replace(/~1/g, '/').replace(/~0/g, '~')], rootSchema);
}

function check(value, schema, rootSchema, where = '$') {
  if (schema.$ref) return check(value, resolveRef(rootSchema, schema.$ref), rootSchema, where);
  if (schema.const !== undefined && value !== schema.const) throw new Error(`${where}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${where}: value is not in enum`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${where}: expected object`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`${where}.${key}: required`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!schema.properties?.[key] && !schema.$defs?.[key]) throw new Error(`${where}.${key}: additional property`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) check(value[key], child, rootSchema, `${where}.${key}`);
    if (schema.patternProperties) for (const [key, child] of Object.entries(schema.patternProperties)) for (const name of Object.keys(value)) if (new RegExp(key).test(name)) check(value[name], child, rootSchema, `${where}.${name}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${where}: expected array`);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${where}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${where}: too many items`);
    for (let i = 0; i < value.length; i++) check(value[i], schema.items, rootSchema, `${where}[${i}]`);
    if (schema.uniqueItems) { const encoded = value.map(JSON.stringify); if (new Set(encoded).size !== encoded.length) throw new Error(`${where}: duplicate items`); }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${where}: expected string`);
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new Error(`${where}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new Error(`${where}: too long`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) throw new Error(`${where}: pattern mismatch`);
    if (schema.format === 'uri' && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) throw new Error(`${where}: invalid URI`);
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) throw new Error(`${where}: invalid date-time`);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) throw new Error(`${where}: expected integer`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${where}: below minimum`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${where}: expected boolean`);
}

function validate(name, value, schema, semanticCheck) {
  try {
    check(value, schema, schema);
    if (semanticCheck) semanticCheck(value);
    return {name, pass: true};
  } catch (error) { return {name, pass: false, error: error.message}; }
}

function validatePlugin(manifest) {
  const ids = manifest.contributes.commands.map((command) => command.id);
  if (new Set(ids).size !== ids.length) throw new Error('$.contributes.commands: duplicate command id');
  const refs = [...manifest.requires.capabilities.required, ...manifest.requires.capabilities.optional, ...manifest.subscriptions.map((s) => ({name: s.event, ...s}))];
  for (const ref of refs) {
    const known = registry.entries.find((entry) => entry.name === ref.name && entry.version === ref.version);
    if (!known || known.schemaHash !== ref.schemaHash) throw new Error(`unknown contract or schema hash: ${ref.name}@${ref.version}`);
  }
}

function digestFile(relativePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex')}`;
}

function verifyRegistry() {
  for (const entry of registry.entries) assert.equal(digestFile(entry.schema), entry.schemaHash, `${entry.name} schemaHash drifted`);
}

function negotiate(manifest, host, grants = []) {
  const supported = new Map(host.contracts.map((c) => [`${c.name}@${c.version}`, c]));
  const required = manifest.requires.capabilities.required;
  const optional = manifest.requires.capabilities.optional;
  const missingRequired = required.filter((r) => {
    const h = supported.get(`${r.name}@${r.version}`);
    return !h || h.schemaHash !== r.schemaHash;
  });
  const missingOptional = optional.filter((r) => {
    const h = supported.get(`${r.name}@${r.version}`);
    return !h || h.schemaHash !== r.schemaHash;
  });
  const hostPermissions = new Set(host.contracts.flatMap((c) => c.permissions));
  const granted = new Set(grants);
  const deniedPermissions = manifest.permissions.filter((permission) => {
    if (!hostPermissions.has(permission.name)) return true;
    const definition = permissionRegistry.permissions.find((item) => item.name === permission.name);
    return !definition || (definition.default === 'deny' && !granted.has(permission.name));
  });
  if (missingRequired.length) return {decision: 'rejected', reasonCode: 'REQUIRED_CONTRACT_UNAVAILABLE', missingRequired: missingRequired.map((x) => x.name)};
  if (deniedPermissions.length) return {decision: 'waiting_authorization', reasonCode: 'PERMISSION_NOT_GRANTED', deniedPermissions: deniedPermissions.map((x) => x.name)};
  return {decision: missingOptional.length ? 'compatible_degraded' : 'compatible', missingOptional: missingOptional.map((x) => x.name)};
}

verifyRegistry();
const cases = [
  validate('valid plugin', load('conformance/fixtures/valid-plugin.json'), schemas.plugin, validatePlugin),
  validate('invalid service rejected', load('conformance/fixtures/invalid-plugin-unknown-service.json'), schemas.plugin, validatePlugin),
  validate('duplicate command rejected', load('conformance/fixtures/invalid-plugin-duplicate-command.json'), schemas.plugin, validatePlugin),
  validate('valid message', load('conformance/fixtures/valid-message.json'), schemas.message),
  validate('invalid privacy rejected', load('conformance/fixtures/invalid-message-privacy.json'), schemas.message),
  validate('valid ledger', load('conformance/fixtures/valid-ledger-record.json'), schemas.ledger),
  validate('valid claim', load('conformance/fixtures/valid-claim.json'), schemas.claim),
  validate('valid host descriptor', load('registry/host-descriptor.tui.example.json'), schemas.host)
];
assert.equal(cases[0].pass, true, cases[0].error);
assert.equal(cases[1].pass, false, 'unknown services must be rejected');
assert.equal(cases[2].pass, false, 'duplicate command ids must be rejected');
assert.equal(cases[3].pass, true, cases[3].error);
assert.equal(cases[4].pass, false, 'unknown privacy classes must be rejected');
assert.equal(cases[5].pass, true, cases[5].error);
assert.equal(cases[6].pass, true, cases[6].error);
assert.equal(cases[7].pass, true, cases[7].error);
const compatible = negotiate(load('conformance/fixtures/valid-plugin.json'), load('registry/host-descriptor.tui.example.json'));
assert.equal(compatible.decision, 'compatible');
const waiting = negotiate(load('conformance/fixtures/waiting-authorization-plugin.json'), load('registry/host-descriptor.tui.example.json'));
assert.equal(waiting.decision, 'waiting_authorization');
const authorized = negotiate(load('conformance/fixtures/waiting-authorization-plugin.json'), load('registry/host-descriptor.tui.example.json'), ['messages.observe.read']);
assert.equal(authorized.decision, 'compatible');
console.log(JSON.stringify({suite: 'community-v0.1', cases, negotiation: {compatible, waiting, authorized}}, null, 2));
