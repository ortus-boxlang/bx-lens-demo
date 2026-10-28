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
const logo = 'data:image/png;base64,' + fs.readFileSync( path.join( __dirname, 'assets', 'bxaudio-logo-full-dark-md.png' ) ).toString( 'base64' );

/** Length of a spoken segment in seconds. */
const seconds = id => parseFloat( cp.execFileSync( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join( OUT, 'voice', id + '.wav' ) ] ).toString() );

// What happens on screen for each segment. The runner holds the last frame until the voice has finished.
const wheel = async ( t, n, dy, every ) => { for ( let i = 0; i < n; i++ ) { await t.page.mouse.wheel( 0, dy ); await t.wait( every ); } };
const search = async ( t, text ) => {
	const box = t.page.locator( 'input[placeholder^="Search URL"]:visible' );
	await box.fill( '' );
	await t.glide( box );
	await t.page.keyboard.type( text, { delay: 70 } );
	await t.wait( 900 );
};
const BARS = [ '/orders.bxm', '/n-plus-one.bxm', '/http-failures.bxm' ];

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
		await t.bug( null );
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
		await t.wait( 1500 );
		await t.page.mouse.wheel( 0, 500 );
		await t.wait( 1500 );
		await t.page.mouse.wheel( 0, -500 );
	},
	'10-servers': async t => {
		await t.hover( 'tr:has-text("web-a")' );
		await t.wait( 800 );
		await t.hover( 'tr:has-text("web-b")' );
		await t.wait( 800 );
		await t.hover( 'tr:has-text("web-c")' );
	},
	'11a-list': async t => {
		// Fresh requests so that the list has the ones we open next
		await t.fire( '/investigate/checkout.bxm' );
		await t.fire( '/cbApp/public/index.bxm/orders' );
		await t.nav( 'Requests' );
		await t.click( t.page.locator( '.rq-chip:visible', { hasText: /With issues/ } ).first() );
		for ( const re of [ /Errors/, /Slow/, /ColdBox/ ] ) {
			await t.hover( t.page.locator( '.rq-chip:visible', { hasText: re } ).first() );
			await t.wait( 500 );
		}
		await t.click( t.page.locator( '.rq-chip:visible', { hasText: /ColdBox/ } ).first() );
		await t.wait( 600 );
		await t.hover( 'tr:visible:has-text("ColdBox")' );
	},
	'11-requests': async t => {
		await t.click( t.page.locator( '.rq-chip:visible', { hasText: /^\s*All/ } ).first() );
		await search( t, 'checkout' );
		await t.pick( 'tr:visible:has-text("/investigate/checkout.bxm")' );
		await t.wait( 1500 );
	},
	'11b-security': async t => {
		await t.hover( ':text("Security headers missing") >> visible=true' );
		await t.wait( 1000 );
	},
	'11c-timeline': async t => {
		await t.page.mouse.wheel( 0, 120 );
		await t.wait( 600 );
		await t.pick( 'text=/SELECT name, country FROM customers/ >> visible=true >> nth=3' );
		await t.wait( 1800 );
	},
	'11d-sections': async t => {
		await t.click( 'button:visible:has-text("Expand all")' );
		await t.wait( 1500 );
		await t.page.mouse.move( 1100, 700 );
		await wheel( t, 6, 520, 1300 );
	},
	'11e-scopes': async t => {
		await wheel( t, 7, 560, 1400 );
	},
	'11f-coldbox': async t => {
		await t.nav( 'Requests' );
		await t.wait( 800 );
		await search( t, 'cbApp/public/index.bxm/orders' );
		await t.pick( 'tr:visible:has-text("/cbApp/public/index.bxm/orders")' );
		await t.wait( 1500 );
		await t.click( 'button:visible:has-text("Expand all")' );
		await t.wait( 1500 );
		await t.scrollTo( ':text("rendered more than once") >> visible=true' );
		await t.hover( ':text("rendered more than once") >> visible=true' );
		await t.wait( 1500 );
	},
	'11g-inflight': async t => {
		await t.load( [ '/investigate/checkout.bxm', '/cbApp/public/index.bxm/perf/parallel', '/investigate/checkout.bxm' ], 450, 22 );
		await t.nav( 'In flight' );
		await t.wait( 2500 );
		await t.hover( 'tr:visible >> nth=1' );
	},
	'12-errors': async t => {
		await t.nav( 'Errors' );
		await t.wait( 1500 );
		await t.hover( 'text=Escalating >> nth=0' );
	},
	'12b-sample': async t => {
		await t.pick( 'tr:visible:has-text("MISSING_TABLE")' );
		await t.wait( 1500 );
		await wheel( t, 3, 300, 900 );
		await t.page.mouse.wheel( 0, -900 );
		await t.hover( 'button:visible:has-text("Resolve")' );
	},
	'13-reports': async t => {
		await t.fire( '/control.bxm?action=start&id=executors&tasks=14&seconds=900' );
		await t.nav( 'Reports' );
		await t.wait( 1200 );
		await t.page.mouse.wheel( 0, 400 );
	},
	'13b-boards': async t => {
		await t.page.mouse.wheel( 0, -900 );
		await t.click( 'button:visible:text-is("Boards")' );
		await t.wait( 1500 );
		await wheel( t, 2, 400, 1200 );
		await t.page.mouse.wheel( 0, -900 );
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
	'16b-queries': async t => {
		await t.nav( 'Queries' );
		await t.wait( 2500 );
		await t.hover( 'tr:visible >> nth=2' );
	},
	'16c-http': async t => {
		await t.nav( 'HTTP' );
		await t.wait( 2500 );
		await t.hover( 'tr:visible:has-text("localhost")' );
	},
	'16d-caches': async t => {
		await t.nav( 'Caches' );
		await t.wait( 2500 );
	},
	'17a-logs': async t => {
		await t.nav( 'Logs' );
		await t.wait( 1200 );
		await t.pick( 'text=demo.log >> visible=true >> nth=0' );
		await t.wait( 1500 );
	},
	'17b-filter': async t => {
		await t.pick( 'text=exception.log >> visible=true >> nth=0' );
		await t.wait( 1200 );
		await t.glide( t.page.locator( 'input[placeholder^="Search this file"]:visible' ) );
		await t.page.keyboard.type( 'Exception', { delay: 80 } );
		await t.wait( 1200 );
		await t.hover( t.page.locator( 'a:visible, button:visible', { hasText: /^\s*Download/ } ).first() );
	},
	'18a-system': async t => {
		await t.nav( 'System' );
		await t.wait( 3500 );
		await wheel( t, 1, 380, 1200 );
	},
	'18b-cpu': async t => { await t.page.mouse.wheel( 0, -900 ); await t.tab( 'CPU' ); await t.wait( 1500 ); },
	'18c-memory': async t => { await t.tab( 'Memory' ); await t.wait( 1500 ); },
	'18d-disks': async t => { await t.tab( 'Disks' ); await t.wait( 1500 ); },
	'18e-network': async t => { await t.tab( 'Network' ); await t.wait( 1500 ); },
	'19a-jvm': async t => {
		await t.fire( '/control.bxm?action=start&id=deadlock&kind=java' );
		await t.wait( 2500 );
		await t.nav( 'JVM' );
		await t.wait( 2500 );
		await t.hover( ':text("deadlocked") >> visible=true >> nth=0' );
	},
	'19b-memory': async t => { await t.tab( 'Memory' ); await t.wait( 2500 ); },
	'19c-gc': async t => { await t.tab( 'Garbage collection' ); await t.wait( 2500 ); },
	'17-deadlock': async t => {
		await t.tab( 'Threads' );
		await t.wait( 2500 );
		await wheel( t, 2, 400, 1500 );
	},
	'19e-classes': async t => { await t.page.mouse.wheel( 0, -900 ); await t.tab( 'Classes and JIT' ); await t.wait( 2500 ); },
	'19f-web': async t => { await t.nav( 'Web server' ); await t.wait( 2500 ); },
	'20a-intro': async t => {
		await t.nav( 'Ask Lens' );
		await t.wait( 2000 );
		await t.hover( 'text=Do we have any blocked threads? >> visible=true' );
	},
	'20b-diagnose': async t => {
		await ask( t, 'Diagnose this server' );
	},
	'20c-answer': async t => { await t.wait( 800 ); },
	'20d-slow': async t => {
		await t.fire( '/investigate/checkout.bxm' );
		await ask( t, 'Why is checkout failing?' );
	},
	'20e-answer': async t => { await t.wait( 800 ); },
	'18-ai': async t => {
		await t.nav( 'AI' );
		await t.wait( 1500 );
		await t.hover( 'text=generate_report >> visible=true >> nth=0' );
	},
	'21b-agents': async t => { await t.tab( 'Agents' ); await t.wait( 2000 ); await t.hover( 'text=FlakyReporter >> visible=true >> nth=0' ); },
	'21c-composition': async t => {
		await t.click( 'text=Coordinator >> visible=true >> nth=-1' );
		await t.wait( 2500 );
	},
	'21d-runs': async t => {
		await t.tab( 'Runs' );
		await t.wait( 1500 );
		await t.hover( 'button:visible:has-text("delegated")' );
		await t.wait( 500 );
		await t.hover( 'button:visible:has-text("failed only")' );
	},
	'19-trace': async t => {
		await t.click( 'button:visible:has-text("delegated")' );
		await t.wait( 800 );
		await t.click( 'tbody tr:visible >> nth=0' );
		await t.wait( 800 );
		await t.page.locator( '#obs-trace' ).evaluate( e => e.scrollIntoView( { block: 'start', behavior: 'smooth' } ) );
		await t.wait( 1800 );
	},
	'21f-failed': async t => {
		await t.page.mouse.wheel( 0, -2000 );
		await t.wait( 600 );
		await t.click( 'button:visible:has-text("failed only")' );
		await t.wait( 800 );
		await t.click( 'tbody tr:visible >> nth=0' );
		await t.wait( 800 );
		await t.page.locator( '#obs-trace' ).evaluate( e => e.scrollIntoView( { block: 'start', behavior: 'smooth' } ) );
		await t.wait( 1800 );
	},
	'21g-mcp': async t => { await t.page.mouse.wheel( 0, -3000 ); await t.tab( 'MCP' ); await t.wait( 2500 ); },
	'21h-models': async t => { await t.tab( 'Models' ); await t.wait( 2500 ); },
	'21i-cost': async t => { await t.tab( 'Cost' ); await t.wait( 2500 ); },
	'21j-registries': async t => { await t.tab( 'Registries' ); await t.wait( 1500 ); await t.click( 'text=Tools >> visible=true >> nth=0' ); await t.wait( 1200 ); },
	'21k-settings': async t => { await t.tab( 'Settings' ); await t.wait( 3000 ); },
	'20-fleet': async t => {
		await t.fire( '/control.bxm?action=resetAll' );
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
	'22b-coldbox': async t => {
		await t.nav( 'ColdBox' );
		await t.wait( 1800 );
		for ( const n of [ 'Findings', 'Composition', 'Modules', 'Schedulers' ] ) { await t.tab( n ); await t.wait( 900 ); }
	},
	'22c-watchers': async t => { await t.nav( 'Watchers' ); await t.wait( 2500 ); },
	'22d-apps': async t => { await t.nav( 'Applications' ); await t.wait( 2500 ); },
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
	'24-outro': async t => {
		await t.card( { t: '<b>bxlens</b>.boxlang.io', s: 'Find the cause, not just the symptom.', big: true,
			foot: 'Music by <img src="' + logo + '"> &nbsp;bxaudio.boxlang.io' } );
		await t.wait( 6000 );
	},
};

/** Ask Lensy a question: type it, send it, and let the answer stream in. */
async function ask( t, q ) {
	const box = t.page.locator( 'textarea:visible' ).first();
	await t.glide( box );
	await t.page.keyboard.type( q, { delay: 60 } );
	await t.wait( 400 );
	await t.page.keyboard.press( 'Enter' );
	await t.wait( 3000 );
}

( async () => {
	fs.mkdirSync( OUT, { recursive: true } );
	const t = await open( { base: BASE, out: OUT, password: 'lens-demo', video: false, cast: !SHOTS } );
	const log = [];
	// The opening card is up from the start, before the first segment
	await t.go( '/index.bxm' );
	await t.card( { t: '<b>Bx</b>Lens', s: 'Observability for BoxLang' } );
	await t.bug( { s: 'Music by', img: logo } );
	await t.wait( 2000 );
	if ( ONLY.length && !ONLY.includes( '01-intro' ) ) { await t.card( null ); await t.bug( null ); if ( !ONLY.includes( '09-overview' ) && ONLY.some( id => !/^(0|1[01]a?-|11b)/.test( id ) ) ) { await t.login(); } }
	const gap = 1.1;       // seconds of picture after the voice has finished
	const lead = 0.7;      // seconds of picture before the voice starts
	for ( const seg of narration.segments ) {
		if ( ONLY.length && !ONLY.includes( seg.id ) ) { continue; }
		const start = t.now();
		if ( seg.card ) {
			await t.card( seg.card );
			await t.wait( seg.hold * 1000 );
			await t.card( null );
			await t.wait( 500 );
			log.push( { id: seg.id, start, voiceAt: start, voiceFor: 0, end: t.now() } );
			continue;
		}
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
