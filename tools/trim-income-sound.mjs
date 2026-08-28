import fs from 'node:fs';
import path from 'node:path';

const [inputPath,outputPath,durationArg='1.75']=process.argv.slice(2);
if(!inputPath||!outputPath)throw new Error('Usage: node trim-income-sound.mjs <input.wav> <output.wav> [duration]');
const requestedDuration=Math.max(.25,Math.min(2,Number(durationArg)||1.75));
const input=fs.readFileSync(inputPath);
if(input.toString('ascii',0,4)!=='RIFF'||input.toString('ascii',8,12)!=='WAVE')throw new Error('Expected a RIFF/WAVE input');

let fmtOffset=-1,fmtSize=0,dataOffset=-1,dataSize=0,offset=12;
while(offset+8<=input.length){
  const id=input.toString('ascii',offset,offset+4),size=input.readUInt32LE(offset+4),body=offset+8;
  if(id==='fmt '){fmtOffset=body;fmtSize=size}
  if(id==='data'){dataOffset=body;dataSize=Math.min(size,input.length-body);break}
  offset=body+size+(size%2);
}
if(fmtOffset<0||dataOffset<0)throw new Error('WAV fmt/data chunks are missing');

let format=input.readUInt16LE(fmtOffset),channels=input.readUInt16LE(fmtOffset+2);
const sampleRate=input.readUInt32LE(fmtOffset+4),blockAlign=input.readUInt16LE(fmtOffset+12),bits=input.readUInt16LE(fmtOffset+14);
if(format===0xfffe&&fmtSize>=40)format=input.readUInt16LE(fmtOffset+24);
if(!channels||!sampleRate||!blockAlign)throw new Error('Invalid WAV format');
if(!((format===1&&[16,24,32].includes(bits))||(format===3&&bits===32)))throw new Error(`Unsupported WAV encoding: format=${format}, bits=${bits}`);

const totalFrames=Math.floor(dataSize/blockAlign),samples=Array.from({length:channels},()=>new Float32Array(totalFrames));
function readSample(byteOffset){
  if(format===3)return input.readFloatLE(byteOffset);
  if(bits===16)return input.readInt16LE(byteOffset)/32768;
  if(bits===24){let value=input[byteOffset]|(input[byteOffset+1]<<8)|(input[byteOffset+2]<<16);if(value&0x800000)value|=0xff000000;return value/8388608}
  return input.readInt32LE(byteOffset)/2147483648;
}
const bytesPerSample=bits/8;
for(let frame=0;frame<totalFrames;frame++)for(let channel=0;channel<channels;channel++)samples[channel][frame]=readSample(dataOffset+frame*blockAlign+channel*bytesPerSample);

const windowFrames=Math.max(64,Math.round(sampleRate*.01)),step=Math.max(32,Math.floor(windowFrames/2)),rms=[];
let maxRms=0;
for(let start=0;start+windowFrames<=totalFrames;start+=step){let sum=0;for(let i=0;i<windowFrames;i++){let mono=0;for(let channel=0;channel<channels;channel++)mono+=samples[channel][start+i]/channels;sum+=mono*mono}const value=Math.sqrt(sum/windowFrames);rms.push({start,value});maxRms=Math.max(maxRms,value)}
const threshold=Math.max(.002,maxRms*.045),onset=rms.find(frame=>frame.value>=threshold)?.start||0,startFrame=Math.max(0,onset-Math.round(sampleRate*.012));
const outputFrames=Math.min(Math.round(sampleRate*requestedDuration),totalFrames-startFrame),mono=new Float32Array(outputFrames);
let peak=0;
for(let i=0;i<outputFrames;i++){let value=0;for(let channel=0;channel<channels;channel++)value+=samples[channel][startFrame+i]/channels;mono[i]=value;peak=Math.max(peak,Math.abs(value))}
const normalization=peak>0?Math.min(2.5,.78/peak):1,fadeIn=Math.max(1,Math.round(sampleRate*.008)),fadeOut=Math.max(1,Math.min(outputFrames,Math.round(sampleRate*.28)));
for(let i=0;i<outputFrames;i++){
  const inGain=i<fadeIn?.5-.5*Math.cos(Math.PI*i/fadeIn):1;
  const remaining=outputFrames-1-i,outGain=remaining<fadeOut?.5-.5*Math.cos(Math.PI*remaining/fadeOut):1;
  mono[i]=Math.max(-1,Math.min(1,mono[i]*normalization*inGain*outGain));
}

const output=Buffer.alloc(44+outputFrames*2);
output.write('RIFF',0);output.writeUInt32LE(output.length-8,4);output.write('WAVE',8);output.write('fmt ',12);output.writeUInt32LE(16,16);output.writeUInt16LE(1,20);output.writeUInt16LE(1,22);output.writeUInt32LE(sampleRate,24);output.writeUInt32LE(sampleRate*2,28);output.writeUInt16LE(2,32);output.writeUInt16LE(16,34);output.write('data',36);output.writeUInt32LE(outputFrames*2,40);
for(let i=0;i<outputFrames;i++)output.writeInt16LE(Math.round(mono[i]*32767),44+i*2);
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,output);
console.log(JSON.stringify({sourceDuration:totalFrames/sampleRate,start:startFrame/sampleRate,duration:outputFrames/sampleRate,sampleRate,sourceChannels:channels,outputChannels:1,peakBeforeNormalization:peak,bytes:output.length}));
