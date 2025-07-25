import { McpServerStatus } from '../types';
import { Card, CardContent } from './ui/Card';
import { CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  apiStatus: McpServerStatus;
  midiOutputs: string[];
}

export default function StatusBar({ apiStatus, midiOutputs }: StatusBarProps) {
  const isMidiAvailable = midiOutputs.includes('MCP MIDI Bridge');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {apiStatus.running ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                MCP API: {apiStatus.running ? 'Running' : 'Stopped'}
              </span>
              <span className="text-sm text-muted-foreground">
                Port {apiStatus.port}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMidiAvailable ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              MIDI: {isMidiAvailable ? 'MCP MIDI Bridge' : 'Not available'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}