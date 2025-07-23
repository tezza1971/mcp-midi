import { McpServerStatus } from '../types';

interface StatusBarProps {
  apiStatus: McpServerStatus;
  midiOutputs: string[];
}

export default function StatusBar({ apiStatus, midiOutputs }: StatusBarProps) {
  const isMidiAvailable = midiOutputs.includes('MCP MIDI Bridge');

  return (
    <div className="bg-gray-100 p-4 rounded-md mb-5 flex justify-between items-center">
      <div>
        <span 
          className={`inline-block w-3 h-3 rounded-full mr-2 ${apiStatus.running ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>MCP API: Running on port {apiStatus.port}</span>
      </div>
      <div>
        <span 
          className={`inline-block w-3 h-3 rounded-full mr-2 ${isMidiAvailable ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>MIDI Output: {isMidiAvailable ? 'MCP MIDI Bridge' : 'Not available'}</span>
      </div>
    </div>
  );
}