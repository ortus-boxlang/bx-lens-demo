/**
 * Records the walkthrough of the demo. The narration (narration.json) is spoken first, so every segment's length is known; each segment drives
 * the browser for its sentences and the recorder keeps a log of when each segment really started, which the mixer uses to place the voice.
 *
 * Usage: BASE=http://127.0.0.1:8097 OUT=out CHROMIUM=/path/to/chrome node record.cjs
 *   SHOTS=1  save a screenshot at the end of every segment into OUT/shots (a quick check, with the waits cut short)
 *   ONLY=11-requests,12-errors  run only these segments (with SHOTS for a check of the selectors)
 */
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );
const { open } = require( './lib.cjs' );

const BASE = process.env.BASE || 'http://127.0.0.1:8088';
const OUT = path.resolve( process.env.OUT || 'out' );
const SHOTS = !!process.env.SHOTS;
const ONLY = ( process.env.ONLY || '' ).split( ',' ).filter( Boolean );
const narration = JSON.parse( fs.readFileSync( path.join( __dirname, 'narration.json' ), 'utf8' ) );

/** Length of a spoken segment in seconds. */
const seconds = id => parseFloat( cp.execFileSync( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join( OUT, 'voice', id + '.wav' ) ] ).toString() );

// What happens on screen for each segment. The runner holds the last frame until the voice has finished.
const acts = {
	'01-intro': async t => {
		// The opening card is already up
		await t.wait( 8500 );
		await t.card( null );
		t.cardOff = t.now();
	},
	'02-panel': async t => {
		for ( let i = 0; i < 6; i++ ) { await t.page.mouse.wheel( 0, 140 ); await t.wait( 700 ); }
		await t.wait( 600 );
		await t.page.mouse.wheel( 0, -900 );
	},
	'03-bar': async t => {
		await t.goBar( '/orders.bxm' );
		await t.hover( '#bxlens .lens' );
	},
	'04-timeline': async t => {
		await t.bar( 'Timeline' );
		await t.page.mouse.move( 700, 790, { steps: 20 } );
		await t.wait( 900 );
		await t.page.mouse.move( 700, 846, { steps: 30 } );
	},
	'05-queries': async t => {
		await t.goBar( '/n-plus-one.bxm' );
		await t.bar( 'Queries' );
		await t.page.mouse.move( 960, 900 );
		for ( let i = 0; i < 3; i++ ) { await t.page.mouse.wheel( 0, 120 ); await t.wait( 900 ); }
	},
	'06-http': async t => {
		await t.goBar( '/http-failures.bxm' );
		await t.bar( 'HTTP' );
		await t.page.mouse.move( 960, 900 );
		for ( let i = 0; i < 3; i++ ) { await t.page.mouse.wheel( 0, 110 ); await t.wait( 900 ); }
	},
	'07-cost': async t => {
		await t.goBar( '/cost.bxm?mode=both' );
		await t.bar( 'Request' );
		await t.wait( 1500 );
		await t.page.mouse.move( 960, 900, { steps: 15 } );
		await t.page.mouse.wheel( 0, 300 );
	},
	'08-exception': async t => {
		await t.goBar( '/caught-exception.bxm' );
		await t.wait( 1200 );
	},
	'09-overview': async t => {
		await t.login();
		// The volume of the machine that records the video is not part of the story
		await t.hide( '#fleet tbody tr:first-child td:nth-child(6)' );
	},
	'10-servers': async t => {
		await t.hover( 'tr:has-text("web-a")' );
		await t.wait( 800 );
		await t.hover( 'tr:has-text("web-b")' );
		await t.wait( 800 );
		await t.hover( 'tr:has-text("web-c")' );
	},
	'11-requests': async t => {
		await t.fire( '/investigate/checkout.bxm' );
		await t.nav( 'Requests' );
		await t.wait( 800 );
		await t.page.locator( 'input[placeholder="Filter by URL"]' ).click();
		await t.page.keyboard.type( 'checkout', { delay: 80 } );
		await t.wait( 800 );
		await t.pick( 'tr:visible:has-text("/investigate/checkout.bxm")' );
		await t.wait( 1500 );
	},
	'11b-security': async t => {
		await t.hover( ':text("Security headers missing") >> visible=true' );
		await t.wait( 1000 );
	},
	'12-errors': async t => {
		await t.nav( 'Errors' );
		await t.wait( 1000 );
		await t.pick( 'tr:visible:has-text("MISSING_TABLE")' );
		await t.wait( 1500 );
	},
	'13-reports': async t => {
		await t.fire( '/control.bxm?action=start&id=executors&tasks=14&seconds=60' );
		await t.nav( 'Reports' );
		await t.wait( 1200 );
		await t.page.mouse.wheel( 0, 400 );
	},
	'14-executors': async t => {
		await t.nav( 'Executors' );
		await t.wait( 1500 );
	},
	'15-tasks': async t => {
		await t.nav( 'Tasks' );
		await t.wait( 1000 );
		await t.hover( 'text=sync-prices' );
	},
	'16-datasources': async t => {
		await t.fire( '/control.bxm?action=start&id=pool' );
		await t.nav( 'Datasources' );
		await t.wait( 1500 );
	},
	'17-deadlock': async t => {
		await t.fire( '/control.bxm?action=start&id=deadlock&kind=java' );
		await t.nav( 'System' );
		// The mounts and the JVM flags of the recording machine are not part of the story
		await t.hide( [ '#sys-volumes-h', '#sys-volumes', '#sys-folders' ] );
		await t.hideCard( 'Flags' );
		await t.wait( 2600 );
		await t.nav( 'Threads' );
		await t.wait( 2000 );
	},
	'18-ai': async t => {
		await t.fire( '/control.bxm?action=resetAll' );
		await t.nav( 'AI' );
		await t.wait( 1500 );
		await t.hover( 'text=generate_report' );
	},
	'19-trace': async t => {
		await t.click( 'a:has-text("Agents")' );
		await t.wait( 800 );
		await t.click( 'text=Coordinator >> nth=-1' );
		await t.wait( 2500 );
		await t.click( 'button:has-text("Runs"), a:has-text("Runs") >> nth=-1' );
		await t.wait( 1500 );
		await t.click( 'tbody tr:visible >> nth=0' );
		await t.wait( 800 );
		await t.page.locator( '#obs-trace' ).evaluate( e => e.scrollIntoView( { block: 'start', behavior: 'smooth' } ) );
		await t.wait( 1800 );
	},
	'20-fleet': async t => {
		await t.nav( 'Reports' );
		await t.wait( 1000 );
		await t.click( '#server-select' );
		await t.wait( 700 );
		await t.click( 'text="web-c"' );
		await t.wait( 2200 );
		await t.click( '#server-select' );
		await t.wait( 700 );
		await t.click( 'text="All servers"' );
		await t.wait( 2000 );
		await t.click( '#server-select' );
		await t.wait( 600 );
		await t.click( 'text="web-a"' );
		await t.wait( 800 );
	},
	'21-tickets': async t => {
		await t.go( '/investigate/' );
		// The bar was left open by the earlier pages
		if ( await t.page.locator( '#bxlens .panel' ).isVisible().catch( () => false ) ) { await t.page.keyboard.press( 'Control+`' ); await t.wait( 500 ); }
		await t.hover( 'button.repro >> nth=0' );
		await t.hover( 'button.repro >> nth=1' );
		await t.hover( 'button.repro >> nth=2' );
	},
	'21b-payments': async t => {
		await t.click( 'button.repro >> nth=1' );
		await t.wait( 5000 );
		await t.go( '/~bxlens/index.bxm' );
		await t.nav( 'Errors' );
		await t.wait( 800 );
		await t.pick( 'tr:visible:has-text("PaymentGatewayError")' );
	},
	'22-more': async t => {
		await t.go( '/watchers.bxm' );
		await t.wait( 3000 );
		await t.go( '/cbApp/' );
	},
	'23-outro': async t => {
		await t.card( { t: '<b>Bx</b>Lens', s: 'Find the cause, not just the symptom. bxlens.boxlang.io' } );
	},
};

( async () => {
	fs.mkdirSync( OUT, { recursive: true } );
	const t = await open( { base: BASE, out: OUT, password: 'lens-demo', video: false, cast: !SHOTS } );
	const log = [];
	// The opening card is up from the start, before the first segment
	await t.go( '/index.bxm' );
	await t.card( { t: '<b>Bx</b>Lens', s: 'Observability for BoxLang' } );
	await t.wait( 2000 );
	const gap = 1.1;       // seconds of picture after the voice has finished
	const lead = 0.7;      // seconds of picture before the voice starts
	for ( const seg of narration.segments ) {
		if ( ONLY.length && !ONLY.includes( seg.id ) ) { continue; }
		const start = t.now();
		const dur = seconds( seg.id );
		try { await acts[ seg.id ]( t ); } catch ( e ) { console.error( 'segment ' + seg.id + ' failed: ' + e.message ); }
		if ( SHOTS ) { await t.shot( 's-' + seg.id ); }
		else {
			const rest = start + lead + dur + gap - t.now();
			if ( rest > 0 ) { await t.wait( rest * 1000 ); }
		}
		log.push( { id: seg.id, start, voiceAt: start + lead, voiceFor: dur, end: t.now() } );
		console.log( seg.id, 'start', start.toFixed( 1 ), 'end', t.now().toFixed( 1 ) );
	}
	const total = t.now();
	await t.close();
	fs.writeFileSync( path.join( OUT, 'timeline.json' ), JSON.stringify( { total, segments: log }, null, 2 ) );
	console.log( 'total', total.toFixed( 1 ) );
} )().catch( e => { console.error( e ); process.exit( 1 ); } );
