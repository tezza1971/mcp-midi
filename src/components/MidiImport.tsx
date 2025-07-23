import { useState, useRef, DragEvent, ChangeEvent } from 'react';

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
        onImport(file.path);
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
      onImport(file.path);
    }
  };

  return (
    <div className="bg-white p-6 rounded-md shadow-md mb-5">
      <h2 className="text-xl font-semibold border-b pb-2 mb-4">Import MIDI</h2>
      
      <div 
        className={`border-2 border-dashed p-8 rounded-md text-center ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>Drag and drop a MIDI file here</p>
        <p className="my-2">or</p>
        <button 
          type="button"
          onClick={handleBrowseClick}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Browse Files
        </button>
        <label htmlFor="midi-file-input" className="sr-only">MIDI file input</label>
        <input 
          type="file" 
          id="midi-file-input"
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".mid,.midi" 
          className="hidden"
          title="Select MIDI file"
          placeholder="Select MIDI file"
        />
      </div>
    </div>
  );
}