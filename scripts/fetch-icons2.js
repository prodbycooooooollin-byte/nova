const fs=require('fs'),path=require('path'),AdmZip=require('adm-zip');
const out=path.join(__dirname,'..','ui','icons');
const png=(b)=>b.length>80&&b.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
(async()=>{
  for (const [name,domain] of [['br-edge','microsoftedge.microsoft.com'],['br-edge','bing.com/edge'],['br-opera','operagx.gg'],['br-opera','blogs.opera.com']]) {
    if (fs.existsSync(path.join(out,name+'.png'))) continue;
    try{const r=await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);const b=Buffer.from(await r.arrayBuffer());if(png(b)){fs.writeFileSync(path.join(out,name+'.png'),b);console.log('ok',name,domain,b.length)}else console.log('skip',name,domain)}catch(e){console.log('fail',name,e.message)}
  }
  for (const id of ['gebbhagfogifgggkldgodflihgfeacdd','nffaoalbilbmmfgbnbgppjihopabppdk','pkehgijcmpdhfbdbbnkijodmdjhbjlgp']) {
    try{
      const url=`https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${id}&installsource=ondemand&uc`)}`;
      const res=await fetch(url); const buf=Buffer.from(await res.arrayBuffer()); console.log(id,res.status,buf.length,buf.subarray(0,4).toString());
      if(buf.subarray(0,4).toString()!=='Cr24') continue;
      const zipAt=buf.readUInt32LE(4)===3?12+buf.readUInt32LE(8):16+buf.readUInt32LE(8)+buf.readUInt32LE(12);
      const zip=new AdmZip(buf.subarray(zipAt));const m=JSON.parse(zip.readAsText('manifest.json').replace(/^\uFEFF/,''));
      const icons=m.icons||{};const best=icons[Object.keys(icons).sort((a,b)=>b-a)[0]];const d=zip.readFile(best);
      if(d&&png(d)){fs.writeFileSync(path.join(out,'ext-'+id+'.png'),d);console.log('ok ext',id,m.name)}
    }catch(e){console.log('fail',id,e.message)}
  }
})();
