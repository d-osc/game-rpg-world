/**
 * Server Test Script
 * Quick test to verify server setup without database
 */

console.log('🧪 Testing server imports...\n');

try {
	console.log('✓ Importing Elit...');
	await import('elit');

	console.log('✓ Importing database config...');
	await import('./src/database/config.ts');

	console.log('✓ Importing AuthService...');
	await import('./src/auth/AuthService.ts');

	console.log('✓ Importing SaveService...');
	await import('./src/save/SaveService.ts');

	console.log('\n✅ All imports successful!');
	console.log('\nTo run the server:');
	console.log('  1. Setup PostgreSQL database');
	console.log('  2. Copy .env.example to .env and configure');
	console.log('  3. Run: bun run src/database/init.ts');
	console.log('  4. Run: bun run dev');
} catch (error) {
	console.error('\n❌ Import failed:', error);
	process.exit(1);
}
