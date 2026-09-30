import {decodePty} from './apps/desktop/src/main/transcripts.ts';
for (const raw of ['abc\rXY','abc\bX','abc\x1b[2DX']) console.log(JSON.stringify({raw,decoded:decodePty(raw)}));
