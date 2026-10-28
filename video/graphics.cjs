/**
 * Draws the graphics of the captions-only video with a headless browser: the caption strip for every act (with its marker and progress dots)
 * and the two animated slides (the opening and the closing one), as frames that ffmpeg turns into video.
 * Usage: node graphics.cjs OUT spec.json     spec: { acts: [ { n, name } ], of, open: seconds, close: seconds }
 */
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );
const { chromium } = require( 'playwright' );

const OUT = path.resolve( process.argv[ 2 ] );
const spec = JSON.parse( fs.readFileSync( process.argv[ 3 ], 'utf8' ) );
const dir = path.join( __dirname, 'graphics' );

( async () => {
	const browser = await chromium.launch( { executablePath: process.env.CHROMIUM || undefined, args: [ '--no-sandbox', '--allow-file-access-from-files', '--force-device-scale-factor=1' ] } );
	const page = await browser.newPage( { viewport: { width: 1920, height: 1080 } } );
	// The strips: 0 is the plain strip (no act yet)
	await page.setViewportSize( { width: 1920, height: 124 } );
	for ( const a of [ { n: 0, name: '' }, ...spec.acts ] ) {
		await page.goto( 'file://' + path.join( dir, 'strip.html' ) + '?n=' + a.n + '&of=' + spec.of + '&name=' + encodeURIComponent( a.name ) );
		await page.screenshot( { path: path.join( OUT, 'strip-' + a.n + '.png' ) } );
	}
	if ( process.env.STRIPS_ONLY ) { await browser.close(); return; }
	// The slides: seek the animations frame by frame
	await page.setViewportSize( { width: 1920, height: 956 } );
	for ( const m of [ 'open', 'close' ] ) {
		const frames = path.join( OUT, 'slide-' + m );
		fs.rmSync( frames, { recursive: true, force: true } );
		fs.mkdirSync( frames, { recursive: true } );
		await page.goto( 'file://' + path.join( dir, 'slides.html' ) + '?m=' + m );
		await page.waitForTimeout( 500 );
		const n = Math.ceil( spec[ m ] * 30 );
		for ( let i = 0; i < n; i++ ) {
			await page.evaluate( t => window.__seek( t ), i / 30 );
			await page.screenshot( { path: path.join( frames, String( i ).padStart( 5, '0' ) + '.jpg' ), type: 'jpeg', quality: 93 } );
		}
		cp.execFileSync( 'ffmpeg', [ '-v', 'error', '-y', '-framerate', '30', '-i', path.join( frames, '%05d.jpg' ), '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p', path.join( OUT, 'slide-' + m + '.mp4' ) ] );
	}
	await browser.close();
} )().catch( e => { console.error( e ); process.exit( 1 ); } );
