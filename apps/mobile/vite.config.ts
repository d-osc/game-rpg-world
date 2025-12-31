import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	root: './src',
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, 'src/index.html'),
			},
		},
	},
	server: {
		port: 5173,
		host: '0.0.0.0', // Allow access from mobile devices on same network
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
