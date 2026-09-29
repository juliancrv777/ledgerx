import {spawn} from 'node:child_process';

const children=[
  spawn(process.execPath,['apps/api/dist/main.js'],{stdio:'inherit',env:process.env}),
  spawn(process.execPath,['apps/worker/dist/index.js'],{stdio:'inherit',env:process.env}),
];

let shuttingDown=false;

function shutdown(signal='SIGTERM',exitCode=0){
  if(shuttingDown)return;
  shuttingDown=true;
  for(const child of children){
    if(child.exitCode===null)child.kill(signal);
  }
  setTimeout(()=>process.exit(exitCode),5000).unref();
}

for(const [index,child] of children.entries()){
  const name=index===0?'api':'worker';
  child.on('exit',(code,signal)=>{
    if(shuttingDown)return;
    console.error(JSON.stringify({level:'error',event:'process.exit',process:name,code,signal}));
    shutdown('SIGTERM',code??1);
  });
  child.on('error',error=>{
    console.error(JSON.stringify({level:'error',event:'process.error',process:name,message:error.message}));
    shutdown('SIGTERM',1);
  });
}

process.on('SIGTERM',()=>shutdown('SIGTERM',0));
process.on('SIGINT',()=>shutdown('SIGINT',0));
console.log(JSON.stringify({event:'runtime.ready',processes:['api','worker']}));
