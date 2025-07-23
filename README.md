# MCP MIDI Bridge

## Overview

MCP MIDI Bridge is an Electron-based desktop application that acts as a bridge between LLM-driven music generation (via the Model Context Protocol, MCP) and any DAW (Digital Audio Workstation) that accepts MIDI input. It enables AI-generated or AI-edited musical content (in Magenta NoteSequence JSON format) to be easily played, recorded, and manipulated in a DAW via a virtual MIDI device.

This project has been recently refactored to use a modern technology stack, including Next.js for the user interface and TypeScript for the entire codebase.

## Features

- **MCP API Server**: An Express-based server that receives and updates musical content (NoteSequence JSON) from LLMs via HTTP.
- **Virtual MIDI Output**: Creates a virtual MIDI device that any DAW can connect to, powered by `easymidi`.
- **Multi-Channel Support**: Full support for all 16 MIDI channels with General MIDI instruments.
- **Configurable Port**: Run multiple instances on different ports for parallel workflows.
- **Song Cache**: Stores song data for persistence between sessions.
- **User Dashboard**: A modern, responsive UI built with Next.js and React, for viewing and playing songs.
- **MIDI Import/Export**: Support for importing and exporting MIDI files (coming soon).
- **TypeScript Codebase**: The entire project is written in TypeScript for improved type safety and maintainability.

## Technology Stack

- **Electron**: Cross-platform desktop application framework.
- **Next.js**: React framework for building the user interface.
- **TypeScript**: Superset of JavaScript that adds static types.
- **Express**: Web framework for creating the MCP API server.
- **EasyMIDI**: Library for creating virtual MIDI devices.
- **Tailwind CSS**: Utility-first CSS framework for styling the UI.
- **Magenta**: Python library for music generation (used in the Python backend).

## Development

### Prerequisites

- Node.js 18+
- Python 3.8+ (for Magenta features)
- npm or yarn

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/mcp-midi.git
    cd mcp-midi
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    This command will concurrently start the Next.js development server and the Electron application.
    ```bash
    npm run dev
    ```

### Build

To build the application for production, run the following command:
```bash
npm run build
```
This will create a distributable package in the `dist` directory.

## License

Apache 2.0