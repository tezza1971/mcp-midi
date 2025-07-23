declare module 'easymidi' {
  export interface MidiMessage {
    note?: number;
    velocity?: number;
    channel?: number;
    controller?: number;
    value?: number;
    number?: number;
    pressure?: number;
    type?: number;
    value1?: number;
    value2?: number;
  }

  export class Output {
    constructor(name: string, virtual?: boolean);
    close(): void;
    send(type: string, message: MidiMessage): void;
  }

  export class Input {
    constructor(name: string, virtual?: boolean);
    close(): void;
    on(event: string, callback: (msg: MidiMessage) => void): void;
  }

  export function getInputs(): string[];
  export function getOutputs(): string[];
}