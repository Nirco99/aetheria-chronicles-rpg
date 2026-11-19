// Entry point: boots the game on the #game canvas with the DOM UI layer in #ui.
import './styles.css';
import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const game = new Game(canvas, uiRoot);
game.start();
