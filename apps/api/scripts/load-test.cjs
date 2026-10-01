// Đợt 94 — thử tải: node scripts/load-test.cjs <GET|POST> <đường-dẫn> <số-kết-nối> <giây> [body]. Đo req/s và CPU (ms) mỗi yêu cầu của tiến trình `node dist/main` (chỉ chạy trên máy dev, KHÔNG chạy vào máy chủ thật).
// usage: node load.cjs <METHOD> <path> <conc> <secs> [body]
const http=require('http'),fs=require('fs');
const [,, method, path, conc, secs, body]=process.argv;
const pid=require('child_process').execSync("ps -eo pid,args | awk '/node dist\\/main/ && !/awk/{print $1}' | head -1").toString().trim();
const cpu=()=>{const s=fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(' ');return (+s[13]+ +s[14])*10}; // ms (USER_HZ=100)
const agent=new http.Agent({keepAlive:true,maxSockets:+conc});
let ok=0,bad=0,codes={},lat=[];let stop=false;
function one(){ if(stop) return Promise.resolve();
  return new Promise(res=>{const t=Date.now();
    const r=http.request({host:'localhost',port:3001,path,method,agent,headers:Object.assign(body?{'content-type':'application/json'}:{},{'user-agent':'Mozilla/5.0 load-'+Math.random().toString(36).slice(2),'x-forwarded-for':'10.'+(Math.random()*255|0)+'.'+(Math.random()*255|0)+'.'+(Math.random()*255|0)})},rs=>{rs.resume();rs.on('end',()=>{codes[rs.statusCode]=(codes[rs.statusCode]||0)+1;(rs.statusCode<400?ok++:bad++);lat.push(Date.now()-t);res()})});
    r.on('error',()=>{bad++;res()}); if(body) r.write(body.replace('RAND',Math.random().toString(16).slice(2,10)+'-0000-4000-8000-000000000000')); r.end();});}
(async()=>{const c0=cpu(),t0=Date.now();
 const loops=Array.from({length:+conc},async()=>{while(!stop) await one()});
 setTimeout(()=>stop=true,+secs*1000); await Promise.all(loops);
 const dt=(Date.now()-t0)/1000,dc=cpu()-c0,n=ok+bad; lat.sort((a,b)=>a-b);
 console.log(`${method} ${path.slice(0,40).padEnd(40)} ${(n/dt).toFixed(0).padStart(5)} req/s | CPU ${(dc/n).toFixed(2)} ms/yc | p50 ${lat[n>>1]}ms p99 ${lat[(n*0.99)|0]}ms | mã ${JSON.stringify(codes)}`);})();
