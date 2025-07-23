import fs from 'fs';
import path from 'path';
import { NoteSequence, SaveSongResult, SongInfo } from '../types';

/**
 * SongCache manages the storage and retrieval of NoteSequence JSON files
 */
class SongCache {
  private cacheDir: string;

  /**
   * Create a new SongCache
   * @param {string} cacheDir - Directory to store song cache files
   */
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }
  
  /**
   * Ensure the cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  
  /**
   * Save a NoteSequence to the cache
   * @param {NoteSequence} noteSequence - The NoteSequence to save
   * @returns {SaveSongResult} - Information about the saved file
   */
  saveSong(noteSequence: NoteSequence): SaveSongResult {
    try {
      // Basic validation
      if (!noteSequence || !noteSequence.notes) {
        throw new Error('Invalid NoteSequence format');
      }
      
      // Generate a filename with timestamp
      const timestamp = Date.now();
      const filename = `song_${timestamp}.json`;
      const filepath = path.join(this.cacheDir, filename);
      
      // Save the file
      fs.writeFileSync(filepath, JSON.stringify(noteSequence, null, 2));
      
      return {
        success: true,
        filepath,
        timestamp,
        filename
      };
    } catch (error) {
      console.error('Error saving song:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get the most recent song from the cache
   * @returns {NoteSequence|null} - The most recent NoteSequence or null if none found
   */
  getLatestSong(): NoteSequence | null {
    try {
      // Find all song files and sort by name (which includes timestamp)
      const files = fs.readdirSync(this.cacheDir)
        .filter(file => file.startsWith('song_') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length === 0) {
        return null;
      }
      
      // Read the most recent file
      const latestFile = files[0];
      const filepath = path.join(this.cacheDir, latestFile);
      const content = fs.readFileSync(filepath, 'utf8');
      
      return JSON.parse(content) as NoteSequence;
    } catch (error) {
      console.error('Error getting latest song:', error);
      return null;
    }
  }
  
  /**
   * Get a list of all songs in the cache
   * @returns {SongInfo[]} - Array of song information objects
   */
  getSongList(): SongInfo[] {
    try {
      const files = fs.readdirSync(this.cacheDir)
        .filter(file => file.startsWith('song_') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      return files.map(file => {
        const filepath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filepath);
        
        // Extract timestamp from filename
        const timestamp = parseInt(file.replace('song_', '').replace('.json', ''), 10);
        
        return {
          filename: file,
          filepath,
          timestamp,
          created: stats.birthtime,
          size: stats.size
        };
      });
    } catch (error) {
      console.error('Error getting song list:', error);
      return [];
    }
  }
  
  /**
   * Get a specific song by filename
   * @param {string} filename - The filename of the song to retrieve
   * @returns {NoteSequence|null} - The NoteSequence or null if not found
   */
  getSong(filename: string): NoteSequence | null {
    try {
      const filepath = path.join(this.cacheDir, filename);
      
      if (!fs.existsSync(filepath)) {
        return null;
      }
      
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content) as NoteSequence;
    } catch (error) {
      console.error(`Error getting song ${filename}:`, error);
      return null;
    }
  }
  
  /**
   * Delete a song from the cache
   * @param {string} filename - The filename of the song to delete
   * @returns {boolean} - Whether the deletion was successful
   */
  deleteSong(filename: string): boolean {
    try {
      const filepath = path.join(this.cacheDir, filename);
      
      if (!fs.existsSync(filepath)) {
        return false;
      }
      
      fs.unlinkSync(filepath);
      return true;
    } catch (error) {
      console.error(`Error deleting song ${filename}:`, error);
      return false;
    }
  }
}

export default SongCache;