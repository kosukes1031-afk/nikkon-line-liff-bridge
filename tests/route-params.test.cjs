const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/\bstart\(\);\s*$/,'');
function harness(href,initialCookie='',loggedIn=true){
  const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
  const submissions=[],logins=[],sessionStorage=storage(),localStorage=storage();
  let cookie=initialCookie;
  const document={
    get cookie(){return cookie},
    set cookie(value){cookie=String(value).split(';')[0]},
    getElementById:()=>({innerHTML:''}),
    createElement:type=>type==='form'?{appendChild(input){(this.fields||(this.fields=[])).push(input)},submit(){submissions.push(this)}}:{},
    body:{appendChild(){}},
  };
  const liff={init:async()=>{},isLoggedIn:()=>loggedIn,getIDToken:()=> 'test-id-token',login:options=>logins.push(options)};
  const context={URL,URLSearchParams,Date,Number,JSON,Set,document,location:new URL(href),sessionStorage,localStorage,liff};
  vm.createContext(context);vm.runInContext(script,context,{filename:'index.html'});
  return {context,document,submissions,logins,sessionStorage,localStorage};
}
const base='https://example.github.io/nikkon-line-liff-bridge/';
const home=harness(base);
assert.equal(home.context.params().get('route'),'home');
for(const route of ['home','companies','reservation','ticket','tour','gate']){
  assert.equal(harness(base+'?route='+route).context.params().get('route'),route);
}
for(const route of ['tour-direct','tour-later']){
  const h=harness(base+'?route='+route+'&companyId=20260915-1');
  assert.equal(h.context.params().get('route'),route);
  assert.equal(h.context.params().get('companyId'),'20260915-1');
  assert.match(h.context.loginRedirectUrl(h.context.params()),new RegExp('route='+route+'.*companyId=20260915-1'));
}
const nested=harness(base+'?liff.state='+encodeURIComponent('?route=tour-later&companyId=55'));
assert.equal(nested.context.params().get('route'),'tour-later');
assert.equal(nested.context.params().get('companyId'),'55');
const invalid=harness(base+'?route=untrusted&companyId=55&gas=https://attacker.example/exec');
assert.equal(invalid.context.params().get('route'),'home');
assert.equal(invalid.context.params().has('gas'),false);
const beforeLogin=harness(base+'?route=tour-direct&companyId=55','',false);
beforeLogin.context.rememberParams(beforeLogin.context.params());
const afterLogin=harness(base,beforeLogin.document.cookie);
assert.equal(afterLogin.context.params().get('route'),'tour-direct');
assert.equal(afterLogin.context.params().get('companyId'),'55');
assert.equal(vm.runInContext('LIFF_ID',home.context),'2011369414-JWuEiqsX');
assert.match(vm.runInContext('GAS_URL',home.context),/^https:\/\/script\.google\.com\/macros\/s\//);
assert.doesNotMatch(script,/DEFAULT_POC_GAS_URL|allowedGasUrl\(/);
(async()=>{
  await beforeLogin.context.start();
  assert.equal(beforeLogin.logins.length,1);
  assert.match(beforeLogin.logins[0].redirectUri,/route=tour-direct.*companyId=55/);
  const malicious=harness(base+'?route=tour-later&companyId=55&gas=https://attacker.example/exec');
  await malicious.context.start();
  assert.equal(malicious.submissions.length,1);
  const form=malicious.submissions[0];
  assert.equal(form.action,vm.runInContext('GAS_URL',malicious.context));
  const fields=Object.fromEntries(form.fields.map(input=>[input.name,input.value]));
  assert.equal(fields.route,'tour-later');
  assert.equal(fields.companyId,'55');
  assert.equal(Object.hasOwn(fields,'gas'),false);
  console.log('production bridge candidate route fixtures: ok');
})().catch(error=>{console.error(error);process.exitCode=1});
