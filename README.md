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

## Prerequisites

- Node.js (v14 or later)
- Python 3.8 or later
- Windows 11 (for the MVP version)
- A virtual MIDI driver (loopMIDI recommended for Windows)

## Installation

1. Clone this repository

```bash
git clone https://github.com/yourusername/mcp-midi.git
cd mcp-midi
```

2. Install Node.js dependencies

```bash
npm install
```

3. Set up the Python environment

```bash
cd src/python
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r ../../requirements.txt
cd ../..
```

## Setting up Virtual MIDI

For Windows, we recommend using loopMIDI to create virtual MIDI ports:

1. Download and install loopMIDI from [https://www.tobias-erichsen.de/software/loopmidi.html](https://www.tobias-erichsen.de/software/loopmidi.html)
2. Launch loopMIDI and create a new virtual MIDI port named "MCP MIDI Bridge"

## Running the Application

1. Start the application in development mode:

```bash
npm run dev
```

2. The application will start and create a virtual MIDI output port that your DAW can connect to.

3. In your DAW, select "MCP MIDI Bridge" as a MIDI input device.

## Testing the MCP API

You can test the MCP API with the included test script:

```bash
npm run test-api
```

This will send a test multi-channel sequence to the application, which you can then play to your DAW.

To specify a different port (if you've changed it in the settings):

```bash
npm run test-api -- --port=3001
```

## Multi-Channel MIDI Support

The application supports all 16 MIDI channels according to the General MIDI standard:

- Channels 1-9 and 11-16 (0-8 and 10-15 in zero-indexed notation) can be used for melodic instruments
- Channel 10 (9 in zero-indexed notation) is reserved for drums and percussion

When creating NoteSequence JSON, you can specify the channel using the `instrument` property (0-15) and the instrument sound using the `program` property (0-127).

Example for a piano note on channel 1:
```json
{
  "pitch": 60,
  "startTime": 0,
  "endTime": 0.5,
  "velocity": 80,
  "instrument": 0,
  "program": 0
}
```

Example for a drum note on channel 10:
```json
{
  "pitch": 36,
  "startTime": 0,
  "endTime": 0.1,
  "velocity": 100,
  "instrument": 9,
  "program": 0,
  "isDrum": true
}
```

## MCP API Documentation

The application exposes an HTTP API for LLMs to interact with:

- **POST /api/song**: Send a NoteSequence JSON to update the current song
- **GET /api/song**: Get the current song as NoteSequence JSON
- **GET /api/instruments**: Get information about General MIDI instruments
- **GET /api/drums**: Get information about General MIDI drum kits

Example NoteSequence JSON format:

```json
{
  "notes": [
    {
      "pitch": 60,
      "startTime": 0,
      "endTime": 0.5,
      "velocity": 80,
      "instrument": 0,
      "program": 0
    },
    {
      "pitch": 62,
      "startTime": 0.5,
      "endTime": 1.0,
      "velocity": 80,
      "instrument": 0,
      "program": 0
    }
  ],
  "tempos": [
    {
      "time": 0,
      "qpm": 120
    }
  ],
  "timeSignatures": [
    {
      "time": 0,
      "numerator": 4,
      "denominator": 4
    }
  ],
  "totalTime": 1.0
}
```

## Configurable Port

You can change the MCP API server port in the application settings (File > Settings). This allows you to run multiple instances of the application on different ports, each with its own virtual MIDI output.

## Project Structure

```
mcp-midi/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # Electron renderer process (UI)
│   ├── common/         # Shared code between main and renderer
│   └── python/         # Python backend with Magenta integration
├── public/             # Static assets
├── song_cache/         # For storing song data
├── package.json        # Node.js dependencies and scripts
└── requirements.txt    # Python dependencies
```

## Building for Production

To build the application for production:

```bash
npm run build
```

This will create distributable packages in the `dist` directory.

## Development Roadmap

- [x] Basic MCP API server
- [x] Virtual MIDI output
- [x] Song caching system
- [x] Simple user interface
- [x] Multi-channel MIDI support
- [x] Configurable MCP server port
- [ ] MIDI file import/export
- [ ] Piano roll visualization
- [ ] DAW sync via MIDI clock
- [ ] Multi-platform support (macOS, Linux)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache License 2.0