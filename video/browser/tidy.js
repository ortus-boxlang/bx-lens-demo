// Hides what belongs to the recording machine and not to the demo: the trial banner and pill, mounts, and the home folder and kernel build names.
// Browser side code: Playwright injects this file into every page before the page's own scripts (the recorder in lib/Recorder.bx adds it).
(function tidy() {
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
})();
