#!/usr/bin/env python
"""
Magenta Wrapper for MCP MIDI Bridge

This script provides a simple interface to convert between NoteSequence JSON and MIDI files
using the Magenta note_seq library.
"""

import argparse
import json
import os
import sys
from typing import Dict, Any, Optional

import note_seq
import mido
from flask import Flask, request, jsonify

app = Flask(__name__)


def note_sequence_to_midi(note_sequence: Dict[str, Any], output_file: str) -> bool:
    """
    Convert a NoteSequence JSON object to a MIDI file.
    
    Args:
        note_sequence: A dictionary representing a NoteSequence JSON object
        output_file: Path to save the MIDI file
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Convert the dictionary to a NoteSequence protocol buffer
        sequence = note_seq.NoteSequence()
        
        # Add notes
        for note_data in note_sequence.get('notes', []):
            note = sequence.notes.add()
            note.pitch = note_data.get('pitch', 60)
            note.start_time = note_data.get('startTime', 0)
            note.end_time = note_data.get('endTime', note.start_time + 0.5)
            note.velocity = note_data.get('velocity', 80)
            note.instrument = note_data.get('instrument', 0)
            note.program = note_data.get('program', 0)
            note.is_drum = note_data.get('isDrum', False)
        
        # Add tempo changes if present
        if 'tempos' in note_sequence:
            for tempo_data in note_sequence['tempos']:
                tempo = sequence.tempos.add()
                tempo.time = tempo_data.get('time', 0)
                tempo.qpm = tempo_data.get('qpm', 120.0)
        else:
            # Add a default tempo if none exists
            tempo = sequence.tempos.add()
            tempo.time = 0
            tempo.qpm = 120.0
        
        # Add time signatures if present
        if 'timeSignatures' in note_sequence:
            for ts_data in note_sequence['timeSignatures']:
                ts = sequence.time_signatures.add()
                ts.time = ts_data.get('time', 0)
                ts.numerator = ts_data.get('numerator', 4)
                ts.denominator = ts_data.get('denominator', 4)
        else:
            # Add a default time signature if none exists
            ts = sequence.time_signatures.add()
            ts.time = 0
            ts.numerator = 4
            ts.denominator = 4
        
        # Set total time if present, otherwise calculate from notes
        if 'totalTime' in note_sequence:
            sequence.total_time = note_sequence['totalTime']
        elif sequence.notes:
            sequence.total_time = max(note.end_time for note in sequence.notes)
        else:
            sequence.total_time = 0
        
        # Convert to MIDI and save
        midi_data = note_seq.sequence_proto_to_midi_file(sequence)
        with open(output_file, 'wb') as f:
            f.write(midi_data)
        
        return True
    except Exception as e:
        print(f"Error converting NoteSequence to MIDI: {e}", file=sys.stderr)
        return False


def midi_to_note_sequence(midi_file: str) -> Optional[Dict[str, Any]]:
    """
    Convert a MIDI file to a NoteSequence JSON object.
    
    Args:
        midi_file: Path to the MIDI file
        
    Returns:
        dict: A dictionary representing a NoteSequence JSON object, or None if conversion failed
    """
    try:
        # Load MIDI file and convert to NoteSequence
        sequence = note_seq.midi_file_to_note_sequence(midi_file)
        
        # Convert to dictionary
        result = {
            'notes': [],
            'tempos': [],
            'timeSignatures': [],
            'totalTime': sequence.total_time
        }
        
        # Add notes
        for note in sequence.notes:
            note_data = {
                'pitch': note.pitch,
                'startTime': note.start_time,
                'endTime': note.end_time,
                'velocity': note.velocity,
                'instrument': note.instrument,
                'program': note.program
            }
            if note.is_drum:
                note_data['isDrum'] = True
            result['notes'].append(note_data)
        
        # Add tempos
        for tempo in sequence.tempos:
            result['tempos'].append({
                'time': tempo.time,
                'qpm': tempo.qpm
            })
        
        # Add time signatures
        for ts in sequence.time_signatures:
            result['timeSignatures'].append({
                'time': ts.time,
                'numerator': ts.numerator,
                'denominator': ts.denominator
            })
        
        return result
    except Exception as e:
        print(f"Error converting MIDI to NoteSequence: {e}", file=sys.stderr)
        return None


@app.route('/convert/midi-to-json', methods=['POST'])
def api_midi_to_json():
    """API endpoint to convert MIDI file to NoteSequence JSON"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename.endswith(('.mid', '.midi')):
        return jsonify({'error': 'File must be a MIDI file (.mid or .midi)'}), 400
    
    # Save the uploaded file temporarily
    temp_path = os.path.join(os.path.dirname(__file__), 'temp_upload.mid')
    file.save(temp_path)
    
    try:
        note_sequence = midi_to_note_sequence(temp_path)
        if note_sequence:
            return jsonify(note_sequence)
        else:
            return jsonify({'error': 'Failed to convert MIDI to NoteSequence'}), 500
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.route('/convert/json-to-midi', methods=['POST'])
def api_json_to_midi():
    """API endpoint to convert NoteSequence JSON to MIDI file"""
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    note_sequence = request.json
    if not note_sequence or 'notes' not in note_sequence:
        return jsonify({'error': 'Invalid NoteSequence format'}), 400
    
    # Generate a temporary output file
    temp_path = os.path.join(os.path.dirname(__file__), 'temp_output.mid')
    
    if note_sequence_to_midi(note_sequence, temp_path):
        # Return the MIDI file as a download
        with open(temp_path, 'rb') as f:
            midi_data = f.read()
        
        # Clean up
        os.remove(temp_path)
        
        response = jsonify({'success': True})
        response.data = midi_data
        response.headers['Content-Type'] = 'audio/midi'
        response.headers['Content-Disposition'] = 'attachment; filename=output.mid'
        return response
    else:
        return jsonify({'error': 'Failed to convert NoteSequence to MIDI'}), 500


def main():
    """Main entry point for command-line usage"""
    parser = argparse.ArgumentParser(description='Convert between NoteSequence JSON and MIDI')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # MIDI to JSON command
    midi_to_json_parser = subparsers.add_parser('midi-to-json', help='Convert MIDI file to NoteSequence JSON')
    midi_to_json_parser.add_argument('midi_file', help='Path to the MIDI file')
    midi_to_json_parser.add_argument('--output', '-o', help='Output JSON file (default: stdout)')
    
    # JSON to MIDI command
    json_to_midi_parser = subparsers.add_parser('json-to-midi', help='Convert NoteSequence JSON to MIDI file')
    json_to_midi_parser.add_argument('json_file', help='Path to the NoteSequence JSON file')
    json_to_midi_parser.add_argument('--output', '-o', required=True, help='Output MIDI file')
    
    # API server command
    server_parser = subparsers.add_parser('server', help='Start the API server')
    server_parser.add_argument('--host', default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    server_parser.add_argument('--port', type=int, default=5000, help='Port to bind to (default: 5000)')
    
    args = parser.parse_args()
    
    if args.command == 'midi-to-json':
        note_sequence = midi_to_note_sequence(args.midi_file)
        if note_sequence:
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(note_sequence, f, indent=2)
            else:
                print(json.dumps(note_sequence, indent=2))
        else:
            sys.exit(1)
    
    elif args.command == 'json-to-midi':
        with open(args.json_file, 'r') as f:
            note_sequence = json.load(f)
        
        if not note_sequence_to_midi(note_sequence, args.output):
            sys.exit(1)
    
    elif args.command == 'server':
        app.run(host=args.host, port=args.port)
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()