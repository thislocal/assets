/* THIS LOCAL late UI/navigation runtime V17.95 - 8-language category rendering. */

/* ---- original script block 14 ---- */
(function(){
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
  ready(function(){
    var desktop=document.querySelector('.tl-nav-categories');
    if(desktop){
      document.addEventListener('click',function(e){if(desktop.open&&!desktop.contains(e.target))desktop.open=false;});
      document.addEventListener('keydown',function(e){if(e.key==='Escape'&&desktop.open){desktop.open=false;var sm=desktop.querySelector('summary');if(sm)sm.focus();}});
      desktop.querySelectorAll('.tl-nav-mega a').forEach(function(a){a.addEventListener('click',function(){desktop.open=false;});});
    }

    var btn=document.getElementById('tlMobileCategoryBtn');
    var layer=document.getElementById('tlMobileCategoryLayer');
    function setMenu(open){
      if(!btn||!layer)return;
      btn.setAttribute('aria-expanded',open?'true':'false');
      layer.hidden=!open;
      layer.setAttribute('aria-hidden',open?'false':'true');
      document.body.classList.toggle('tl-mobile-menu-open',open);
    }
    if(btn&&layer){
      btn.addEventListener('click',function(){setMenu(btn.getAttribute('aria-expanded')!=='true');});
      layer.querySelectorAll('[data-tl-mobile-menu-close]').forEach(function(x){x.addEventListener('click',function(){setMenu(false);});});
      layer.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});
      document.addEventListener('keydown',function(e){if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){setMenu(false);btn.focus();}});
      window.addEventListener('resize',function(){if(window.innerWidth>900)setMenu(false);},{passive:true});
    }

    var propose=document.getElementById('tlMobileProposeBtn');
    if(propose){
      propose.addEventListener('click',function(){
        setMenu(false);
        var fab=document.getElementById('tlProposeFab');
        if(fab)fab.click();
        else if(typeof window.TL_OPEN_PROPOSAL==='function')window.TL_OPEN_PROPOSAL('',[], '');
      });
    }
  });
})();


/* ---- original script block 15 ---- */
(function(){
  'use strict';
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function norm(v){v=clean(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){return v}}
  function T(v){try{return window.TL_I18N&&window.TL_I18N.t?window.TL_I18N.t(v):v}catch(e){return v}}
  function C(v){try{return window.TL_I18N&&window.TL_I18N.category?window.TL_I18N.category(v):v}catch(e){return v}}
  function isPage(){
    var p=(location.pathname||'').toLowerCase();
    try{var qp=new URLSearchParams(location.search||'');if(clean(qp.get('parent')))return false;}catch(e){}
    if(/^\/p\/danh-muc(?:_[^\/]*)?\.html\/?$/.test(p))return true;
    var t=document.querySelector('h1.post-title,h2.post-title,.post-title,.entry-title');return /^danh mục$/i.test(clean(t&&t.textContent));
  }
  if(!isPage())return;
  document.body.classList.add('tl-allcats-page');
  var API=window.TL_GUIDE_API_URL||window.TL_DATA_API_URL||'https://dhxawrbtzloypojwmksn.supabase.co/functions/v1/this-local-api';
  var CACHE='tl_category_catalog_v4';
  function parentUrl(item){
    var name=clean(item&&(item.name_vi||item.name)),direct=clean(item&&(item.post_url||item.postUrl||item.url));
    /* Có post_url thì giữ URL đẹp; chưa có thì dùng parent fallback hoạt động thật. */
    return direct||('/p/danh-muc.html?parent='+encodeURIComponent(name));
  }
  function pageUrl(item,parent){
    var name=clean(item&&(item.name_vi||item.name));
    /* V17.34: Category con luôn đi qua trang nhóm cha; bỏ qua post_url riêng của Category con. */
    if(parent){var base=parentUrl(parent);return base+(base.indexOf('?')>-1?'&':'?')+'category='+encodeURIComponent(name)+'#tlCategoryHub';}
    return parentUrl(item);
  }
  function icon(i){var x=['⌖','◉','◇','▦','◎','✦','○','△','□','◌','✧','⌂'];return x[i%x.length]}
  function sortItems(a,b){var aa=Number(a&&a.sort),bb=Number(b&&b.sort);if(!isFinite(aa))aa=999999;if(!isFinite(bb))bb=999999;if(aa!==bb)return aa-bb;return clean(a&&(a.name_vi||a.name)).localeCompare(clean(b&&(b.name_vi||b.name)),'vi')}
  function jsonp(url){return new Promise(function(resolve,reject){var cb='TLAC24_'+Date.now()+'_'+Math.floor(Math.random()*100000),sc=document.createElement('script'),done=false,timer=setTimeout(function(){finish();reject(new Error('timeout'))},12000);function finish(){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(e){}if(sc.parentNode)sc.parentNode.removeChild(sc)}window[cb]=function(data){finish();resolve(data)};sc.onerror=function(){finish();reject(new Error('load'))};sc.src=url+(url.indexOf('?')>-1?'&':'?')+'callback='+encodeURIComponent(cb);document.head.appendChild(sc)})}
  function start(){
    var body=document.querySelector('body.item-view .post-body')||document.querySelector('.Blog .post-body')||document.querySelector('.post-body');
    if(!body){setTimeout(start,80);return}
    body.innerHTML='<div class="tl-allcats-v24" id="tlAC24"><section class="tl-ac-hero"><h1>Tất cả danh mục</h1><p>Duyệt toàn bộ nhóm chính và danh mục con đang hoạt động trên THIS LOCAL. Bấm một mục để mở danh sách địa điểm tương ứng.</p><div class="tl-ac-search"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg><input id="tlACSearch" type="search" autocomplete="off" placeholder="Tìm nhà hàng, nhà thuốc, ngân hàng, salon..."/><button id="tlACClear" type="button" hidden>Xóa</button></div></section><div class="tl-ac-toolbar"><span class="tl-ac-count" id="tlACCount">Đang tải danh mục...</span><div class="tl-ac-actions"><button id="tlACOpen" type="button">Mở tất cả</button><button id="tlACClose" type="button">Thu gọn</button></div></div><div class="tl-ac-status" id="tlACStatus">Đang tải danh mục từ THIS LOCAL...</div><div class="tl-ac-grid" id="tlACGrid"></div><div class="tl-ac-empty" id="tlACEmpty"><strong>Không tìm thấy danh mục phù hợp.</strong></div></div>';
    var grid=document.getElementById('tlACGrid'),status=document.getElementById('tlACStatus'),count=document.getElementById('tlACCount'),search=document.getElementById('tlACSearch'),clear=document.getElementById('tlACClear'),empty=document.getElementById('tlACEmpty'),open=document.getElementById('tlACOpen'),close=document.getElementById('tlACClose'),catalog=[];
    try{var qp=new URLSearchParams(location.search||''),initial=clean(qp.get('category')||qp.get('parent'));if(initial)search.value=initial;}catch(e){}
    function tree(items){items=(items||[]).filter(function(x){return x&&x.active!==false&&clean(x.name_vi||x.name)}).slice().sort(sortItems);var child={},parents=[];items.forEach(function(x){var pid=clean(x.parent_id);if(!pid)parents.push(x);else(child[pid]||(child[pid]=[])).push(x)});Object.keys(child).forEach(function(k){child[k].sort(sortItems)});return{parents:parents,child:child}}
    function arrow(){return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'}
    function chev(){return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"></path></svg>'}
    function render(items){catalog=items||[];var t=tree(catalog),total=0;grid.innerHTML='';t.parents.forEach(function(p,i){var name=clean(p.name_vi||p.name),kids=t.child[clean(p.id)]||[];total+=kids.length;var d=document.createElement('details');d.className='tl-ac-group';d.dataset.search=norm(name+' '+kids.map(function(c){return clean(c.name_vi||c.name)}).join(' '));if(i<4)d.open=true;var sm=document.createElement('summary');sm.innerHTML='<span class="tl-ac-icon">'+icon(i)+'</span><span class="tl-ac-title" role="link" tabindex="0"><strong></strong><small>'+kids.length+' danh mục con</small></span><a class="tl-ac-parent-link">Vào nhóm</a><span class="tl-ac-chevron">'+chev()+'</span>';sm.querySelector('strong').textContent=C(name);var purl=pageUrl(p),pt=sm.querySelector('.tl-ac-title'),pl=sm.querySelector('.tl-ac-parent-link');pt.title='Mở '+name;pt.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();location.href=purl});pt.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();location.href=purl}});pl.href=purl;pl.addEventListener('click',function(e){e.stopPropagation()});d.appendChild(sm);var cb=document.createElement('div');cb.className='tl-ac-children';kids.forEach(function(c){var cn=clean(c.name_vi||c.name),a=document.createElement('a');a.className='tl-ac-child';a.href=pageUrl(c,p);a.dataset.search=norm(cn);var sp=document.createElement('span');sp.textContent=C(cn);a.appendChild(sp);a.insertAdjacentHTML('beforeend',arrow());cb.appendChild(a)});d.appendChild(cb);grid.appendChild(d)});count.textContent=t.parents.length+' nhóm chính · '+total+' danh mục con';status.hidden=true;filter(search.value)}
    function filter(v){var q=norm(v),visible=0;clear.hidden=!q;grid.querySelectorAll('.tl-ac-group').forEach(function(g){var pm=norm(g.querySelector('summary').textContent).indexOf(q)>-1,vc=0;g.querySelectorAll('.tl-ac-child').forEach(function(a){var ok=!q||pm||norm(a.textContent).indexOf(q)>-1;a.hidden=!ok;if(ok)vc++});var ok=!q||pm||vc>0;g.hidden=!ok;if(ok)visible++;if(q&&ok)g.open=true});empty.classList.toggle('is-show',visible===0);if(q)count.textContent=visible+' nhóm phù hợp với “'+clean(v)+'”';else{var t=tree(catalog),total=0;t.parents.forEach(function(p){total+=(t.child[clean(p.id)]||[]).length});count.textContent=t.parents.length+' nhóm chính · '+total+' danh mục con'}}
    search.addEventListener('input',function(){filter(search.value)});clear.addEventListener('click',function(){search.value='';filter('');search.focus()});open.addEventListener('click',function(){grid.querySelectorAll('.tl-ac-group:not([hidden])').forEach(function(x){x.open=true})});close.addEventListener('click',function(){grid.querySelectorAll('.tl-ac-group').forEach(function(x){x.open=false})});
    try{var cached=JSON.parse(localStorage.getItem(CACHE)||'[]');if(Array.isArray(cached)&&cached.length)render(cached)}catch(e){}
    jsonp(API+'?action=categoryCatalog').then(function(data){if(!data||!data.ok||!Array.isArray(data.categories))throw new Error('invalid');try{localStorage.setItem(CACHE,JSON.stringify(data.categories))}catch(e){}render(data.categories)}).catch(function(){if(catalog.length){status.hidden=false;status.textContent='Đang dùng danh mục đã lưu gần nhất vì dữ liệu mới chưa tải được.'}else{status.hidden=false;status.textContent='Không tải được danh mục. Hãy kiểm tra Edge Function this-local-api và thử lại.'}})
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();


/* ---- original script block 16 ---- */
(function(){
  'use strict';
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){v=clean(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return v;}}
  function T(v){try{return window.TL_I18N&&window.TL_I18N.t?window.TL_I18N.t(v):v}catch(e){return v}}
  function C(v){try{return window.TL_I18N&&window.TL_I18N.category?window.TL_I18N.category(v):v}catch(e){return v}}
  function safePageUrl(v){
    v=clean(v);if(!v)return'';
    if(v.charAt(0)==='/')return v;
    try{var u=new URL(v,location.origin);if(u.protocol==='http:'||u.protocol==='https:')return u.href;}catch(e){}
    return'';
  }
  var needRendered=false;
  function shuffled(list){
    var a=(list||[]).slice();
    for(var i=a.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;
    }
    return a;
  }
  function fallbackCategoryUrl(name){
    /* Dùng cho ROOT/PARENT chưa có post_url. Category con sẽ ghép thêm &category=... ở phía gọi. */
    return '/p/danh-muc.html?parent='+encodeURIComponent(clean(name));
  }
  function renderRandomNeeds(items){
    if(needRendered)return;
    var host=document.getElementById('tlHomeNeedRandom');
    if(!host)return;
    var limit=parseInt(host.getAttribute('data-tl-random-needs')||'5',10);if(!isFinite(limit)||limit<1)limit=5;
    var active=(items||[]).filter(function(item){return item&&item.active!==false&&clean(item.name_vi||item.name);});
    if(active.length<limit)return;

    var byId={};
    active.forEach(function(item){var id=clean(item.id);if(id)byId[id]=item;});
    function pack(item){
      var name=clean(item&&(item.name_vi||item.name));
      var parentId=clean(item&&item.parent_id),pitem=parentId&&byId[parentId]?byId[parentId]:null;
      var parent=clean((pitem&&(pitem.name_vi||pitem.name))||(item&&item.parent_name));
      var isChild=!!(parentId||parent),direct=safePageUrl(item&&(item.post_url||item.postUrl||item.url)),url='';
      if(isChild){
        var base=safePageUrl(pitem&&(pitem.post_url||pitem.postUrl||pitem.url))||fallbackCategoryUrl(parent||name);
        url=base+(base.indexOf('?')>-1?'&':'?')+'category='+encodeURIComponent(name)+'#tlCategoryHub';
      }else url=direct||fallbackCategoryUrl(name);
      return {name:name,parent:parent,group:parent||name,isChild:isChild,url:url};
    }
    var children=shuffled(active.filter(function(x){return clean(x.parent_id);}).map(pack));
    var roots=shuffled(active.filter(function(x){return !clean(x.parent_id);}).map(pack));
    var chosen=[],usedGroups={};
    function take(list,max){
      for(var i=0;i<list.length&&chosen.length<limit&&max>0;i++){
        var c=list[i],g=norm(c.group);if(!c.name||usedGroups[g])continue;
        chosen.push(c);usedGroups[g]=true;max--;
      }
    }
    // Ưu tiên 3 nhu cầu cụ thể + 2 nhóm rộng, đồng thời tránh trùng cùng nhóm cha.
    take(children,Math.min(3,limit));
    take(roots,limit-chosen.length);
    take(children,limit-chosen.length);
    take(roots,limit-chosen.length);

    if(chosen.length<limit){
      var all=shuffled(active.map(pack));
      for(var k=0;k<all.length&&chosen.length<limit;k++){
        if(chosen.some(function(x){return norm(x.name)===norm(all[k].name);} ))continue;
        chosen.push(all[k]);
      }
    }
    if(chosen.length<limit)return;

    var title=host.querySelector(':scope > strong'),frag=document.createDocumentFragment();
    if(title)frag.appendChild(title.cloneNode(true));
    else{title=document.createElement('strong');title.textContent='Đang cần gì?';frag.appendChild(title);}
    chosen.slice(0,limit).forEach(function(c){
      var a=document.createElement('a');a.href=c.url;a.setAttribute('data-tl-category-link',c.name);
      var span=document.createElement('span');span.textContent=C(c.name);
      var small=document.createElement('small');small.textContent=c.parent?C(c.parent):T('Khám phá địa điểm');
      a.appendChild(span);a.appendChild(small);frag.appendChild(a);
    });
    host.replaceChildren(frag);
    needRendered=true;
  }
  function apply(items){
    try{if(window.TL_I18N&&window.TL_I18N.hydrateCategories)window.TL_I18N.hydrateCategories(items);}catch(e){}
    var map={},active=(items||[]).filter(function(item){return item&&item.active!==false&&clean(item.name_vi||item.name);}),byId={};
    active.forEach(function(item){var id=clean(item.id);if(id)byId[id]=item;});
    active.forEach(function(item){
      var name=clean(item&&(item.name_vi||item.name)),parentId=clean(item&&item.parent_id),pitem=parentId&&byId[parentId]?byId[parentId]:null;
      var parent=clean((pitem&&(pitem.name_vi||pitem.name))||(item&&item.parent_name)),url='';
      if(parentId||parent){
        var base=safePageUrl(pitem&&(pitem.post_url||pitem.postUrl||pitem.url))||fallbackCategoryUrl(parent||name);
        url=base+(base.indexOf('?')>-1?'&':'?')+'category='+encodeURIComponent(name)+'#tlCategoryHub';
      }else url=safePageUrl(item&&(item.post_url||item.postUrl||item.url))||fallbackCategoryUrl(name);
      if(name&&url)map[norm(name)]=url;
    });
    document.querySelectorAll('[data-tl-category-link]').forEach(function(a){
      var name=clean(a.getAttribute('data-tl-category-link')),url=map[norm(name)];
      if(url)a.href=url;
    });
    renderRandomNeeds(items);
  }
  function start(){
    try{var cached=JSON.parse(localStorage.getItem('tl_category_catalog_v4')||'[]');if(Array.isArray(cached))apply(cached);}catch(e){}
    var api=window.TL_GUIDE_API_URL||window.TL_DATA_API_URL||'';if(!api)return;
    var cb='TLCATLINK_'+Date.now()+'_'+Math.floor(Math.random()*100000),s=document.createElement('script'),done=false;
    function finish(){if(done)return;done=true;try{delete window[cb];}catch(e){}if(s.parentNode)s.parentNode.removeChild(s);}
    window[cb]=function(data){
      if(data&&data.ok&&Array.isArray(data.categories)){
        try{localStorage.setItem('tl_category_catalog_v4',JSON.stringify(data.categories));}catch(e){}
        apply(data.categories);
      }
      finish();
    };
    s.onerror=finish;
    s.src=api+'?action=categoryCatalog&callback='+encodeURIComponent(cb);
    document.head.appendChild(s);
    setTimeout(finish,12000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
