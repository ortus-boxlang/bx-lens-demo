/**
 * Puts the voice and the music on the recording. Usage: OUT=out node mix.cjs
 *   in:  OUT/screen.webm, OUT/timeline.json, OUT/voice/*.wav, OUT/music.wav (a bx-audio piece)
 *   out: OUT/bxlens-demo-walkthrough.mp4, .srt, poster.jpg
 * The voice of each segment is placed where the segment really started (timeline.json), the music is looped to the length of the picture
 * and ducked under the voice, and the mix is mastered to -14 LUFS (what YouTube plays at) with a true peak ceiling of -1.5 dB.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );

const OUT = path.resolve( process.env.OUT || 'out' );
const tl = JSON.parse( fs.readFileSync( path.join( OUT, 'timeline.json' ), 'utf8' ) );
const narration = JSON.parse( fs.readFileSync( path.join( __dirname, 'narration.json' ), 'utf8' ) );
const run = ( cmd, args, opts = {} ) => {
	const r = cp.spawnSync( cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts } );
	if ( r.status !== 0 ) { console.error( r.stderr.slice( -3000 ) ); throw new Error( cmd + ' failed' ); }
	return r;
};

// 1. Where the picture really starts: the white flash of the opening card
const stats = run( 'ffmpeg', [ '-v', 'error', '-i', path.join( OUT, 'screen.webm' ), '-t', '15', '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-' ] ).stdout;
let on = null, off = null, t = null;
for ( const line of stats.split( '\n' ) ) {
	let m = line.match( /pts_time:([\d.]+)/ ); if ( m ) { t = parseFloat( m[ 1 ] ); }
	m = line.match( /YAVG=([\d.]+)/ );
	if ( m && t !== null ) {
		const bright = parseFloat( m[ 1 ] ) > 200;
		if ( bright && on === null ) { on = t; }
		if ( bright ) { off = t; }
	}
}
if ( on === null ) { throw new Error( 'The flash was not found in the first 15 seconds of the recording' ); }
const vStart = off + 0.04;            // video time at which the flash has ended
const shift = tl.flashOff;            // the same moment in the recorder's clock
const total = tl.total - shift + 3.5; // seconds of picture we keep, with a tail for the music
console.log( `flash ${ on.toFixed( 2 ) }s to ${ off.toFixed( 2 ) }s in the video, picture starts at ${ vStart.toFixed( 2 ) }s, ${ total.toFixed( 1 ) }s long` );

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

// 3. The mix
const segs = tl.segments.filter( s => fs.existsSync( path.join( OUT, 'voice', s.id + '.wav' ) ) );
const inputs = [ '-ss', vStart.toFixed( 3 ), '-t', total.toFixed( 3 ), '-i', path.join( OUT, 'screen.webm' ) ];
segs.forEach( s => inputs.push( '-i', path.join( OUT, 'voice', s.id + '.wav' ) ) );
inputs.push( '-i', loop );
const mi = segs.length + 1;
const f = [];
segs.forEach( ( s, i ) => {
	const ms = Math.max( 0, Math.round( ( s.voiceAt - shift ) * 1000 ) );
	f.push( `[${ i + 1 }:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ ms }|${ ms }[v${ i }]` );
} );
f.push( segs.map( ( s, i ) => `[v${ i }]` ).join( '' ) + `amix=inputs=${ segs.length }:normalize=0:dropout_transition=0,apad=whole_dur=${ total.toFixed( 3 ) },atrim=0:${ total.toFixed( 3 ) }[voice]` );
f.push( '[voice]asplit=2[vo][sc]' );
f.push( `[${ mi }:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${ total.toFixed( 3 ) },asetpts=PTS-STARTPTS,volume=${ process.env.MUSIC_GAIN || '0.55' }[music]` );
f.push( '[music][sc]sidechaincompress=threshold=0.012:ratio=9:attack=20:release=500:makeup=1[ducked]' );
f.push( `[ducked][vo]amix=inputs=2:normalize=0,afade=t=in:d=1.2,afade=t=out:st=${ ( total - 3.2 ).toFixed( 2 ) }:d=3.2,loudnorm=I=-14:TP=-1.5:LRA=11[aout]` );
f.push( '[0:v]fps=30,scale=1920:1080,format=yuv420p,setpts=PTS-STARTPTS[vout]' );
const mp4 = path.join( OUT, 'bxlens-demo-walkthrough.mp4' );
run( 'ffmpeg', [ '-v', 'error', '-y', ...inputs, '-filter_complex', f.join( ';' ), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4 ] );

// 4. Captions for YouTube: each sentence of the narration, timed across the time its segment is spoken
const clock = x => { const ms = Math.round( x * 1000 ); const p = ( n, w = 2 ) => String( n ).padStart( w, '0' ); return `${ p( Math.floor( ms / 3600000 ) ) }:${ p( Math.floor( ms / 60000 ) % 60 ) }:${ p( Math.floor( ms / 1000 ) % 60 ) },${ p( ms % 1000, 3 ) }`; };
let srt = '', n = 1;
for ( const s of segs ) {
	const text = narration.segments.find( x => x.id === s.id ).text;
	const sentences = text.match( /[^.?!]+[.?!]+/g ) || [ text ];
	const chars = sentences.reduce( ( a, x ) => a + x.length, 0 );
	let at = s.voiceAt - shift;
	for ( const sentence of sentences ) {
		const len = s.voiceFor * ( sentence.length / chars );
		srt += `${ n++ }\n${ clock( at ) } --> ${ clock( at + len - 0.05 ) }\n${ sentence.trim() }\n\n`;
		at += len;
	}
}
fs.writeFileSync( path.join( OUT, 'bxlens-demo-walkthrough.srt' ), srt );
run( 'ffmpeg', [ '-v', 'error', '-y', '-ss', '48', '-i', mp4, '-frames:v', '1', path.join( OUT, 'poster.jpg' ) ] );

// 5. What the licenses ask for
fs.writeFileSync( path.join( OUT, 'credits.txt' ), [
	'Voice: ' + narration.voice + ' (Piper), made with bx-audio. See https://bxaudio.boxlang.io/voices/ for the license of the voice and the credit it asks for.',
	'Music: the synthwave piece of bx-audio (original, made from code, no samples). https://bxaudio.boxlang.io/examples/',
	'',
].join( '\n' ) );
console.log( 'wrote ' + mp4 );
