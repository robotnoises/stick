import './styles.css';
import { Game } from './app/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

const game = new Game(canvas);

await game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});
