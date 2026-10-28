/**
 * A small recorder for the walkthrough: a browser with a visible cursor and click ripple, title cards, and helpers to drive the bar and the console.
 * Playwright comes from node_modules (npm install in this folder). Set CHROMIUM to a Chromium binary when Playwright has none.
 */
const fs = require( 'fs' );
const path = require( 'path' );

// Runs in every page before its own scripts: cursor, click ripple and the title card.
function overlay() {
	const host = document.createElement( 'div' );
	host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
	const root = host.attachShadow( { mode: 'open' } );
	root.innerHTML = `<style>
		:host{all:initial}
		.card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:16px;
			background:radial-gradient(1400px 700px at 50% 30%,#10304f,#060f1b 70%);color:#fff;opacity:0;transition:opacity .6s;font-family:system-ui,"Segoe UI",sans-serif;padding:60px}
		.card.on{opacity:1}
		.card h1{font-size:84px;margin:0;font-weight:700;letter-spacing:-.01em}
		.card h1 b{background:linear-gradient(90deg,#00d4ff,#1af5b0);-webkit-background-clip:text;color:transparent}
		.card p{font-size:32px;color:#aeb5cf;margin:0;max-width:1200px;line-height:1.4}
		.card.big h1{font-size:128px}
		.card img.lead{height:150px;margin-bottom:8px}
		.card .foot{position:absolute;bottom:54px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:18px;font-size:26px;color:#aeb5cf}
		.card .foot img{height:46px}
		.bug{position:fixed;right:26px;bottom:22px;display:none;align-items:center;gap:12px;padding:8px 16px;border-radius:12px;background:rgba(6,15,27,.82);color:#aeb5cf;font:18px system-ui,sans-serif;border:1px solid rgba(255,255,255,.12)}
		.bug.on{display:flex}
		.bug img{height:30px}
		.cur{position:fixed;width:24px;height:24px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(0,219,255,.9);border:3px solid #fff;box-shadow:0 0 0 4px rgba(0,0,0,.25);left:-60px;top:-60px;transition:none}
		.rip{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:4px solid #1af5b0;animation:r .6s ease-out forwards}
		@keyframes r{to{transform:scale(5);opacity:0}}
	</style><div class="card"></div><div class="bug"></div><div class="cur"></div>`;
	const card = root.querySelector( '.card' ), cur = root.querySelector( '.cur' ), bug = root.querySelector( '.bug' );
	const esc = s => String( s ).replace( /[&<>]/g, c => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ c ] ) );
	window.__render = () => {
		let k = null;
		try { k = JSON.parse( sessionStorage.getItem( 'card' ) || 'null' ); } catch ( e ) {}
		if ( k ) {
			card.innerHTML = ( k.img ? '<img class="lead" src="' + k.img + '">' : '' ) + '<h1>' + k.t + '</h1><p>' + esc( k.s || '' ) + '</p>' + ( k.foot ? '<div class="foot">' + k.foot + '</div>' : '' );
			card.classList.toggle( 'big', !!k.big );
		}
		card.classList.toggle( 'on', !!k );
		let b = null;
		try { b = JSON.parse( sessionStorage.getItem( 'bug' ) || 'null' ); } catch ( e ) {}
		if ( b ) { bug.innerHTML = '<span>' + esc( b.s ) + '</span><img src="' + b.img + '">'; }
		bug.classList.toggle( 'on', !!b );
	};
	window.__set = ( key, val ) => { try { sessionStorage.setItem( key, JSON.stringify( val ) ); } catch ( e ) {} window.__render(); };
	document.addEventListener( 'mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true );
	document.addEventListener( 'mousedown', e => {
		const r = document.createElement( 'div' ); r.className = 'rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
		root.appendChild( r ); setTimeout( () => r.remove(), 800 );
	}, true );
	const mount = () => { document.documentElement.appendChild( host ); window.__render(); };
	if ( document.documentElement ) mount(); else document.addEventListener( 'DOMContentLoaded', mount );
}

// The console of a trial shows a banner and a pill, and the machine that records the video has mounts that are not part of the story.
// Both are hidden on every page, by their text, because the console redraws itself every second.
function tidy() {
	const hideText = ( root, re, how ) => {
		const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
		for ( let n; ( n = walker.nextNode() ); ) {
			if ( re.test( n.nodeValue ) && n.parentElement ) {
				const e = n.parentElement.closest( how.up ) || n.parentElement;
				e.style.setProperty( how.prop, how.val, 'important' );
			}
		}
	};
	setInterval( () => {
		if ( !document.body ) { return; }
		hideText( document.body, /You are on a trial/, { up: '.banner, .trial, [class*=banner]', prop: 'display', val: 'none' } );
		hideText( document.body, /^\s*Trial\s*·/, { up: 'span, a, button', prop: 'visibility', val: 'hidden' } );
		hideText( document.body, /\/opt\/claude-code|\/opt\/pw-browsers|\/root\/\.claude/, { up: 'td, div', prop: 'visibility', val: 'hidden' } );
		// Not a secret, but the home folder and the kernel build name the recording machine: show the usual short forms
		const w = document.createTreeWalker( document.body, NodeFilter.SHOW_TEXT );
		for ( let n; ( n = w.nextNode() ); ) {
			const v = n.nodeValue;
			if ( /\/root\/|-fc-v\d+/.test( v ) ) { n.nodeValue = v.replace( /\/root\//g, '~/' ).replace( /-fc-v\d+/g, '' ); }
		}
		hideText( document.body, /^\s*Physical disks/, { up: '.card', prop: 'display', val: 'none' } );
		hideText( document.body, /Other volumes/, { up: 'button', prop: 'display', val: 'none' } );
	}, 250 );
}

/**
 * Open the browser.
 *
 * @param {object} o base (the demo address), out (folder for the video), password (console password), video (false to skip recording)
 */
async function open( o ) {
	const { chromium } = require( 'playwright' );
	fs.mkdirSync( o.out, { recursive: true } );
	const size = { width: 1920, height: 1080 };
	const browser = await chromium.launch( { executablePath: process.env.CHROMIUM || undefined, args: [ '--no-sandbox', '--force-device-scale-factor=1' ] } );
	const ctx = await browser.newContext( {
		viewport: size, colorScheme: 'dark',
		...( o.video === false || o.cast ? {} : { recordVideo: { dir: o.out, size } } ),
	} );
	await ctx.addInitScript( overlay );
	await ctx.addInitScript( tidy );
	const page = await ctx.newPage();
	page.setDefaultTimeout( 20000 );
	page.on( 'dialog', d => d.accept().catch( () => {} ) );
	const t0 = Date.now();
	// Recording with Playwright's own video stretches time when the machine is busy, so the picture drifts from the voice. The screencast of
	// the browser stamps every frame with the real time instead; mix.cjs builds the video from those frames and their stamps.
	const frames = [];
	let cdp = null, writing = Promise.resolve();
	const frameDir = path.join( o.out, 'frames' );
	if ( o.cast ) {
		fs.rmSync( frameDir, { recursive: true, force: true } );
		fs.mkdirSync( frameDir, { recursive: true } );
		cdp = await ctx.newCDPSession( page );
		cdp.on( 'Page.screencastFrame', ev => {
			const n = frames.length;
			frames.push( { f: 'f' + String( n ).padStart( 6, '0' ) + '.jpg', ts: ev.metadata.timestamp } );
			fs.writeFileSync( path.join( frameDir, frames[ n ].f ), Buffer.from( ev.data, 'base64' ) );
			cdp.send( 'Page.screencastFrameAck', { sessionId: ev.sessionId } ).catch( () => {} );
		} );
		await cdp.send( 'Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 } );
	}
	const wait = ms => page.waitForTimeout( ms );
	const loc = s => ( typeof s === 'string' ? page.locator( s ).first() : s );

	const glide = async ( l, click = true, steps = 30 ) => {
		// The console redraws its lists every second, which makes scrollIntoViewIfNeeded wait for a stable element, so scroll from the page instead
		let b = await l.boundingBox();
		if ( !b ) { return; }
		if ( b.y < 0 || b.y + b.height > size.height ) {
			await l.evaluate( e => e.scrollIntoView( { block: 'center' } ) ).catch( () => {} );
			await wait( 300 );
			b = ( await l.boundingBox() ) || b;
		}
		await page.mouse.move( b.x + b.width / 2, b.y + b.height / 2, { steps } );
		await wait( 250 );
		if ( click ) {
			const b2 = ( await l.boundingBox() ) || b;
			await page.mouse.click( b2.x + b2.width / 2, b2.y + b2.height / 2 );
		}
	};
	const tabOf = name => page.locator( '.ptabs2 > *:visible, .tab:visible, [role=tab]:visible', { hasText: new RegExp( `^\\s*${ name }\\b` ) } ).first();
	const nav = name => page.locator( '.side .nav', { hasText: new RegExp( `^\\s*${ name }\\b` ) } ).first();

	const t = {
		page, wait, glide,
		/** Seconds since the browser opened. The video starts a moment earlier, see start. */
		now: () => ( Date.now() - t0 ) / 1000,
		card: async o2 => { await page.evaluate( v => window.__set( 'card', v ), o2 || null ).catch( () => {} ); },
		login: async () => {
			await page.goto( o.base + '/~bxlens/index.bxm' );
			await wait( 600 );
			if ( await page.locator( '#pw' ).count() ) {
				await glide( page.locator( '#pw' ) );
				await page.keyboard.type( o.password, { delay: 70 } );
				await glide( page.locator( '.go' ) );
			}
			await page.waitForSelector( '.shell .app' );
			await wait( 800 );
			await page.evaluate( () => { const p = document.querySelector( '.aipanel' ); if ( p ) { p.style.display = 'none'; } } ).catch( () => {} );
		},
		go: async p => { await page.goto( o.base + p ); await wait( 500 ); },
		/** A page with the bar on it. */
		goBar: async p => { await page.goto( o.base + p ); await page.locator( '#bxlens .lens' ).waitFor(); await wait( 500 ); },
		/** Open the bar if it is closed and show one of its tabs. */
		bar: async name => {
			const panel = page.locator( '#bxlens .panel' );
			if ( !( await panel.isVisible() ) ) { await page.keyboard.press( 'Control+`' ); await panel.waitFor(); await wait( 500 ); }
			await glide( page.locator( '#bxlens .tab', { hasText: new RegExp( `^\\s*${ name }\\b` ) } ).first() );
			await wait( 600 );
		},
		/** A small credit in the corner of the picture, or none. */
		bug: async o2 => { await page.evaluate( v => window.__set( 'bug', v ), o2 || null ).catch( () => {} ); },
		/** Show a tab of the page (the console pages and the JVM, System and AI pages have them). */
		tab: async name => { await glide( tabOf( name ) ); await wait( 900 ); },
		/** Keep some load going on the demo for a while, without leaving the page: the urls are called one after another every few hundred ms. */
		load: async ( urls, every, seconds ) => page.evaluate( ( [ b, u, ms, sec ] ) => {
			let i = 0; const id = setInterval( () => { fetch( b + u[ i++ % u.length ], { credentials: 'same-origin' } ).catch( () => {} ); }, ms );
			setTimeout( () => clearInterval( id ), sec * 1000 );
		}, [ o.base, urls, every, seconds ] ),
		nav: async name => { await glide( nav( name ) ); await wait( 800 ); },
		click: async s => { await glide( loc( s ) ); await wait( 500 ); },
		/** Click a row of a list the console redraws every second: move the cursor to it, then click the element itself, so the click cannot be lost in a redraw. */
		pick: async s => { await glide( loc( s ), false ); await wait( 300 ); await loc( s ).dispatchEvent( 'click' ); await wait( 600 ); },
		hover: async s => { await glide( loc( s ), false ); await wait( 400 ); },
		scrollTo: async s => { await loc( s ).evaluate( e => e.scrollIntoView( { block: 'center' } ) ); await wait( 500 ); },
		shot: async name => { await page.screenshot( { path: path.join( o.out, name + '.png' ) } ); },
		/** Call a demo URL without leaving the page (to start a scenario). */
		fire: async p => page.evaluate( u => fetch( u, { credentials: 'same-origin' } ).then( r => r.status ), o.base + p ),
		count: async s => page.locator( s ).count(),
		/** Hide parts of a page with CSS, one rule for each selector so a selector that does not match cannot cancel the others. Used for details of the machine that records the video. */
		hide: async list => { for ( const css of [].concat( list ) ) { await page.addStyleTag( { content: css + '{visibility:hidden !important}' } ); } },
		/** Hide the card of the page that contains this label. */
		hideCard: async label => page.evaluate( l => { document.querySelectorAll( '.card' ).forEach( c => { if ( c.offsetParent && c.textContent.includes( l ) ) { c.style.visibility = 'hidden'; } } ); }, label ),
	};
	if ( process.env.DEBUG ) {
		for ( const k of Object.keys( t ) ) {
			if ( typeof t[ k ] !== 'function' || [ 'now', 'wait', 'glide' ].includes( k ) ) { continue; }
			const f = t[ k ];
			t[ k ] = async ( ...a ) => { const s0 = Date.now(); const r = await f( ...a ); console.log( '   ' + k + '(' + String( a[ 0 ] ).slice( 0, 40 ) + ') ' + ( Date.now() - s0 ) + 'ms' ); return r; };
		}
	}
	t.close = async file => {
		if ( cdp ) {
			await cdp.send( 'Page.stopScreencast' ).catch( () => {} );
			await wait( 300 );
			fs.writeFileSync( path.join( o.out, 'cast.json' ), JSON.stringify( { t0epoch: t0 / 1000, frames } ) );
			await ctx.close();
			await browser.close();
			return;
		}
		const vid = page.video();
		await ctx.close();
		if ( vid && file ) { await vid.saveAs( file ); }
		await browser.close();
	};
	return t;
}

module.exports = { open };
