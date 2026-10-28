/**
 * Puts the voice and the music on the recording. Usage: OUT=out node mix.cjs
 *   in:  OUT/cast.json and OUT/frames (the screencast), OUT/timeline.json, OUT/voice/*.wav, OUT/music.wav (a bx-audio piece)
 *   out: OUT/bxlens-demo-walkthrough.mp4, .srt, poster.jpg
 * The voice of each segment is placed where the segment really started (timeline.json), the music is looped to the length of the picture
 * and ducked under the voice, and the mix is mastered to -14 LUFS (what YouTube plays at) with a true peak ceiling of -1.5 dB.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );

const OUT = path.resolve( process.env.OUT || 'out' );
// VOICE=0 builds the video without the voice-over: the music, and the narration as captions burned into a strip under the picture
const VOICE = process.env.VOICE !== '0';
const tl = JSON.parse( fs.readFileSync( path.join( OUT, 'timeline.json' ), 'utf8' ) );
const narration = JSON.parse( fs.readFileSync( path.join( __dirname, 'narration.json' ), 'utf8' ) );
const run = ( cmd, args, opts = {} ) => {
	const r = cp.spawnSync( cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts } );
	if ( r.status !== 0 ) { console.error( r.stderr.slice( -3000 ) ); throw new Error( cmd + ' failed' ); }
	return r;
};

// 1. The picture: every frame of the browser screencast has the real time it was shown, so the video is built from the frames and those times
// and cannot drift from the voice. delta is the video time minus the recorder time.
const cast = JSON.parse( fs.readFileSync( path.join( OUT, 'cast.json' ), 'utf8' ) );
const ts0 = cast.frames[ 0 ].ts;
const delta = cast.t0epoch - ts0;
const list = [ 'ffconcat version 1.0' ];
cast.frames.forEach( ( fr, i ) => {
	const next = cast.frames[ i + 1 ];
	// The screencast sends a frame only when the picture changes, so the last one (the closing card) is held until the end of the recording
	const last = Math.max( 0.5, cast.t0epoch + tl.total + 6 - fr.ts );
	list.push( `file 'frames/${ fr.f }'`, `duration ${ ( next ? Math.max( 0.001, next.ts - fr.ts ) : last ).toFixed( 4 ) }` );
} );
list.push( `file 'frames/${ cast.frames[ cast.frames.length - 1 ].f }'` );
fs.writeFileSync( path.join( OUT, 'frames.txt' ), list.join( '\n' ) );
const screen = path.join( OUT, 'screen.mp4' );
run( 'ffmpeg', [ '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join( OUT, 'frames.txt' ), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', screen ], { cwd: OUT } );
const startB = 1.0;                   // recorder time of the first picture we keep: the opening card is up
const vStart = startB + delta;        // video time of it
const shift = startB;
const total = tl.total - shift + 3.5; // seconds of picture we keep, with a tail for the music
console.log( `${ cast.frames.length } frames, picture starts at ${ vStart.toFixed( 2 ) }s of the screen video, ${ total.toFixed( 1 ) }s long` );

// 2. The music, looped to the length with a crossfade between the repeats
const music = path.join( OUT, 'music.wav' );
const loop = path.join( OUT, 'music-loop.wav' );
const mlen = parseFloat( run( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', music ] ).stdout );
const reps = Math.ceil( ( total + 4 ) / ( mlen - 2 ) ) + 1;
const ins = [], parts = [];
for ( let i = 0; i < reps; i++ ) { ins.push( '-i', music ); }
let last = '[0]';
for ( let i = 1; i < reps; i++ ) { parts.push( `${ last }[${ i }]acrossfade=d=2:c1=tri:c2=tri[x${ i }]` ); last = `[x${ i }]`; }
run( 'ffmpeg', [ '-v', 'error', '-y', ...ins, '-filter_complex', parts.join( ';' ), '-map', last, loop ] );

// 3. The captions: each sentence of the narration, timed across the time its segment would be spoken
const segs = tl.segments.filter( s => fs.existsSync( path.join( OUT, 'voice', s.id + '.wav' ) ) );
const clock = x => { const ms = Math.round( x * 1000 ); const p = ( n, w = 2 ) => String( n ).padStart( w, '0' ); return `${ p( Math.floor( ms / 3600000 ) ) }:${ p( Math.floor( ms / 60000 ) % 60 ) }:${ p( Math.floor( ms / 1000 ) % 60 ) },${ p( ms % 1000, 3 ) }`; };
let srt = '', n = 1;
const events = [];   // { from, to, text } of every sentence, for the styled captions
for ( const s of segs ) {
	const text = narration.segments.find( x => x.id === s.id ).text;
	const sentences = text.split( /(?<=[.?!])\s+/ );  // after the mark and a space, so a web address stays whole
	const chars = sentences.reduce( ( a, x ) => a + x.length, 0 );
	let at = s.voiceAt - shift;
	sentences.forEach( ( sentence, i ) => {
		const len = s.voiceFor * ( sentence.length / chars );
		// The last sentence stays on screen until the picture of its segment ends
		const to = i === sentences.length - 1 ? Math.max( at + len, s.end - shift - 0.05 ) : at + len - 0.05;
		srt += `${ n++ }\n${ clock( at ) } --> ${ clock( to ) }\n${ sentence.trim() }\n\n`;
		events.push( { from: at, to, text: sentence.trim() } );
		at += len;
	} );
}
const srtFile = path.join( OUT, 'bxlens-demo-walkthrough.srt' );
fs.writeFileSync( srtFile, srt );

// 4. The mix
const f = [];
let inputs = [ '-ss', vStart.toFixed( 3 ), '-t', total.toFixed( 3 ), '-i', screen ];
let mi;
if ( VOICE ) {
	segs.forEach( s => inputs.push( '-i', path.join( OUT, 'voice', s.id + '.wav' ) ) );
	mi = segs.length + 1;
	segs.forEach( ( s, i ) => {
		const ms = Math.max( 0, Math.round( ( s.voiceAt - shift ) * 1000 ) );
		f.push( `[${ i + 1 }:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ ms }|${ ms }[v${ i }]` );
	} );
	f.push( segs.map( ( s, i ) => `[v${ i }]` ).join( '' ) + `amix=inputs=${ segs.length }:normalize=0:dropout_transition=0,apad=whole_dur=${ total.toFixed( 3 ) },atrim=0:${ total.toFixed( 3 ) }[voice]` );
	f.push( '[voice]asplit=2[vo][sc]' );
	inputs.push( '-i', loop );
	f.push( `[${ mi }:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${ total.toFixed( 3 ) },asetpts=PTS-STARTPTS,volume=${ process.env.MUSIC_GAIN || '0.55' }[music]` );
	f.push( '[music][sc]sidechaincompress=threshold=0.012:ratio=9:attack=20:release=500:makeup=1[ducked]' );
	f.push( `[ducked][vo]amix=inputs=2:normalize=0,afade=t=in:d=1.2,afade=t=out:st=${ ( total - 3.2 ).toFixed( 2 ) }:d=3.2,loudnorm=I=-14:TP=-1.5:LRA=11[aout]` );
	f.push( '[0:v]fps=30,scale=1920:1080,format=yuv420p,setpts=PTS-STARTPTS[vout]' );
} else {
	// Music only. The picture sits in a frame with a strip under it. The strip has the captions (styled), the act marker and the progress dots,
	// and the opening and closing slides are animated (graphics.cjs draws them).
	// The number and the name of every act are in narration.json
	const acts = narration.segments.filter( x => x.card ).map( x => ( { id: x.id, n: x.n, name: x.name, start: tl.segments.find( y => y.id === x.id ).start - shift } ) );
	const s01 = tl.segments.find( x => x.id === '01-intro' ), sEnd = tl.segments.find( x => x.id === narration.segments[ narration.segments.length - 1 ].id );
	const openDur = s01.start - shift + 8.8, closeFrom = sEnd.start - shift, closeDur = total - closeFrom;
	const spec = { acts: acts.map( x => ( { n: x.n, name: x.name } ) ), of: acts.length, open: openDur, close: closeDur };
	fs.writeFileSync( path.join( OUT, 'graphics.json' ), JSON.stringify( spec ) );
	run( 'node', [ path.join( __dirname, 'graphics.cjs' ), OUT, path.join( OUT, 'graphics.json' ) ] );

	// The captions: Inter bold, key terms in the accent color, a fade in and out, a break into two lines when long
	const accents = JSON.parse( fs.readFileSync( path.join( __dirname, 'accents.json' ), 'utf8' ) ).sort( ( x, y ) => y.length - x.length );
	const accentRe = new RegExp( '(?<![\\w.])(' + accents.map( x => x.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ).join( '|' ) + ')(?![\\w])', 'gi' );
	const ass = x => { const cs = Math.round( x * 100 ); const p = ( v, w = 2 ) => String( v ).padStart( w, '0' ); return `${ Math.floor( cs / 360000 ) }:${ p( Math.floor( cs / 6000 ) % 60 ) }:${ p( Math.floor( cs / 100 ) % 60 ) }.${ p( cs % 100 ) }`; };
	const split = t => {
		if ( t.length <= 74 ) { return [ t ]; }
		const mid = t.length / 2;
		let best = -1, bestScore = 1e9;
		for ( let i = 12; i < t.length - 12; i++ ) {
			if ( t[ i ] !== ' ' ) { continue; }
			const score = Math.abs( i - mid ) - ( /[,.;]/.test( t[ i - 1 ] ) ? 10 : 0 );
			if ( score < bestScore ) { bestScore = score; best = i; }
		}
		return [ t.slice( 0, best ), t.slice( best + 1 ) ];
	};
	const mark = t => t.replace( accentRe, '{\\1c&HB0F51A&}$1{\\1c&HFFFFFF&}' );
	const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,Inter,33,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,0,2,5,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
	const lines = events.map( e => `Dialogue: 0,${ ass( e.from ) },${ ass( e.to ) },Cap,,0,0,0,,{\\an5\\pos(960,1018)\\fad(220,220)}${ split( e.text ).map( mark ).join( '\\N' ) }` );
	fs.writeFileSync( path.join( OUT, 'captions.ass' ), head + lines.join( '\n' ) + '\n' );

	inputs.push( '-i', loop, '-i', path.join( OUT, 'slide-open.mp4' ), '-i', path.join( OUT, 'slide-close.mp4' ) );
	[ 0, ...acts.map( x => x.n ) ].forEach( n => inputs.push( '-loop', '1', '-framerate', '30', '-t', total.toFixed( 3 ), '-i', path.join( OUT, 'strip-' + n + '.png' ) ) );
	f.push( `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${ total.toFixed( 3 ) },asetpts=PTS-STARTPTS,afade=t=in:d=1.5,afade=t=out:st=${ ( total - 3.5 ).toFixed( 2 ) }:d=3.5,loudnorm=I=-14:TP=-1.5:LRA=11[aout]` );
	f.push( '[0:v]fps=30,scale=1700:956,pad=1920:1080:110:0:color=0x060f1b,setpts=PTS-STARTPTS[v0]' );
	// the slides sit on the picture, 1920 by 956, and the strip goes over the bottom
	f.push( `[2:v]format=yuva420p,fade=t=out:st=${ ( openDur - 0.9 ).toFixed( 2 ) }:d=0.9:alpha=1,setpts=PTS-STARTPTS[so]` );
	f.push( `[3:v]format=yuva420p,fade=t=in:st=0:d=0.9:alpha=1,setpts=PTS-STARTPTS+${ closeFrom.toFixed( 3 ) }/TB[sc]` );
	f.push( '[v0][so]overlay=0:0:eof_action=pass[v1]' );
	f.push( `[v1][sc]overlay=0:0:eof_action=pass:enable='gte(t,${ closeFrom.toFixed( 3 ) })'[v2]` );
	let cur = 'v2';
	const windows = [ { idx: 4, from: 0, to: acts[ 0 ].start }, ...acts.map( ( a, i ) => ( { idx: 5 + i, from: a.start, to: i + 1 < acts.length ? acts[ i + 1 ].start : total + 1 } ) ) ];
	windows.forEach( ( w, i ) => {
		f.push( `[${ cur }][${ w.idx }:v]overlay=0:956:enable='between(t,${ w.from.toFixed( 3 ) },${ w.to.toFixed( 3 ) })':shortest=0[s${ i }]` );
		cur = 's' + i;
	} );
	f.push( `[${ cur }]ass=captions.ass,format=yuv420p[vout]` );
}
const mp4 = path.join( OUT, VOICE ? 'bxlens-demo-walkthrough.mp4' : 'bxlens-demo-walkthrough-captions.mp4' );
run( 'ffmpeg', [ '-v', 'error', '-y', ...inputs, '-filter_complex', f.join( ';' ), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4 ], { cwd: OUT } );  // run in OUT so the captions file is found by its plain name, with nothing to escape
run( 'ffmpeg', [ '-v', 'error', '-y', '-ss', '48', '-i', mp4, '-frames:v', '1', path.join( OUT, 'poster.jpg' ) ] );

// 5. What the licenses ask for
fs.writeFileSync( path.join( OUT, 'credits.txt' ), [
	...( VOICE ? [ 'Voice: ' + narration.voice + ' (Piper), made with bx-audio. See https://bxaudio.boxlang.io/voices/ for the license of the voice and the credit it asks for.' ] : [ 'No voice-over in this version: the narration is shown as captions.' ] ),
	'Music: the synthwave piece of bx-audio (original, made from code, no samples). https://bxaudio.boxlang.io/examples/',
	'',
].join( '\n' ) );
console.log( 'wrote ' + mp4 );
