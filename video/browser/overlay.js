// The cursor, the click ripple, the title card and the small credit in the corner of the picture.
// Browser side code: Playwright injects this file into every page before the page's own scripts (the recorder in lib/Recorder.bx adds it).
(function overlay() {
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
})();
