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
	// Music only. The picture sits in a frame with a strip under it, and the narration is written in the strip so no caption covers the demo.
	inputs.push( '-i', loop );
	f.push( `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${ total.toFixed( 3 ) },asetpts=PTS-STARTPTS,afade=t=in:d=1.5,afade=t=out:st=${ ( total - 3.5 ).toFixed( 2 ) }:d=3.5,loudnorm=I=-14:TP=-1.5:LRA=11[aout]` );
	const style = "FontName=Inter,FontSize=10,PrimaryColour=&HFFFFFF&,BorderStyle=1,Outline=0,Shadow=0,Alignment=2,MarginV=4,MarginL=40,MarginR=40";
	f.push( `[0:v]fps=30,scale=1700:956,pad=1920:1080:110:0:color=0x060f1b,setpts=PTS-STARTPTS,subtitles='${ srtFile.replace( /'/g, "\\'" ) }':original_size=1920x1080:force_style='${ style }',format=yuv420p[vout]` );
}
const mp4 = path.join( OUT, VOICE ? 'bxlens-demo-walkthrough.mp4' : 'bxlens-demo-walkthrough-captions.mp4' );
run( 'ffmpeg', [ '-v', 'error', '-y', ...inputs, '-filter_complex', f.join( ';' ), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4 ] );
run( 'ffmpeg', [ '-v', 'error', '-y', '-ss', '48', '-i', mp4, '-frames:v', '1', path.join( OUT, 'poster.jpg' ) ] );

// 5. What the licenses ask for
fs.writeFileSync( path.join( OUT, 'credits.txt' ), [
	...( VOICE ? [ 'Voice: ' + narration.voice + ' (Piper), made with bx-audio. See https://bxaudio.boxlang.io/voices/ for the license of the voice and the credit it asks for.' ] : [ 'No voice-over in this version: the narration is shown as captions.' ] ),
	'Music: the synthwave piece of bx-audio (original, made from code, no samples). https://bxaudio.boxlang.io/examples/',
	'',
].join( '\n' ) );
console.log( 'wrote ' + mp4 );
