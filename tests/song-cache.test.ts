import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SongCache } from '../src/common/song-cache';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'song-cache-test-'));
}

describe('SongCache', () => {
  it('saves and retrieves a song', () => {
    const dir = makeTempDir();
    const cache = new SongCache(dir);

    const noteSequence = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-note-sequence.json'), 'utf8'));

    const result = cache.saveSong(noteSequence as any);
    expect(result.success).toBe(true);
    expect(result.filename).toBeDefined();

    const latest = cache.getLatestSong();
    expect(latest).not.toBeNull();
    expect((latest as any).notes.length).toBeGreaterThan(0);

    // Clean up
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty list when no songs', () => {
    const dir = makeTempDir();
    const cache = new SongCache(dir);
    const list = cache.getSongList();
    expect(list.length).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
