import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.rpg.mobile',
	appName: 'RPG Game',
	webDir: 'dist',
	bundledWebRuntime: false,
	server: {
		androidScheme: 'https',
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 2000,
			backgroundColor: '#000000',
			showSpinner: false,
		},
		PushNotifications: {
			presentationOptions: ['badge', 'sound', 'alert'],
		},
		Keyboard: {
			resize: 'native',
			style: 'dark',
			resizeOnFullScreen: true,
		},
		StatusBar: {
			style: 'dark',
			backgroundColor: '#000000',
		},
		Haptics: {},
	},
};

export default config;
