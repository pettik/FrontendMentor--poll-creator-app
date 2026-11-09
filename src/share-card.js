import { createAvatar } from '@dicebear/core';
import * as micah from '@dicebear/micah';
import { race, percentage, plural } from './utils.js';

const colors = {cream:'#faf2e3',card:'#fffbf2',ink:'#38261a',orange:'#e2542c',butter:'#f3c64f',teal:'#1f7367'};
function wrap(ctx,text,maxWidth) {
  const lines=[];
  let line='';
  for (const word of text.split(/\s+/)) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) { lines.push(line); line=''; }
      let chunk='';
      for (const char of word) { if (ctx.measureText(chunk+char).width>maxWidth) { lines.push(chunk); chunk=char; } else chunk+=char; }
      line=chunk;
    } else if (ctx.measureText(line?line+' '+word:word).width > maxWidth) { lines.push(line); line=word; }
    else line=line?line+' '+word:word;
  }
  if (line) lines.push(line);
  return lines;
}
function rounded(ctx,x,y,w,h,r,fill,stroke) {
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();}
}
export async function saveShareCard(poll) {
  if(poll.status!=='settled') throw new Error('Close the poll before saving its result.');
  await document.fonts.ready;
  const {leaders,tied}=race(poll);
  const canvas=document.createElement('canvas');
  let ctx=canvas.getContext('2d');
  ctx.font='750 40px "Gabarito Variable"';
  const title=wrap(ctx,poll.title,1032);
  ctx.font='750 58px "Gabarito Variable"';
  const winner=wrap(ctx,leaders.length?leaders.map(o=>o.label).join(' & '):'No votes this round.',1000);
  const backers=[...new Map(leaders.flatMap(o=>o.backers).map(person=>[person.name+'|'+person.avatar.seed,person])).values()];
  ctx.font='600 26px "Karla Variable"';
  const names=wrap(ctx,backers.length?`Backed by ${backers.map(p=>p.name).join(', ')}.`:'The crew can reopen this poll when everyone is ready.',1000);
  const titleHeight=title.length*47;
  const cardY=165+titleHeight;
  const cardH=210+winner.length*66+names.length*34+(backers.length?80:0);
  canvas.width=1200;canvas.height=Math.max(800,cardY+cardH+100);
  ctx=canvas.getContext('2d');
  ctx.fillStyle=colors.cream;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=colors.ink;ctx.font='800 32px "Gabarito Variable"';ctx.fillText('tiebreak',76,80);
  ctx.font='700 19px "Karla Variable"';ctx.textAlign='right';ctx.fillText('GOOD COMPANY. DECISION MADE.',1124,76);ctx.textAlign='left';
  ctx.strokeStyle=colors.ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(76,105);ctx.lineTo(1124,105);ctx.stroke();
  ctx.font='750 40px "Gabarito Variable"';title.forEach((line,i)=>ctx.fillText(line,80,163+i*47));
  rounded(ctx,76,cardY,1048,cardH,28,tied?colors.butter:leaders.length?colors.orange:colors.card,colors.ink);
  ctx.fillStyle=colors.ink;ctx.font='800 21px "Karla Variable"';ctx.fillText(tied?'A TIE. EVERYONE GETS EQUAL BILLING.':leaders.length?'THE CREW HAS SPOKEN':'NO VOTES, NO WINNER.',112,cardY+52);
  ctx.fillStyle=tied?colors.ink:leaders.length?colors.card:colors.ink;ctx.font='750 58px "Gabarito Variable"';
  winner.forEach((line,i)=>ctx.fillText(line,112,cardY+126+i*66));
  let y=cardY+144+winner.length*66;
  if(leaders.length) {
    rounded(ctx,108,y-24,980,49,10,tied?colors.card:'#38261a88');
    ctx.fillStyle=tied?colors.ink:colors.card;ctx.font='700 26px "Karla Variable"';
    ctx.fillText(`${leaders[0].count} of ${plural(poll.totalVoters)}${tied?' each':''} · ${percentage(leaders[0].count,poll.totalVoters)}%${poll.type==='multi'?' of people · multiple picks allowed':''}`,128,y+10);
    y+=70;
  }
  if(backers.length) {
    const displayed=backers.slice(0,9);
    for(let i=0;i<displayed.length;i++) {
      const person=displayed[i];
      const uri=createAvatar(micah,{seed:person.avatar.seed,backgroundColor:[person.avatar.tint]}).toDataUri();
      const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=uri;});
      ctx.save();ctx.beginPath();ctx.arc(146+i*62,y+9,27,0,Math.PI*2);ctx.clip();ctx.drawImage(img,119+i*62,y-18,54,54);ctx.restore();
      ctx.strokeStyle=colors.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(146+i*62,y+9,27,0,Math.PI*2);ctx.stroke();
    }
    y+=76;
  }
  ctx.fillStyle=tied?colors.ink:leaders.length?colors.card:colors.ink;ctx.font='600 26px "Karla Variable"';
  names.forEach((line,i)=>ctx.fillText(line,112,y+i*34));
  ctx.fillStyle=colors.ink;ctx.font='600 22px "Karla Variable"';ctx.fillText(`${poll.totalVoters} ${poll.totalVoters===1?'person':'people'} · One crew · One less decision`,80,canvas.height-45);
  ctx.font='500 14px "Karla Variable"';ctx.fillText('Avatars: Micah Lanier / DiceBear · CC BY 4.0 · dicebear.com/styles/micah',80,canvas.height-18);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('The image couldn’t be saved. Try copying the result instead.');
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`tiebreak-${poll.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,55)}.png`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
