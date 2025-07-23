# MCP MIDI Bridge

## Overview

MCP MIDI Bridge is an Electron-based desktop application that acts as a bridge between LLM-driven music generation (via the Model Context Protocol, MCP) and any DAW (Digital Audio Workstation) that accepts MIDI input. It enables AI-generated or AI-edited musical content (in Magenta NoteSequence JSON format) to be easily played, recorded, and manipulated in a DAW via a virtual MIDI device.

## Features

- **MCP API Server**: Receives and updates musical content (NoteSequence JSON) from LLMs via HTTP
- **Virtual MIDI Output**: Creates a virtual MIDI device that any DAW can connect to
- **Multi-Channel Support**: Full support for all 16 MIDI channels with General MIDI instruments
- **Configurable Port**: Run multiple instances on different ports for parallel workflows
- **Song Cache**: Stores song data for persistence between sessions
- **User Dashboard**: Simple interface for viewing and playing songs
- **MIDI Import/Export**: Support for importing and exporting MIDI files (coming soon)

## Technology Stack

- **Electron**: Cross-platform desktop application framework
- **Next.js**: React framework for the user interface
- **TypeScript**: Type-safe JavaScript for better development experience
- **Express**: API server for MCP communication
- **EasyMIDI**: MIDI interface for virtual device creation
- **Magenta**: Music generation and manipulation (Python backend)

## Development

### Prerequisites

- Node.js 18+
- Python 3.8+ (for Magenta features)
- npm or yarn

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/mcp-midi.git
   cd mcp-midi
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm run dev
   ```

### Build

```bash
npm run build
```

## License

Apache 2.0