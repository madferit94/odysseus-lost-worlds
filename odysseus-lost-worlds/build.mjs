import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unsafe output directory');
const assets={};
for(const file of ['index.html','game.js','art.js','gods.js','achilles.js','caocao.js','views.js','weapons.js','characters.js','combat.js','progression.js','ui.js','ranking.js','telemetry.js','telemetry-hooks.js','assets/trojan-horse.png']){
 const binary=file.endsWith('.png'),data=fs.readFileSync(path.join(root,file));
 assets['/'+file]={binary,type:binary?'image/png':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8',body:binary?data.toString('base64'):data.toString('utf8')};
}
const config=JSON.parse(fs.readFileSync('.openai/hosting.json','utf8'));if(config.static||config.d1!=='DB')throw Error('Worker configuration required');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'server'),{recursive:true});fs.mkdirSync(path.join(out,'.openai'),{recursive:true});
fs.writeFileSync(path.join(out,'server/index.js'),'const ASSET_MAP='+JSON.stringify(assets)+';\n'+fs.readFileSync('server/telemetry.mjs','utf8')+'\n'+fs.readFileSync('server/worker.mjs','utf8').replace("import {telemetryApi} from './telemetry.mjs';",''));
fs.copyFileSync('.openai/hosting.json',path.join(out,'.openai/hosting.json'));
fs.cpSync('drizzle',path.join(out,'.openai/drizzle'),{recursive:true});
console.log('Built game, ranking Worker, and database migrations.');
