/**
 * Desktop Main Entry
 * Uses elit desktop runtime for native window management
 */

import {
	createWindow,
	onMessage,
	windowSetTitle,
	windowQuit,
	windowSetSize,
	windowSetPosition,
	windowMinimize,
	windowMaximize,
	windowSetAlwaysOnTop,
} from 'elit/desktop';

const HTML_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RPG Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="game-mount"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>`;

onMessage((msg: string) => {
	if (msg === 'ready') {
		windowSetTitle('RPG Game');
		console.log('[Desktop] Window ready');
	}
	if (msg === 'quit') {
		windowQuit();
	}
});

createWindow({
	title: 'RPG Game',
	width: 1280,
	height: 720,
	center: true,
	decorations: true,
	devtools: true,
	html: HTML_SHELL,
});
