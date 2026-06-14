// Output is 16kHz mono PCM-WAV — what llama-liquid-audio expects.

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildWavHeader(dataLen: number, sampleRate = 16000): ArrayBuffer {
  const wav = new ArrayBuffer(44 + dataLen);
  const v = new DataView(wav);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, "RIFF");
  v.setUint32(4, 36 + dataLen, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data");
  v.setUint32(40, dataLen, true);
  return wav;
}

function writePcm16(view: DataView, samples: Float32Array, offset: number) {
  let off = offset;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return off;
}

export async function blobToWavBase64(blob: Blob): Promise<string> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const dataLen = ch.length * 2;
    const wav = buildWavHeader(dataLen);
    writePcm16(new DataView(wav), ch, 44);
    return bytesToBase64(new Uint8Array(wav));
  } finally {
    ctx.close();
  }
}
