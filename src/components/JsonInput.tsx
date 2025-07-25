import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { NoteSequence } from '../types';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface JsonInputProps {
  onNoteSequenceLoad: (noteSequence: NoteSequence) => void;
}

export default function JsonInput({ onNoteSequenceLoad }: JsonInputProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleJsonSubmit = () => {
    setError(null);
    setSuccess(false);

    if (!jsonInput.trim()) {
      setError('Please enter a NoteSequence JSON');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      
      // Basic validation for NoteSequence structure
      if (!parsed.notes || !Array.isArray(parsed.notes)) {
        setError('Invalid NoteSequence: missing or invalid "notes" array');
        return;
      }

      // Validate that notes have required properties
      for (let i = 0; i < parsed.notes.length; i++) {
        const note = parsed.notes[i];
        if (typeof note.pitch !== 'number' || 
            typeof note.startTime !== 'number' || 
            typeof note.endTime !== 'number') {
          setError(`Invalid note at index ${i}: missing required properties (pitch, startTime, endTime)`);
          return;
        }
      }

      onNoteSequenceLoad(parsed as NoteSequence);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (err) {
      setError('Invalid JSON format: ' + (err as Error).message);
    }
  };

  const handleClear = () => {
    setJsonInput('');
    setError(null);
    setSuccess(false);
  };

  const exampleJson = {
    notes: [
      {
        pitch: 60,
        startTime: 0,
        endTime: 0.5,
        velocity: 80
      },
      {
        pitch: 64,
        startTime: 0.5,
        endTime: 1.0,
        velocity: 80
      },
      {
        pitch: 67,
        startTime: 1.0,
        endTime: 1.5,
        velocity: 80
      }
    ],
    totalTime: 1.5,
    ticksPerQuarter: 220
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Load NoteSequence JSON
        </CardTitle>
        <CardDescription>
          Paste a NoteSequence JSON object to load it into the player. The JSON should contain a "notes" array with pitch, startTime, and endTime properties.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder={`Paste your NoteSequence JSON here...\n\nExample:\n${JSON.stringify(exampleJson, null, 2)}`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              NoteSequence loaded successfully!
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleJsonSubmit} className="flex-1">
            Load NoteSequence
          </Button>
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}