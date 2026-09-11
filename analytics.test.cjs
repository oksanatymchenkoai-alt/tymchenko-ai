// Offline behavior tests; no requests are sent to Google Analytics.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
function setup(){
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.textContent=''}
    append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
    replaceChildren(){this.children=[]}
    setAttribute(){}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
    closest(selector){if(selector==='a[href]'&&this.tag==='a')return this;if(selector==='[data-prompt-id]'&&this.dataset.promptId)return this;return this.parent?.closest(selector)||null}
    querySelectorAll(selector){return this.children.flatMap(c=>[(selector==='.prompt-text'&&c.className==='prompt-text')?c:null,...(c.querySelectorAll?.(selector)||[])].filter(Boolean))}
  }
  const listeners={},nodes={},events=[],copies=[],observers=[];
  const document={visibilityState:'visible',createElement:t=>new Element(t),createTextNode:t=>({textContent:t}),getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(n,f)=>(listeners[n]??=[]).push(f)};
  class IntersectionObserver{constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this)}observe(t){this.targets.add(t)}unobserve(t){this.targets.delete(t)}}
  const context=vm.createContext({document,location:new URL('https://example.com/resource.html?id=test&utm_source=ig'),URL,URLSearchParams,IntersectionObserver,navigator:{clipboard:{writeText:async t=>{copies.push(t)}}},setTimeout:()=>0});
  context.window=context;context.gtag=(...args)=>events.push(args);
  vm.runInContext(fs.readFileSync(path.join(base,'app.js'),'utf8'),context);
  return{context,document,listeners,nodes,events,copies,observers,Element};
}
test('copy: one event per click, unchanged clipboard, rejection and analytics failure safe',async()=>{
  const s=setup(),item={id:'one',title:'Prompt',text:'Exact clipboard text'},guide={id:'guide'};
  const card=s.context.promptCard(item,0,guide),copy=card.children.at(-1).children[0].children[1];
  assert.equal(copy.listeners.click.length,1);
  await copy.listeners.click[0]();assert.equal(s.events.length,1);assert.equal(s.events[0][1],'copy_prompt');assert.equal(s.events[0][2].prompt_id,'guide:one');assert.deepEqual(s.copies,[item.text]);
  s.context.navigator.clipboard.writeText=async()=>{throw Error('denied')};await copy.listeners.click[0]();assert.equal(s.events.length,2);assert.equal(copy.textContent,'Виділіть текст');
  s.context.gtag=()=>{throw Error('blocked')};await copy.listeners.click[0]();
  delete s.context.gtag;await copy.listeners.click[0]();
});
test('delegated nested clicks: download counted once and excluded from outbound; internal links ignored',()=>{
  const s=setup();s.context.initLinkTracking();assert.equal(s.listeners.click.length,1);
  const a=new s.Element('a'),child=new s.Element('span');a.append(child);a.href='https://drive.google.com/uc?export=download&id=abc';a.dataset={fileId:'guide:pdf',fileName:'Guide.pdf',guideId:'guide'};
  s.listeners.click[0]({target:child});assert.equal(s.events.length,1);assert.equal(s.events[0][1],'file_download');assert.equal(s.events[0][2].file_url,a.href);
  a.dataset={};a.href='https://www.instagram.com/example';a.textContent='Instagram';s.listeners.click[0]({target:child});assert.equal(s.events[1][1],'outbound_click');assert.equal(s.events[1][2].destination,'www.instagram.com');
  a.href='https://example.com/about.html';s.listeners.click[0]({target:child});assert.equal(s.events.length,2);
});
test('all real guides render once; prompt visibility is deduplicated; download metadata generated',()=>{
  const guides=JSON.parse(fs.readFileSync(path.join(base,'content/resources.json'),'utf8'));
  const ids=new Set();
  for(const guide of guides){
    const s=setup();for(const id of ['resource-content','resource-title','resource-description'])s.nodes[id]=new s.Element('div');
    s.context.renderResource(guide);s.context.renderResource(guide);assert.equal(s.events.filter(e=>e[1]==='view_guide').length,1);
    const observer=s.observers[0],targets=[...observer.targets];assert.equal(targets.length,guide.prompts.length);
    observer.callback(targets.map(target=>({target,isIntersecting:false})));assert.equal(s.events.length,1);
    observer.callback(targets.map(target=>({target,isIntersecting:true})));observer.callback(targets.map(target=>({target,isIntersecting:true})));
    assert.equal(s.events.filter(e=>e[1]==='view_prompt').length,guide.prompts.length);
    for(const event of s.events.filter(e=>e[1]==='view_prompt')){assert.ok(!ids.has(event[2].prompt_id));ids.add(event[2].prompt_id);assert.ok(event[2].page_location.includes('utm_source=ig'))}
    const pdf=s.nodes['resource-content'].children.at(-1),download=pdf.children.at(-1).children.at(-1);assert.equal(download.dataset.fileId,`${guide.id}:pdf`);assert.equal(download.dataset.guideId,guide.id);
  }
});
test('fallback identity survives reorder and explicit ID survives rename',()=>{
  const s=setup();assert.equal(s.context.promptIdentity({title:'Same'},0,{id:'g'}).prompt_id,s.context.promptIdentity({title:'Same'},3,{id:'g'}).prompt_id);
  assert.equal(s.context.promptIdentity({id:'stable',title:'Old'},0,{id:'g'}).prompt_id,s.context.promptIdentity({id:'stable',title:'New'},1,{id:'g'}).prompt_id);
});
test('exactly one GA loader and config per HTML page; no manual page_view',()=>{
  for(const file of fs.readdirSync(base).filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(path.join(base,file),'utf8');assert.equal((html.match(/gtag\/js\?id=G-YWB4VXZGJ2/g)||[]).length,1);assert.equal((html.match(/src="analytics.js"/g)||[]).length,1);assert.ok(!html.includes('gtm.js'))}
  const calls=[],context=vm.createContext({window:{},Date});context.window=context;vm.runInContext(fs.readFileSync(path.join(base,'analytics.js'),'utf8'),context);assert.equal(context.dataLayer.length,2);assert.equal(context.dataLayer[1][0],'config');assert.equal(context.dataLayer[1][1],'G-YWB4VXZGJ2');
});
