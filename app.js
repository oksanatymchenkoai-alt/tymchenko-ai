const state={resources:[],query:'',tool:'all',type:'all'};
const allowedHosts=new Set(['chatgpt.com','gemini.google.com','claude.ai','drive.google.com','www.youtube.com','youtube.com','www.instagram.com','instagram.com']);

// Analytics must never prevent copying, rendering, or following a link.
function trackEvent(name,params){try{if(typeof window.gtag==='function')window.gtag('event',name,{...params,page_location:location.href})}catch{}}
function promptIdentity(item,index,guide){
  const name=item.title||`Промпт ${index+1}`;
  // Title-based fallback survives reordering. Set item.id to preserve identity when renaming.
  let hash=2166136261;for(const char of name){hash=Math.imul(hash^char.codePointAt(0),16777619)}
  return{prompt_id:`${guide.id}:${item.id||`prompt-${(hash>>>0).toString(36)}`}`,prompt_name:name,guide_id:guide.id};
}
let promptObserver;
const viewedPrompts=new Set();
function observePrompts(root){
  if(!('IntersectionObserver' in window))return;
  if(!promptObserver){promptObserver=new IntersectionObserver(entries=>{
    if(document.visibilityState==='hidden')return;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const card=entry.target.closest('[data-prompt-id]'),data=card.dataset;
      if(!viewedPrompts.has(data.promptId)){
        viewedPrompts.add(data.promptId);
        trackEvent('view_prompt',{prompt_id:data.promptId,prompt_name:data.promptName,guide_id:data.guideId});
      }
      promptObserver.unobserve(entry.target);
    }
  },{threshold:0});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')return;
      document.querySelectorAll('.prompt-text').forEach(text=>{
        if(!viewedPrompts.has(text.closest('[data-prompt-id]').dataset.promptId)){
          promptObserver.unobserve(text);promptObserver.observe(text);
        }
      });
    });
  }
  root.querySelectorAll('.prompt-text').forEach(text=>promptObserver.observe(text));
}
let linkTrackingInitialized=false;
function initLinkTracking(){
  if(linkTrackingInitialized)return;linkTrackingInitialized=true;
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');if(!link)return;
    if(link.dataset.fileId){
      trackEvent('file_download',{file_id:link.dataset.fileId,file_name:link.dataset.fileName,guide_id:link.dataset.guideId,file_url:link.href});
      return;
    }
    let url;try{url=new URL(link.href,location.href)}catch{return}
    if(!['http:','https:'].includes(url.protocol)||url.origin===location.origin)return;
    trackEvent('outbound_click',{link_url:url.href,link_name:link.dataset.linkName||link.textContent.trim(),destination:link.dataset.destination||url.hostname});
  });
}

function safeUrl(value){if(!value)return null;try{const u=new URL(value,location.href);if(u.protocol!=='https:'||!allowedHosts.has(u.hostname))return null;return u.href}catch{return null}}
function qs(id){return document.getElementById(id)}
function initMenu(){const b=document.querySelector('.menu-button'),n=qs('main-nav');if(!b||!n)return;b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));n.classList.toggle('open',!open)})}
function normalize(v){return String(v||'').toLocaleLowerCase('uk-UA')}
function matches(r){const hay=normalize([r.title,r.description,...(r.tools||[]),...(r.topics||[]),...(r.keywords||[])].join(' '));return(!state.query||hay.includes(normalize(state.query)))&&(state.tool==='all'||r.toolGroup===state.tool||(r.tools||[]).includes(state.tool))&&(state.type==='all'||r.type===state.type)}

function card(r){
  const a=document.createElement('article');a.className='card';
  const top=document.createElement('div');top.className='card-top';
  const type=document.createElement('span');type.className='card-type';type.textContent=r.typeLabel;
  const date=document.createElement('span');date.className='card-date';date.textContent=`Перевірено ${r.verifiedAt}`;
  top.append(type,date);
  const h=document.createElement('h3');h.textContent=r.title;
  const p=document.createElement('p');p.textContent=r.description;
  const tags=document.createElement('div');tags.className='tag-row';
  (r.tools||[]).forEach(x=>{const s=document.createElement('span');s.className='tag';s.textContent=x;tags.append(s)});
  const link=document.createElement('a');link.className='card-link';link.href=`resource.html?id=${encodeURIComponent(r.id)}`;link.textContent='Відкрити інструкцію →';
  a.append(top,h,p,tags,link);return a;
}

function render(){
  const grid=qs('resource-grid'),empty=qs('empty-state'),count=qs('result-count'),reset=qs('reset');if(!grid)return;
  grid.replaceChildren();const visible=state.resources.filter(matches);visible.forEach(r=>grid.append(card(r)));
  count.textContent=`Знайдено: ${visible.length}`;empty.hidden=visible.length!==0;reset.hidden=!state.query&&state.tool==='all'&&state.type==='all';
}

function initCatalog(){
  const grid=qs('resource-grid');if(!grid)return;
  fetch('content/resources.json').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{state.resources=Array.isArray(data)?data:[];render()}).catch(()=>{qs('result-count').textContent='Матеріали тимчасово не завантажилися.';qs('empty-state').hidden=false});
  qs('search').addEventListener('input',e=>{state.query=e.target.value;render()});
  document.querySelectorAll('[data-filter]').forEach(group=>group.addEventListener('click',e=>{const b=e.target.closest('button[data-value]');if(!b)return;group.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));state[group.dataset.filter]=b.dataset.value;render()}));
  qs('reset').addEventListener('click',()=>{state.query='';state.tool='all';state.type='all';qs('search').value='';document.querySelectorAll('[data-filter]').forEach(g=>g.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.value==='all')));render()});
}

function addList(container,items){const ul=document.createElement('ul');(items||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.append(li)});container.append(ul)}
function section(title){const s=document.createElement('section');s.className='section';const h=document.createElement('h2');h.textContent=title;s.append(h);return s}
function addExternal(actions,label,url,secondary=false,newTab=true){const safe=safeUrl(url);if(!safe)return;const a=document.createElement('a');a.href=safe;if(newTab){a.target='_blank';a.rel='noopener noreferrer'}a.textContent=label;if(secondary)a.className='secondary';actions.append(a);return a}

function promptCard(item,index,guide){
  const identity=promptIdentity(item,index,guide);
  const article=document.createElement('article');article.className='prompt-item';
  article.dataset.promptId=identity.prompt_id;article.dataset.promptName=identity.prompt_name;article.dataset.guideId=identity.guide_id;
  const title=document.createElement('h3');title.textContent=item.title||`Промпт ${index+1}`;
  article.append(title);
  if(item.purpose){const purpose=document.createElement('p');purpose.className='prompt-purpose';const label=document.createElement('strong');label.textContent='Для чого: ';purpose.append(label,document.createTextNode(item.purpose));article.append(purpose)}
  const box=document.createElement('div');box.className='prompt-box';
  const head=document.createElement('div');head.className='prompt-head';
  const label=document.createElement('span');label.textContent=`Промпт ${index+1} · скопіюйте та вставте`;
  const copy=document.createElement('button');copy.className='copy';copy.type='button';copy.textContent='Копіювати';copy.setAttribute('aria-label',`Скопіювати: ${item.title||`промпт ${index+1}`}`);
  const pre=document.createElement('pre');pre.className='prompt-text';pre.textContent=item.text;
  copy.addEventListener('click',async()=>{trackEvent('copy_prompt',identity);try{await navigator.clipboard.writeText(item.text);copy.textContent='Скопійовано';setTimeout(()=>copy.textContent='Копіювати',1800)}catch{copy.textContent='Виділіть текст'}});
  head.append(label,copy);box.append(head,pre);article.append(box);return article;
}

function renderResource(r){
  const root=qs('resource-content');
  if(root.dataset.guideId===r.id)return;
  root.replaceChildren();root.dataset.guideId=r.id;
  document.title=`${r.title} — Tymchenko.AI`;
  qs('resource-title').textContent=r.title;qs('resource-description').textContent=r.description;
  const meta=document.createElement('div');meta.className='meta';
  [r.typeLabel,...(r.tools||[]),`Перевірено ${r.verifiedAt}`].forEach(x=>{const s=document.createElement('span');s.className='tag';s.textContent=x;meta.append(s)});root.append(meta);
  const result=section('Що ви отримаєте');const rp=document.createElement('p');rp.textContent=r.result;result.append(rp);root.append(result);
  const who=section('Кому підійде');const wp=document.createElement('p');wp.textContent=r.audience;who.append(wp);root.append(who);

  const prompts=Array.isArray(r.prompts)?r.prompts.filter(x=>x&&x.text):r.prompt?[{title:'Готовий промпт',purpose:'',text:r.prompt}]:[];
  if(prompts.length){
    const ps=section(prompts.length===1?'Готовий промпт':'Готові промпти');
    const list=document.createElement('div');list.className='prompt-list';prompts.forEach((item,index)=>list.append(promptCard(item,index,r)));ps.append(list);
    const actions=document.createElement('div');actions.className='actions';
    if((r.tools||[]).includes('ChatGPT'))addExternal(actions,'Відкрити ChatGPT','https://chatgpt.com/');
    if((r.tools||[]).includes('Gemini'))addExternal(actions,'Відкрити Gemini','https://gemini.google.com/',true);
    if((r.tools||[]).includes('Claude'))addExternal(actions,'Відкрити Claude','https://claude.ai/',true);
    ps.append(actions);root.append(ps);
  }

  const steps=section('Як використати');addList(steps,r.steps);root.append(steps);
  const checks=section('Що перевірити');const notice=document.createElement('div');notice.className='notice';addList(notice,r.checks);checks.append(notice);root.append(checks);
  const pdfView=safeUrl(r.pdfViewUrl),pdfDown=safeUrl(r.pdfDownloadUrl);
  if(pdfView||pdfDown){const pdf=section('PDF-інструкція');const p=document.createElement('p');p.textContent='PDF зберігається на Google Drive. Після перегляду поверніться на сайт кнопкою браузера «Назад».';const actions=document.createElement('div');actions.className='actions';addExternal(actions,'Відкрити PDF',pdfView,false,false);const download=addExternal(actions,'Завантажити PDF',pdfDown,true,false);if(download){download.dataset.fileId=r.fileId||`${r.id}:pdf`;download.dataset.fileName=r.fileName||`${r.title}.pdf`;download.dataset.guideId=r.id}pdf.append(p,actions);root.append(pdf)}
  trackEvent('view_guide',{guide_id:r.id,guide_name:r.title});
  observePrompts(root);
}

function initResource(){if(!qs('resource-content'))return;const id=new URLSearchParams(location.search).get('id');fetch('content/resources.json').then(r=>r.json()).then(data=>{const item=data.find(x=>x.id===id);if(!item)throw new Error();renderResource(item)}).catch(()=>{qs('resource-title').textContent='Матеріал не знайдено';qs('resource-description').textContent='Перевірте посилання або поверніться до каталогу.'})}

initLinkTracking();initMenu();initCatalog();initResource();
