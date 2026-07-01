export interface GameSystem {
  initialize?(): Promise<void> | void;
  update(deltaSeconds: number): void;
  dispose?(): void;
}
