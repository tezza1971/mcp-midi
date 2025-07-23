declare module 'easymidi' {
  export interface Note {
    note: number;
    velocity: number;
    channel: number;
  }

  export interface Controller {
    controller: number;
    value: number;
    channel: number;
  }

  export interface Program {
    number: number;
    channel: number;
  }

  export class Output {
    constructor(name: string, virtual?: boolean);
    send(type: 'noteon', note: Note): void;
    send(type: 'noteoff', note: Note): void;
    send(type: 'poly aftertouch', note: Note): void;
    send(type: 'cc', controller: Controller): void;
    send(type: 'program', program: Program): void;
    send(type: 'channel aftertouch', pressure: { value: number; channel: number }): void;
    send(type: 'pitch', value: { value: number; channel: number }): void;
    send(type: 'position', value: { value: number; channel: number }): void;
    send(type: 'mtc', value: { type: number; value: number }): void;
    send(type: 'select', value: { value: number }): void;
    send(type: 'sysex', data: number[]): void;
    close(): void;
  }

  export function getOutputs(): string[];
}