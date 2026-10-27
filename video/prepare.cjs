/** Clears the Errors page of the console, so the walkthrough starts with groups made on purpose. Usage: BASE=... CHROMIUM=... node prepare.cjs */
const { open } = require( './lib.cjs' );
( async () => {
	const t = await open( { base: process.env.BASE || 'http://127.0.0.1:8088', out: 'out', password: 'lens-demo', video: false } );
	await t.login();
	await t.nav( 'Errors' );
	await t.wait( 800 );
	await t.page.locator( 'button:has-text("Clear")' ).first().click();
	await t.wait( 800 );
	const confirm = t.page.locator( 'button:has-text("Clear"), button:has-text("Yes"), button:has-text("Confirm")' );
	if ( await confirm.count() > 1 ) { await confirm.last().click().catch( () => {} ); }
	await t.wait( 800 );
	console.log( 'errors cleared' );
	await t.close();
} )().catch( e => { console.error( e ); process.exit( 1 ); } );
