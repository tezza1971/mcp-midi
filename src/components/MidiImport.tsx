import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Upload, FileMusic } from 'lucide-react';

interface MidiImportProps {
  onImport: (filePath: string) => void;
}

export default function MidiImport({ onImport }: MidiImportProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);

    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
        // In a real Electron app, we'd have access to the file.path
        // For now, we'll just pass the file name as a placeholder
        onImport((file as any).path);
      } else {
        alert('Please drop a MIDI file (.mid or .midi)');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const file = e.target.files[0];
      // In a real Electron app, we'd have access to the file.path
      // For now, we'll just pass the file name as a placeholder
      onImport((file as any).path);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileMusic className="h-5 w-5" />
          Import MIDI File
        </CardTitle>
        <CardDescription>
          Import MIDI files (.mid or .midi) to convert them to NoteSequence format for playback
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${isDragActive ? 'bg-primary/10' : 'bg-muted'}`}>
              <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {isDragActive ? 'Drop your MIDI file here' : 'Drag & drop MIDI files'}
              </h3>
              <p className="text-muted-foreground">
                Supports .mid and .midi files
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button onClick={handleBrowseClick} variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Browse Files
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Select MIDI file"
          title="Select MIDI file"
        />
      </CardContent>
    </Card>
  );
}