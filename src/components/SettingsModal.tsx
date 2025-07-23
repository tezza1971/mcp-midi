import { useState } from 'react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  config: AppConfig;
  onClose: () => void;
  onSave: (newConfig: Partial<AppConfig>) => void;
}

export default function SettingsModal({ config, onClose, onSave }: SettingsModalProps) {
  const [mcpPort, setMcpPort] = useState(config.mcpPort);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isNaN(mcpPort) || mcpPort < 1024 || mcpPort > 65535) {
      alert('Please enter a valid port number (1024-65535)');
      return;
    }
    
    onSave({ mcpPort });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button 
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label htmlFor="mcp-port" className="block font-semibold mb-1">MCP API Port:</label>
            <input 
              type="number" 
              id="mcp-port" 
              value={mcpPort}
              onChange={(e) => setMcpPort(parseInt(e.target.value, 10))}
              min="1024" 
              max="65535" 
              required
              className="w-full p-2 border rounded"
            />
            <small className="text-gray-500">Port must be between 1024 and 65535</small>
          </div>
          
          <div className="text-right mt-6">
            <button 
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}