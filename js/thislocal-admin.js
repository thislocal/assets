/* THIS LOCAL admin runtime V17.65 - compatible multi TOP storage. */
/* THIS LOCAL ADMIN V17.71: accept decimal and DMS coordinates; normalize to decimal before saving. */
(function(){
  var pth=(location.pathname||'').toLowerCase();
  if(!/^\/p\/(?:quan-tri|quan-tri-this-local|this-local-admin|admin)\.html\/?$/.test(pth))return;
  document.body.classList.add('tl-admin-v2-view');

  var PROJECT='https://dhxawrbtzloypojwmksn.supabase.co';
  var API=PROJECT+'/functions/v1/this-local-admin-api';
  var KKEY='tl_admin_publishable_key_v2',KEMAIL='tl_admin_email_v2',KACCESS='tl_admin_access_v2',KREFRESH='tl_admin_refresh_v2';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function node(tag,cls,text){var x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
  function fmt(v){try{return new Date(v).toLocaleString('vi-VN');}catch(e){return clean(v);}}
  function normUrl(v){v=clean(v);if(!v)return'';if(/^\/\//.test(v))v='https:'+v;if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(v))v='https://'+v.replace(/^\/+/,'');try{var u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){return'';}}
  function key(){return clean(localStorage.getItem(KKEY)||'')}function access(){return clean(sessionStorage.getItem(KACCESS)||'')}function refresh(){return clean(sessionStorage.getItem(KREFRESH)||'')}
  function saveSession(d){if(d&&d.access_token)sessionStorage.setItem(KACCESS,d.access_token);if(d&&d.refresh_token)sessionStorage.setItem(KREFRESH,d.refresh_token)}
  function clearSession(){sessionStorage.removeItem(KACCESS);sessionStorage.removeItem(KREFRESH)}

  var host=node('section','tla');host.id='tlAdminV2';
  var pageBody=document.getElementById('page_body');
  if(pageBody&&pageBody.parentNode)pageBody.parentNode.insertBefore(host,pageBody);else(document.getElementById('main')||document.body).appendChild(host);

  async function token(grant,body){
    if(!key())throw new Error('Thiếu Supabase publishable key.');
    var r=await fetch(PROJECT+'/auth/v1/token?grant_type='+encodeURIComponent(grant),{method:'POST',headers:{'Content-Type':'application/json','apikey':key()},body:JSON.stringify(body)});
    var raw=await r.text(),d={};try{d=raw?JSON.parse(raw):{}}catch(e){d={raw:raw}}
    if(!r.ok){
      var msg='';
      if(typeof d.error_description==='string')msg=d.error_description;
      else if(typeof d.msg==='string')msg=d.msg;
      else if(typeof d.message==='string')msg=d.message;
      else if(typeof d.error==='string')msg=d.error;
      else if(d.error&&typeof d.error==='object'){try{msg=JSON.stringify(d.error)}catch(e){}}
      if(!msg&&raw)msg=raw;
      throw new Error(msg||('Đăng nhập thất bại · HTTP '+r.status));
    }
    saveSession(d);return d;
  }
  async function renew(){if(!refresh())throw new Error('Phiên đăng nhập đã hết.');return token('refresh_token',{refresh_token:refresh()})}
  async function api(path,opt,retry){
    opt=opt||{};if(retry===undefined)retry=true;
    var h=Object.assign({'Content-Type':'application/json','apikey':key()},opt.headers||{});if(access())h.Authorization='Bearer '+access();
    var r=await fetch(API+path,Object.assign({},opt,{headers:h,cache:'no-store'}));
    if(r.status===401&&retry&&refresh()){await renew();return api(path,opt,false)}
    var raw=await r.text(),d={};try{d=raw?JSON.parse(raw):{}}catch(e){d={raw:raw}}
    if(!r.ok||!d.ok){
      var msg='';
      if(typeof d.error==='string')msg=d.error;
      else if(d.error&&typeof d.error==='object'){try{msg=JSON.stringify(d.error)}catch(e){}}
      else if(typeof d.message==='string')msg=d.message;
      else if(typeof d.msg==='string')msg=d.msg;
      if(!msg&&raw)msg=raw;
      throw new Error(msg||('HTTP '+r.status));
    }
    return d;
  }
  function errBox(parent,msg){var old=parent.querySelector('.tla-error');if(old)old.remove();if(!msg)return;parent.appendChild(node('div','tla-error',msg))}
  function field(label,name,value,type,wide){
    var w=node('div','tla-field'+(wide?' wide':'')),l=node('label','',label),i;
    if(type==='textarea'){i=node('textarea','');i.value=value==null?'':value}
    else if(type==='select'){i=node('select','')}
    else{i=node('input','');i.type=type||'text';i.value=value==null?'':value}
    i.setAttribute('data-field',name);w.appendChild(l);w.appendChild(i);return{wrap:w,input:i}
  }
  function checked(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'||String(v).toUpperCase()==='TRUE'}
  function parseCoordinate(value,axis){
    var raw=clean(value);if(!raw)return null;
    var s=raw.toUpperCase()
      .replace(/º/g,'°')
      .replace(/[′’]/g,"'")
      .replace(/[″“”]/g,'"')
      .replace(/,/g,'.')
      .trim();
    var dm=s.match(/([NSEW])\s*$/),dir=dm?dm[1]:'';
    if(dir)s=s.replace(/([NSEW])\s*$/,'').trim();
    if(axis==='lat'&&dir&&dir!=='N'&&dir!=='S')return NaN;
    if(axis==='lng'&&dir&&dir!=='E'&&dir!=='W')return NaN;
    var n;
    if(!/[°'\"]/.test(s)&&/^[-+]?\d+(?:\.\d+)?$/.test(s)){
      n=Number(s);
    }else{
      var m=s.match(/^([-+]?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?\s*\"?\s*$/);
      if(!m)return NaN;
      var deg=Number(m[1]),min=m[2]==null||m[2]===''?0:Number(m[2]),sec=m[3]==null||m[3]===''?0:Number(m[3]);
      if(!isFinite(deg)||!isFinite(min)||!isFinite(sec)||min<0||min>=60||sec<0||sec>=60)return NaN;
      var sign=deg<0?-1:1;
      n=(Math.abs(deg)+(min/60)+(sec/3600))*sign;
    }
    if(dir)n=Math.abs(n)*((dir==='S'||dir==='W')?-1:1);
    var minRange=axis==='lat'?-90:-180,maxRange=axis==='lat'?90:180;
    if(!isFinite(n)||n<minRange||n>maxRange)return NaN;
    return n;
  }
  function normalizeCoordinateFields(data){
    [['lat','lat','Vĩ độ','22.483833 hoặc 22°29\'01.8"N'],['lng','lng','Kinh độ','103.972194 hoặc 103°58\'19.9"E']].forEach(function(x){
      if(!(x[0] in data))return;
      var raw=clean(data[x[0]]);if(!raw){data[x[0]]='';return;}
      var n=parseCoordinate(raw,x[1]);
      if(!isFinite(n))throw new Error(x[2]+' không hợp lệ. Có thể nhập dạng thập phân hoặc dạng độ-phút-giây, ví dụ '+x[3]+'.');
      data[x[0]]=Number(n.toFixed(6));
    });
    return data;
  }
  function topScopeState(value,base){
    var raw=clean(value),out={THIS_LOCAL:false,LOCALITY:false,RADIUS:false};
    function n(v){return clean(v).toLowerCase().normalize?clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'):clean(v).toLowerCase().replace(/đ/g,'d')}
    function accept(part){var s=n(part).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');if(!s)return;if(s.indexOf('this_local')>-1||s.indexOf('thislocal')>-1||s.indexOf('global')>-1||s.indexOf('toan_data')>-1){out.THIS_LOCAL=true;return}if(s.indexOf('radius')>-1||s.indexOf('ban_kinh')>-1||s.indexOf('khoang_cach')>-1||s.indexOf('distance')>-1){out.RADIUS=true;return}if(s==='local'||s.indexOf('locality')>-1||s.indexOf('dia_phuong')>-1||s.indexOf('khu_vuc')>-1||s.indexOf('province')>-1||s==='tinh'||s.indexOf('tinh_thanh')>-1){out.LOCALITY=true;return}out.LOCALITY=true}
    if(raw)raw.split(/[,;|+]+/).forEach(accept);
    /* V17.65: top_locality và top_radius_km là cờ phạm vi phụ để không phải lưu chuỗi scope ghép. */
    if(base&&clean(base.top_rank)){
      if(clean(base.top_locality))out.LOCALITY=true;
      if(Number(base.top_radius_km)>0)out.RADIUS=true;
      if(!out.THIS_LOCAL&&!out.LOCALITY&&!out.RADIUS)out.THIS_LOCAL=true;
    }
    return out;
  }
  function topScopePicker(value,base){
    var state=topScopeState(value,base),wrap=node('div','tla-field tla-top-scope-field'),label=node('label','','Phạm vi TOP'),flags=node('div','tla-flags');wrap.appendChild(label);
    [['THIS_LOCAL','TOP THIS LOCAL'],['LOCALITY','TOP khu vực'],['RADIUS','TOP bán kính']].forEach(function(x){var l=node('label','tla-check'),i=node('input','');i.type='checkbox';i.checked=!!state[x[0]];i.setAttribute('data-top-scope',x[0]);l.appendChild(i);l.appendChild(document.createTextNode(x[1]));flags.appendChild(l)});
    wrap.appendChild(flags);return wrap;
  }
  function selectedTopScopes(rootNode){return Array.prototype.slice.call(rootNode.querySelectorAll('[data-top-scope]:checked')).map(function(i){return i.getAttribute('data-top-scope')})}
  function applyTopScopes(data,rootNode){
    var scopes=selectedTopScopes(rootNode);
    if(!scopes.length){data.top_scope='';data.top_rank='';data.top_locality='';data.top_radius_km=null;return data}
    if(!clean(data.top_rank))throw new Error('Đã chọn phạm vi TOP nhưng chưa nhập TOP rank, ví dụ TOP1.');
    if(scopes.indexOf('LOCALITY')>-1&&!clean(data.top_locality||data.locality||data.province))throw new Error('TOP khu vực cần có Khu vực TOP, Khu vực hoặc Tỉnh/thành.');
    if(scopes.indexOf('RADIUS')>-1){
      var r=Number(data.top_radius_km),rawLat=clean(data.lat),rawLng=clean(data.lng);
      if(!isFinite(r)||r<=0)throw new Error('TOP bán kính cần nhập Bán kính TOP (km) lớn hơn 0.');
      if(!rawLat||!rawLng)throw new Error('TOP bán kính cần nhập cả Vĩ độ và Kinh độ của địa điểm. Không thể chỉ dùng địa chỉ.');
      var lat=Number(rawLat),lng=Number(rawLng);
      if(!isFinite(lat)||!isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)throw new Error('TOP bán kính cần tọa độ Vĩ độ/Kinh độ hợp lệ của địa điểm.');
    }
    /* Không lưu THIS_LOCAL,LOCALITY,RADIUS chung một chuỗi nữa.
       Scope rộng nhất được lưu ở top_scope; phạm vi phụ được biểu diễn bằng top_locality/top_radius_km. */
    data.top_scope=scopes.indexOf('THIS_LOCAL')>-1?'THIS_LOCAL':(scopes.indexOf('LOCALITY')>-1?'LOCALITY':'RADIUS');
    if(scopes.indexOf('LOCALITY')<0)data.top_locality='';
    if(scopes.indexOf('RADIUS')<0)data.top_radius_km=null;
    return data;
  }
  function collect(rootNode,base){
    var o=Object.assign({},base||{});
    rootNode.querySelectorAll('[data-field]').forEach(function(i){
      var k=i.getAttribute('data-field');if(i.type==='checkbox')o[k]=i.checked;else o[k]=i.value;
    });
    normalizeCoordinateFields(o);
    if(o.business_url)o.business_url=normUrl(o.business_url);
    if(o.map_url)o.map_url=normUrl(o.map_url);
    if(o.source_url)o.source_url=normUrl(o.source_url);
    return o;
  }

  function login(message){
    host.innerHTML='';
    var shell=node('div','tla-shell'),box=node('div','tla-login');box.appendChild(node('h2','','Quản trị THIS LOCAL'));box.appendChild(node('p','','Tất cả thay đổi được ghi trực tiếp vào Supabase.'));
    var fk=field('Supabase publishable key','key',key(),'text'),fe=field('Email quản trị','email',localStorage.getItem(KEMAIL)||'','email'),fp=field('Mật khẩu','password','','password');
    box.appendChild(fk.wrap);box.appendChild(fe.wrap);box.appendChild(fp.wrap);box.appendChild(node('div','tla-note','Chỉ dùng sb_publishable_... ở trình duyệt. Không dùng sb_secret/service-role.'));
    var b=node('button','tla-btn primary','Đăng nhập');b.type='button';box.appendChild(b);if(message)errBox(box,message);
    b.onclick=async function(){try{b.disabled=true;localStorage.setItem(KKEY,clean(fk.input.value));localStorage.setItem(KEMAIL,clean(fe.input.value));clearSession();await token('password',{email:clean(fe.input.value),password:fp.input.value});await api('?action=stats');render()}catch(e){errBox(box,e.message||String(e))}finally{b.disabled=false}};
    shell.appendChild(box);host.appendChild(shell);
  }

  var state={tab:'dashboard',cats:[],catFilter:'ALL',places:{items:[],total:0,offset:0,limit:30,active:'',q:'',status:'ALL',verified:'ALL',flag:'',province:'',categoryId:''},suggestions:{items:[],status:'PENDING',active:''},ratings:{items:[],total:0,offset:0,placeId:'',active:'ALL'},catActive:''};

  async function ensureCats(){if(state.cats.length)return state.cats;var d=await api('?action=categories');state.cats=d.categories||[];return state.cats}
  function byId(){var m={};state.cats.forEach(function(c){m[c.id]=c});return m}
  function catName(id){var c=byId()[id];return c?c.name_vi:''}
  function parentName(id){var c=byId()[id];return c&&c.parent_id?catName(c.parent_id):''}

  function shell(){
    host.innerHTML='';var s=node('div','tla-shell');
    var h=node('div','tla-head'),brand=node('div','tla-brand');brand.appendChild(node('h1','','THIS LOCAL Admin'));brand.appendChild(node('p','','Supabase là nguồn dữ liệu chính · mọi thay đổi làm tại đây'));
    var usr=node('div','tla-user');usr.appendChild(node('span','',localStorage.getItem(KEMAIL)||'Admin'));var lo=node('button','tla-btn','Đăng xuất');lo.onclick=function(){clearSession();login()};usr.appendChild(lo);h.appendChild(brand);h.appendChild(usr);s.appendChild(h);
    var nav=node('div','tla-nav');[['dashboard','Tổng quan'],['places','Địa điểm'],['suggestions','Đề xuất'],['categories','Danh mục'],['ratings','Đánh giá']].forEach(function(x){var b=node('button',state.tab===x[0]?'is-active':'',x[1]);b.onclick=function(){state.tab=x[0];render()};nav.appendChild(b)});s.appendChild(nav);
    var c=node('div','tla-content');c.id='tlaContent';s.appendChild(c);host.appendChild(s);return c
  }
  async function render(){var c=shell();try{await ensureCats();if(state.tab==='dashboard')dashboard(c);if(state.tab==='places')places(c);if(state.tab==='suggestions')suggestions(c);if(state.tab==='categories')categories(c);if(state.tab==='ratings')ratings(c)}catch(e){c.innerHTML='<div class="tla-error">'+esc(e.message||String(e))+'</div>'}}

  async function dashboard(c){
    c.innerHTML='<div class="tla-status">Đang tải tổng quan...</div>';var d=await api('?action=stats'),x=d.counts||{};c.innerHTML='';
    var grid=node('div','tla-stats');[['places','Tổng địa điểm'],['approved','Đã duyệt'],['pendingPlaces','Địa điểm PENDING'],['pendingSuggestions','Đề xuất chờ duyệt'],['verified','Đã xác minh'],['hot','Đang Hot'],['trusted','Uy tín'],['ratings','Đánh giá hoạt động']].forEach(function(k){var s=node('div','tla-stat');s.appendChild(node('b','',String(x[k[0]]||0)));s.appendChild(node('span','',k[1]));grid.appendChild(s)});c.appendChild(grid)
  }

  function addSelectOptions(sel,items,blank){sel.innerHTML='';if(blank!==undefined){var o=node('option','',blank);o.value='';sel.appendChild(o)}items.forEach(function(it){var o=node('option','',it.label);o.value=it.value;sel.appendChild(o)})}
  function categoryOptions(sel,value){
    var m=byId();var children=state.cats.filter(function(x){return x.parent_id&&x.active!==false});sel.innerHTML='<option value="">Chọn Category</option>';
    children.forEach(function(x){var o=node('option','',(m[x.parent_id]?m[x.parent_id].name_vi+' › ':'')+x.name_vi);o.value=x.id;if(x.id===value)o.selected=true;sel.appendChild(o)})
  }

  async function loadPlaces(){
    var p=state.places,qs='?action=places&limit='+p.limit+'&offset='+p.offset;
    if(p.q)qs+='&q='+encodeURIComponent(p.q);if(p.status&&p.status!=='ALL')qs+='&status='+encodeURIComponent(p.status);if(p.verified&&p.verified!=='ALL')qs+='&verified='+encodeURIComponent(p.verified);if(p.flag)qs+='&flag='+encodeURIComponent(p.flag);if(p.province)qs+='&province='+encodeURIComponent(p.province);if(p.categoryId)qs+='&category_id='+encodeURIComponent(p.categoryId);
    var d=await api(qs);p.items=d.places||[];p.total=d.total||0
  }
  function placeBadges(p){
    var b=node('div','tla-badges');var st=clean(p.approval_status).toUpperCase();b.appendChild(node('span','tla-badge '+(st==='APPROVED'?'ok':st==='PENDING'?'pending':'danger'),st||'—'));if(p.verified==='TRUE')b.appendChild(node('span','tla-badge ok','Xác minh'));if(p.is_hot)b.appendChild(node('span','tla-badge hot','Hot'));if(p.is_trusted)b.appendChild(node('span','tla-badge trusted','Uy tín'));if(p.top_rank)b.appendChild(node('span','tla-badge top','TOP '+p.top_rank));return b
  }
  async function places(c){
    c.innerHTML='';var tb=node('div','tla-toolbar'),q=node('input','tla-search');q.placeholder='Tìm tên địa điểm...';q.value=state.places.q;
    var st=node('select','');addSelectOptions(st,[{value:'ALL',label:'Tất cả trạng thái'},{value:'APPROVED',label:'APPROVED'},{value:'PENDING',label:'PENDING'},{value:'REJECTED',label:'REJECTED'}]);st.value=state.places.status;
    var vf=node('select','');addSelectOptions(vf,[{value:'ALL',label:'Xác minh: tất cả'},{value:'TRUE',label:'Đã xác minh'},{value:'FALSE',label:'Chưa xác minh'}]);vf.value=state.places.verified;
    var fl=node('select','');addSelectOptions(fl,[{value:'',label:'Cờ: tất cả'},{value:'hot',label:'Hot'},{value:'trusted',label:'Uy tín'},{value:'top',label:'Có TOP'}]);fl.value=state.places.flag;
    var cat=node('select','');categoryOptions(cat,state.places.categoryId);
    var prov=node('input','');prov.placeholder='Tỉnh/thành';prov.value=state.places.province;
    var search=node('button','tla-btn primary','Lọc');var add=node('button','tla-btn','+ Thêm địa điểm');
    [q,st,vf,fl,cat,prov,search,add].forEach(function(x){tb.appendChild(x)});c.appendChild(tb);
    var sp=node('div','tla-split'),list=node('div','tla-list'),detail=node('div','tla-detail');detail.id='tlaPlaceDetail';sp.appendChild(list);sp.appendChild(detail);c.appendChild(sp);
    search.onclick=function(){state.places.q=clean(q.value);state.places.status=st.value;state.places.verified=vf.value;state.places.flag=fl.value;state.places.categoryId=cat.value;state.places.province=clean(prov.value);state.places.offset=0;places(c)};
    q.onkeydown=function(e){if(e.key==='Enter')search.click()};add.onclick=function(){state.places.active='';editPlace(detail,null)};
    list.innerHTML='<div class="tla-status">Đang tải...</div>';await loadPlaces();list.innerHTML='';
    if(!state.places.items.length)list.appendChild(node('div','tla-status','Không có địa điểm phù hợp.'));
    state.places.items.forEach(function(p){var b=node('button','tla-item'+(state.places.active===p.id?' is-active':''));b.appendChild(placeBadges(p));b.appendChild(node('strong','',p.name||p.id));b.appendChild(node('small','',(p.category||'')+(p.province?' · '+p.province:'')+(p.address?' · '+p.address:'')));b.onclick=function(){state.places.active=p.id;Array.from(list.children).forEach(function(x){x.classList.remove('is-active')});b.classList.add('is-active');editPlace(detail,p)};list.appendChild(b)});
    var pg=node('div','tla-pager'),prev=node('button','tla-btn','← Trước'),info=node('span','',((state.places.offset+1)+'–'+Math.min(state.places.offset+state.places.limit,state.places.total)+' / '+state.places.total)),next=node('button','tla-btn','Sau →');prev.disabled=state.places.offset<=0;next.disabled=state.places.offset+state.places.limit>=state.places.total;prev.onclick=function(){state.places.offset=Math.max(0,state.places.offset-state.places.limit);places(c)};next.onclick=function(){state.places.offset+=state.places.limit;places(c)};pg.appendChild(prev);pg.appendChild(info);pg.appendChild(next);list.appendChild(pg);
    detail.innerHTML='<div class="tla-empty">Chọn địa điểm bên trái hoặc bấm “Thêm địa điểm”.</div>'
  }

  function editPlace(detail,p){
    p=p||{approval_status:'APPROVED',business_status:'OPEN',country_code:'VN',verified:'FALSE',is_hot:false,is_trusted:false};detail.innerHTML='';
    var head=node('div','tla-form-head'),left=node('div','');left.appendChild(node('h2','',p.id?(p.name||'Sửa địa điểm'):'Thêm địa điểm mới'));left.appendChild(node('div','tla-muted',p.id||'ID sẽ tự tạo khi lưu'));head.appendChild(left);detail.appendChild(head);
    var form=node('div',''),grid=node('div','tla-grid');
    function add(label,name,type,wide){var f=field(label,name,p[name],type,wide);grid.appendChild(f.wrap);return f.input}
    var category=field('Category','category_id','', 'select');categoryOptions(category.input,p.category_id||'');category.input.onchange=function(){var c=byId()[category.input.value];if(c){form.querySelector('[data-field="category"]').value=c.name_vi;form.querySelector('[data-field="parent_category"]').value=parentName(c.id)}};grid.appendChild(category.wrap);
    add('Tên Category','category','text');add('Danh mục cha','parent_category','text');add('Tên địa điểm','name','text',true);add('Địa chỉ','address','text',true);add('Điện thoại','phone');add('Website','business_url');add('Google Maps URL','map_url');add('Giờ mở cửa','hours');add('Giờ mở','open_time');add('Giờ đóng','close_time');add('Giá','price');add('Giá từ','price_min');add('Giá đến','price_max');var latAdmin=add('Vĩ độ','lat'),lngAdmin=add('Kinh độ','lng');latAdmin.placeholder='22.483833 hoặc 22°29\'01.8"N';lngAdmin.placeholder='103.972194 hoặc 103°58\'19.9"E';add('Tỉnh/thành','province');add('Mã tỉnh','province_code');add('Khu vực','locality');add('Mã quốc gia','country_code');add('Ghi chú','note','textarea',true);form.appendChild(grid);form.appendChild(node('div','tla-note','Tọa độ nhận cả 2 dạng: thập phân (22.483833 / 103.972194) hoặc độ-phút-giây (22°29\'01.8"N / 103°58\'19.9"E). Khi lưu, hệ thống tự đổi về số thập phân.'));
    detail.appendChild(form);
    detail.appendChild(node('div','tla-section-title','Quản trị hiển thị'));
    var flags=node('div','tla-flags');
    [['is_hot','Hot'],['is_trusted','Uy tín'],['verified','Đã xác minh']].forEach(function(x){var l=node('label','tla-check'),i=node('input','');i.type='checkbox';i.checked=x[0]==='verified'?p.verified==='TRUE':checked(p[x[0]]);i.setAttribute('data-field',x[0]);l.appendChild(i);l.appendChild(document.createTextNode(x[1]));flags.appendChild(l)});
    var approved=node('label','tla-check'),ap=node('input','');ap.type='checkbox';ap.checked=clean(p.approval_status).toUpperCase()==='APPROVED';ap.setAttribute('data-field','_approved_checkbox');approved.appendChild(ap);approved.appendChild(document.createTextNode('APPROVED'));flags.appendChild(approved);form.appendChild(flags);
    var top=node('div','tla-grid');function topf(label,name){var f=field(label,name,p[name]);top.appendChild(f.wrap)}topf('TOP rank','top_rank');top.appendChild(topScopePicker(p.top_scope,p));topf('Khu vực TOP','top_locality');topf('Bán kính TOP (km)','top_radius_km');form.appendChild(top);
    detail.appendChild(node('div','tla-section-title','Trạng thái & nguồn'));
    var extra=node('div','tla-grid'),bs=field('Trạng thái kinh doanh','business_status','', 'select');[['OPEN','Đang mở'],['TEMPORARILY_CLOSED','Tạm đóng'],['PERMANENTLY_CLOSED','Đóng vĩnh viễn']].forEach(function(x){var o=node('option','',x[1]);o.value=x[0];if(clean(p.business_status).toUpperCase()===x[0])o.selected=true;bs.input.appendChild(o)});extra.appendChild(bs.wrap);
    function ef(l,n,t,w){var f=field(l,n,p[n],t,w);extra.appendChild(f.wrap)}ef('Nguồn','source_name');ef('URL nguồn','source_url');ef('Giấy phép','source_license');ef('Ngày kiểm tra nguồn','source_checked_at');ef('ID nguồn','source_place_id');ef('Chất lượng dữ liệu','data_quality','text',true);form.appendChild(extra);
    var actions=node('div','tla-actions'),save=node('button','tla-btn primary','Lưu thay đổi');save.type='button';actions.appendChild(save);
    if(p.id){var del=node('button','tla-btn danger','Xóa địa điểm');del.type='button';del.onclick=async function(){if(!confirm('Xóa vĩnh viễn địa điểm này? Ratings liên quan cũng có thể bị xóa theo khóa ngoại.'))return;try{await api('',{method:'POST',body:JSON.stringify({action:'deletePlace',id:p.id})});state.places.active='';render()}catch(e){errBox(detail,e.message)}};actions.appendChild(del)}
    form.appendChild(actions);
    save.onclick=async function(){try{save.disabled=true;var data=collect(form,p);applyTopScopes(data,form);data.approval_status=data._approved_checkbox?'APPROVED':'PENDING';delete data._approved_checkbox;data.verified=data.verified?'TRUE':'FALSE';var d=await api('',{method:'POST',body:JSON.stringify({action:'savePlace',id:p.id||'',place:data})});state.places.active=d.place.id;await render()}catch(e){errBox(detail,e.message||String(e))}finally{save.disabled=false}}
  }

  async function suggestions(c){
    c.innerHTML='';var tb=node('div','tla-toolbar'),st=node('select','');addSelectOptions(st,[{value:'PENDING',label:'Chờ duyệt'},{value:'APPROVED',label:'Đã duyệt'},{value:'REJECTED',label:'Từ chối'},{value:'ALL',label:'Tất cả'}]);st.value=state.suggestions.status;var ref=node('button','tla-btn','Làm mới');tb.appendChild(st);tb.appendChild(ref);c.appendChild(tb);
    var sp=node('div','tla-split'),list=node('div','tla-list'),detail=node('div','tla-detail');sp.appendChild(list);sp.appendChild(detail);c.appendChild(sp);st.onchange=function(){state.suggestions.status=st.value;state.suggestions.active='';suggestions(c)};ref.onclick=function(){suggestions(c)};
    list.innerHTML='<div class="tla-status">Đang tải...</div>';var d=await api('?action=suggestions&status='+encodeURIComponent(state.suggestions.status)+'&limit=100');state.suggestions.items=d.suggestions||[];list.innerHTML='';
    if(!state.suggestions.items.length)list.appendChild(node('div','tla-status','Không có đề xuất.'));
    state.suggestions.items.forEach(function(s){var p=s.payload||{},b=node('button','tla-item');var badges=node('div','tla-badges');badges.appendChild(node('span','tla-badge '+(s.status==='PENDING'?'pending':s.status==='APPROVED'?'ok':'danger'),s.status));badges.appendChild(node('span','tla-badge',clean(s.submit_type).toLowerCase()==='update'?'Cập nhật':'Thêm mới'));b.appendChild(badges);b.appendChild(node('strong','',p.name||'(Chưa có tên)'));b.appendChild(node('small','',(p.category||'')+(p.address?' · '+p.address:'')+' · '+fmt(s.created_at)));b.onclick=function(){suggestionEditor(detail,s.id)};list.appendChild(b)});detail.innerHTML='<div class="tla-empty">Chọn một đề xuất để kiểm tra.</div>'
  }

  async function suggestionEditor(detail,id){
    detail.innerHTML='<div class="tla-status">Đang tải...</div>';try{var d=await api('?action=suggestionDetail&id='+encodeURIComponent(id)),s=d.suggestion,p=s.payload||{};detail.innerHTML='';
      var h=node('div','tla-form-head'),l=node('div','');l.appendChild(node('h2','',p.name||'Đề xuất'));l.appendChild(node('div','tla-muted',(s.submit_type||'add')+' · '+fmt(s.created_at)+' · '+clean(s.submitter_name||s.submitter_contact)));h.appendChild(l);detail.appendChild(h);
      if(d.target){detail.appendChild(node('div','tla-note','Địa điểm gốc: '+(d.target.name||d.target.id)+' · '+(d.target.address||'')))}
      var form=node('div',''),grid=node('div','tla-grid');
      function sf(label,name,type,wide){var f=field(label,name,p[name],type,wide);grid.appendChild(f.wrap);return f.input}
      var cat=field('Category','category_id','','select');categoryOptions(cat.input,p.category_id||'');cat.input.onchange=function(){var c=byId()[cat.input.value];if(c){form.querySelector('[data-field="category"]').value=c.name_vi;form.querySelector('[data-field="parent_category"]').value=parentName(c.id)}};grid.appendChild(cat.wrap);
      sf('Tên Category','category');sf('Danh mục cha','parent_category');sf('Tên địa điểm','name','text',true);sf('Địa chỉ','address','text',true);sf('Điện thoại','phone');sf('Website','business_url');sf('Google Maps','map_url');sf('Giờ','hours');sf('Giá','price');var latSug=sf('Vĩ độ','lat'),lngSug=sf('Kinh độ','lng');latSug.placeholder='22.483833 hoặc 22°29\'01.8"N';lngSug.placeholder='103.972194 hoặc 103°58\'19.9"E';sf('Tỉnh/thành','province');sf('Khu vực','locality');sf('Ghi chú','note','textarea',true);form.appendChild(grid);form.appendChild(node('div','tla-note','Có thể nhập tọa độ thập phân hoặc độ-phút-giây; hệ thống tự chuyển về thập phân khi duyệt.'));
      var flags=node('div','tla-flags');[['is_hot','Hot'],['is_trusted','Uy tín'],['verified','Xác minh']].forEach(function(x){var lab=node('label','tla-check'),i=node('input','');i.type='checkbox';i.checked=x[0]==='verified'?p.verified==='TRUE':checked(p[x[0]]);i.setAttribute('data-field',x[0]);lab.appendChild(i);lab.appendChild(document.createTextNode(x[1]));flags.appendChild(lab)});form.appendChild(flags);
      var top=node('div','tla-grid');var trf=field('TOP rank','top_rank',p.top_rank);top.appendChild(trf.wrap);top.appendChild(topScopePicker(p.top_scope,p));var tlf=field('Khu vực TOP','top_locality',p.top_locality),trd=field('Bán kính TOP (km)','top_radius_km',p.top_radius_km);top.appendChild(tlf.wrap);top.appendChild(trd.wrap);form.appendChild(top);
      var note=field('Ghi chú quản trị','admin_note',s.admin_note||'','textarea',true);form.appendChild(note.wrap);detail.appendChild(form);
      var act=node('div','tla-actions');
      if(s.status==='PENDING'){var yes=node('button','tla-btn primary','Duyệt & lưu'),no=node('button','tla-btn danger','Từ chối');act.appendChild(yes);act.appendChild(no);yes.onclick=async function(){if(!confirm('Duyệt đề xuất và ghi vào Places?'))return;try{yes.disabled=no.disabled=true;var fp=collect(form,p);applyTopScopes(fp,form);fp.approval_status='APPROVED';fp.verified=fp.verified?'TRUE':'FALSE';await api('',{method:'POST',body:JSON.stringify({action:'reviewSuggestion',id:s.id,decision:'approve',final_payload:fp,admin_note:note.input.value})});suggestions(document.getElementById('tlaContent'))}catch(e){errBox(detail,e.message)}finally{yes.disabled=no.disabled=false}};no.onclick=async function(){if(!confirm('Từ chối đề xuất này?'))return;try{yes.disabled=no.disabled=true;await api('',{method:'POST',body:JSON.stringify({action:'reviewSuggestion',id:s.id,decision:'reject',admin_note:note.input.value})});suggestions(document.getElementById('tlaContent'))}catch(e){errBox(detail,e.message)}finally{yes.disabled=no.disabled=false}}}
      else act.appendChild(node('div','tla-note','Đã xử lý: '+s.status+(s.reviewed_by?' · '+s.reviewed_by:'')+(s.reviewed_at?' · '+fmt(s.reviewed_at):'')));
      detail.appendChild(act)
    }catch(e){detail.innerHTML='<div class="tla-error">'+esc(e.message||String(e))+'</div>'}
  }

  function categoryFallbackUrl(c){
    var name=clean(c&&c.name_vi);
    return '/p/danh-muc.html?parent='+encodeURIComponent(name);
  }
  function categoryOpenUrl(c){
    /* V17.41: nếu post_url đã lưu nhưng kiểm tra thấy Page không tồn tại,
       nút Mở sẽ đưa quản trị viên về fallback thay vì mở URL hỏng. */
    var saved=clean(c&&c.post_url);
    var u=(saved&&c&&c._pageExists!==false)?saved:categoryFallbackUrl(c);
    if(/^https?:\/\//i.test(u))return u;
    if(u.charAt(0)!=='/')u='/'+u;
    return location.origin+u;
  }
  function categorySeoSlug(name){
    var v=clean(name).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
    try{v=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){}
    v=v.replace(/&/g,'-').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-');
    return '/p/'+(v||'danh-muc')+'.html';
  }
  var TL_BLOGGER_BLOG_ID='8877213240937459046';
  var TL_BLOGGER_PAGES_ADMIN='https://www.blogger.com/blog/pages/'+TL_BLOGGER_BLOG_ID;
  function copyPageTitleForCreate(name){
    var value=clean(name);
    if(!value)return;
    function copied(){
      setTimeout(function(){alert('Đã copy tên Page: '+value+'\nTrong Blogger: bấm “Trang mới” → Ctrl+V tên này → Xuất bản.');},80);
    }
    function legacyCopy(){
      try{
        var ta=document.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);copied();
      }catch(e){window.prompt('Copy tên Page này rồi bấm “Trang mới” trong Blogger:',value)}
    }
    if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(value).then(copied).catch(legacyCopy)}else legacyCopy();
  }
  function openBloggerCreatePage(name){
    /* Blogger không cho Blogspot điền trực tiếp tiêu đề vào editor khác miền.
       Vì vậy một click sẽ copy tên gợi ý và mở đúng mục Trang của blog. */
    var win=window.open(TL_BLOGGER_PAGES_ADMIN,'_blank','noopener,noreferrer');
    copyPageTitleForCreate(name);
    return win;
  }
  function createPageLink(name,label){
    var a=node('a','tla-cat-state fallback tla-create-page-link',label||'Tạo Page ↗');
    a.href=TL_BLOGGER_PAGES_ADMIN;a.target='_blank';a.rel='noopener noreferrer';
    a.onclick=function(){copyPageTitleForCreate(name)};
    a.title='Mở Blogger > Trang. Tên gợi ý sẽ tự được copy để dán vào Trang mới.';
    return a;
  }
  async function saveCategoryQuick(c,postUrl){
    var data=Object.assign({},c,{post_url:clean(postUrl)});
    return api('',{method:'POST',body:JSON.stringify({action:'saveCategory',category:data})});
  }

  /* V17.50: tách post_url đã lưu khỏi trạng thái Page thật; Feed + kiểm tra trực tiếp xác minh Page.
     Blogger permalink có thể khác slug gợi ý (ví dụ Page cùng tên nhưng URL cũ/gõ khác),
     nên không được kết luận "chưa tạo Page" chỉ vì pathname không khớp. */
  var tlPublishedPagePaths=null,tlPublishedPageCheckedAt=0,TL_PAGE_FEED_TTL=2*60*1000;
  function normalizedPagePath(value){
    value=clean(value);if(!value)return'';
    try{var u=new URL(value,location.origin);return u.pathname.replace(/\/+$/,'').toLowerCase()}catch(e){return''}
  }
  function normalizedPageTitle(value){
    var v=clean(value).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
    try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return v;}
  }
  function isFallbackPostUrl(value){
    try{var u=new URL(clean(value),location.origin);return /\/p\/danh-muc(?:-\d+)?\.html\/?$/i.test(u.pathname)&&u.searchParams.has('parent')}catch(e){return false}
  }
  function usesPageLink(cat){
    var saved=clean(cat&&cat.post_url);return !!saved&&!isFallbackPostUrl(saved);
  }
  function currentCategoryLink(cat){
    return usesPageLink(cat)?clean(cat&&cat.post_url):categoryFallbackUrl(cat);
  }
  function detectedPageUrl(cat){return clean(cat&&cat._realPageUrl);}
  function hasDetectedPage(cat){
    return !!(cat&&(cat._pageCheckReason==='EXISTS'||cat._pageCheckReason==='PAGE_EXISTS_FALLBACK'||cat._pageCheckReason==='PAGE_EXISTS_WRONG_URL'));
  }
  function pageRegistryFromData(data){
    var entries=(data&&data.feed&&data.feed.entry)||[],paths={},byTitle={};
    entries.forEach(function(entry){
      var title=clean(entry&&entry.title&&entry.title.$t),titleKey=normalizedPageTitle(title),pagePath='';
      var links=entry&&entry.link||[];
      links.forEach(function(link){
        if(link&&link.rel==='alternate'&&link.href){var path=normalizedPagePath(link.href);if(path){paths[path]=true;if(!pagePath)pagePath=path}}
      });
      if(titleKey&&pagePath&&!byTitle[titleKey])byTitle[titleKey]=pagePath;
    });
    return{paths:paths,byTitle:byTitle};
  }
  function loadBloggerPageFeedJsonp(){
    return new Promise(function(resolve){
      var cb='TL_PAGE_FEED_'+Date.now()+'_'+Math.floor(Math.random()*100000),sc=document.createElement('script'),done=false;
      var timer=setTimeout(function(){finish(null)},3800);
      function finish(data){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(e){}if(sc.parentNode)sc.parentNode.removeChild(sc);resolve(data||null)}
      window[cb]=function(data){finish(data)};
      sc.onerror=function(){finish(null)};
      sc.src='/feeds/pages/summary?alt=json-in-script&max-results=150&callback='+encodeURIComponent(cb)+'&_='+Date.now();
      document.head.appendChild(sc);
    });
  }
  async function loadPublishedBloggerPagePaths(force){
    var now=Date.now();
    if(!force&&tlPublishedPagePaths&&now-tlPublishedPageCheckedAt<TL_PAGE_FEED_TTL)return tlPublishedPagePaths;
    var data=null,controller=(typeof AbortController==='function')?new AbortController():null,timer=null;
    try{
      if(controller)timer=setTimeout(function(){try{controller.abort()}catch(e){}},2600);
      var r=await Promise.race([
        fetch('/feeds/pages/summary?alt=json&max-results=150',{credentials:'same-origin',cache:'no-store',signal:controller?controller.signal:undefined}).catch(function(){return null}),
        new Promise(function(resolve){setTimeout(function(){resolve(null)},3000)})
      ]);
      if(timer)clearTimeout(timer);
      if(r&&r.ok)data=await Promise.race([r.json().catch(function(){return null}),new Promise(function(resolve){setTimeout(function(){resolve(null)},1200)})]);
    }catch(e){if(timer)clearTimeout(timer)}
    if(!data){
      try{data=await loadBloggerPageFeedJsonp()}catch(e){data=null}
    }
    if(!data){
      console.warn('THIS LOCAL: Blogger Pages Feed tạm không đọc được; vẫn dùng trạng thái link hiện tại.');
      tlPublishedPagePaths=null;tlPublishedPageCheckedAt=now;return null;
    }
    tlPublishedPagePaths=pageRegistryFromData(data);tlPublishedPageCheckedAt=now;return tlPublishedPagePaths;
  }
  function parseDirectPageResult(cat,saved,finalUrl,html){
    if(!html)return{checked:false,exists:false,pageUrl:''};
    var low=String(html).toLowerCase();
    var notFound=/page not found|sorry, the page you were looking for in this blog does not exist|trang bạn đang tìm kiếm trong blog này không tồn tại|không tìm thấy trang|the page you requested could not be found/.test(low);
    if(notFound)return{checked:true,exists:false,pageUrl:''};
    var doc=null,canonical='',og='',docTitle='',bodyText='';
    try{
      doc=new DOMParser().parseFromString(html,'text/html');
      canonical=clean(doc&&doc.querySelector('link[rel="canonical"]')&&doc.querySelector('link[rel="canonical"]').getAttribute('href'));
      og=clean(doc&&doc.querySelector('meta[property="og:url"]')&&doc.querySelector('meta[property="og:url"]').getAttribute('content'));
      docTitle=clean(doc&&doc.title);bodyText=clean(doc&&doc.body&&doc.body.textContent);
    }catch(e){}
    var expected=normalizedPagePath(saved),finalPath=normalizedPagePath(finalUrl||saved),canonicalPath=normalizedPagePath(canonical),ogPath=normalizedPagePath(og),titleKey=normalizedPageTitle(cat&&cat.name_vi),docTitleKey=normalizedPageTitle(docTitle),bodyKey=normalizedPageTitle(bodyText.slice(0,1800));
    var titleMatch=!!(titleKey&&((docTitleKey&&docTitleKey.indexOf(titleKey)>-1)||(bodyKey&&bodyKey.indexOf(titleKey)>-1)));
    var real=canonicalPath||ogPath||finalPath;
    var exact=!!expected&&(canonicalPath===expected||ogPath===expected||(finalPath===expected&&titleMatch));
    if(exact)return{checked:true,exists:true,pageUrl:expected};
    if(titleMatch&&real&&/\/p\/[^/?#]+\.html$/i.test(real))return{checked:true,exists:true,pageUrl:real};
    return{checked:true,exists:false,pageUrl:''};
  }
  function iframeVerifySavedPage(cat){
    return new Promise(function(resolve){
      var saved=clean(cat&&cat.post_url),target=null,done=false,frame=document.createElement('iframe');
      if(!saved||isFallbackPostUrl(saved)){resolve({checked:false,exists:false,pageUrl:''});return}
      try{target=new URL(saved,location.origin);if(target.origin!==location.origin){resolve({checked:false,exists:false,pageUrl:''});return}}catch(e){resolve({checked:true,exists:false,pageUrl:''});return}
      frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed!important;left:-99999px!important;top:-99999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;border:0!important';
      var timer=setTimeout(function(){finish({checked:false,exists:false,pageUrl:''})},6500);
      function finish(result){if(done)return;done=true;clearTimeout(timer);try{if(frame.parentNode)frame.parentNode.removeChild(frame)}catch(e){}resolve(result||{checked:false,exists:false,pageUrl:''})}
      frame.onload=function(){
        try{
          var doc=frame.contentDocument||frame.contentWindow.document,href=frame.contentWindow.location.href,html=doc&&doc.documentElement?doc.documentElement.outerHTML:'';
          finish(parseDirectPageResult(cat,saved,href,html));
        }catch(e){finish({checked:false,exists:false,pageUrl:''})}
      };
      frame.onerror=function(){finish({checked:false,exists:false,pageUrl:''})};
      document.body.appendChild(frame);frame.src=target.href+(target.search?'&':'?')+'_tlcheck='+Date.now();
    })
  }
  async function directVerifySavedPage(cat){
    var saved=clean(cat&&cat.post_url);
    if(!saved||isFallbackPostUrl(saved))return{checked:false,exists:false,pageUrl:''};
    var target=null;
    try{target=new URL(saved,location.origin);if(target.origin!==location.origin)return{checked:false,exists:false,pageUrl:''}}catch(e){return{checked:true,exists:false,pageUrl:''}}
    var controller=(typeof AbortController==='function')?new AbortController():null,timer=null,r=null,html='';
    try{
      if(controller)timer=setTimeout(function(){try{controller.abort()}catch(e){}},5200);
      r=await Promise.race([
        fetch(target.href+(target.search?'&':'?')+'_tlcheck='+Date.now(),{credentials:'same-origin',cache:'no-store',redirect:'follow',signal:controller?controller.signal:undefined}).catch(function(){return null}),
        new Promise(function(resolve){setTimeout(function(){resolve(null)},5600)})
      ]);
      if(timer)clearTimeout(timer);
      if(!r)return await iframeVerifySavedPage(cat);
      if(r.status===404||r.status===410)return{checked:true,exists:false,pageUrl:''};
      if(!r.ok)return await iframeVerifySavedPage(cat);
      html=await Promise.race([r.text().catch(function(){return''}),new Promise(function(resolve){setTimeout(function(){resolve('')},2200)})]);
    }catch(e){if(timer)clearTimeout(timer);return await iframeVerifySavedPage(cat)}
    if(!html)return await iframeVerifySavedPage(cat);
    var parsed=parseDirectPageResult(cat,saved,r.url||target.href,html);
    if(parsed.checked&&parsed.exists)return parsed;
    var iframeResult=await iframeVerifySavedPage(cat);
    return iframeResult.checked?iframeResult:parsed;
  }
  /* V17.50: kiểm tra Page luôn trả kết quả bằng toast + tổng hợp sau “Kiểm tra lại tất cả”. */
  function showPageCheckNotice(message,kind){
    var old=document.getElementById('tlPageCheckNotice');if(old&&old.parentNode)old.parentNode.removeChild(old);
    var n=document.createElement('div');n.id='tlPageCheckNotice';n.setAttribute('role','status');n.setAttribute('aria-live','polite');n.textContent=message;
    var bg=kind==='bad'?'#8f2d20':(kind==='warn'?'#8a5a00':'#176b4b');
    n.style.cssText='position:fixed;z-index:2147483647;right:18px;top:18px;width:min(520px,calc(100vw - 36px));padding:14px 16px;border-radius:14px;background:'+bg+';color:#fff;font:800 12.5px/1.55 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;box-shadow:0 18px 55px rgba(0,0,0,.28);white-space:pre-line;';
    document.body.appendChild(n);
    setTimeout(function(){if(n&&n.parentNode)n.parentNode.removeChild(n)},9000);
  }
  function pageCheckMessage(cat){
    var reason=cat&&cat._pageCheckReason,name=clean(cat&&cat.name_vi)||clean(cat&&cat.id)||'Danh mục';
    if(reason==='EXISTS')return{kind:'ok',text:'✓ '+name+'\nPage thật đã tồn tại và link đang lưu đúng.'};
    if(reason==='PAGE_EXISTS_WRONG_URL')return{kind:'warn',text:'⚠ '+name+'\nPage thật đã tồn tại nhưng URL đang lưu khác Page thật.\nPage thật: '+clean(cat&&cat._realPageUrl)};
    if(reason==='PAGE_EXISTS_FALLBACK')return{kind:'warn',text:'✓ '+name+'\nPage thật đã tồn tại nhưng danh mục vẫn đang dùng fallback.'};
    if(reason==='MISSING_PAGE')return{kind:'bad',text:'✕ '+name+'\nĐã có link Page nhưng Blogger Page thật CHƯA được tạo.'};
    return{kind:'warn',text:'? '+name+'\nVẫn chưa kiểm tra được Page từ trình duyệt này.'};
  }
  async function manualCheckCategoryPage(cat,button){
    if(button){button.disabled=true;button.textContent='Đang kiểm tra...'}
    showPageCheckNotice('Đang kiểm tra Page: '+(clean(cat&&cat.name_vi)||clean(cat&&cat.id)||''),'ok');
    try{
      tlPublishedPagePaths=null;tlPublishedPageCheckedAt=0;
      await Promise.race([verifyParentPageStates([cat]),new Promise(function(resolve){setTimeout(resolve,15000)})]);
      var result=pageCheckMessage(cat);showPageCheckNotice(result.text,result.kind);
      return cat._pageCheckReason;
    }catch(e){
      showPageCheckNotice('Không kiểm tra được Page. '+(e&&e.message?e.message:String(e||'')),'bad');
      return 'CHECK_FAILED';
    }finally{if(button){button.disabled=false;button.textContent='Kiểm tra lại'}}
  }
  async function verifyParentPageStates(roots){
    var registry=await loadPublishedBloggerPagePaths(true),paths=registry&&registry.paths,byTitle=registry&&registry.byTitle,needsDirect=[];
    (roots||[]).forEach(function(cat){
      var saved=clean(cat&&cat.post_url),suggested=categorySeoSlug(cat&&cat.name_vi),suggestedPath=normalizedPagePath(suggested),titleKey=normalizedPageTitle(cat&&cat.name_vi),titlePagePath=clean(byTitle&&byTitle[titleKey]);
      cat._suggestedPageUrl=suggested;
      cat._suggestedPageExists=paths?!!(suggestedPath&&paths[suggestedPath]):null;
      cat._titleMatchedPageUrl=titlePagePath;
      cat._realPageUrl='';
      cat._pageDirectChecked=false;
      if(!saved||isFallbackPostUrl(saved)){
        if(registry){cat._pageExists=!!titlePagePath;cat._realPageUrl=titlePagePath||'';cat._pageCheckReason=titlePagePath?'PAGE_EXISTS_FALLBACK':(!saved?'NO_URL':'FALLBACK_SAVED')}
        else{cat._pageExists=null;cat._pageCheckReason=!saved?'NO_URL':'FALLBACK_SAVED'}
        return;
      }
      var path=normalizedPagePath(saved);
      if(registry&&path&&paths[path]){cat._pageExists=true;cat._realPageUrl=path;cat._pageCheckReason='EXISTS';return}
      if(registry&&titlePagePath){cat._pageExists=true;cat._realPageUrl=titlePagePath;cat._pageCheckReason='PAGE_EXISTS_WRONG_URL';return}
      cat._pageExists=registry?false:null;cat._pageCheckReason=registry?'MISSING_PAGE':'CHECK_FAILED';needsDirect.push(cat);
    });
    if(needsDirect.length){
      await Promise.all(needsDirect.map(async function(cat){
        var result=await directVerifySavedPage(cat);cat._pageDirectChecked=!!result.checked;
        if(result.exists){
          var savedPath=normalizedPagePath(cat.post_url),real=clean(result.pageUrl)||savedPath;
          cat._pageExists=true;cat._realPageUrl=real;cat._pageCheckReason=(real&&savedPath&&real!==savedPath)?'PAGE_EXISTS_WRONG_URL':'EXISTS';
        }else if(result.checked){cat._pageExists=false;cat._realPageUrl='';cat._pageCheckReason='MISSING_PAGE'}
        else if(!registry){cat._pageExists=null;cat._pageCheckReason='CHECK_FAILED'}
      }));
    }
    return roots;
  }

  function renderParentSeoManager(hostNode,refresh){
    var roots=state.cats.filter(function(x){return !x.parent_id;}).slice().sort(function(a,b){var sa=Number(a.sort),sb=Number(b.sort);if(!isFinite(sa))sa=999999;if(!isFinite(sb))sb=999999;if(sa!==sb)return sa-sb;return clean(a.name_vi).localeCompare(clean(b.name_vi),'vi')});
    var usingFallback=roots.filter(function(x){return !usesPageLink(x)}),confirmedPage=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='EXISTS'}),readyToPage=roots.filter(function(x){return !usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_FALLBACK'}),wrongUrl=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_WRONG_URL'}),missingPageLink=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='MISSING_PAGE'}),unknownPageLink=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='CHECK_FAILED'});
    var box=node('section','tla-seo-manager'),head=node('div','tla-seo-head'),copy=node('div','');
    copy.appendChild(node('h3','','URL Page cho nhóm cha'));
    copy.appendChild(node('p','','post_url chỉ là link đã lưu. Chỉ khi Blogger xác nhận Page thật mới hiện “Đang dùng link Page”. Bạn có thể gắn link trước rồi tạo Page sau.'));
    head.appendChild(copy);
    var sum=node('div','tla-seo-summary');
    sum.appendChild(node('span','tla-seo-chip','Nhóm cha: '+roots.length));
    sum.appendChild(node('span','tla-seo-chip ok','Đang dùng link Page: '+confirmedPage.length));
    sum.appendChild(node('span','tla-seo-chip warn','Đang dùng fallback: '+usingFallback.length));
    if(missingPageLink.length)sum.appendChild(node('span','tla-seo-chip danger','Có link nhưng chưa tạo Page: '+missingPageLink.length));
    if(readyToPage.length)sum.appendChild(node('span','tla-seo-chip','Có Page · đang fallback: '+readyToPage.length));
    if(wrongUrl.length)sum.appendChild(node('span','tla-seo-chip warn','Link khác Page thật: '+wrongUrl.length));
    if(unknownPageLink.length)sum.appendChild(node('span','tla-seo-chip','Link chưa kiểm tra được: '+unknownPageLink.length));
    var recheckAll=node('button','tla-btn soft','Kiểm tra lại tất cả');recheckAll.type='button';
    recheckAll.onclick=async function(){
      recheckAll.disabled=true;recheckAll.textContent='Đang kiểm tra...';showPageCheckNotice('Đang kiểm tra '+roots.length+' danh mục cha...','ok');
      try{
        tlPublishedPagePaths=null;tlPublishedPageCheckedAt=0;
        await Promise.race([verifyParentPageStates(roots),new Promise(function(resolve){setTimeout(resolve,30000)})]);
        var cOk=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='EXISTS'}).length;
        var cMissing=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='MISSING_PAGE'}).length;
        var cFallbackReady=roots.filter(function(x){return !usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_FALLBACK'}).length;
        var cWrong=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_WRONG_URL'}).length;
        var cUnknown=roots.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='CHECK_FAILED'}).length;
        var cFallback=roots.filter(function(x){return !usesPageLink(x)&&x._pageCheckReason!=='PAGE_EXISTS_FALLBACK'}).length;
        var msg='Kết quả kiểm tra Page\n✓ Đã có Page + đúng link: '+cOk+'\n✕ Có link nhưng chưa tạo Page: '+cMissing+'\n↪ Có Page nhưng đang fallback: '+cFallbackReady+'\n⚠ Link khác Page thật: '+cWrong+'\n? Chưa kiểm tra được: '+cUnknown+'\n• Chưa có Page / dùng fallback: '+cFallback;
        showPageCheckNotice(msg,cMissing?'warn':'ok');
        alert(msg);
      }catch(e){showPageCheckNotice('Kiểm tra Page gặp lỗi: '+(e&&e.message?e.message:String(e||'')),'bad')}
      finally{recheckAll.disabled=false;recheckAll.textContent='Kiểm tra lại tất cả'}
      state.cats=[];render();
    };sum.appendChild(recheckAll);
    head.appendChild(sum);box.appendChild(head);

    if(missingPageLink.length){
      var missing=node('div','tla-page-warning');
      missing.appendChild(node('strong','','⚠ Có '+missingPageLink.length+' danh mục đã gắn link Page nhưng Page thật chưa được tạo'));
      missing.appendChild(node('p','','Đây là các post_url bạn đã chuẩn bị trước. Tạo Page tương ứng rồi tải lại quản trị; hệ thống sẽ tự nhận diện.'));
      var missList=node('div','tla-page-warning-list');
      missingPageLink.forEach(function(cat){var row=node('div','');row.appendChild(node('b','',cat.name_vi||cat.id));row.appendChild(node('code','',clean(cat.post_url)));missList.appendChild(row)});missing.appendChild(missList);box.appendChild(missing);
    }
    if(readyToPage.length){
      var readyWarning=node('div','tla-page-ready-warning');
      readyWarning.appendChild(node('strong','','Có '+readyToPage.length+' danh mục đã có Blogger Page nhưng vẫn đang dùng fallback'));
      readyWarning.appendChild(node('p','','Bấm “Dùng link Page” ở đúng dòng để gắn URL Page thật.'));
      var readyList=node('div','tla-page-ready-warning-list');
      readyToPage.forEach(function(cat){var row=node('div','');row.appendChild(node('b','',cat.name_vi||cat.id));row.appendChild(node('code','','Page thật: '+detectedPageUrl(cat)));readyList.appendChild(row)});readyWarning.appendChild(readyList);box.appendChild(readyWarning);
    }
    if(wrongUrl.length){
      var wrongWarning=node('div','tla-page-ready-warning');
      wrongWarning.appendChild(node('strong','','Có '+wrongUrl.length+' danh mục đã có Page nhưng link đã lưu khác URL Page thật'));
      wrongWarning.appendChild(node('p','','Bấm “Dùng link Page” để đổi sang URL Page thật Blogger đang dùng.'));box.appendChild(wrongWarning);
    }

    var wrap=node('div','tla-table-wrap'),table=node('table','tla-seo-table'),thead=node('thead',''),trh=node('tr','');['Nhóm cha','Trạng thái','URL đã lưu / Page thật','Thao tác'].forEach(function(t){trh.appendChild(node('th','',t))});thead.appendChild(trh);table.appendChild(thead);var tbody=node('tbody','');
    roots.forEach(function(cat){
      var tr=node('tr',''),tdName=node('td','tla-seo-name'),tdState=node('td',''),tdUrl=node('td','tla-seo-url'),tdTools=node('td','');
      tdName.appendChild(node('strong','',cat.name_vi||cat.id));tdName.appendChild(node('small','',cat.id));
      var saved=clean(cat.post_url),pageMode=usesPageLink(cat),current=currentCategoryLink(cat),realPage=detectedPageUrl(cat),canUseReal=!!realPage&&normalizedPagePath(realPage)!==normalizedPagePath(current),reason=cat._pageCheckReason;
      if(!pageMode){
        tdState.appendChild(node('span','tla-cat-state fallback','Đang dùng fallback'));
        if(reason==='PAGE_EXISTS_FALLBACK'&&realPage)tdState.appendChild(node('span','tla-cat-state linkfallback','Page đã có'));
      }else if(reason==='EXISTS')tdState.appendChild(node('span','tla-cat-state seo','Đang dùng link Page'));
      else if(reason==='PAGE_EXISTS_WRONG_URL')tdState.appendChild(node('span','tla-cat-state linkfallback','⚠ Có Page nhưng link lưu khác'));
      else if(reason==='MISSING_PAGE')tdState.appendChild(node('span','tla-cat-state broken','⚠ Có link Page nhưng chưa tạo Page'));
      else tdState.appendChild(node('span','tla-cat-state child','Có link Page · chưa kiểm tra được'));

      var inp=node('input','');inp.type='text';inp.value=saved;inp.placeholder='Có thể dán link Page trước khi tạo Page';inp.setAttribute('data-original-url',saved);inp.setAttribute('data-cat-id',cat.id);tdUrl.appendChild(inp);
      tdUrl.appendChild(node('small','tla-seo-meta','Link hiện tại: '+current));
      if(realPage)tdUrl.appendChild(node('small','tla-seo-meta','Page thật: '+realPage));
      tdUrl.appendChild(node('small','tla-seo-meta','Link gợi ý: '+categorySeoSlug(cat.name_vi)));

      var tools=node('div','tla-seo-tools'),open=node('button','tla-btn soft','Mở'),checkNow=node('button','tla-btn soft','Kiểm tra lại'),useReal=node('button','tla-btn soft','Dùng link Page'),useFallback=node('button','tla-btn soft','Dùng fallback'),save=node('button','tla-btn primary','Lưu');
      open.type=checkNow.type=useReal.type=useFallback.type=save.type='button';
      open.onclick=function(){var target=currentCategoryLink(cat);window.open(/^https?:\/\//i.test(target)?target:(location.origin+target),'_blank','noopener')};
      useReal.onclick=async function(){if(!realPage)return;try{useReal.disabled=true;await saveCategoryQuick(cat,realPage);cat.post_url=realPage;refresh()}catch(e){alert(e.message||String(e))}finally{useReal.disabled=false}};
      useFallback.onclick=async function(){try{useFallback.disabled=true;await saveCategoryQuick(cat,'');cat.post_url='';refresh()}catch(e){alert(e.message||String(e))}finally{useFallback.disabled=false}};
      save.onclick=async function(){var next=clean(inp.value),old=clean(inp.getAttribute('data-original-url'));if(next===old){alert('URL chưa thay đổi.');return}if(next&&!confirm('Lưu link Page dự kiến cho nhóm “'+clean(cat.name_vi)+'”?\n'+next+'\nNếu Page chưa tạo, quản trị sẽ cảnh báo cho tới khi Blogger xác nhận Page thật.'))return;try{save.disabled=true;await saveCategoryQuick(cat,next);cat.post_url=next;inp.setAttribute('data-original-url',next);refresh()}catch(e){alert(e.message||String(e))}finally{save.disabled=false}};
      checkNow.onclick=async function(){await manualCheckCategoryPage(cat,checkNow);tdState.innerHTML='';var r2=cat._pageCheckReason,real2=detectedPageUrl(cat);if(!usesPageLink(cat)){tdState.appendChild(node('span','tla-cat-state fallback','Đang dùng fallback'));if(r2==='PAGE_EXISTS_FALLBACK'&&real2)tdState.appendChild(node('span','tla-cat-state linkfallback','Page đã có'))}else if(r2==='EXISTS')tdState.appendChild(node('span','tla-cat-state seo','Đang dùng link Page'));else if(r2==='PAGE_EXISTS_WRONG_URL')tdState.appendChild(node('span','tla-cat-state linkfallback','⚠ Có Page nhưng link lưu khác'));else if(r2==='MISSING_PAGE')tdState.appendChild(node('span','tla-cat-state broken','⚠ Có link Page nhưng chưa tạo Page'));else tdState.appendChild(node('span','tla-cat-state child','Có link Page · chưa kiểm tra được'));};
      tools.appendChild(open);
      if(reason==='CHECK_FAILED'&&pageMode)tools.appendChild(checkNow);
      if(canUseReal)tools.appendChild(useReal);
      else if(reason==='MISSING_PAGE'||(!pageMode&&!realPage))tools.appendChild(createPageLink(cat.name_vi,'Tạo Page ↗'));
      if(pageMode)tools.appendChild(useFallback);
      tools.appendChild(save);tdTools.appendChild(tools);
      tr.appendChild(tdName);tr.appendChild(tdState);tr.appendChild(tdUrl);tr.appendChild(tdTools);tbody.appendChild(tr);
    });
    table.appendChild(tbody);wrap.appendChild(table);box.appendChild(wrap);
    var foot=node('div','tla-seo-footer'),hint=node('span','','Nút “Mở” luôn mở đúng link hiện đang lưu/dùng. post_url có thể được nhập trước; Page thật được xác minh riêng.'),saveAll=node('button','tla-btn primary','Lưu các URL đã nhập');foot.appendChild(hint);foot.appendChild(saveAll);box.appendChild(foot);
    saveAll.onclick=async function(){
      var inputs=Array.prototype.slice.call(box.querySelectorAll('input[data-cat-id]')),changed=inputs.filter(function(i){return clean(i.value)!==clean(i.getAttribute('data-original-url'))});
      if(!changed.length){alert('Chưa có URL nào thay đổi.');return}var adding=changed.filter(function(i){return !!clean(i.value)}).length;if(adding&&!confirm('Lưu '+adding+' link Page dự kiến? Page chưa tạo vẫn được phép lưu và sẽ được cảnh báo.'))return;
      try{saveAll.disabled=true;saveAll.textContent='Đang lưu '+changed.length+' nhóm...';for(var i=0;i<changed.length;i++){var input=changed[i],cat=state.cats.find(function(x){return x.id===input.getAttribute('data-cat-id')});if(cat){await saveCategoryQuick(cat,input.value);cat.post_url=clean(input.value)}}refresh()}catch(e){alert(e.message||String(e))}finally{saveAll.disabled=false;saveAll.textContent='Lưu các URL đã nhập'}
    };
    hostNode.appendChild(box);
  }

  async function categories(c){
    c.innerHTML='<div class="tla-status">Đang tải danh mục...</div>';
    var parents=state.cats.filter(function(x){return !x.parent_id});
    try{await Promise.race([verifyParentPageStates(parents),new Promise(function(resolve){setTimeout(resolve,7600)})])}catch(e){console.warn('THIS LOCAL: bỏ qua kiểm tra Blogger Page',e)}
    c.innerHTML='';
    var usingFallback=parents.filter(function(x){return !usesPageLink(x)}),confirmedPage=parents.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='EXISTS'}),missingPage=parents.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='MISSING_PAGE'}),readyToPage=parents.filter(function(x){return !usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_FALLBACK'}),wrongUrl=parents.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_WRONG_URL'}),unknownPage=parents.filter(function(x){return usesPageLink(x)&&x._pageCheckReason==='CHECK_FAILED'});
    var tb=node('div','tla-toolbar'),search=node('input','tla-search'),filter=node('select',''),add=node('button','tla-btn','+ Thêm danh mục');search.placeholder='Tìm danh mục...';
    addSelectOptions(filter,[{value:'ALL',label:'Tất cả danh mục'},{value:'PARENT',label:'Chỉ nhóm cha'},{value:'FALLBACK',label:'Đang dùng fallback ('+usingFallback.length+')'},{value:'PAGE',label:'Đang dùng link Page ('+confirmedPage.length+')'},{value:'MISSING_PAGE',label:'Có link nhưng chưa tạo Page ('+missingPage.length+')'},{value:'READY_PAGE',label:'Có Page nhưng đang fallback ('+readyToPage.length+')'},{value:'WRONG_URL',label:'Link khác Page thật ('+wrongUrl.length+')'},{value:'UNKNOWN_PAGE',label:'Link chưa kiểm tra được ('+unknownPage.length+')'},{value:'CHILD',label:'Chỉ danh mục con'}]);filter.value=state.catFilter||'ALL';
    tb.appendChild(search);tb.appendChild(filter);tb.appendChild(add);c.appendChild(tb);
    renderParentSeoManager(c,function(){state.cats=[];render()});
    var lay=node('div','tla-cat-layout'),list=node('div','tla-cat-list'),detail=node('div','tla-detail');lay.appendChild(list);lay.appendChild(detail);c.appendChild(lay);
    function passFilter(x){var f=filter.value;if(f==='PARENT')return !x.parent_id;if(f==='FALLBACK')return !x.parent_id&&!usesPageLink(x);if(f==='PAGE')return !x.parent_id&&usesPageLink(x)&&x._pageCheckReason==='EXISTS';if(f==='MISSING_PAGE')return !x.parent_id&&usesPageLink(x)&&x._pageCheckReason==='MISSING_PAGE';if(f==='READY_PAGE')return !x.parent_id&&!usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_FALLBACK';if(f==='WRONG_URL')return !x.parent_id&&usesPageLink(x)&&x._pageCheckReason==='PAGE_EXISTS_WRONG_URL';if(f==='UNKNOWN_PAGE')return !x.parent_id&&usesPageLink(x)&&x._pageCheckReason==='CHECK_FAILED';if(f==='CHILD')return !!x.parent_id;return true}
    function draw(){
      var q=clean(search.value).toLowerCase();list.innerHTML='';var m=byId();
      state.cats.filter(function(x){return passFilter(x)&&(!q||String(x.name_vi||'').toLowerCase().indexOf(q)>-1||String(x.id||'').toLowerCase().indexOf(q)>-1)}).forEach(function(x){
        var b=node('button','tla-item');b.appendChild(node('strong','',x.name_vi));var small=node('small','',(x.parent_id?(m[x.parent_id]?m[x.parent_id].name_vi:'?'):'Danh mục cha')+' · '+x.id+(x.active===false?' · TẮT':''));b.appendChild(small);
        if(x.parent_id)b.appendChild(node('span','tla-cat-state child','Link tự động theo nhóm cha'));
        else if(!usesPageLink(x)){
          b.appendChild(node('span','tla-cat-state fallback','Đang dùng fallback'));
          if(x._pageCheckReason==='PAGE_EXISTS_FALLBACK'&&detectedPageUrl(x)){var use=node('span','tla-cat-state linkfallback tla-create-page-link','Dùng link Page');use.onclick=function(ev){ev.preventDefault();ev.stopPropagation();saveCategoryQuick(x,detectedPageUrl(x)).then(function(){state.cats=[];render()}).catch(function(e){alert(e.message||String(e))})};b.appendChild(use)}
          else{var cp=node('span','tla-cat-state fallback tla-create-page-link','Tạo Page ↗');cp.onclick=function(ev){ev.preventDefault();ev.stopPropagation();openBloggerCreatePage(x.name_vi)};b.appendChild(cp)}
        }else if(x._pageCheckReason==='EXISTS')b.appendChild(node('span','tla-cat-state seo','Đang dùng link Page'));
        else if(x._pageCheckReason==='PAGE_EXISTS_WRONG_URL'){
          b.appendChild(node('span','tla-cat-state linkfallback','⚠ Link khác Page thật'));
          if(detectedPageUrl(x)){var fix=node('span','tla-cat-state linkfallback tla-create-page-link','Dùng link Page');fix.onclick=function(ev){ev.preventDefault();ev.stopPropagation();saveCategoryQuick(x,detectedPageUrl(x)).then(function(){state.cats=[];render()}).catch(function(e){alert(e.message||String(e))})};b.appendChild(fix)}
        }else if(x._pageCheckReason==='MISSING_PAGE'){
          b.appendChild(node('span','tla-cat-state broken','⚠ Có link Page nhưng chưa tạo Page'));var cp2=node('span','tla-cat-state fallback tla-create-page-link','Tạo Page ↗');cp2.onclick=function(ev){ev.preventDefault();ev.stopPropagation();openBloggerCreatePage(x.name_vi)};b.appendChild(cp2)
        }else{var chk=node('span','tla-cat-state child tla-create-page-link','Kiểm tra Page ↻');chk.onclick=async function(ev){ev.preventDefault();ev.stopPropagation();chk.textContent='Đang kiểm tra...';await manualCheckCategoryPage(x,null);draw()};b.appendChild(chk)};
        b.onclick=function(){editCategory(detail,x)};list.appendChild(b)
      })
    }
    search.oninput=draw;filter.onchange=function(){state.catFilter=filter.value;draw()};add.onclick=function(){editCategory(detail,null)};draw();
    detail.innerHTML='<div class="tla-empty">Chọn danh mục để sửa.<br/>post_url đã lưu và Page thật là hai trạng thái riêng. Link đã nhập nhưng Page chưa tạo sẽ được cảnh báo đỏ.</div>';
  }

  function editCategory(detail,c){
    c=c||{sort:100,active:true};detail.innerHTML='';detail.appendChild(node('h2','',c.id?'Sửa danh mục':'Thêm danh mục'));
    if(c.id&&!c.parent_id){
      var pageMode=usesPageLink(c),real=detectedPageUrl(c),reason=c._pageCheckReason,msg=!pageMode?'Đang dùng fallback · '+currentCategoryLink(c):(reason==='EXISTS'?'Đang dùng link Page · '+currentCategoryLink(c):(reason==='MISSING_PAGE'?'⚠ Có link Page nhưng chưa tạo Page · '+currentCategoryLink(c):(reason==='PAGE_EXISTS_WRONG_URL'?'⚠ Có Page nhưng link đã lưu khác Page thật · '+currentCategoryLink(c):'Có link Page · chưa kiểm tra được · '+currentCategoryLink(c))));
      if(!pageMode&&real)msg+=' · Page thật đã có: '+real;
      else if(pageMode&&reason==='PAGE_EXISTS_WRONG_URL'&&real)msg+=' · Page thật: '+real;
      detail.appendChild(node('div','tla-note',msg));
    }
    var form=node('div','tla-grid');
    var id=field('ID','id',c.id||'');if(c.id)id.input.readOnly=true;form.appendChild(id.wrap);
    var parent=field('Danh mục cha','parent_id','','select');parent.input.innerHTML='<option value="">— Đây là danh mục cha —</option>';state.cats.filter(function(x){return !x.parent_id&&x.id!==c.id}).forEach(function(x){var o=node('option','',x.name_vi);o.value=x.id;if(x.id===c.parent_id)o.selected=true;parent.input.appendChild(o)});form.appendChild(parent.wrap);
    [['Tên VI','name_vi'],['English','name_en'],['中文','name_zh'],['ไทย','name_th'],['Русский','name_ru'],['日本語','name_ja'],['한국어','name_ko']].forEach(function(x){var f=field(x[0],x[1],c[x[1]]);form.appendChild(f.wrap)});
    var urlf=field('URL trang SEO của nhóm cha (Blogger)','post_url',c.post_url||'','text',true);urlf.input.placeholder='Để trống = fallback · /p/ten-page.html = dùng link Page';form.appendChild(urlf.wrap);var help=node('div','tla-field-help');urlf.wrap.appendChild(help);var preview=node('div','tla-url-preview');urlf.wrap.appendChild(preview);
    var sortf=field('Thứ tự','sort',c.sort);form.appendChild(sortf.wrap);
    function refreshUrlHelp(){
      var isChild=!!clean(parent.input.value),nameField=form.querySelector('[data-field="name_vi"]'),name=clean(nameField&&nameField.value)||clean(c.name_vi)||'Tên nhóm';
      if(isChild){urlf.input.disabled=true;help.innerHTML='<strong>Danh mục con không cần post_url.</strong> Website tự sinh link từ nhóm cha + ?category=...';var pc=byId()[parent.input.value];preview.textContent='Link tự động: '+(clean(pc&&pc.post_url)||('/p/danh-muc.html?parent='+encodeURIComponent(clean(pc&&pc.name_vi))))+'?category='+encodeURIComponent(name)+'#tlCategoryHub'}
      else{urlf.input.disabled=false;help.innerHTML='<strong>Nhóm cha:</strong> có thể lưu /p/...html trước khi tạo Page. Quản trị sẽ chỉ báo “Đang dùng link Page” sau khi Page thật được xác minh.';var current=usesPageLink(c)?clean(c.post_url):('/p/danh-muc.html?parent='+encodeURIComponent(name)),real=detectedPageUrl(c);preview.textContent='Link đang dùng: '+current+(real?' · Page thật: '+real:'')+' · Link gợi ý: '+categorySeoSlug(name)}
    }
    parent.input.onchange=refreshUrlHelp;urlf.input.oninput=refreshUrlHelp;var nameInput=form.querySelector('[data-field="name_vi"]');if(nameInput)nameInput.oninput=refreshUrlHelp;refreshUrlHelp();
    var active=node('label','tla-check'),ck=node('input','');ck.type='checkbox';ck.checked=c.active!==false;ck.setAttribute('data-field','active');active.appendChild(ck);active.appendChild(document.createTextNode('Đang hoạt động'));form.appendChild(active);detail.appendChild(form);
    var a=node('div','tla-actions'),save=node('button','tla-btn primary','Lưu danh mục');a.appendChild(save);
    if(c.id){
      var open=node('button','tla-btn soft','Mở');open.type='button';open.onclick=function(){var target=currentCategoryLink(c);window.open(/^https?:\/\//i.test(target)?target:(location.origin+target),'_blank','noopener')};a.appendChild(open);
      var real=detectedPageUrl(c),current=currentCategoryLink(c);
      if(real&&normalizedPagePath(real)!==normalizedPagePath(current)){var useReal=node('button','tla-btn soft','Dùng link Page');useReal.type='button';useReal.onclick=async function(){try{useReal.disabled=true;await saveCategoryQuick(c,real);state.cats=[];render()}catch(e){alert(e.message||String(e))}finally{useReal.disabled=false}};a.appendChild(useReal)}
      else if((!usesPageLink(c)&&!real)||(usesPageLink(c)&&c._pageCheckReason==='MISSING_PAGE')){var create=node('button','tla-btn soft','Tạo Page ↗');create.type='button';create.onclick=function(){var ni=form.querySelector('[data-field="name_vi"]');openBloggerCreatePage(clean(ni&&ni.value)||c.name_vi)};a.appendChild(create)}
      if(usesPageLink(c)){var useFallback=node('button','tla-btn soft','Dùng fallback');useFallback.type='button';useFallback.onclick=async function(){try{useFallback.disabled=true;await saveCategoryQuick(c,'');state.cats=[];render()}catch(e){alert(e.message||String(e))}finally{useFallback.disabled=false}};a.appendChild(useFallback)}
      var del=node('button','tla-btn danger','Xóa');del.onclick=async function(){if(!confirm('Xóa danh mục này?'))return;try{await api('',{method:'POST',body:JSON.stringify({action:'deleteCategory',id:c.id})});state.cats=[];render()}catch(e){errBox(detail,e.message)}};a.appendChild(del)
    }else if(!clean(parent.input.value)){
      var createNew=node('button','tla-btn soft','Tạo Page ↗');createNew.type='button';createNew.onclick=function(){var ni=form.querySelector('[data-field="name_vi"]');openBloggerCreatePage(clean(ni&&ni.value))};a.appendChild(createNew)
    }
    detail.appendChild(a);
    save.onclick=async function(){try{var data=collect(form,c);if(clean(parent.input.value))data.post_url=clean(c.post_url);else if(clean(data.post_url)&&clean(data.post_url)!==clean(c.post_url)&&!confirm('Lưu link Page dự kiến cho nhóm “'+clean(data.name_vi||c.name_vi)+'”? Nếu Page chưa tạo, hệ thống sẽ tiếp tục cảnh báo.'))return;save.disabled=true;await api('',{method:'POST',body:JSON.stringify({action:'saveCategory',category:data})});state.cats=[];render()}catch(e){errBox(detail,e.message)}finally{save.disabled=false}}
  }

  async function ratings(c){
    c.innerHTML='';var tb=node('div','tla-toolbar'),pid=node('input','tla-search');pid.placeholder='Lọc theo Place ID';pid.value=state.ratings.placeId;var active=node('select','');addSelectOptions(active,[{value:'ALL',label:'Tất cả'},{value:'true',label:'Đang hoạt động'},{value:'false',label:'Đã ẩn'}]);active.value=state.ratings.active;var go=node('button','tla-btn primary','Lọc');tb.appendChild(pid);tb.appendChild(active);tb.appendChild(go);c.appendChild(tb);go.onclick=function(){state.ratings.placeId=clean(pid.value);state.ratings.active=active.value;state.ratings.offset=0;ratings(c)};
    var qs='?action=ratings&limit=50&offset='+state.ratings.offset;if(state.ratings.placeId)qs+='&place_id='+encodeURIComponent(state.ratings.placeId);if(state.ratings.active!=='ALL')qs+='&active='+state.ratings.active;
    var d=await api(qs);state.ratings.items=d.ratings||[];state.ratings.total=d.total||0;var wrap=node('div','tla-table-wrap'),table=node('table','tla-table'),thead=node('thead',''),tr=node('tr','');['Ngày','Place ID','Điểm','Reviewer','Nguồn','Trạng thái','Thao tác'].forEach(function(x){tr.appendChild(node('th','',x))});thead.appendChild(tr);table.appendChild(thead);var tbody=node('tbody','');
    state.ratings.items.forEach(function(r){var row=node('tr','');[fmt(r.created_at),r.place_id,String(r.rating),r.reviewer_key,r.source,r.active?'Hiện':'Ẩn'].forEach(function(x){row.appendChild(node('td','',x))});var td=node('td',''),toggle=node('button','tla-btn soft',r.active?'Ẩn':'Hiện'),del=node('button','tla-btn danger','Xóa');toggle.onclick=async function(){try{await api('',{method:'POST',body:JSON.stringify({action:'setRatingActive',id:r.id,active:!r.active})});ratings(c)}catch(e){alert(e.message)}};del.onclick=async function(){if(!confirm('Xóa đánh giá này?'))return;try{await api('',{method:'POST',body:JSON.stringify({action:'deleteRating',id:r.id})});ratings(c)}catch(e){alert(e.message)}};td.appendChild(toggle);td.appendChild(del);row.appendChild(td);tbody.appendChild(row)});table.appendChild(tbody);wrap.appendChild(table);c.appendChild(wrap)
  }

  /* V17.48 saved-link vs real-Page verification enabled */
  (async function(){if(!access()){login();return}try{await api('?action=stats');render()}catch(e){clearSession();login(e.message||String(e))}})();
})();
