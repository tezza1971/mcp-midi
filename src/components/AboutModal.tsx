interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">About MCP MIDI Bridge</h2>
          <button 
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        
        <div className="p-4">
          <p className="mb-2">
            MCP MIDI Bridge is an Electron-based desktop application that acts as a bridge between LLM-driven music generation (via the Model Context Protocol, MCP) and any DAW (Digital Audio Workstation) that accepts MIDI input.
          </p>
          <p className="mb-2">Version: 1.0.0</p>
          <p className="mb-2">License: Apache 2.0</p>
          <p className="mb-2">Features:</p>
          <ul className="list-disc pl-5 mb-2">
            <li>MCP API Server for receiving NoteSequence JSON</li>
            <li>Virtual MIDI output for DAW integration</li>
            <li>Support for all 16 MIDI channels (Channel 10 reserved for drums)</li>
            <li>General MIDI instrument support</li>
            <li>Configurable MCP server port</li>
          </ul>
        </div>
      </div>
    </div>
  );
}