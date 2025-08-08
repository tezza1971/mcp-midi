import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import fs from 'node:fs';
import path from 'node:path';

describe('NoteSequence schema validation', () => {
  it('validates a correct sample NoteSequence', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'note-sequence.schema.json'), 'utf8'));
    const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-note-sequence.json'), 'utf8'));
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(sample);
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('rejects an invalid NoteSequence (missing notes)', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'note-sequence.schema.json'), 'utf8'));
    const sample = { totalTime: 1.0 };
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(sample);
    expect(valid).toBe(false);
  });
});
