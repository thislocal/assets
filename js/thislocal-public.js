/* THIS LOCAL public runtime extracted from V17.60. */

/* ---- original script block 6 ---- */
(function(){
  'use strict';

  /* Không cho hai tiện ích Guide Engine cùng chạy nếu vô tình được thêm lặp. */
  if(window.__THIS_LOCAL_GUIDE_ENGINE_ACTIVE__)return;
  window.__THIS_LOCAL_GUIDE_ENGINE_ACTIVE__=true;

  /* MỘT URL DỮ LIỆU DUY NHẤT. Hiện tại là Apps Script; khi Supabase sẵn sàng
     chỉ cần đổi URL này sang Edge Function, giao diện không cần biết backend là gì. */
  var VLC_API_URL=(window.TL_DATA_API_URL||'').replace(/\/+$/,'');
  window.TL_DATA_API_URL=VLC_API_URL;
  window.TL_GUIDE_API_URL=VLC_API_URL;
  window.TL_GUIDE_ENGINE_VERSION='2026-08-12-global-data-v18';

  /* Danh mục luôn lấy qua API dữ liệu; Blogger không đọc trực tiếp Google Sheets/Supabase. */
  var CATEGORY_CATALOG_CACHE_KEY='tl_category_catalog_v4';
  var GUIDE_PAGE_SIZE_DESKTOP=20;
  var GUIDE_PAGE_SIZE_MOBILE=10;
  var GUIDE_RADIUS_KM=25;
  var TL_LOCATION_KEY='tl_user_location_v1';

  /* Mỗi đợt luôn tương đương 10 hàng: PC 2 cột = 20, mobile 1 cột = 10. */
  function guideBatchSize(){
    return window.matchMedia&&window.matchMedia('(max-width:520px)').matches?GUIDE_PAGE_SIZE_MOBILE:GUIDE_PAGE_SIZE_DESKTOP;
  }

  function readSavedLocation(){
    try{
      var p=JSON.parse(localStorage.getItem(TL_LOCATION_KEY)||'null');
      if(!p||!isFinite(Number(p.lat))||!isFinite(Number(p.lng)))return null;
      if(p.savedAt&&Date.now()-Number(p.savedAt)>86400000)return null;
      return p;
    }catch(e){return null;}
  }
  function reverseCurrentLocality(pos,callback){
    callback=typeof callback==='function'?callback:function(){};
    if(!pos||!pos.coords||typeof fetch!=='function'){callback(null);return;}
    var lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
    if(!isFinite(lat)||!isFinite(lng)){callback(null);return;}
    var url='https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lng)+'&localityLanguage=vi';
    fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('reverse');return r.json();})
      .then(function(data){
        data=data||{};
        var locality=safe(data.locality)||safe(data.city)||safe(data.principalSubdivision);
        callback(locality?{
          locality:locality,
          region:safe(data.principalSubdivision),
          countryCode:safe(data.countryCode).toUpperCase(),
          countryName:safe(data.countryName),
          currency:''
        }:null);
      })
      .catch(function(){callback(null);});
  }
  window.TL_REVERSE_CURRENT_LOCALITY=reverseCurrentLocality;

  function storeEnrichedLocation(p,meta){
    if(!p||!meta||!meta.locality)return;
    p.locality=meta.locality;p.region=meta.region||'';p.countryCode=meta.countryCode||'';p.countryName=meta.countryName||'';p.currency=meta.currency||p.currency||'';p.savedAt=Date.now();
    try{localStorage.setItem(TL_LOCATION_KEY,JSON.stringify(p));}catch(e){}
    try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
  }
  function savePosition(pos){
    if(!pos||!pos.coords)return null;
    var p={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy)||null,locality:'',region:'',countryCode:'',countryName:'',currency:'',savedAt:Date.now()};
    try{localStorage.setItem(TL_LOCATION_KEY,JSON.stringify(p));}catch(e){}
    try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
    reverseCurrentLocality(pos,function(meta){storeEnrichedLocation(p,meta);});
    return p;
  }

  /* Tự bổ sung lại địa danh cho vị trí đã lưu từ phiên bản cũ. */
  (function repairSavedLocality(){
    var p=readSavedLocation();
    if(!p||safe(p.locality)||safe(p.region))return;
    reverseCurrentLocality({coords:{latitude:Number(p.lat),longitude:Number(p.lng)}},function(meta){storeEnrichedLocation(p,meta);});
  })();

  function el(tag, cls, text){
    var n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }

  function safe(v){return v==null?'':String(v).trim();}

  var UNVERIFIED_INFO_TEXT='Dữ liệu chưa được xác minh, để xác minh địa điểm của bạn nhanh nhất vui lòng liên hệ với THIS LOCAL.';

  function normKey(v){
    v=safe(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
    try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}catch(e){return v;}
  }

  function verificationState(place){
    var raw=place&&place.verified;
    if(raw===true)return 'TRUE';
    if(raw===false)return 'FALSE';
    var value=normKey(raw);
    if(['true','1','yes','y','co','có','verified','da xac minh','đã xác minh'].indexOf(value)>-1)return 'TRUE';
    if(['false','0','no','n','khong','không','unverified','chua xac minh','chưa xác minh'].indexOf(value)>-1)return 'FALSE';
    return '';
  }

  function statusFromPlace(place){
    place=place||{};
    var raw=safe(place.business_status||place.place_status||place.status).toUpperCase();
    var folded=raw.replace(/Đ/g,'D');
    try{folded=folded.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
    var note=safe(place.note);
    if(/\[THISLOCAL_STATUS:TEMP_CLOSED\]/i.test(note)||/TEMP[_ -]?CLOSED/.test(raw)||/TAM.*DONG/.test(folded))return 'TEMP_CLOSED';
    if(/\[THISLOCAL_STATUS:PERM_CLOSED\]/i.test(note)||/PERM(?:ANENT)?[_ -]?CLOSED/.test(raw)||/VINH.*VIEN|DA.*DONG/.test(folded))return 'PERM_CLOSED';
    return 'OPEN';
  }

  function stripStatusMarker(note){
    return safe(note).replace(/\[THISLOCAL_STATUS:(?:TEMP_CLOSED|PERM_CLOSED|OPEN)\]\s*/ig,'').trim();
  }

  function statusMarker(value){return value&&value!=='OPEN'?'[THISLOCAL_STATUS:'+value+']':'';}

  function editableVerificationNote(place){
    var note=stripStatusMarker(place&&place.note||'');
    if(/Dữ liệu thử nghiệm Lào Cai\s*;?\s*cần quản trị viên kiểm tra lại tình trạng hoạt động/i.test(note))return UNVERIFIED_INFO_TEXT;
    return verificationState(place)==='FALSE'&&!note?UNVERIFIED_INFO_TEXT:note;
  }

  function haversine(lat1,lon1,lat2,lon2){
    var R=6371,toRad=Math.PI/180;
    var dLat=(lat2-lat1)*toRad,dLon=(lon2-lon1)*toRad;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function distanceText(km){
    if(!isFinite(km))return '';
    if(km<1)return Math.max(10,Math.round(km*1000/10)*10)+' m';
    return (km<10?km.toFixed(1):Math.round(km))+' km';
  }

  function topRankNumber(place){
    var match=safe(place&&place.top_rank).match(/(?:TOP\s*)?(\d+)/i);
    var rank=match?Number(match[1]):NaN;
    return isFinite(rank)&&rank>0?rank:Number.POSITIVE_INFINITY;
  }

  function topInfo(place,userPos,localityLabel){
    var rank=topRankNumber(place);
    if(!isFinite(rank))return null;
    var rawScope=safe(place&&place.top_scope);
    var scope=normKey(rawScope).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    var radius=Number(place&&place.top_radius_km);
    var area=safe(place&&place.top_locality||place&&place.locality||place&&place.province);
    var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
    var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
    var radii=['radius','ban_kinh','khoang_cach','distance'];

    /* V17.57: suy luận an toàn khi dữ liệu TOP cũ chưa chuẩn hóa hoàn toàn. */
    var kind='global';
    if(scope){
      var looksRadius=scope.indexOf('radius')>-1||scope.indexOf('ban_kinh')>-1||scope.indexOf('khoang_cach')>-1||scope.indexOf('distance')>-1;
      var looksLocal=scope.indexOf('local')>-1||scope.indexOf('dia_phuong')>-1||scope.indexOf('khu_vuc')>-1||scope.indexOf('province')>-1||scope.indexOf('tinh')>-1;
      if(globals.indexOf(scope)>-1)kind='global';
      else if(radii.indexOf(scope)>-1||looksRadius)kind='radius';
      else if(locals.indexOf(scope)>-1||looksLocal)kind='local';
      else if(isFinite(radius)&&radius>0)kind='radius';
      else {kind='local';if(!safe(place&&place.top_locality))area=rawScope;}
    }else if(isFinite(radius)&&radius>0)kind='radius';
    else if(safe(place&&place.top_locality))kind='local';

    if(kind==='global')return {rank:rank,label:'TOP của THIS LOCAL',scope:'global'};
    if(kind==='local'){
      var wanted=normKey(localityLabel),actual=normKey(area);
      if(!wanted||!actual||(wanted.indexOf(actual)<0&&actual.indexOf(wanted)<0))return null;
      return {rank:rank,label:'TOP của '+area,scope:'local'};
    }
    if(kind==='radius'){
      if(!userPos||!isFinite(radius)||radius<=0||!isFinite(Number(place.lat))||!isFinite(Number(place.lng)))return null;
      var km=isFinite(place._distance)?place._distance:haversine(userPos.lat,userPos.lng,Number(place.lat),Number(place.lng));
      if(!isFinite(km)||km>radius)return null;
      return {rank:rank,label:'TOP trong bán kính '+(Math.round(radius*10)/10)+' km',scope:'radius',distance:km};
    }
    return null;
  }

  function ratingText(place){
    var count=Math.max(0,Number(place&&place.rating_count)||0);
    var average=Number(place&&place.rating_average)||0;
    return count?('Đánh giá '+(Math.round(average*10)/10)+' \u2605 / '+count):'Đánh giá';
  }

  function ratingReviewerKey(){
    var keyName='tl_rating_reviewer_v1';
    try{
      var value=localStorage.getItem(keyName);
      if(value)return value;
      value='TLR-'+Date.now()+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
      localStorage.setItem(keyName,value);
      return value;
    }catch(e){return 'TLR-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  }

  function directionsUrl(place,userPos){
    var dest='';
    if(isFinite(place.lat)&&isFinite(place.lng)) dest=place.lat+','+place.lng;
    else dest=place.address||place.name;

    var url='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest);
    if(userPos)url+='&origin='+encodeURIComponent(userPos.lat+','+userPos.lng);
    url+='&travelmode=driving';
    return url;
  }

  function websiteUrl(value){
    var url=safe(value);
    if(!url)return '';
    if(!/^https?:\/\//i.test(url))url='https://'+url.replace(/^\/+/, '');
    return url;
  }

  function placeSourceNode(place){
    var sourceName=safe(place&&place.source_name);
    if(/^THIS LOCAL community$/i.test(sourceName))sourceName='THIS LOCAL Community';
    var sourceLicense=safe(place&&place.source_license);
    if(!sourceName&&!sourceLicense)return null;
    var row=el('div','vlc-place-source');
    row.appendChild(document.createTextNode('Nguồn: '));
    if(sourceName){
      var sourceUrl=safe(place&&place.source_url);
      if(sourceUrl){
        var sourceLink=el('a','',sourceName);
        sourceLink.href=sourceUrl;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
        row.appendChild(sourceLink);
      }else row.appendChild(document.createTextNode(sourceName));
    }
    if(sourceName&&sourceLicense)row.appendChild(document.createTextNode(' \u00b7 '));
    if(sourceLicense){
      var licenseLink=el('a','',sourceLicense);
      if(/odbl/i.test(sourceLicense)){
        licenseLink.href='https://www.openstreetmap.org/copyright';
        licenseLink.target='_blank';licenseLink.rel='noopener noreferrer';
      }
      row.appendChild(licenseLink);
    }
    return row;
  }

  function jsonp(url, cb){
    var name='VLC_CB_'+Date.now()+'_'+Math.floor(Math.random()*100000);
    var s=document.createElement('script');
    var done=false,fallbackStarted=false,fallbackTimer=null,finalTimer=null;
    function cleanup(){
      if(fallbackTimer)clearTimeout(fallbackTimer);
      if(finalTimer)clearTimeout(finalTimer);
      try{delete window[name];}catch(e){}
      if(s.parentNode)s.parentNode.removeChild(s);
    }
    function finish(err,data){
      if(done)return;done=true;cleanup();cb(err,data);
    }
    function fetchFallback(){
      if(done||fallbackStarted)return;fallbackStarted=true;
      if(typeof fetch!=='function'){finish(new Error('Không tải được dữ liệu'));return;}
      fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store'})
        .then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.text();})
        .then(function(text){finish(null,JSON.parse(text));})
        .catch(function(){finish(new Error('Không tải được dữ liệu'));});
    }
    window[name]=function(data){finish(null,data);};
    s.onerror=fetchFallback;
    s.src=url+(url.indexOf('?')>-1?'&':'?')+'callback='+encodeURIComponent(name);
    document.head.appendChild(s);
    fallbackTimer=setTimeout(fetchFallback,8000);
    finalTimer=setTimeout(function(){finish(new Error('Hết thời gian chờ dữ liệu'));},30000);
  }

  function initGuide(root){
    if(root.dataset.vlcReady==='1')return;
    root.dataset.vlcReady='1';

    var proposalOnly=root.getAttribute('data-proposal-only')==='1';
    var category=safe(root.dataset.category)||(proposalOnly?'':'Địa điểm');
    var parentCategory=safe(root.getAttribute('data-parent-category'));
    var allowedCategories=[];
    try{
      var allowedRaw=JSON.parse(root.getAttribute('data-allowed-categories')||'[]');
      if(Array.isArray(allowedRaw))allowedCategories=allowedRaw.map(safe).filter(Boolean);
    }catch(e){}
    var cachedCatalog=[];
    try{
      var cachedRaw=JSON.parse(localStorage.getItem(CATEGORY_CATALOG_CACHE_KEY)||'[]');
      if(Array.isArray(cachedRaw))cachedCatalog=cachedRaw;
    }catch(e){}
    var shell=el('div','vlc-guide-shell');

    var hero=el('div','vlc-guide-hero');
    hero.appendChild(el('div','vlc-guide-kicker','THIS LOCAL - Dữ liệu cộng đồng'));
    var guideTitle=el('h2','vlc-guide-title',category+' gần bạn');hero.appendChild(guideTitle);
    var guideDesc=el('p','vlc-guide-desc','Danh sách do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị.');hero.appendChild(guideDesc);

    var actions=el('div','vlc-guide-actions');
    var nearBtn=el('button','vlc-btn vlc-btn-primary','Xác định vị trí');
    nearBtn.type='button';
    actions.appendChild(nearBtn);hero.appendChild(actions);

    var status=el('div','vlc-guide-status','Đang tải danh sách đã kiểm duyệt...');
    var list=el('div','vlc-guide-list');
    var contribute=el('div','vlc-contribute');
    contribute.innerHTML='<h3 class="vlc-contribute-title">Bạn biết địa điểm khác?</h3><p>Gửi địa điểm mới hoặc báo thông tin cần sửa. Nội dung chỉ xuất hiện sau khi THIS LOCAL duyệt.</p>';
    var addBtn=el('button','vlc-btn vlc-btn-primary','Đề xuất địa điểm');addBtn.type='button';
    contribute.appendChild(addBtn);

    shell.appendChild(hero);shell.appendChild(status);shell.appendChild(list);shell.appendChild(contribute);
    root.appendChild(shell);

    var cachedLeaves=cachedCatalog.filter(function(v){return v&&!v.is_parent;}).map(function(v){return safe(v.name_vi||v.name);}).filter(Boolean);
    var savedLocation=readSavedLocation();
    var state={places:[],userPos:savedLocation?{lat:Number(savedLocation.lat),lng:Number(savedLocation.lng)}:null,userAccuracy:savedLocation?Number(savedLocation.accuracy)||null:null,userLocality:savedLocation?safe(savedLocation.locality):'',userRegion:savedLocation?safe(savedLocation.region):'',categories:allowedCategories.concat(cachedLeaves),categoryCatalog:cachedCatalog,nextOffset:0,hasMore:true,loading:false};
    var loadObserver=null;
    if(state.userPos)nearBtn.textContent='Cập nhật vị trí của tôi';

    function stopWatchingMore(){
      if(loadObserver&&typeof loadObserver.disconnect==='function')loadObserver.disconnect();
      loadObserver=null;
    }
    function watchForMore(target){
      stopWatchingMore();
      var loadNext=function(){
        if(state.loading||!state.hasMore)return;
        stopWatchingMore();
        loadPage(false);
      };
      if('IntersectionObserver' in window){
        loadObserver=new IntersectionObserver(function(entries){
          if(entries.some(function(entry){return entry.isIntersecting;}))loadNext();
        },{root:null,rootMargin:'700px 0px',threshold:0});
        loadObserver.observe(target);
        return;
      }
      var onScroll=function(){if(target.getBoundingClientRect().top<=window.innerHeight+700)loadNext();};
      window.addEventListener('scroll',onScroll,{passive:true});
      loadObserver={disconnect:function(){window.removeEventListener('scroll',onScroll);}};
      setTimeout(onScroll,0);
    }

    function render(){
      stopWatchingMore();
      list.innerHTML='';
      status.hidden=true;
      status.textContent='';
      var arr=state.places.slice();
      var localityLabel=state.userLocality||state.userRegion||'';
      guideTitle.textContent=localityLabel?(category+' quanh '+localityLabel):(category+' gần bạn');
      guideDesc.textContent=localityLabel
        ? ('Khám phá '+category+' quanh '+localityLabel+'. Dữ liệu do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị.')
        : 'Danh sách do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị.';
      var nearestDistance=Number.POSITIVE_INFINITY;

      arr.forEach(function(p,index){
        p._guideOrder=index;
      });

      if(state.userPos){
        arr.forEach(function(p){
          if(isFinite(p.lat)&&isFinite(p.lng))p._distance=haversine(state.userPos.lat,state.userPos.lng,p.lat,p.lng);
          else p._distance=Infinity;
        });
        arr=arr.filter(function(p){return isFinite(p._distance)&&p._distance<=GUIDE_RADIUS_KM;});
        arr.forEach(function(p){if(p._distance<nearestDistance)nearestDistance=p._distance;});
      }
      arr.sort(function(a,b){
          var topA=topInfo(a,state.userPos,localityLabel),topB=topInfo(b,state.userPos,localityLabel);
          var rankA=topA?topA.rank:Number.POSITIVE_INFINITY,rankB=topB?topB.rank:Number.POSITIVE_INFINITY;
          if(rankA!==rankB)return rankA-rankB;
          if(state.userPos){
          var da=isFinite(a._distance)?a._distance:Number.POSITIVE_INFINITY;
          var db=isFinite(b._distance)?b._distance:Number.POSITIVE_INFINITY;
          if(da!==db)return da-db;
          }
          if(a._guideOrder!==b._guideOrder)return a._guideOrder-b._guideOrder;
          return safe(a.name).localeCompare(safe(b.name),'vi');
        });

      if(!arr.length){
        list.appendChild(el('div','vlc-empty',localityLabel?('Chưa có địa điểm phù hợp quanh '+localityLabel+'.'):'Chưa có địa điểm phù hợp trong khu vực hiện tại.'));
        return;
      }

      arr.forEach(function(p){
        var placeStatus=statusFromPlace(p);
        var statusClass=placeStatus==='TEMP_CLOSED'?' is-temp-closed':(placeStatus==='PERM_CLOSED'?' is-perm-closed':'');
        var placeTop=topInfo(p,state.userPos,localityLabel);
        var card=el('article','vlc-place'+(state.userPos&&isFinite(p._distance)&&p._distance===nearestDistance?' is-nearest':'')+statusClass);
        card.appendChild(el('span','vlc-nearest-badge',localityLabel?('Gần nhất quanh '+localityLabel):'Gần bạn nhất'));
        if(placeStatus==='TEMP_CLOSED')card.appendChild(el('div','vlc-closure-ribbon','Tạm thời đóng cửa'));
        if(placeStatus==='PERM_CLOSED')card.appendChild(el('div','vlc-closure-ribbon','Đã đóng vĩnh viễn'));

        if(placeTop||p.is_trusted||p.is_hot){
          var badges=el('div','vlc-place-badges');
          if(placeTop)badges.appendChild(el('span','vlc-admin-badge is-top','\u2605 '+placeTop.label));
          if(p.is_trusted)badges.appendChild(el('span','vlc-admin-badge is-trusted','\u2713 Uy tín'));
          if(p.is_hot)badges.appendChild(el('span','vlc-admin-badge is-hot','\u25CF Đang hot'));
          card.appendChild(badges);
        }

        var titleRow=el('div','vlc-place-title-row');
        titleRow.appendChild(el('h3','vlc-place-name',p.name||'Địa điểm'));
        card.appendChild(titleRow);

        if(p.address)card.appendChild(el('p','vlc-place-address',p.address));

        var meta=el('div','vlc-place-meta');
        if(state.userPos&&isFinite(p._distance))meta.appendChild(el('span','vlc-chip vlc-chip-distance',distanceText(p._distance)));
        var verifyState=verificationState(p);
        if(verifyState)meta.appendChild(el('span','vlc-chip '+(verifyState==='TRUE'?'vlc-chip-verified':'vlc-chip-unverified'),verifyState==='TRUE'?'Đã xác minh':'Chưa xác minh'));
        if(p.price)meta.appendChild(el('span','vlc-chip',p.price));
        if(p.hours)meta.appendChild(el('span','vlc-chip',p.hours));
        if(meta.childNodes.length)card.appendChild(meta);

        var cleanNote=stripStatusMarker(p.note);
        if(cleanNote)card.appendChild(el('p','vlc-place-note',cleanNote));
        var sourceRow=placeSourceNode(p);
        if(sourceRow)card.appendChild(sourceRow);

        var pa=el('div','vlc-place-actions');
        var dir=el('a','vlc-btn vlc-btn-primary','Chỉ đường');
        dir.href=directionsUrl(p,state.userPos);dir.target='_blank';dir.rel='noopener';
        pa.appendChild(dir);
        if(p.phone){
          var tel=el('a','vlc-btn vlc-btn-soft','Gọi quán');
          tel.href='tel:'+p.phone.replace(/[^\d+]/g,'');
          pa.appendChild(tel);
        }
        if(p.business_url){
          var web=el('a','vlc-btn vlc-btn-soft','Website');
          web.href=websiteUrl(p.business_url);web.target='_blank';web.rel='noopener noreferrer';
          pa.appendChild(web);
        }
        var edit=el('button','vlc-btn vlc-btn-soft','Cập nhật thông tin');
        edit.type='button';
        edit.addEventListener('click',function(){openForm('update',p);});
        pa.appendChild(edit);
        var rate=el('button','vlc-btn vlc-btn-soft',ratingText(p));
        rate.type='button';
        rate.addEventListener('click',function(){openRating(p);});
        pa.appendChild(rate);
        card.appendChild(pa);
        list.appendChild(card);
      });
      if(state.hasMore){
        var sentinel=el('div','vlc-load-sentinel');
        sentinel.setAttribute('aria-hidden','true');
        list.appendChild(sentinel);watchForMore(sentinel);
      }
    }

    function loadCategories(callback){
      if(!VLC_API_URL || VLC_API_URL.indexOf('DAN_URL_')===0){
        if(callback)callback();
        return;
      }

      jsonp(VLC_API_URL+'?action=categoryCatalog',function(err,data){
        if(!err && data && data.ok && Array.isArray(data.categories)){
          state.categoryCatalog=data.categories.slice();
          state.categories=data.categories
            .filter(function(v){return v&&!v.is_parent;})
            .map(function(v){return safe(v.name_vi||v.name);})
            .filter(function(v){return !!v;});
          try{localStorage.setItem(CATEGORY_CATALOG_CACHE_KEY,JSON.stringify(state.categoryCatalog.slice(0,400)));}catch(e){}
        }
        if(callback)callback();
      });
    }

    function loadPage(reset){
      if(!VLC_API_URL || VLC_API_URL.indexOf('DAN_URL_')===0){
        status.hidden=false;
        status.textContent='Chưa kết nối API dữ liệu. Quản trị viên cần cấu hình TL_DATA_API_URL.';
        list.innerHTML='';
        list.appendChild(el('div','vlc-empty','Phần giao diện đã sẵn sàng. Sau khi kết nối API, các địa điểm đã duyệt sẽ tự hiển thị tại đây.'));
        return;
      }
      if(state.loading)return;
      if(reset){state.places=[];state.nextOffset=0;state.hasMore=true;stopWatchingMore();}
      if(!state.hasMore)return;
      state.loading=true;
      var pageSize=guideBatchSize();
      var offset=state.nextOffset;
      if(reset){status.hidden=false;status.textContent='Đang tải địa điểm phù hợp...';}
      var listUrl=VLC_API_URL+'?action=list&category='+encodeURIComponent(category)+'&limit='+encodeURIComponent(pageSize)+'&offset='+encodeURIComponent(offset);
      if(state.userPos&&isFinite(Number(state.userPos.lat))&&isFinite(Number(state.userPos.lng))){
        listUrl+='&lat='+encodeURIComponent(Number(state.userPos.lat))+'&lng='+encodeURIComponent(Number(state.userPos.lng))+'&radius_km='+encodeURIComponent(GUIDE_RADIUS_KM);
      }else if(state.userRegion){listUrl+='&province='+encodeURIComponent(state.userRegion);}
      jsonp(listUrl,function(err,data){
        state.loading=false;
        if(err||!data||!data.ok){
          if(reset){
            status.hidden=false;
            status.textContent='Tạm thời chưa tải được dữ liệu.';
            list.innerHTML='';
            list.appendChild(el('div','vlc-empty','Không thể tải danh sách lúc này. Vui lòng thử lại sau.'));
          }else{state.hasMore=false;render();}
          return;
        }
        var incoming=(data.places||[]).map(function(p){p.lat=Number(p.lat);p.lng=Number(p.lng);return p;});
        var seen={};state.places.forEach(function(p){if(p&&p.id)seen[p.id]=true;});
        incoming.forEach(function(p){if(!p||!p.id||!seen[p.id]){state.places.push(p);if(p&&p.id)seen[p.id]=true;}});
        state.nextOffset=offset+incoming.length;
        state.hasMore=incoming.length===pageSize;
        render();
      });
    }

    function load(){loadPage(true);}

    function getBestPosition(done,fail){
      if(!navigator.geolocation){fail();return;}

      var best=null;
      var watchId=null;
      var finished=false;
      var timer=null;

      function finish(){
        if(finished)return;
        finished=true;
        if(timer)clearTimeout(timer);
        if(watchId!==null){
          try{navigator.geolocation.clearWatch(watchId);}catch(e){}
        }
        if(best)done(best);
        else fail();
      }

      watchId=navigator.geolocation.watchPosition(function(pos){
        var acc=Number(pos.coords.accuracy);
        if(!best || (isFinite(acc) && acc<Number(best.coords.accuracy))){
          best=pos;
        }

        /* Nếu đã đạt sai số khoảng 50 m trở xuống thì dùng ngay. */
        if(isFinite(acc) && acc<=50)finish();
      },function(){
        /* Chờ timer: đôi khi lần đọc sau vẫn tốt hơn lần đầu. */
      },{
        enableHighAccuracy:true,
        timeout:12000,
        maximumAge:0
      });

      /* Cho thiết bị tối đa 8 giây để cải thiện vị trí rồi lấy bản tốt nhất. */
      timer=setTimeout(finish,8000);
    }

    nearBtn.addEventListener('click',function(){
      if(!navigator.geolocation){
        status.hidden=false;
        status.textContent='Trình duyệt này không hỗ trợ xác định vị trí.';
        return;
      }

      nearBtn.disabled=true;
      nearBtn.textContent='Đang lấy vị trí chính xác...';
      status.hidden=false;
      status.textContent='Đang cập nhật vị trí...';

      getBestPosition(function(pos){
        var saved=savePosition(pos);
        state.userPos={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude)};
        state.userAccuracy=Number(pos.coords.accuracy)||null;
        if(saved)state.userPos={lat:saved.lat,lng:saved.lng};
          nearBtn.disabled=false;
        nearBtn.textContent='Cập nhật vị trí của tôi';
        render();
      },function(){
        nearBtn.disabled=false;
        nearBtn.textContent=state.userPos?'Cập nhật vị trí của tôi':'Xác định vị trí';
        status.hidden=false;
        status.textContent='Không lấy được vị trí. Vui lòng kiểm tra quyền vị trí và thử lại.';
      });
    });

    document.addEventListener('tl:locationchange',function(ev){
      var p=ev&&ev.detail;
      if(!p||!isFinite(Number(p.lat))||!isFinite(Number(p.lng)))return;
      state.userPos={lat:Number(p.lat),lng:Number(p.lng)};
      state.userAccuracy=Number(p.accuracy)||null;
      state.userLocality=safe(p.locality);
      state.userRegion=safe(p.region);
      nearBtn.textContent='Cập nhật vị trí của tôi';
      load();
    });

    addBtn.addEventListener('click',function(){openForm('add',null);});

    function openRating(place){
      var old=document.getElementById('vlcGuideModal');
      if(old)old.remove();
      if(!place||!safe(place.id))return;

      var modal=el('div','vlc-modal is-open');modal.id='vlcGuideModal';
      var card=el('div','vlc-modal-card');
      var head=el('div','vlc-modal-head');
      head.appendChild(el('h3','','Đánh giá '+safe(place.name)));
      var close=el('button','vlc-close','Đóng');close.type='button';head.appendChild(close);

      var form=el('form','vlc-form');form.method='post';form.target='vlcRatingFrame';
      if(VLC_API_URL&&VLC_API_URL.indexOf('DAN_URL_')!==0)form.action=VLC_API_URL;
      var summary=el('p','vlc-rating-summary',Number(place.rating_count)?('Đánh giá hiện tại: '+(Math.round(Number(place.rating_average)*10)/10)+' \u2605 / '+Number(place.rating_count)+' người'):'Địa điểm này chưa có đánh giá.');
      form.appendChild(summary);
      form.appendChild(el('div','vlc-form-note','Chọn từ 1 đến 5 sao. Mỗi thiết bị có thể cập nhật lại đánh giá của mình.'));

      var stars=el('div','vlc-rating-stars');
      var selected=0;
      [1,2,3,4,5].forEach(function(value){
        var star=el('button','vlc-rating-star','\u2605');star.type='button';star.setAttribute('aria-label',value+' sao');
        star.addEventListener('click',function(){
          selected=value;ratingInput.value=value;
          Array.prototype.forEach.call(stars.children,function(node,index){node.classList.toggle('is-selected',index<value);});
        });
        stars.appendChild(star);
      });
      form.appendChild(stars);

      function hidden(name,value){var input=el('input','');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);return input;}
      hidden('submit_type','rating');
      hidden('place_id',safe(place.id));
      hidden('reviewer_key',ratingReviewerKey());
      var ratingInput=hidden('rating','');
      var success=el('div','vlc-form-success','Cảm ơn bạn. Đánh giá đã được ghi nhận.');form.appendChild(success);
      var submit=el('button','vlc-btn vlc-btn-primary','Gửi đánh giá');submit.type='submit';form.appendChild(submit);
      var iframe=el('iframe','vlc-hp');iframe.name='vlcRatingFrame';iframe.title='Gửi đánh giá';form.appendChild(iframe);

      form.addEventListener('submit',function(ev){
        if(!selected){ev.preventDefault();alert('Vui lòng chọn từ 1 đến 5 sao.');return;}
        if(!VLC_API_URL||VLC_API_URL.indexOf('DAN_URL_')===0){ev.preventDefault();alert('Quản trị viên chưa kết nối API dữ liệu.');return;}
        submit.disabled=true;submit.textContent='Đang gửi...';
        setTimeout(function(){
          jsonp(VLC_API_URL+'?action=ratingSummary&place_id='+encodeURIComponent(place.id),function(err,data){
            var result=!err&&data&&data.ok&&data.rating?data.rating:null;
            if(result){
              place.rating_average=Number(result.average)||0;place.rating_count=Number(result.count)||0;render();
              try{document.dispatchEvent(new CustomEvent('tl:ratingchange',{detail:{place_id:place.id,average:place.rating_average,count:place.rating_count}}));}catch(e){}
            }
            success.classList.add('is-show');submit.textContent='Đã gửi';
          });
        },900);
      });

      function closeModal(){document.removeEventListener('keydown',onKey);modal.remove();document.documentElement.classList.remove('vlc-modal-open');document.body.classList.remove('vlc-modal-open');}
      function onKey(e){if(e.key==='Escape')closeModal();}
      close.addEventListener('click',closeModal);
      modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
      document.addEventListener('keydown',onKey);
      card.appendChild(head);card.appendChild(form);modal.appendChild(card);document.body.appendChild(modal);
      document.documentElement.classList.add('vlc-modal-open');document.body.classList.add('vlc-modal-open');
    }

    function openForm(type,place){
      var old=document.getElementById('vlcGuideModal');
      if(old)old.remove();

      var modal=el('div','vlc-modal');modal.id='vlcGuideModal';
      var card=el('div','vlc-modal-card');
      var head=el('div','vlc-modal-head');
      head.appendChild(el('h3','',type==='update'?'Cập nhật thông tin địa điểm':'Đề xuất địa điểm'));
      var close=el('button','vlc-close','Đóng');
      close.type='button';
      close.setAttribute('aria-label','Đóng cửa sổ đề xuất');
      head.appendChild(close);

      var form=el('form','vlc-form');
      form.method='post';form.target='vlcSubmitFrame';
      if(VLC_API_URL && VLC_API_URL.indexOf('DAN_URL_')!==0)form.action=VLC_API_URL;

      var success=el('div','vlc-form-success','Đã gửi thông tin. THIS LOCAL sẽ kiểm tra trước khi công khai.');
      form.appendChild(success);

      var note=el('div','vlc-form-note');
      note.innerHTML='Các trường có <span class="vlc-required-star">*</span> là bắt buộc. Thông tin bạn gửi không xuất hiện ngay; quản trị viên sẽ kiểm tra trước khi duyệt.';
      form.appendChild(note);

      function inputField(label,name,value,required,typeAttr){
        var w=el('div','vlc-field');
        var l=el('label','',label);l.htmlFor='vlc_'+name;

        if(required){
          var star=el('span','vlc-required-star','*');
          star.setAttribute('aria-hidden','true');
          l.appendChild(star);
        }

        var inp=el('input','');inp.id='vlc_'+name;inp.name=name;inp.type=typeAttr||'text';inp.value=value||'';
        if(required){
          inp.required=true;
          inp.setAttribute('aria-required','true');
        }

        w.appendChild(l);w.appendChild(inp);return w;
      }

      function addHelp(field,text){
        field.appendChild(el('div','vlc-field-help',text));
      }

      function addError(field,text){
        var msg=el('div','vlc-field-error',text);
        field.appendChild(msg);
        return msg;
      }

      function normalizeVNPhone(value){
        var digits=String(value||'').replace(/\D/g,'');
        if(digits.length===11 && digits.indexOf('84')===0){
          digits='0'+digits.slice(2);
        }
        if(digits.length===10 && digits.charAt(0)==='0')return digits;
        return '';
      }

      function formatVNPhone(digits){
        digits=String(digits||'').replace(/\D/g,'').slice(0,10);
        if(digits.length<=4)return digits;
        if(digits.length<=7)return digits.slice(0,4)+' '+digits.slice(4);
        return digits.slice(0,4)+' '+digits.slice(4,7)+' '+digits.slice(7,10);
      }

      function digitsOnly(value){
        return String(value||'').replace(/\D/g,'');
      }

      function formatMoney(value){
        var digits=digitsOnly(value).replace(/^0+(?=\d)/,'');
        if(!digits)return '';
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
      }

      function parseHours(hours){
        var out={open:'',close:''};
        var m=String(hours||'').match(/(\d{1,2})\s*[h:]\s*(\d{2})\s*-\s*(\d{1,2})\s*[h:]\s*(\d{2})/i);
        if(m){
          out.open=String(m[1]).padStart(2,'0')+':'+m[2];
          out.close=String(m[3]).padStart(2,'0')+':'+m[4];
        }
        return out;
      }

      function parsePrice(price){
        var nums=String(price||'').match(/[\d.]+/g)||[];
        return {
          min:nums[0]?digitsOnly(nums[0]):'',
          max:nums[1]?digitsOnly(nums[1]):''
        };
      }

      function toDisplayHours(openTime,closeTime){
        if(!openTime && !closeTime)return '';
        function one(v){
          var p=String(v||'').split(':');
          if(p.length!==2)return '';
          return p[0].padStart(2,'0')+'h'+p[1].padStart(2,'0');
        }
        var a=one(openTime),b=one(closeTime);
        if(a && b)return a+' - '+b;
        return a||b;
      }

      function toDisplayPrice(minValue,maxValue){
        var a=formatMoney(minValue),b=formatMoney(maxValue);
        if(a && b)return a+' - '+b+' VNĐ';
        if(a)return 'Từ '+a+' VNĐ';
        if(b)return 'Đến '+b+' VNĐ';
        return '';
      }

      /* DANH MỤC CHA -> CATEGORY CON. Cả hai cấp đều cho phép thêm mới. */
      function normName(v){
        v=safe(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
        try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return v;}
      }
      function uniqueNames(values){
        var seen={},out=[];
        (values||[]).forEach(function(v){v=safe(v);var k=normName(v);if(!v||seen[k])return;seen[k]=1;out.push(v);});
        return out;
      }
      function inferParentForCategory(value){
        var found=(state.categoryCatalog||[]).filter(function(item){
          return normName(item&&(item.name_vi||item.name))===normName(value)&&safe(item.parent_name);
        })[0];
        if(found)return safe(found.parent_name);
        return'';
      }

      function makeSearchableSelect(select,config){
        if(!select||select.__vlcSearchReady)return;
        select.__vlcSearchReady=true;
        config=config||{};

        var box=el('div','vlc-search-select');
        var search=el('input','vlc-select-search-input');
        search.type='text';search.autocomplete='off';search.spellcheck=false;
        search.placeholder=config.placeholder||'Tìm kiếm...';
        search.setAttribute('role','combobox');search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-expanded','false');

        var menu=el('div','vlc-select-menu');menu.hidden=true;menu.setAttribute('role','listbox');
        var first=el('button','vlc-select-option vlc-select-fixed');first.type='button';
        var results=el('div','vlc-select-results');
        var add=el('button','vlc-select-option vlc-select-add');add.type='button';
        menu.appendChild(first);menu.appendChild(results);menu.appendChild(add);

        select.parentNode.insertBefore(box,select);
        box.appendChild(search);box.appendChild(menu);box.appendChild(select);
        select.classList.add('vlc-native-search-select');select.tabIndex=-1;

        function options(){return Array.prototype.slice.call(select.options||[]);}
        function choose(value){
          select.value=value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          syncLabel();closeMenu();
        }
        function optionButton(option){
          var button=el('button','vlc-select-option',option.textContent);button.type='button';button.setAttribute('role','option');
          button.classList.toggle('is-selected',select.value===option.value);
          button.addEventListener('click',function(){choose(option.value);});
          return button;
        }
        function render(){
          var all=options(),blank=all[0]||null,addOption=all.filter(function(o){return /^__VLC_NEW_/.test(o.value);})[0]||all[all.length-1]||null;
          first.textContent=blank?blank.textContent:(config.blankLabel||'Chọn');
          first.onclick=function(){choose(blank?blank.value:'');};
          add.textContent=addOption?addOption.textContent:(config.addLabel||'+ Thêm mới');
          add.onclick=function(){if(addOption)choose(addOption.value);};
          var query=normName(search.value);
          var current=safe(select.value);
          results.innerHTML='';
          all.filter(function(option){
            if(option===blank||option===addOption)return false;
            if(!query)return true;
            return normName(option.textContent).indexOf(query)>-1||option.value===current;
          }).forEach(function(option){results.appendChild(optionButton(option));});
          if(!results.children.length)results.appendChild(el('div','vlc-select-empty','Không tìm thấy lựa chọn phù hợp'));
        }
        function openMenu(){render();menu.hidden=false;search.setAttribute('aria-expanded','true');box.classList.add('is-open');}
        function closeMenu(){menu.hidden=true;search.setAttribute('aria-expanded','false');box.classList.remove('is-open');syncLabel();}
        function syncLabel(){
          var selected=options().filter(function(o){return o.value===select.value;})[0];
          search.value=selected&&select.value&&!/^__VLC_NEW_/.test(select.value)?selected.textContent:'';
          search.classList.toggle('is-selected',!!search.value);
        }
        search.addEventListener('focus',function(){if(search.classList.contains('is-selected'))search.value='';openMenu();});
        search.addEventListener('click',openMenu);
        search.addEventListener('input',openMenu);
        search.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();search.blur();}});
        document.addEventListener('click',function(e){if(!box.contains(e.target))closeMenu();});
        select.addEventListener('change',syncLabel);
        select.__vlcSearchRefresh=function(){syncLabel();if(!menu.hidden)render();};
        select.__vlcSearchInput=search;
        syncLabel();
      }

      var selectedParent=parentCategory||inferParentForCategory(category);
      var parentCategoryHidden=el('input','');
      parentCategoryHidden.type='hidden';
      parentCategoryHidden.name='parent_category';
      parentCategoryHidden.value=selectedParent;

      var parentCategoryField=el('div','vlc-field vlc-parent-category-field');
      parentCategoryField.appendChild(el('label','','Danh mục'));
      var parentCategorySelect=el('select','');
      parentCategorySelect.id='vlc_parent_category_select';
      parentCategorySelect.setAttribute('aria-required','true');
      parentCategoryField.appendChild(parentCategorySelect);
      var parentError=addError(parentCategoryField,'Hãy chọn Danh mục hoặc thêm Danh mục mới.');

      var newParentWrap=el('div','vlc-field vlc-new-category-field');
      newParentWrap.style.display='none';
      var newParentLabel=el('label','','Tên Danh mục mới');
      var newParentStar=el('span','vlc-required-star','*');newParentStar.setAttribute('aria-hidden','true');newParentLabel.appendChild(newParentStar);
      var newParentInput=el('input','');newParentInput.type='text';newParentInput.placeholder='Ví dụ: Sức khỏe';newParentInput.autocomplete='off';
      newParentWrap.appendChild(newParentLabel);newParentWrap.appendChild(newParentInput);
      addHelp(newParentWrap,'Chỉ thêm khi chưa có Danh mục phù hợp.');

      var categoryField=el('div','vlc-field');
      var categoryLabel=el('label','','Category trong Danh mục');
      var categoryStar=el('span','vlc-required-star','*');
      categoryStar.setAttribute('aria-hidden','true');
      categoryLabel.appendChild(categoryStar);

      var categorySelect=el('select','');
      categorySelect.id='vlc_category_select';
      categorySelect.setAttribute('aria-required','true');

      var categoryHidden=el('input','');
      categoryHidden.type='hidden';
      categoryHidden.name='category';

      var newCategoryWrap=el('div','vlc-field vlc-new-category-field');
      newCategoryWrap.style.display='none';

      var newCategoryLabel=el('label','','Tên Category mới');
      var newCategoryStar=el('span','vlc-required-star','*');
      newCategoryStar.setAttribute('aria-hidden','true');
      newCategoryLabel.appendChild(newCategoryStar);

      var newCategoryInput=el('input','');
      newCategoryInput.type='text';
      newCategoryInput.placeholder='Ví dụ: Bánh cuốn';
      newCategoryInput.autocomplete='off';

      newCategoryWrap.appendChild(newCategoryLabel);
      newCategoryWrap.appendChild(newCategoryInput);
      addHelp(newCategoryWrap,'Nhập tên Category mới ngắn gọn, dễ hiểu.');

      var categoryError=addError(categoryField,'Category là bắt buộc. Hãy chọn Category hoặc thêm Category mới.');
      var newCategoryError=addError(newCategoryWrap,'Hãy nhập tên Category mới.');

      categoryField.appendChild(categoryLabel);
      categoryField.appendChild(categorySelect);
      addHelp(categoryField,'Chọn Category có sẵn; nếu chưa có, chọn “Thêm Category mới”.');
      categoryField.appendChild(categoryError);

      function parentValues(){
        var values=[];
        (state.categoryCatalog||[]).forEach(function(item){
          if(item&&(item.is_parent||!safe(item.parent_id)))values.push(item.name_vi||item.name);
        });
        if(selectedParent)values.unshift(selectedParent);
        return uniqueNames(values);
      }

      function childValues(){
        if(parentCategory&&allowedCategories.length&&normName(selectedParent)===normName(parentCategory))return uniqueNames(allowedCategories);
        var values=[];
        if(selectedParent){
          (state.categoryCatalog||[]).forEach(function(item){
            if(item&&normName(item.parent_name)===normName(selectedParent))values.push(item.name_vi||item.name);
          });
        }else{
          values=values.concat(state.categories||[]);
        }
        return uniqueNames(values);
      }

      function fillParentSelect(){
        var previous=parentCategorySelect.value;
        parentCategorySelect.innerHTML='';
        var blank=document.createElement('option');blank.value='';blank.textContent='Chọn Danh mục';parentCategorySelect.appendChild(blank);
        parentValues().forEach(function(v){var opt=document.createElement('option');opt.value=v;opt.textContent=v;parentCategorySelect.appendChild(opt);});
        var add=document.createElement('option');add.value='__VLC_NEW_PARENT__';add.textContent='+ Thêm Danh mục mới';parentCategorySelect.appendChild(add);
        if(previous&&Array.prototype.some.call(parentCategorySelect.options,function(o){return o.value===previous;}))parentCategorySelect.value=previous;
        else if(selectedParent)parentCategorySelect.value=selectedParent;
        else parentCategorySelect.value='';
        if(parentCategorySelect.__vlcSearchRefresh)parentCategorySelect.__vlcSearchRefresh();
      }

      function updateParentChoice(resetCategory){
        var isNew=parentCategorySelect.value==='__VLC_NEW_PARENT__';
        if(newParentWrap)newParentWrap.style.display=isNew?'grid':'none';
        selectedParent=isNew?safe(newParentInput&&newParentInput.value):safe(parentCategorySelect.value);
        parentCategoryHidden.value=selectedParent;
        if(resetCategory)category='';
        if(selectedParent&&parentError){parentCategorySelect.classList.remove('is-invalid');parentError.classList.remove('is-show');}
      }

      function fillCategorySelect(){
        var current=safe(category);
        var previous=categorySelect.value;
        categorySelect.innerHTML='';

        var blank=document.createElement('option');
        blank.value='';
        blank.textContent='Chọn Category';
        categorySelect.appendChild(blank);

        var seen={};
        var values=childValues();

        if(current && values.indexOf(current)===-1)values.unshift(current);

        values.forEach(function(v){
          v=safe(v);
          if(!v)return;
          var key=v.toLocaleLowerCase('vi-VN');
          if(seen[key])return;
          seen[key]=true;

          var opt=document.createElement('option');
          opt.value=v;
          opt.textContent=v;
          categorySelect.appendChild(opt);
        });

        var addNew=document.createElement('option');
        addNew.value='__VLC_NEW_CATEGORY__';
        addNew.textContent='+ Thêm Category mới';
        categorySelect.appendChild(addNew);

        if(previous && Array.prototype.some.call(categorySelect.options,function(o){return o.value===previous;})){
          categorySelect.value=previous;
        }else if(current){
          categorySelect.value=current;
        }else{
          categorySelect.value='';
        }

        updateCategoryChoice();
        if(categorySelect.__vlcSearchRefresh)categorySelect.__vlcSearchRefresh();
      }

      function updateCategoryChoice(){
        var selected=categorySelect.value;
        var isNew=selected==='__VLC_NEW_CATEGORY__';

        newCategoryWrap.style.display=isNew?'grid':'none';

        if(isNew){
          categoryHidden.value=safe(newCategoryInput.value);
          newCategoryInput.setAttribute('aria-required','true');
        }else{
          categoryHidden.value=safe(selected);
          newCategoryInput.removeAttribute('aria-required');
          newCategoryInput.classList.remove('is-invalid');
          newCategoryError.classList.remove('is-show');
        }

        if(categoryHidden.value){
          categorySelect.classList.remove('is-invalid');
          categoryError.classList.remove('is-show');
        }
      }

      categorySelect.addEventListener('change',function(){
        updateCategoryChoice();
        if(categorySelect.value==='__VLC_NEW_CATEGORY__'){
          setTimeout(function(){newCategoryInput.focus();},0);
        }
      });

      parentCategorySelect.addEventListener('change',function(){
        updateParentChoice(true);
        fillCategorySelect();
        if(parentCategorySelect.value==='__VLC_NEW_PARENT__')setTimeout(function(){newParentInput.focus();},0);
      });
      newParentInput.addEventListener('input',function(){
        updateParentChoice(false);
        if(selectedParent&&parentError){parentCategorySelect.classList.remove('is-invalid');parentError.classList.remove('is-show');}
      });

      newCategoryInput.addEventListener('input',function(){
        categoryHidden.value=safe(newCategoryInput.value);
        if(categoryHidden.value){
          newCategoryInput.classList.remove('is-invalid');
          newCategoryError.classList.remove('is-show');
          categoryError.classList.remove('is-show');
        }
      });

      fillParentSelect();
      updateParentChoice(false);
      fillCategorySelect();
      makeSearchableSelect(parentCategorySelect,{placeholder:'Tìm Danh mục...',blankLabel:'Chọn Danh mục',addLabel:'+ Thêm Danh mục mới'});
      makeSearchableSelect(categorySelect,{placeholder:'Tìm Category...',blankLabel:'Chọn Category',addLabel:'+ Thêm Category mới'});
      form.appendChild(parentCategoryField);
      form.appendChild(newParentWrap);
      form.appendChild(categoryField);
      form.appendChild(newCategoryWrap);
      form.appendChild(categoryHidden);

      form.appendChild(parentCategoryHidden);

      root.addEventListener('tl:categoriesready',function(){
        var inferred=selectedParent||inferParentForCategory(category);
        if(inferred&&!selectedParent){selectedParent=inferred;parentCategoryHidden.value=inferred;}
        fillParentSelect();updateParentChoice(false);fillCategorySelect();
      },{once:true});

      var grid=el('div','vlc-grid vlc-grid-contact');
      grid.appendChild(inputField('Tên địa điểm','name',place&&place.name,true));

      var phoneField=inputField('Số điện thoại','phone_display','',true,'tel');
      var phoneInput=phoneField.querySelector('input');
      phoneInput.inputMode='tel';
      phoneInput.autocomplete='tel';
      phoneInput.placeholder='0986 123 456';
      var existingPhone=normalizeVNPhone(place&&place.phone);
      phoneInput.value=existingPhone?formatVNPhone(existingPhone):(place&&place.phone||'');
      addHelp(phoneField,'Bắt buộc. Có thể nhập liền, có khoảng trắng, dấu chấm, dấu gạch hoặc +84.');
      var phoneError=addError(phoneField,'Số điện thoại là bắt buộc và phải hợp lệ, ví dụ 0986 123 456.');
      grid.appendChild(phoneField);
      form.appendChild(grid);

      var hiddenPhone=el('input','');
      hiddenPhone.type='hidden';
      hiddenPhone.name='phone';
      hiddenPhone.value=existingPhone?formatVNPhone(existingPhone):'';
      form.appendChild(hiddenPhone);

      var addressField=inputField('Địa chỉ','address',place&&place.address,true);
      var addressInput=addressField.querySelector('input');
      addressInput.autocomplete='street-address';
      addressInput.placeholder='Số nhà, đường/phố, phường/xã, tỉnh/thành';
      addHelp(addressField,'Bắt buộc. Nhập địa chỉ đủ để người khác có thể tìm tới địa điểm.');
      form.appendChild(addressField);

      var areaGrid=el('div','vlc-grid');
      var provinceField=inputField('Tỉnh/thành','province',place&&place.province,false);
      var localityField=inputField('Khu vực','locality',place&&place.locality,false);
      var provinceInput=provinceField.querySelector('input');
      var localityInput=localityField.querySelector('input');
      provinceInput.placeholder='Ví dụ: Lào Cai';
      localityInput.placeholder='Ví dụ: Phường Lào Cai, Sa Pa...';
      addHelp(provinceField,'Dùng để xác định TOP khu vực. Có thể để trống nếu chưa rõ.');
      addHelp(localityField,'Khu vực nhỏ hơn tỉnh/thành, ví dụ phường, xã, thị trấn hoặc thành phố.');
      areaGrid.appendChild(provinceField);
      areaGrid.appendChild(localityField);
      form.appendChild(areaGrid);

      form.appendChild(inputField('Link Google Maps','map_url',place&&place.map_url,false,'url'));
      var websiteField=inputField('Website','business_url',place&&place.business_url,false,'text');
      websiteField.querySelector('input').placeholder='Ví dụ: thislocal.vn';
      addHelp(websiteField,'Có thể nhập có hoặc không có https://.');
      form.appendChild(websiteField);

      var existingHours=parseHours(place&&place.hours);
      existingHours.open=safe(place&&place.open_time)||existingHours.open;
      existingHours.close=safe(place&&place.close_time)||existingHours.close;
      var grid2=el('div','vlc-grid');
      var openField=inputField('Giờ mở cửa (24h)','open_time',existingHours.open,false,'text');
      var closeField=inputField('Giờ đóng cửa (24h)','close_time',existingHours.close,false,'text');
      var openTimeInput=openField.querySelector('input'),closeTimeInput=closeField.querySelector('input');
      [openTimeInput,closeTimeInput].forEach(function(inp){inp.inputMode='numeric';inp.placeholder=inp===openTimeInput?'06:30':'22:00';inp.maxLength=5;});
      addHelp(openField,'Nhập dạng 24 giờ HH:mm, ví dụ 06:30.');
      addHelp(closeField,'Nhập dạng 24 giờ HH:mm, ví dụ 22:00. Không dùng SA/CH.');
      var openTimeError=addError(openField,'Giờ phải theo dạng HH:mm, ví dụ 06:30.');
      var closeTimeError=addError(closeField,'Giờ phải theo dạng HH:mm, ví dụ 22:00.');
      function formatTimeTyping(v){var d=String(v||'').replace(/\D/g,'').slice(0,4);return d.length>2?d.slice(0,2)+':'+d.slice(2):d;}
      function valid24Time(v){if(!safe(v))return true;var m=safe(v).match(/^(\d{2}):(\d{2})$/);return !!(m&&Number(m[1])<=23&&Number(m[2])<=59);}
      [[openTimeInput,openTimeError],[closeTimeInput,closeTimeError]].forEach(function(pair){pair[0].addEventListener('input',function(){pair[0].value=formatTimeTyping(pair[0].value);pair[0].classList.remove('is-invalid');pair[1].classList.remove('is-show');});});
      grid2.appendChild(openField);
      grid2.appendChild(closeField);
      form.appendChild(grid2);

      var hiddenHours=el('input','');
      hiddenHours.type='hidden';
      hiddenHours.name='hours';
      hiddenHours.value=toDisplayHours(existingHours.open,existingHours.close);
      form.appendChild(hiddenHours);

      var existingPrice=parsePrice(place&&place.price);
      existingPrice.min=digitsOnly(place&&place.price_min)||existingPrice.min;
      existingPrice.max=digitsOnly(place&&place.price_max)||existingPrice.max;
      var gridPrice=el('div','vlc-grid');

      var minPriceField=inputField('Giá từ','price_min',formatMoney(existingPrice.min),false,'text');
      minPriceField.classList.add('vlc-inline-unit');
      var minPriceInput=minPriceField.querySelector('input');
      minPriceInput.inputMode='numeric';
      minPriceInput.placeholder='30.000';

      var maxPriceField=inputField('Giá đến','price_max',formatMoney(existingPrice.max),false,'text');
      maxPriceField.classList.add('vlc-inline-unit');
      var maxPriceInput=maxPriceField.querySelector('input');
      maxPriceInput.inputMode='numeric';
      maxPriceInput.placeholder='100.000';

      addHelp(minPriceField,'Tự thêm dấu chấm phân cách hàng nghìn.');
      addHelp(maxPriceField,'Ví dụ: 30.000 - 100.000 VNĐ.');

      gridPrice.appendChild(minPriceField);
      gridPrice.appendChild(maxPriceField);
      form.appendChild(gridPrice);

      var hiddenPrice=el('input','');
      hiddenPrice.type='hidden';
      hiddenPrice.name='price';
      hiddenPrice.value=toDisplayPrice(existingPrice.min,existingPrice.max);
      form.appendChild(hiddenPrice);

      var currentPlaceStatus=statusFromPlace(place);
      if(type==='update'){
        var statusField=el('div','vlc-field');
        statusField.appendChild(el('label','','Trạng thái hoạt động'));
        var choices=el('div','vlc-status-choice');
        [['OPEN','Đang hoạt động / không đổi'],['TEMP_CLOSED','Tạm thời đóng cửa'],['PERM_CLOSED','Đóng cửa vĩnh viễn']].forEach(function(opt){
          var lab=el('label','');var radio=el('input','');radio.type='radio';radio.name='business_status_choice';radio.value=opt[0];radio.checked=currentPlaceStatus===opt[0];lab.appendChild(radio);lab.appendChild(document.createTextNode(opt[1]));choices.appendChild(lab);
        });
        statusField.appendChild(choices);
        addHelp(statusField,'Thông tin đóng cửa sẽ được gửi để quản trị viên kiểm tra trước khi cập nhật.');
        form.appendChild(statusField);
      }
      var hiddenBusinessStatus=el('input','');hiddenBusinessStatus.type='hidden';hiddenBusinessStatus.name='business_status';hiddenBusinessStatus.value=currentPlaceStatus;form.appendChild(hiddenBusinessStatus);

      var field=el('div','vlc-field');
      field.appendChild(el('label','','Thông tin muốn bổ sung / sửa'));
      var ta=el('textarea','');ta.name='note_display';ta.value=editableVerificationNote(place);field.appendChild(ta);form.appendChild(field);
      var hiddenNote=el('input','');hiddenNote.type='hidden';hiddenNote.name='note';hiddenNote.value=ta.value;form.appendChild(hiddenNote);

      var grid3=el('div','vlc-grid');
      grid3.appendChild(inputField('Tên người gửi (không bắt buộc)','submitter_name','',false));
      grid3.appendChild(inputField('Liên hệ (không bắt buộc)','submitter_contact','',false));
      form.appendChild(grid3);

      var geoBtn=el('button','vlc-btn vlc-btn-soft','Dùng vị trí hiện tại của tôi');geoBtn.type='button';
      form.appendChild(geoBtn);
      var latInp=el('input','');latInp.type='hidden';latInp.name='lat';
      var lngInp=el('input','');lngInp.type='hidden';lngInp.name='lng';
      form.appendChild(latInp);form.appendChild(lngInp);

      phoneInput.addEventListener('input',function(){
        phoneInput.classList.remove('is-invalid');
        phoneError.classList.remove('is-show');

        var digits=digitsOnly(phoneInput.value);

        /* Nếu người dùng bắt đầu bằng +84/84 thì vẫn cho nhập tự nhiên. */
        if(digits.indexOf('84')===0 && digits.length<=11){
          return;
        }

        if(digits.length<=10){
          phoneInput.value=formatVNPhone(digits);
        }
      });

      [minPriceInput,maxPriceInput].forEach(function(inp){
        inp.addEventListener('input',function(){
          inp.value=formatMoney(inp.value);
        });
      });

      function syncStructuredFields(){
        updateParentChoice(false);
        if(!safe(parentCategoryHidden.value)){
          if(parentError)parentError.classList.add('is-show');
          if(parentCategorySelect){parentCategorySelect.classList.add('is-invalid');parentCategorySelect.focus();}
          return false;
        }
        updateCategoryChoice();

        var isNewCategory=categorySelect.value==='__VLC_NEW_CATEGORY__';
        var chosenCategory=isNewCategory?safe(newCategoryInput.value):safe(categorySelect.value);

        if(!chosenCategory){
          categoryError.classList.add('is-show');

          if(isNewCategory){
            newCategoryInput.classList.add('is-invalid');
            newCategoryError.classList.add('is-show');
          }else{
            categorySelect.classList.add('is-invalid');
          }
          return false;
        }

        categoryHidden.value=chosenCategory;
        categorySelect.classList.remove('is-invalid');
        categoryError.classList.remove('is-show');
        newCategoryInput.classList.remove('is-invalid');
        newCategoryError.classList.remove('is-show');

        var nameInput=form.querySelector('[name="name"]');
        if(!nameInput||!safe(nameInput.value)){
          if(nameInput){nameInput.classList.add('is-invalid');nameInput.focus();}
          return false;
        }

        if(!addressInput||!safe(addressInput.value)){
          if(addressInput){addressInput.classList.add('is-invalid');addressInput.focus();}
          return false;
        }

        var rawPhone=phoneInput.value.trim();
        var normalizedPhone=rawPhone?normalizeVNPhone(rawPhone):'';

        if(!rawPhone || !normalizedPhone){
          phoneInput.classList.add('is-invalid');
          phoneError.classList.add('is-show');
          phoneInput.focus();
          return false;
        }

        if(normalizedPhone){
          phoneInput.value=formatVNPhone(normalizedPhone);
          hiddenPhone.value=formatVNPhone(normalizedPhone);
        }else{
          hiddenPhone.value='';
        }

        if(!valid24Time(openTimeInput.value)){openTimeInput.classList.add('is-invalid');openTimeError.classList.add('is-show');openTimeInput.focus();return false;}
        if(!valid24Time(closeTimeInput.value)){closeTimeInput.classList.add('is-invalid');closeTimeError.classList.add('is-show');closeTimeInput.focus();return false;}
        hiddenHours.value=toDisplayHours(openTimeInput.value,closeTimeInput.value);

        hiddenPrice.value=toDisplayPrice(
          minPriceInput.value,
          maxPriceInput.value
        );

        var websiteInput=form.querySelector('[name="business_url"]');
        if(websiteInput&&safe(websiteInput.value)){
          websiteInput.value=websiteUrl(websiteInput.value);
        }
        var mapInput=form.querySelector('[name="map_url"]');
        if(mapInput&&safe(mapInput.value)&&!/^https?:\/\//i.test(safe(mapInput.value))){
          mapInput.value='https://'+safe(mapInput.value).replace(/^\/+/, '');
        }

        var selectedStatus=type==='update'?(form.querySelector('[name="business_status_choice"]:checked')||{}).value||currentPlaceStatus:'OPEN';
        hiddenBusinessStatus.value=selectedStatus;
        var marker=statusMarker(selectedStatus);
        hiddenNote.value=(marker+(marker&&safe(ta.value)?'\n':'')+safe(ta.value)).trim();

        return true;
      }

      geoBtn.addEventListener('click',function(){
        if(!navigator.geolocation)return;
        geoBtn.disabled=true;geoBtn.textContent='Đang lấy vị trí...';
        navigator.geolocation.getCurrentPosition(function(pos){
          latInp.value=pos.coords.latitude;lngInp.value=pos.coords.longitude;
          reverseCurrentLocality(pos,function(meta){
            if(meta){
              if(provinceInput&&!safe(provinceInput.value))provinceInput.value=safe(meta.region);
              if(localityInput&&!safe(localityInput.value))localityInput.value=safe(meta.locality);
            }
            geoBtn.textContent='Đã lấy vị trí địa điểm';geoBtn.disabled=false;
          });
          setTimeout(function(){
            if(geoBtn.disabled){geoBtn.textContent='Đã lấy tọa độ';geoBtn.disabled=false;}
          },2500);
        },function(){geoBtn.textContent='Không lấy được vị trí';geoBtn.disabled=false;},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
      });

      var hp=el('input','vlc-hp');hp.name='website';hp.autocomplete='off';hp.tabIndex=-1;form.appendChild(hp);
      var act=el('input','');act.type='hidden';act.name='submit_type';act.value=type;form.appendChild(act);
      var tid=el('input','');tid.type='hidden';tid.name='target_id';tid.value=place&&place.id||'';form.appendChild(tid);

      var submit=el('button','vlc-btn vlc-btn-primary',type==='update'?'Gửi cập nhật':'Gửi đề xuất');
      submit.type='submit';form.appendChild(submit);

      var iframe=el('iframe','vlc-hp');iframe.name='vlcSubmitFrame';iframe.title='Gửi dữ liệu';form.appendChild(iframe);

      form.addEventListener('submit',function(ev){
        if(!syncStructuredFields()){
          ev.preventDefault();
          if(categorySelect.value==='__VLC_NEW_CATEGORY__')newCategoryInput.focus();
          else if(!safe(categorySelect.value))categorySelect.focus();
          else phoneInput.focus();
          return;
        }

        if(!VLC_API_URL || VLC_API_URL.indexOf('DAN_URL_')===0){
          ev.preventDefault();
          alert('Quản trị viên chưa kết nối API dữ liệu.');
          return;
        }

        var review=[
          'Bạn đang gửi đề xuất vào Category: '+safe(categoryHidden.value),
          '',
          'Tên địa điểm: '+safe(form.querySelector('[name="name"]').value),
          'Địa chỉ: '+safe(form.querySelector('[name="address"]').value),
          hiddenPhone.value ? 'Điện thoại: '+hiddenPhone.value : '',
          safe(form.querySelector('[name="business_url"]').value) ? 'Website: '+safe(form.querySelector('[name="business_url"]').value) : '',
          hiddenHours.value ? 'Giờ: '+hiddenHours.value : '',
          hiddenPrice.value ? 'Giá: '+hiddenPrice.value : '',
          '',
          'Hãy kiểm tra lại Category và các thông tin trên.',
          'Bạn chắc chắn muốn gửi đề xuất này?'
        ].filter(function(line,index,arr){
          /* Giữ các dòng trống dùng để chia nhóm; bỏ dòng thông tin rỗng */
          return line!=='' || index===1 || index===arr.length-3;
        }).join('\n');

        if(!window.confirm(review)){
          ev.preventDefault();
          return;
        }

        setTimeout(function(){
          success.classList.add('is-show');
          submit.disabled=true;submit.textContent='Đã gửi';
        },300);
      });

      function closeModal(){
        modal.remove();
        document.documentElement.classList.remove('vlc-modal-open');
        document.body.classList.remove('vlc-modal-open');
      }

      /* Đề xuất/cập nhật: chỉ nút Đóng mới được đóng modal.
         Không đóng khi click nền và không đóng bằng phím Escape. */
      close.addEventListener('click',closeModal);

      card.appendChild(head);card.appendChild(form);modal.appendChild(card);document.body.appendChild(modal);
      document.documentElement.classList.add('vlc-modal-open');
      document.body.classList.add('vlc-modal-open');
      requestAnimationFrame(function(){modal.classList.add('is-open');});
    }

    root.__tlOpenUpdate=function(place){openForm('update',place||{});};
    root.__tlOpenRating=function(place){openRating(place||{});};

    loadCategories(function(){
      root.dataset.categoriesReady='1';
      try{root.dispatchEvent(new CustomEvent('tl:categoriesready'));}catch(e){}
      if(!proposalOnly)load();
    });
  }

  /* Mở biểu mẫu dùng chung cho nút Đề xuất nổi của theme. */
  window.TL_OPEN_PROPOSAL=function(categoryHint,allowedCategoryValues,parentCategoryHint){
    var guide=document.querySelector('.post-body .vlc-local-guide[data-category]');
    if(guide&&guide.dataset.vlcReady!=='1')initGuide(guide);

    function openFrom(root){
      if(!root)return;
      var btn=root.querySelector('.vlc-contribute .vlc-btn-primary');
      if(btn)btn.click();
    }
    function openWhenReady(root){
      /* Form được dựng đồng bộ; mở ngay với dữ liệu cha/con đã truyền từ trang.
         Catalog Google Sheet tiếp tục cập nhật nền, không giữ người dùng chờ. */
      openFrom(root);
    }

    if(guide){openWhenReady(guide);return;}

    var old=document.getElementById('tlGlobalProposalGuide');
    if(old)old.remove();
    var host=el('div','vlc-local-guide tl-floating-guide-host');
    host.id='tlGlobalProposalGuide';
    if(safe(categoryHint))host.setAttribute('data-category',safe(categoryHint));
    if(Array.isArray(allowedCategoryValues)&&allowedCategoryValues.length){
      host.setAttribute('data-allowed-categories',JSON.stringify(allowedCategoryValues));
    }
    if(safe(parentCategoryHint))host.setAttribute('data-parent-category',safe(parentCategoryHint));
    host.setAttribute('data-proposal-only','1');
    document.body.appendChild(host);
    initGuide(host);
    openWhenReady(host);
  };

  window.TL_OPEN_PLACE_UPDATE=function(place,categoryHint,parentCategoryHint){
    var guide=document.querySelector('.post-body .vlc-local-guide[data-category]');
    if(guide&&guide.dataset.vlcReady!=='1')initGuide(guide);
    if(guide&&typeof guide.__tlOpenUpdate==='function'){guide.__tlOpenUpdate(place);return;}
    var old=document.getElementById('tlGlobalProposalGuide');if(old)old.remove();
    var host=el('div','vlc-local-guide tl-floating-guide-host');host.id='tlGlobalProposalGuide';
    if(safe(categoryHint))host.setAttribute('data-category',safe(categoryHint));
    if(safe(parentCategoryHint))host.setAttribute('data-parent-category',safe(parentCategoryHint));
    host.setAttribute('data-proposal-only','1');document.body.appendChild(host);initGuide(host);
    if(typeof host.__tlOpenUpdate==='function')host.__tlOpenUpdate(place);
  };

  window.TL_OPEN_PLACE_RATING=function(place,categoryHint,parentCategoryHint){
    var guide=document.querySelector('.post-body .vlc-local-guide[data-category]');
    if(guide&&guide.dataset.vlcReady!=='1')initGuide(guide);
    if(guide&&typeof guide.__tlOpenRating==='function'){guide.__tlOpenRating(place);return;}
    var old=document.getElementById('tlGlobalProposalGuide');if(old)old.remove();
    var host=el('div','vlc-local-guide tl-floating-guide-host');host.id='tlGlobalProposalGuide';
    if(safe(categoryHint))host.setAttribute('data-category',safe(categoryHint));
    if(safe(parentCategoryHint))host.setAttribute('data-parent-category',safe(parentCategoryHint));
    host.setAttribute('data-proposal-only','1');document.body.appendChild(host);initGuide(host);
    if(typeof host.__tlOpenRating==='function')host.__tlOpenRating(place);
  };

  function boot(){
    document.querySelectorAll('.vlc-local-guide').forEach(initGuide);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();


/* ---- original script block 7 ---- */
//
    (function(){
      'use strict';

      /* ---------- SMART SEARCH: gợi ý từ 1 ký tự ---------- */
      var form=document.getElementById('tlSmartSearch');
      var input=document.getElementById('tlSmartSearchInput');
      var hubSearchInput=document.getElementById('tlHubSearch');
      var hubSearchButton=document.getElementById('tlHubSearchSubmit');
      var box=document.getElementById('tlSearchSuggest');
      if(!box){
        box=document.createElement('div');box.id='tlSearchSuggest';box.className='tl-search-suggest';
        box.setAttribute('role','listbox');box.setAttribute('aria-label','Gợi ý tìm kiếm');
      }
      var locationBtn=document.getElementById('tlUseLocation');
      var locationStatus=document.getElementById('tlLocationStatus');
      var headerContext=document.getElementById('tlHeaderContext');
      var headerLocality=document.getElementById('tlHeaderLocality');
      var headerClock=document.getElementById('tlHeaderClock');
      var heroLocalityText=document.getElementById('tlHeroLocalityText');
      var TL_LOCATION_KEY='tl_user_location_v1';
      if(box && box.parentNode!==document.body)document.body.appendChild(box);
      var searchData=[];
      var categoryParentMap={};
      var categoryUrlMap={};
      var dataLoaded=false;
      var loading=false;
      var activeIndex=-1;
      var shown=[];
      var suggestInput=input||hubSearchInput||null;
      var suggestAnchor=form||hubSearchInput||null;
      var suggestFollowFrame=0;
      var syncStickySearch=function(){};
      var placeSearchTimer=0;
      var placeSearchSerial=0;
      var placeSearchMessage='';

      function searchModeForInput(node){
        if(!node)return 'category';
        var direct=node.__tlModeSelect;
        if(direct&&direct.isConnected)return direct.value==='place'?'place':'category';
        var scope=node.__tlSearchScope||(node.closest&&(node.closest('.tl-search-control-v17')||node.closest('.tl-search-page-form')||node.closest('.tl-inline-search-form')||node.closest('.tl-category-hub-search-control')||node.closest('form')));
        var select=scope&&scope.querySelector?scope.querySelector('.tl-search-mode-select'):null;
        return select&&select.value==='place'?'place':'category';
      }
      function updateSearchModeUI(select,node){
        if(!select||!node)return;
        var mode=select.value==='place'?'place':'category';
        if(mode==='place'){node.placeholder='Tìm tên địa điểm bạn quan tâm';node.setAttribute('aria-label','Tìm địa điểm');}
        else{node.placeholder='Tìm danh mục, chủ đề, các dịch vụ, ...';node.setAttribute('aria-label','Tìm danh mục');}
      }

      /* Giải mã HTML entity từ Blogger Feed/API trước khi hiển thị.
         Xử lý cả chuỗi bị mã hóa lặp như &amp;#183; -> ·. */
      function decodeHtmlEntities(v){
        var s=String(v==null?'':v);
        if(s.indexOf('&')<0)return s;
        var el=document.createElement('textarea');
        for(var i=0;i<4;i++){
          if(!/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(s))break;
          el.innerHTML=s;
          var next=el.value;
          if(next===s)break;
          s=next;
        }
        return s;
      }
      function cleanText(v){return decodeHtmlEntities(v).replace(/\s+/g,' ').trim();}
      function decodeVisibleHtmlEntities(root){
        if(!root)return;
        if(root.nodeType===1 && root.closest && root.closest('#tlSearchSuggest'))return;
        function canFix(node){
          var p=node&&node.parentElement;
          if(!p)return false;
          if(p.closest&&p.closest('#tlSearchSuggest'))return false;
          if(/^(SCRIPT|STYLE|TEXTAREA|PRE|CODE|NOSCRIPT)$/i.test(p.tagName))return false;
          return /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(node.nodeValue||'');
        }
        if(root.nodeType===3){
          if(canFix(root)){var one=decodeHtmlEntities(root.nodeValue);if(one!==root.nodeValue)root.nodeValue=one;}
          return;
        }
        if(root.nodeType!==1 && root.nodeType!==9 && root.nodeType!==11)return;
        var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
        var nodes=[];
        while(walker.nextNode()){if(canFix(walker.currentNode))nodes.push(walker.currentNode);}
        nodes.forEach(function(node){var fixed=decodeHtmlEntities(node.nodeValue);if(fixed!==node.nodeValue)node.nodeValue=fixed;});
      }
      function setupVisibleEntityFix(){
        if(!document.body)return;
        decodeVisibleHtmlEntities(document.body);
        if(!window.MutationObserver)return;
        var observer=new MutationObserver(function(mutations){
          mutations.forEach(function(m){
            if(m.type==='characterData'){decodeVisibleHtmlEntities(m.target);return;}
            Array.prototype.forEach.call(m.addedNodes||[],function(node){decodeVisibleHtmlEntities(node);});
          });
        });
        observer.observe(document.body,{subtree:true,childList:true,characterData:true});
      }
      function getSavedLocation(){
        try{
          var raw=localStorage.getItem(TL_LOCATION_KEY);
          if(!raw)return null;
          var p=JSON.parse(raw);
          if(!p||!isFinite(Number(p.lat))||!isFinite(Number(p.lng)))return null;
          if(p.savedAt && Date.now()-Number(p.savedAt)>86400000)return null;
          return p;
        }catch(e){return null;}
      }
      function headerLocationText(p){
        if(!p)return 'Chưa bật vị trí';
        return cleanText(p.locality)||cleanText(p.region)||cleanText(p.countryName)||'Đang xác định địa danh...';
      }
      function updateHeaderContext(p){
        var placeName=p&&(cleanText(p.locality)||cleanText(p.region)||cleanText(p.countryName));
        if(headerLocality)headerLocality.textContent=headerLocationText(p);
        if(heroLocalityText)heroLocalityText.textContent=placeName?'Khám phá tại '+placeName:'Khám phá quanh bạn';
        if(headerContext){
          var acc=p&&isFinite(Number(p.accuracy))?Number(p.accuracy):0;
          headerContext.classList.toggle('is-warning',acc>1000);
        }
      }
      function tlTimezoneLabel(d){
        var offset=-d.getTimezoneOffset(),sign=offset>=0?'+':'-',abs=Math.abs(offset),h=Math.floor(abs/60),m=abs%60;
        return 'GMT'+sign+h+(m?':'+String(m).padStart(2,'0'):'');
      }
      function updateHeaderClock(){
        if(!headerClock)return;
        try{
          var now=new Date();
          var time=new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
          var date=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(now);
          headerClock.textContent=tlTimezoneLabel(now)+' | '+time+' - '+date;
        }catch(e){var now2=new Date();headerClock.textContent=tlTimezoneLabel(now2)+' | '+now2.toLocaleString('vi-VN');}
      }
      updateHeaderClock();setInterval(updateHeaderClock,30000);

      function showLocationState(p){
        updateHeaderContext(p);
        if(!locationStatus)return;
        if(p){
          var placeName=cleanText(p.locality)||cleanText(p.region)||cleanText(p.countryName);
          locationStatus.textContent=placeName?('Đã cập nhật vị trí tại '+placeName+'.'):'Đang xác định địa danh...';
          locationStatus.classList.remove('is-warning');
          locationStatus.classList.add('is-active');
          if(locationBtn){locationBtn.querySelector('span').textContent='Cập nhật vị trí của tôi';}
        }else{
          locationStatus.textContent='Bật vị trí để This Local ưu tiên địa điểm gần bạn.';
          locationStatus.classList.remove('is-active');
          locationStatus.classList.remove('is-warning');
        }
      }
      function saveHomeLocation(pos){
        if(!pos||!pos.coords)return null;
        var p={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy)||null,locality:'',region:'',countryCode:'',countryName:'',currency:'',savedAt:Date.now()};
        try{localStorage.setItem(TL_LOCATION_KEY,JSON.stringify(p));}catch(e){}
        try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
        showLocationState(p);

        if(typeof window.TL_REVERSE_CURRENT_LOCALITY==='function'){
          window.TL_REVERSE_CURRENT_LOCALITY(pos,function(meta){
            if(!meta||!meta.locality)return;
            p.locality=meta.locality;p.region=meta.region||'';p.countryCode=meta.countryCode||'';p.countryName=meta.countryName||'';p.currency=meta.currency||'';p.savedAt=Date.now();
            try{localStorage.setItem(TL_LOCATION_KEY,JSON.stringify(p));}catch(e){}
            try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
            showLocationState(p);
          });
        }
        return p;
      }
      function requestHomeLocation(){
        if(!locationBtn)return;
        if(!navigator.geolocation){showLocationState(null);locationStatus.textContent='Trình duyệt này không hỗ trợ xác định vị trí.';return;}

        locationBtn.disabled=true;
        locationBtn.querySelector('span').textContent='Đang cập nhật vị trí...';

        var best=null;
        var watchId=null;
        var finished=false;
        var timer=null;

        function finish(ok){
          if(finished)return;
          finished=true;
          if(timer)clearTimeout(timer);
          if(watchId!==null){
            try{navigator.geolocation.clearWatch(watchId);}catch(e){}
          }

          locationBtn.disabled=false;

          if(ok && best){
            saveHomeLocation(best);
            return;
          }

          locationBtn.querySelector('span').textContent=getSavedLocation()?'Cập nhật vị trí của tôi':'Dùng vị trí hiện tại';
          locationStatus.textContent='Không lấy được vị trí. Vui lòng thử lại.';
          locationStatus.classList.remove('is-active');
        }

        watchId=navigator.geolocation.watchPosition(function(pos){
          var acc=Number(pos.coords.accuracy);
          var bestAcc=best&&best.coords?Number(best.coords.accuracy):Infinity;

          if(!best || (isFinite(acc) && (!isFinite(bestAcc) || acc<bestAcc))){
            best=pos;

            if(locationStatus){locationStatus.textContent='Đang cập nhật vị trí...';locationStatus.classList.add('is-active');}
          }

          /* Nếu GPS đạt khoảng 30 m trở xuống thì không cần chờ thêm. */
          if(isFinite(acc) && acc<=30)finish(true);
        },function(err){
          /* Không kết thúc ngay vì watchPosition có thể hồi phục ở lần cập nhật tiếp theo. */
          if(err && err.code===1)finish(false);
        },{
          enableHighAccuracy:true,
          timeout:20000,
          maximumAge:0
        });

        /* Không dùng cache và chờ tối đa 18 giây để chọn mẫu có accuracy tốt nhất. */
        timer=setTimeout(function(){finish(!!best);},18000);
      }
      function norm(v){
        v=cleanText(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
        try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return v;}
      }
      function addItem(type,title,url,subtitle,terms,place){
        title=cleanText(title);if(!title||!url)return;
        try{url=new URL(url,location.href).href;}catch(e){}
        var key=type+'|'+url;
        var old=searchData.filter(function(x){return x.key===key;})[0];
        if(old){
          if(cleanText(subtitle))old.subtitle=cleanText(subtitle);
          if(Array.isArray(terms)&&terms.length)old.terms=terms.slice();
          if(place)old.place=place;
          return old;
        }
        var item={key:key,type:type,title:title,url:url,norm:norm(title),subtitle:cleanText(subtitle)||(type==='Trang'?'Danh mục':'Bài viết'),terms:Array.isArray(terms)?terms.slice():[],place:place||null};
        searchData.push(item);return item;
      }
      function seedFromPage(){
        document.querySelectorAll('.tl-category-card').forEach(function(a){
          try{if(!/^\/p\/[^/?#]+\.html\/?$/i.test(new URL(a.href,location.href).pathname))return;}catch(e){return;}
          var t=a.querySelector('strong');addItem('Trang',t?t.textContent:a.textContent,a.href,'Danh mục');
        });
      }
      function applyCategoryCatalog(items){
        (items||[]).forEach(function(item){
          var name=cleanText(item&&(item.name_vi||item.name));
          var parent=cleanText(item&&item.parent_name);
          if(!name)return;
          categoryParentMap[norm(name)]=parent||name;
          if(cleanText(item.post_url))categoryUrlMap[norm(name)]=cleanText(item.post_url);
        });
        refreshPostParents();
      }
      function parentForTerms(terms){
        var list=Array.isArray(terms)?terms:[];
        for(var i=0;i<list.length;i++){
          var term=cleanText(list[i]);
          if(!term||/^ads\d+$/i.test(term))continue;
          var parent=categoryParentMap[norm(term)];
          if(parent)return parent;
        }
        return '';
      }
      function refreshPostParents(){
        searchData.forEach(function(item){
          if(item.type!=='Bài viết')return;
          item.subtitle=parentForTerms(item.terms)||item.subtitle||'Bài viết';
        });
        if(box&&box.classList.contains('is-open')&&suggestInput&&suggestInput.value.trim())renderSuggest(suggestInput.value,suggestInput);
      }
      function loadCategoryCatalog(){
        try{
          var cached=JSON.parse(localStorage.getItem('tl_category_catalog_v4')||'[]');
          if(Array.isArray(cached))applyCategoryCatalog(cached);
        }catch(e){}
        var api=window.TL_GUIDE_API_URL||'';if(!api)return;
        var callback='TLSEARCHCAT_'+Date.now()+'_'+Math.floor(Math.random()*100000);
        var script=document.createElement('script'),done=false;
        function finish(){
          if(done)return;done=true;
          try{delete window[callback];}catch(e){}
          if(script.parentNode)script.parentNode.removeChild(script);
        }
        window[callback]=function(data){
          if(data&&data.ok&&Array.isArray(data.categories))applyCategoryCatalog(data.categories);
          finish();
        };
        script.onerror=finish;
        script.src=api+'?action=categoryCatalog&callback='+encodeURIComponent(callback);
        document.head.appendChild(script);
        setTimeout(finish,12000);
      }
      function placeSubtitle(place){
        var area=cleanText(place&&(place.locality||place.province));
        var category=cleanText(place&&place.category)||'Địa điểm';
        return area?category+' · '+area:category;
      }
      function clearPlaceSearchItems(){searchData=searchData.filter(function(item){return item.type!=='Địa điểm';});}
      function applyPlaceSearchResults(places,query,sourceInput){
        clearPlaceSearchItems();
        (places||[]).forEach(function(place){
          if(!place||!cleanText(place.name))return;
          if(!cleanText(place.category_url)&&categoryUrlMap[norm(place.category)])place.category_url=categoryUrlMap[norm(place.category)];
          var target=cleanText(place.category_url)||location.href.split('#')[0]+'#tl-place-'+encodeURIComponent(cleanText(place.id)||cleanText(place.name));
          addItem('Địa điểm',place.name,target,placeSubtitle(place),[place.category,place.parent_category,place.locality,place.province],place);
        });
        placeSearchMessage=(places&&places.length)?'':'Không tìm thấy địa điểm phù hợp trong sheet Places.';
        if(sourceInput&&document.activeElement===sourceInput&&norm(sourceInput.value)===norm(query))renderSuggest(sourceInput.value,sourceInput);
      }
      function showPlaceSearchMessage(message,query,sourceInput){
        placeSearchMessage=message||'';
        if(sourceInput&&document.activeElement===sourceInput&&norm(sourceInput.value)===norm(query))renderSuggest(sourceInput.value,sourceInput);
      }
      /* Dự phòng cho Web App cũ: lấy một lô Places rồi lọc tên ngay trên blog.
         Nhờ vậy tìm kiếm vẫn hoạt động và người quản trị có thời gian triển khai V14. */
      function requestLegacyPlaceSearch(query,sourceInput,serial){
        if(serial!==placeSearchSerial)return;
        var api=window.TL_GUIDE_API_URL||'';if(!api)return;
        var callback='TLSEARCHLEGACY_'+Date.now()+'_'+Math.floor(Math.random()*100000);
        var script=document.createElement('script'),done=false;
        function finish(message){if(done)return;done=true;try{delete window[callback];}catch(e){}if(script.parentNode)script.parentNode.removeChild(script);if(message&&serial===placeSearchSerial)showPlaceSearchMessage(message,query,sourceInput);}
        window[callback]=function(data){
          if(serial===placeSearchSerial&&data&&data.ok&&Array.isArray(data.places)){
            var wanted=norm(query);
            var matches=data.places.filter(function(place){return place&&norm(place.name).indexOf(wanted)>-1;}).slice(0,8);
            applyPlaceSearchResults(matches,query,sourceInput);finish();return;
          }
          finish('Web App chưa có API tìm địa điểm. Hãy triển khai Apps Script V14.');
        };
        script.onerror=function(){finish('Không kết nối được dữ liệu địa điểm. Hãy kiểm tra quyền Web App.');};
        script.src=api+'?action=list&limit=100&callback='+encodeURIComponent(callback)+'&_v=14';
        document.head.appendChild(script);
        setTimeout(function(){finish('Dữ liệu địa điểm phản hồi quá lâu. Hãy triển khai Apps Script V14.');},15000);
      }
      function requestPlaceSearch(raw,sourceInput){
        var query=cleanText(raw);
        if(norm(query).length<2){clearPlaceSearchItems();return;}
        var api=window.TL_GUIDE_API_URL||'';if(!api)return;
        var serial=++placeSearchSerial;
        showPlaceSearchMessage('Đang tìm trong dữ liệu địa điểm...',query,sourceInput);
        var callback='TLSEARCHPLACE_'+Date.now()+'_'+Math.floor(Math.random()*100000);
        var script=document.createElement('script'),done=false,fallbackStarted=false;
        function finish(){if(done)return;done=true;try{delete window[callback];}catch(e){}if(script.parentNode)script.parentNode.removeChild(script);}
        function fallback(){if(fallbackStarted||serial!==placeSearchSerial)return;fallbackStarted=true;finish();requestLegacyPlaceSearch(query,sourceInput,serial);}
        window[callback]=function(data){
          if(serial!==placeSearchSerial){finish();return;}
          if(data&&data.ok&&Array.isArray(data.places)){applyPlaceSearchResults(data.places,query,sourceInput);finish();return;}
          fallback();
        };
        script.onerror=fallback;
        script.src=api+'?action=searchPlaces&q='+encodeURIComponent(query)+'&limit=10&callback='+encodeURIComponent(callback)+'&_v=14';
        document.head.appendChild(script);setTimeout(fallback,12000);
      }
      function schedulePlaceSearch(raw,sourceInput){
        if(placeSearchTimer)clearTimeout(placeSearchTimer);
        if(searchModeForInput(sourceInput)!=='place'){placeSearchSerial++;placeSearchMessage='';clearPlaceSearchItems();return;}
        if(norm(raw).length<2){placeSearchSerial++;placeSearchMessage='';clearPlaceSearchItems();return;}
        placeSearchTimer=setTimeout(function(){requestPlaceSearch(raw,sourceInput);},280);
      }
      function safePublicUrl(value){
        value=cleanText(value);if(!value)return '';
        try{
          if(/^\/(?!\/)/.test(value)){var localUrl=new URL(value,location.origin);return localUrl.href;}
          if(/^\/\//.test(value))value='https:'+value;
          if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(value))value='https://'+value.replace(/^\/+/, '');
          var url=new URL(value);return /^(https?:)$/i.test(url.protocol)?url.href:'';
        }catch(e){return '';}
      }
      function placeMapUrl(place){
        var lat=Number(place&&place.lat),lng=Number(place&&place.lng);
        if(isFinite(lat)&&isFinite(lng))return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng);
        return safePublicUrl(place&&place.map_url);
      }
      function ensurePlaceSearchModal(){
        var modal=document.getElementById('tlPlaceSearchModal');if(modal)return modal;
        modal=document.createElement('div');modal.id='tlPlaceSearchModal';modal.className='tl-place-search-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Thông tin địa điểm');
        var dialog=document.createElement('div');dialog.className='tl-place-search-dialog';
        var close=document.createElement('button');close.type='button';close.className='tl-place-search-close';close.setAttribute('aria-label','Đóng');close.textContent='×';
        var content=document.createElement('div');content.className='tl-place-search-content';
        dialog.appendChild(close);dialog.appendChild(content);modal.appendChild(dialog);document.body.appendChild(modal);
        function closeModal(){modal.classList.remove('is-open');document.body.style.overflow=modal.dataset.previousOverflow||'';}
        close.addEventListener('click',closeModal);modal.addEventListener('click',function(event){if(event.target===modal)closeModal();});
        document.addEventListener('keydown',function(event){if(event.key==='Escape'&&modal.classList.contains('is-open'))closeModal();});
        modal.__tlClose=closeModal;return modal;
      }
      function openPlaceSearchResult(place){
        if(!place)return;closeSuggest();
        var modal=ensurePlaceSearchModal(),content=modal.querySelector('.tl-place-search-content');content.innerHTML='';
        function node(tag,className,text){var element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
        function row(label,value,wide){value=cleanText(value);if(!value)return;var item=node('div','tl-place-search-row'+(wide?' is-wide':'')),strong=node('strong','',label+': ');item.appendChild(strong);item.appendChild(document.createTextNode(value));info.appendChild(item);}
        function action(label,url,primary){url=safePublicUrl(url);if(!url)return;var link=node('a',primary?'is-primary':'',label);link.href=url;link.target='_blank';link.rel='noopener noreferrer';actions.appendChild(link);}
        function telAction(phone){phone=cleanText(phone);if(!phone)return;var value=phone.replace(/[^\d+]/g,'');if(!value)return;var link=node('a','','Gọi điện');link.href='tel:'+value;actions.appendChild(link);}
        function truthy(value){if(value===true||value===1)return true;var v=norm(value);return ['true','1','yes','y','co','checked','x','uy tin','trusted','hot'].indexOf(v)>-1;}
        content.appendChild(node('div','tl-place-search-eyebrow','THIS LOCAL · ĐỊA ĐIỂM'));
        content.appendChild(node('h2','tl-place-search-title',cleanText(place.name)||'Địa điểm'));
        content.appendChild(node('div','tl-place-search-meta',placeSubtitle(place)));
        var badges=node('div','tl-place-search-badges'),verified=cleanText(place.verified).toUpperCase();
        var topRank=cleanText(place.top_rank);if(topRank)badges.appendChild(node('span','tl-place-search-badge is-top','★ '+(/^top/i.test(topRank)?topRank:('TOP '+topRank))));
        if(truthy(place.is_trusted))badges.appendChild(node('span','tl-place-search-badge is-trusted','✓ Uy tín'));
        if(truthy(place.is_hot))badges.appendChild(node('span','tl-place-search-badge is-hot','● Đang hot'));
        if(verified==='TRUE')badges.appendChild(node('span','tl-place-search-badge is-verified','Đã xác minh'));
        else if(verified==='FALSE')badges.appendChild(node('span','tl-place-search-badge is-unverified','Chưa xác minh'));
        var status=cleanText(place.business_status||place.status).toUpperCase();
        if(status==='TEMP_CLOSED'||status==='TEMPORARILY_CLOSED')badges.appendChild(node('span','tl-place-search-badge is-closed','Tạm thời đóng cửa'));
        else if(status==='PERM_CLOSED'||status==='PERMANENTLY_CLOSED')badges.appendChild(node('span','tl-place-search-badge is-closed','Đã đóng vĩnh viễn'));
        if(badges.childNodes.length)content.appendChild(badges);
        var info=node('div','tl-place-search-info');content.appendChild(info);
        row('Danh mục',place.category);
        row('Khu vực',[cleanText(place.locality),cleanText(place.province)].filter(Boolean).join(', '));
        row('Địa chỉ',place.address,true);
        row('Điện thoại',place.phone);
        row('Giờ mở cửa',place.hours);
        row('Khoảng giá',place.price);
        var ratingCount=Math.max(0,Number(place.rating_count)||0),ratingAverage=Number(place.rating_average)||0;
        if(ratingCount)row('Đánh giá',(Math.round(ratingAverage*10)/10)+' ★ / '+ratingCount+' lượt');
        if(cleanText(place.data_quality))row('Chất lượng dữ liệu',place.data_quality);
        if(cleanText(place.source_checked_at))row('Kiểm tra nguồn',place.source_checked_at);
        var publicNote=cleanText(place.note).replace(/\[STATUS:[^\]]+\]/ig,'').trim();if(publicNote)content.appendChild(node('div','tl-place-search-note',publicNote));
        var actions=node('div','tl-place-search-actions');content.appendChild(actions);
        action('Chỉ đường',placeMapUrl(place),true);telAction(place.phone);action('Website',place.business_url,false);action('Mở Danh mục',place.category_url||categoryUrlMap[norm(place.category)],false);
        var sourceName=cleanText(place.source_name),sourceLicense=cleanText(place.source_license),sourceUrl=safePublicUrl(place.source_url),sourcePlaceId=cleanText(place.source_place_id);
        if(/^THIS LOCAL community$/i.test(sourceName)){sourceName='THIS LOCAL Community';sourceLicense='';sourceUrl='';sourcePlaceId='';}
        if(sourceName||sourceLicense||sourceUrl||sourcePlaceId){var source=node('div','tl-place-search-source');source.appendChild(document.createTextNode('Nguồn: '+(sourceName||'Dữ liệu địa điểm')+(sourceLicense?' · '+sourceLicense:'')+(sourcePlaceId?' · ID '+sourcePlaceId:'')));if(sourceUrl){source.appendChild(document.createTextNode(' · '));var sourceLink=node('a','','Xem nguồn');sourceLink.href=sourceUrl;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';source.appendChild(sourceLink);}content.appendChild(source);}
        modal.dataset.previousOverflow=document.body.style.overflow||'';document.body.style.overflow='hidden';modal.classList.add('is-open');var closeButton=modal.querySelector('.tl-place-search-close');if(closeButton)closeButton.focus();
      }

      function setupGlobalSearchResults(){
        if(!document.body||!document.body.classList.contains('search-view'))return;
        var query='',searchType='category';try{var params=new URLSearchParams(location.search);query=cleanText(params.get('q'));searchType=params.get('type')==='place'?'place':'category';}catch(e){}
        document.body.classList.toggle('tl-search-mode-place',searchType==='place');
        document.body.classList.toggle('tl-search-mode-category',searchType!=='place');
        if(searchType!=='place')return;
        if(norm(query).length<2)return;
        var pageBody=document.getElementById('page_body');if(!pageBody||!pageBody.parentNode)return;
        var old=document.getElementById('tlGlobalSearchPlaces');if(old)old.remove();
        var host=document.createElement('section');host.id='tlGlobalSearchPlaces';host.className='tl-global-search-places';host.setAttribute('aria-label','Kết quả địa điểm');
        var head=document.createElement('div');head.className='tl-global-search-head';
        var copy=document.createElement('div'),title=document.createElement('h2'),sub=document.createElement('p'),count=document.createElement('span');
        title.textContent='Địa điểm phù hợp';sub.textContent='Đang tìm các địa điểm có “'+query+'” trong tên.';count.className='tl-global-search-count';count.textContent='Đang tải';copy.appendChild(title);copy.appendChild(sub);head.appendChild(copy);head.appendChild(count);host.appendChild(head);

        function tabIcon(kind){
          var wrap=document.createElement('span');wrap.className='tl-global-search-tab-icon';
          wrap.innerHTML=kind==='nearest'?'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>':'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
          return wrap;
        }
        function makeTab(kind,strongText,smallText){
          var btn=document.createElement('button');btn.type='button';btn.className='tl-global-search-tab';btn.setAttribute('role','tab');btn.appendChild(tabIcon(kind));
          var c=document.createElement('span');c.className='tl-global-search-tab-copy';var s=document.createElement('strong');s.textContent=strongText;var sm=document.createElement('small');sm.textContent=smallText;c.appendChild(s);c.appendChild(sm);btn.appendChild(c);return btn;
        }
        var tabs=document.createElement('div');tabs.className='tl-global-search-tabs';tabs.setAttribute('role','tablist');
        var relevanceTab=makeTab('relevance','Trùng khớp nhất','Ưu tiên tên giống từ khóa');relevanceTab.classList.add('is-active');relevanceTab.setAttribute('aria-selected','true');
        var nearestTab=makeTab('nearest','Gần nhất','Tìm quanh vị trí của bạn');nearestTab.setAttribute('aria-selected','false');
        tabs.appendChild(relevanceTab);tabs.appendChild(nearestTab);host.appendChild(tabs);

        var radiusBox=document.createElement('div');radiusBox.className='tl-global-search-radius';radiusBox.hidden=true;
        var radiusMessage=document.createElement('div');radiusMessage.className='tl-global-search-radius-message';
        var radiusActions=document.createElement('div');radiusActions.className='tl-global-search-radius-actions';
        function radiusButton(label,step){var b=document.createElement('button');b.type='button';b.className='tl-global-search-radius-btn';b.textContent=label;b.dataset.step=String(step);return b;}
        var plus1=radiusButton('+1 km',1),plus10=radiusButton('+10 km',10);radiusActions.appendChild(plus1);radiusActions.appendChild(plus10);radiusBox.appendChild(radiusMessage);radiusBox.appendChild(radiusActions);host.appendChild(radiusBox);

        var grid=document.createElement('div');grid.className='tl-global-search-grid';host.appendChild(grid);
        var status=document.createElement('div');status.className='tl-global-search-status';status.textContent='Đang lọc dữ liệu địa điểm...';host.appendChild(status);
        pageBody.parentNode.insertBefore(host,pageBody);
        var api=window.TL_GUIDE_API_URL||'';if(!api){status.textContent='Chưa kết nối dữ liệu địa điểm.';count.textContent='0 địa điểm';return;}
        var pageSize=20,offset=0,total=0,loading=false,ended=false,requestToken=0,generation=0,mode='relevance',position=getSavedLocation(),radiusKm=1;

        function radiusText(){
          var text='Trong khoảng cách '+radiusKm+' km';
          if(position&&isFinite(Number(position.accuracy))&&Number(position.accuracy)>0){
            var acc=Number(position.accuracy);
            text+=acc<1000?(' · vị trí ±'+Math.round(acc)+' m'):(' · vị trí ±'+(acc/1000).toFixed(1)+' km');
          }
          return text;
        }
        function setTabs(){
          var near=mode==='nearest';relevanceTab.classList.toggle('is-active',!near);nearestTab.classList.toggle('is-active',near);relevanceTab.setAttribute('aria-selected',near?'false':'true');nearestTab.setAttribute('aria-selected',near?'true':'false');
          sub.textContent=near?('Các địa điểm có “'+query+'” gần vị trí của bạn.'):('Ưu tiên tên trùng khớp nhất với “'+query+'”.');
          radiusBox.hidden=!near;
          if(near){
            radiusMessage.textContent=radiusText();
            if(position&&isFinite(Number(position.accuracy))&&Number(position.accuracy)>500){
              radiusMessage.textContent+=' · độ chính xác vị trí thấp, kết quả có thể lệch.';
            }
          }
          plus1.disabled=radiusKm>=200;plus10.disabled=radiusKm>=200;
        }
        function resetResults(){generation++;offset=0;total=0;loading=false;ended=false;grid.innerHTML='';count.textContent='Đang tải';status.style.display='block';status.textContent=mode==='nearest'?('Đang tìm '+radiusText().toLowerCase()+'...'):'Đang tìm kết quả trùng khớp nhất...';setTabs();loadMore();}
        function saveSearchPosition(pos){if(!pos||!pos.coords)return null;var p={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy)||null,locality:'',region:'',countryCode:'',countryName:'',savedAt:Date.now()};try{localStorage.setItem(TL_LOCATION_KEY,JSON.stringify(p));}catch(e){}try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}return p;}
        function activateNearest(){
          if(!navigator.geolocation){
            status.style.display='block';
            status.textContent='Trình duyệt không hỗ trợ vị trí. Tab Trùng khớp nhất vẫn dùng bình thường.';
            return;
          }

          nearestTab.disabled=true;
          var strong=nearestTab.querySelector('strong');
          if(strong)strong.textContent='Đang lấy vị trí...';
          status.style.display='block';
          status.textContent='Đang lấy vị trí hiện tại chính xác nhất...';

          var best=null,watchId=null,finished=false,timer=null;

          function finish(ok){
            if(finished)return;
            finished=true;
            if(timer)clearTimeout(timer);
            if(watchId!==null){try{navigator.geolocation.clearWatch(watchId);}catch(e){}}
            nearestTab.disabled=false;
            if(strong)strong.textContent='Gần nhất';

            if(ok&&best){
              position=saveSearchPosition(best);
              mode='nearest';
              radiusKm=1;
              resetResults();
              return;
            }

            var saved=getSavedLocation();
            var fresh=saved&&saved.savedAt&&(Date.now()-Number(saved.savedAt)<=600000);
            var usable=fresh&&isFinite(Number(saved.accuracy))&&Number(saved.accuracy)<=500;
            if(usable){
              position=saved;
              mode='nearest';
              radiusKm=1;
              resetResults();
              return;
            }

            status.style.display='block';
            status.textContent='Không lấy được vị trí đủ chính xác. Hãy bật GPS/vị trí rồi thử lại.';
          }

          watchId=navigator.geolocation.watchPosition(function(pos){
            if(!pos||!pos.coords)return;
            var acc=Number(pos.coords.accuracy);
            var bestAcc=best&&best.coords?Number(best.coords.accuracy):Infinity;

            if(!best||(isFinite(acc)&&(!isFinite(bestAcc)||acc<bestAcc))){
              best=pos;
              status.textContent=isFinite(acc)
                ?('Đang tinh chỉnh vị trí · độ chính xác khoảng ±'+Math.round(acc)+' m')
                :'Đang tinh chỉnh vị trí...';
            }

            if(isFinite(acc)&&acc<=50)finish(true);
          },function(err){
            if(err&&err.code===1)finish(false);
          },{
            enableHighAccuracy:true,
            timeout:15000,
            maximumAge:0
          });

          timer=setTimeout(function(){finish(!!best);},9000);
        }
        function renderCard(place){
          var card=document.createElement('button');card.type='button';card.className='tl-global-search-card';card.setAttribute('aria-label','Xem thông tin '+cleanText(place.name));
          var top=document.createElement('div');top.className='tl-global-search-card-top';var cat=document.createElement('span');cat.className='tl-global-search-card-cat';cat.textContent=cleanText(place.category)||'Địa điểm';var area=document.createElement('span');area.className='tl-global-search-card-open';area.textContent=cleanText(place.locality||place.province);top.appendChild(cat);top.appendChild(area);card.appendChild(top);
          var h3=document.createElement('h3');h3.textContent=cleanText(place.name)||'Địa điểm';card.appendChild(h3);
          if(cleanText(place.address)){var address=document.createElement('p');address.className='tl-global-search-card-address';address.textContent=cleanText(place.address);card.appendChild(address);}
          var meta=document.createElement('div');meta.className='tl-global-search-card-meta';
          if(place.distance_km!==null&&place.distance_km!==undefined&&isFinite(Number(place.distance_km))){var db=document.createElement('span');db.className='is-distance';var dk=Number(place.distance_km);db.textContent='Cách '+(dk<1?Math.max(1,Math.round(dk*1000))+' m':dk.toFixed(dk<10?1:0)+' km');meta.appendChild(db);}var verified=cleanText(place.verified).toUpperCase();if(verified==='TRUE'){var vb=document.createElement('span');vb.className='is-verified';vb.textContent='Đã xác minh';meta.appendChild(vb);}if(place.is_trusted===true){var tb=document.createElement('span');tb.className='is-trusted';tb.textContent='Uy tín';meta.appendChild(tb);}if(place.is_hot===true){var hb=document.createElement('span');hb.className='is-hot';hb.textContent='Đang hot';meta.appendChild(hb);}if(cleanText(place.price)){var pb=document.createElement('span');pb.textContent=cleanText(place.price);meta.appendChild(pb);}if(cleanText(place.hours)){var ob=document.createElement('span');ob.textContent=cleanText(place.hours);meta.appendChild(ob);}if(meta.childNodes.length)card.appendChild(meta);
          var hint=document.createElement('span');hint.className='tl-global-search-card-hint';hint.textContent='Xem đầy đủ thông tin →';card.appendChild(hint);
          card.addEventListener('click',function(){openPlaceSearchResult(place);});grid.appendChild(card);
        }
        function updateCount(){count.textContent=total+(ended?' địa điểm':'+ địa điểm');}
        function loadMore(){
          if(loading||ended)return;loading=true;var loadGeneration=generation;status.style.display='block';status.textContent=total?'Đang tải thêm địa điểm...':(mode==='nearest'?('Đang tìm '+radiusText().toLowerCase()+'...'):'Đang tìm kết quả trùng khớp nhất...');
          var callback='TLSEARCHPAGE_'+Date.now()+'_'+(++requestToken)+'_'+Math.floor(Math.random()*100000),script=document.createElement('script'),done=false,timer=0;
          function finish(){if(done)return;done=true;if(loadGeneration===generation)loading=false;if(timer)clearTimeout(timer);try{delete window[callback];}catch(e){}if(script.parentNode)script.parentNode.removeChild(script);}
          function fail(){if(done)return;if(loadGeneration!==generation){finish();return;}status.style.display='block';status.textContent=total?'Không tải thêm được lúc này. Cuộn lại để thử tiếp.':'Tạm thời chưa tải được dữ liệu địa điểm. Kết quả bài viết vẫn hiển thị bên dưới.';count.textContent=total?total+'+ địa điểm':'--';finish();}
          window[callback]=function(data){
            if(done)return;if(loadGeneration!==generation){finish();return;}
            var raw=(data&&data.ok&&Array.isArray(data.places))?data.places:[];
            raw.forEach(renderCard);total+=raw.length;offset+=raw.length;
            ended=raw.length<pageSize;status.style.display=ended?'none':'block';if(!ended)status.textContent='Cuộn xuống để xem thêm địa điểm';updateCount();
            if(!total&&ended){status.style.display='block';status.textContent=mode==='nearest'?('Chưa có địa điểm nào có “'+query+'” '+radiusText().toLowerCase()+'. Hãy tăng khoảng cách bằng +1 km hoặc +10 km.'):('Chưa có địa điểm nào có “'+query+'” trong tên.');}
            finish();
          };
          var src=api+'?action=searchPlaces&q='+encodeURIComponent(query)+'&limit='+pageSize+'&offset='+offset;
          if(mode==='nearest'&&position){src+='&sort=nearest&lat='+encodeURIComponent(Number(position.lat))+'&lng='+encodeURIComponent(Number(position.lng))+'&radius_km='+encodeURIComponent(radiusKm);}
          script.onerror=fail;script.src=src+'&callback='+encodeURIComponent(callback)+'&_v=17-nearest-accuracy';document.head.appendChild(script);timer=setTimeout(fail,15000);
        }
        function growRadius(step){if(mode!=='nearest')return;radiusKm=Math.min(200,radiusKm+step);resetResults();}
        plus1.addEventListener('click',function(){growRadius(1);});plus10.addEventListener('click',function(){growRadius(10);});
        relevanceTab.addEventListener('click',function(){if(mode==='relevance')return;mode='relevance';resetResults();});nearestTab.addEventListener('click',function(){if(mode==='nearest')return;activateNearest();});
        document.addEventListener('tl:locationchange',function(ev){if(mode!=='nearest'||!ev||!ev.detail)return;var p=ev.detail;if(isFinite(Number(p.lat))&&isFinite(Number(p.lng))){position=p;radiusKm=1;resetResults();}});
        if('IntersectionObserver' in window){var observer=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting;}))loadMore();},{rootMargin:'500px 0px'});observer.observe(status);}else{window.addEventListener('scroll',function(){if(!ended&&!loading&&status.getBoundingClientRect().top<window.innerHeight+500)loadMore();},{passive:true});}
        setTabs();loadMore();
      }

      function loadFeed(){
        if(dataLoaded||loading)return;
        loading=true;
        loadCategoryCatalog();
        var posts=fetch('/feeds/posts/summary?alt=json&max-results=150',{credentials:'same-origin'})
          .then(function(r){if(!r.ok)throw new Error('posts');return r.json();}).catch(function(){return{};});
        var pages=fetch('/feeds/pages/summary?alt=json&max-results=150',{credentials:'same-origin'})
          .then(function(r){if(!r.ok)throw new Error('pages');return r.json();}).catch(function(){return{};});
        Promise.all([pages,posts]).then(function(results){
            var pageEntries=(results[0]&&results[0].feed&&results[0].feed.entry)||[];
            pageEntries.forEach(function(e){
              var title=e.title&&e.title.$t;
              var alt=(e.link||[]).filter(function(l){return l.rel==='alternate';})[0];
              if(title&&alt)addItem('Trang',title,alt.href,'Danh mục');
            });
            var postEntries=(results[1]&&results[1].feed&&results[1].feed.entry)||[];
            postEntries.forEach(function(e){
              var title=e.title&&e.title.$t;
              var alt=(e.link||[]).filter(function(l){return l.rel==='alternate';})[0];
              var terms=(e.category||[]).map(function(c){return cleanText(c&&c.term);}).filter(Boolean);
              if(title&&alt)addItem('Bài viết',title,alt.href,parentForTerms(terms)||'Bài viết',terms);
            });
          }).finally(function(){dataLoaded=true;loading=false;if(suggestInput&&suggestInput.value.trim())renderSuggest(suggestInput.value,suggestInput);});
      }

      /* ---------- V17.59 HOMEPAGE TOP: TOP THIS LOCAL kế thừa xuống KHU VỰC / BÁN KÍNH ---------- */
      function setupHomeTopPlaces(){
        if(!document.body||!document.body.classList.contains('tl-home-view'))return;
        var anchor=document.querySelector('.tl-feed-heading-v24')||document.getElementById('tlHomeAds');
        if(!anchor||!anchor.parentNode)return;

        var section=document.getElementById('tlHomeTopPlaces');
        if(!section){
          section=document.createElement('section');section.id='tlHomeTopPlaces';section.className='tl-home-top-places';section.setAttribute('aria-live','polite');
          section.innerHTML='<div class="tl-home-heading tl-home-top-heading"><div><span class="tl-home-section-kicker">Địa điểm nổi bật</span><h3>TOP dành cho bạn</h3><p id="tlHomeTopNote">TOP THIS LOCAL luôn hiển thị. Khi phù hợp vị trí, TOP THIS LOCAL cũng xuất hiện trong TOP khu vực và TOP bán kính.</p></div></div><div class="tl-home-top-groups" id="tlHomeTopGroups"><div class="tl-home-top-status">Đang tải địa điểm TOP...</div></div>';
          anchor.parentNode.insertBefore(section,anchor);
        }
        var groups=section.querySelector('#tlHomeTopGroups'),note=section.querySelector('#tlHomeTopNote');
        if(!groups)return;
        var candidates=[];

        function rankNumber(place){
          var m=cleanText(place&&place.top_rank).match(/(?:TOP\s*)?(\d+)/i),n=m?Number(m[1]):NaN;
          return isFinite(n)&&n>0?n:Number.POSITIVE_INFINITY;
        }
        function haversineHome(a,b,c,d){
          var R=6371,toRad=Math.PI/180,dLat=(c-a)*toRad,dLng=(d-b)*toRad;
          var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a*toRad)*Math.cos(c*toRad)*Math.sin(dLng/2)*Math.sin(dLng/2);
          return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
        }
        function locationKey(loc){
          if(!loc)return'';
          return norm([loc.locality,loc.region,loc.province,loc.countryName].map(cleanText).filter(Boolean).join(' '));
        }
        function scopeOf(place){
          var raw=cleanText(place&&place.top_scope),scope=norm(raw).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
          var radius=Number(place&&place.top_radius_km),area=cleanText(place&&place.top_locality||place&&place.locality||place&&place.province);
          var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
          var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
          var radii=['radius','ban_kinh','khoang_cach','distance'];
          var kind='global';
          if(scope){
            var looksRadius=scope.indexOf('radius')>-1||scope.indexOf('ban_kinh')>-1||scope.indexOf('khoang_cach')>-1||scope.indexOf('distance')>-1;
            var looksLocal=scope.indexOf('local')>-1||scope.indexOf('dia_phuong')>-1||scope.indexOf('khu_vuc')>-1||scope.indexOf('province')>-1||scope.indexOf('tinh')>-1;
            if(globals.indexOf(scope)>-1)kind='global';
            else if(radii.indexOf(scope)>-1||looksRadius)kind='radius';
            else if(locals.indexOf(scope)>-1||looksLocal)kind='local';
            else if(isFinite(radius)&&radius>0)kind='radius';
            else {kind='local';if(!cleanText(place&&place.top_locality))area=raw;}
          }else if(isFinite(radius)&&radius>0)kind='radius';
          else if(cleanText(place&&place.top_locality))kind='local';
          return{kind:kind,area:area,radius:radius};
        }
        function areaMatches(place,scope,loc){
          var wanted=locationKey(loc);if(!wanted)return false;
          var area=cleanText(place&&place.top_locality)||cleanText(scope&&scope.area)||cleanText(place&&place.locality)||cleanText(place&&place.province);
          var actual=norm(area);if(!actual)return false;
          return wanted.indexOf(actual)>-1||actual.indexOf(wanted)>-1;
        }
        function radiusMembership(place,scope,loc,forcedRadius){
          var radius=Number(forcedRadius);
          if(!isFinite(radius)||radius<=0){
            radius=Number(place&&place.top_radius_km);
            if(!isFinite(radius)||radius<=0)radius=Number(scope&&scope.radius);
          }
          if(!loc||!isFinite(Number(loc.lat))||!isFinite(Number(loc.lng))||!isFinite(radius)||radius<=0||!isFinite(Number(place.lat))||!isFinite(Number(place.lng)))return null;
          var km=haversineHome(Number(loc.lat),Number(loc.lng),Number(place.lat),Number(place.lng));
          if(!isFinite(km)||km>radius)return null;
          return{radius:radius,distance:km};
        }
        function memberships(place,loc){
          var rank=rankNumber(place);if(!isFinite(rank))return[];
          var scope=scopeOf(place),out=[];

          /* Phạm vi gốc. */
          if(scope.kind==='global')out.push({rank:rank,group:'global',original:'global',label:'TOP THIS LOCAL',distance:NaN});

          var localMatch=scope.kind==='local'&&areaMatches(place,scope,loc);
          if(localMatch)out.push({rank:rank,group:'local',original:'local',label:'TOP '+(scope.area||cleanText(place.locality)||cleanText(place.province)||'khu vực'),distance:NaN});

          if(scope.kind==='radius'){
            var ownRadius=radiusMembership(place,scope,loc);
            if(ownRadius)out.push({rank:rank,group:'radius',original:'radius',label:'TOP '+(Math.round(ownRadius.radius*10)/10)+' km',distance:ownRadius.distance,radius:ownRadius.radius});
          }

          /* V17.60: TOP cấp trên được kế thừa xuống "quanh bạn" theo bán kính mặc định 25 km.
             TOP RADIUS vẫn dùng bán kính riêng do quản trị viên cấu hình. */
          if(scope.kind==='global'){
            if(areaMatches(place,scope,loc))out.push({rank:rank,group:'local',original:'global',label:'TOP THIS LOCAL',distance:NaN,inherited:true});
            var inheritedGlobalRadius=radiusMembership(place,scope,loc,GUIDE_RADIUS_KM);
            if(inheritedGlobalRadius)out.push({rank:rank,group:'radius',original:'global',label:'TOP THIS LOCAL',distance:inheritedGlobalRadius.distance,radius:GUIDE_RADIUS_KM,inherited:true});
          }

          if(localMatch){
            var inheritedLocalRadius=radiusMembership(place,scope,loc,GUIDE_RADIUS_KM);
            if(inheritedLocalRadius)out.push({rank:rank,group:'radius',original:'local',label:'TOP '+(scope.area||cleanText(place.locality)||cleanText(place.province)||'khu vực'),distance:inheritedLocalRadius.distance,radius:GUIDE_RADIUS_KM,inherited:true});
          }
          return out;
        }
        function distanceLabel(km){
          if(!isFinite(km))return'';
          if(km<1)return Math.max(10,Math.round(km*1000/10)*10)+' m';
          return (km<10?km.toFixed(1):Math.round(km))+' km';
        }
        function truthy(v){if(v===true||v===1)return true;return ['true','1','yes','y','co','checked','x','uy tin','trusted','hot'].indexOf(norm(v))>-1;}
        function sortItems(items){
          items.sort(function(a,b){
            if(a.info.rank!==b.info.rank)return a.info.rank-b.info.rank;
            if(a.info.original!==b.info.original){
              var priority={global:0,local:1,radius:2};
              var pa=priority[a.info.original]===undefined?9:priority[a.info.original];
              var pb=priority[b.info.original]===undefined?9:priority[b.info.original];
              if(pa!==pb)return pa-pb;
            }
            if(isFinite(a.info.distance)&&isFinite(b.info.distance)&&a.info.distance!==b.info.distance)return a.info.distance-b.info.distance;
            return cleanText(a.place.name).localeCompare(cleanText(b.place.name),'vi');
          });
          return items;
        }
        function makeCard(item){
          var p=item.place,info=item.info;
          var card=document.createElement('button');card.type='button';card.className='tl-home-top-card';card.setAttribute('aria-label','Mở '+(cleanText(p.name)||'địa điểm'));
          var head=document.createElement('div');head.className='tl-home-top-card-head';
          var badge=document.createElement('span');badge.className='tl-home-top-badge is-'+info.original;badge.textContent='TOP'+info.rank+' · '+info.label.replace(/^TOP\s*/,'');
          var cat=document.createElement('span');cat.className='tl-home-top-category';cat.textContent=cleanText(p.category)||cleanText(p.parent_category)||'Địa điểm';
          head.appendChild(badge);head.appendChild(cat);
          var title=document.createElement('strong');title.className='tl-home-top-title';title.textContent=cleanText(p.name)||'Địa điểm';
          var address=document.createElement('span');address.className='tl-home-top-address';address.textContent=cleanText(p.address)||[cleanText(p.locality),cleanText(p.province)].filter(Boolean).join(', ')||'Xem thông tin địa điểm';
          var meta=document.createElement('div');meta.className='tl-home-top-meta';
          if(info.inherited){
            var ih=document.createElement('span');ih.className='is-inherited';
            if(info.group==='local')ih.textContent='TOP THIS LOCAL tại khu vực này';
            else if(info.original==='global')ih.textContent='TOP THIS LOCAL trong '+Math.round(Number(info.radius)||GUIDE_RADIUS_KM)+' km';
            else ih.textContent='TOP khu vực trong '+Math.round(Number(info.radius)||GUIDE_RADIUS_KM)+' km';
            meta.appendChild(ih);
          }
          if(isFinite(info.distance)){var ds=document.createElement('span');ds.textContent='Cách '+distanceLabel(info.distance);meta.appendChild(ds);}
          if(String(p.verified||'').toUpperCase()==='TRUE'){var vr=document.createElement('span');vr.className='is-verified';vr.textContent='Đã xác minh';meta.appendChild(vr);}
          if(truthy(p.is_trusted)){var tr=document.createElement('span');tr.className='is-trusted';tr.textContent='Uy tín';meta.appendChild(tr);}
          if(truthy(p.is_hot)){var ht=document.createElement('span');ht.className='is-hot';ht.textContent='Đang hot';meta.appendChild(ht);}
          card.appendChild(head);card.appendChild(title);card.appendChild(address);if(meta.childNodes.length)card.appendChild(meta);
          card.addEventListener('click',function(){openPlaceSearchResult(p);});
          return card;
        }
        function makeGroup(kind,title,subtitle,items,emptyText){
          if(!items.length&&!emptyText)return null;
          var wrap=document.createElement('section');wrap.className='tl-home-top-group is-'+kind;
          var hd=document.createElement('div');hd.className='tl-home-top-group-head';
          var copy=document.createElement('div');
          var h=document.createElement('h4');h.textContent=title;copy.appendChild(h);
          if(subtitle){var sub=document.createElement('p');sub.textContent=subtitle;copy.appendChild(sub);}
          var count=document.createElement('span');count.className='tl-home-top-group-count';count.textContent=items.length+' địa điểm';
          hd.appendChild(copy);hd.appendChild(count);wrap.appendChild(hd);
          var grid=document.createElement('div');grid.className='tl-home-top-grid';
          if(items.length)items.forEach(function(item){grid.appendChild(makeCard(item));});
          else {var empty=document.createElement('div');empty.className='tl-home-top-status';empty.textContent=emptyText||'Chưa có địa điểm TOP phù hợp.';grid.appendChild(empty);}
          wrap.appendChild(grid);
          return wrap;
        }
        function render(loc){
          var buckets={global:[],local:[],radius:[]};
          candidates.forEach(function(place){memberships(place,loc).forEach(function(info){buckets[info.group].push({place:place,info:info});});});
          sortItems(buckets.global);sortItems(buckets.local);sortItems(buckets.radius);
          groups.innerHTML='';
          var area=loc&&(cleanText(loc.locality)||cleanText(loc.region)||cleanText(loc.province));
          if(note){
            note.textContent=loc?('TOP THIS LOCAL luôn hiển thị'+(area?' và được kế thừa vào TOP '+area+' khi địa điểm thuộc khu vực này.':' và được kế thừa vào các phạm vi vị trí phù hợp.')+' TOP bán kính chỉ hiện khi có bán kính TOP được cấu hình và bạn đang ở trong bán kính đó.'):'TOP THIS LOCAL luôn hiển thị. Bật vị trí để xem TOP khu vực và TOP bán kính; TOP THIS LOCAL phù hợp cũng sẽ xuất hiện lại trong các nhóm đó.';
          }
          var g1=makeGroup('global','TOP THIS LOCAL','Những địa điểm TOP trên toàn hệ thống.',buckets.global);if(g1)groups.appendChild(g1);
          var g2=makeGroup(
            'local',
            area?('TOP khu vực '+area):'TOP khu vực của bạn',
            area?'Bao gồm TOP khu vực và TOP THIS LOCAL nằm tại khu vực này.':'Bật vị trí để xác định khu vực.',
            buckets.local,
            loc?'Chưa có địa điểm TOP phù hợp với khu vực hiện tại.':'Bật vị trí để xem TOP khu vực.'
          );if(g2)groups.appendChild(g2);
          var g3=makeGroup(
            'radius',
            'TOP quanh bạn',
            'TOP THIS LOCAL và TOP khu vực trong '+GUIDE_RADIUS_KM+' km quanh bạn; TOP bán kính riêng vẫn dùng số km do quản trị viên đặt.',
            buckets.radius,
            loc?'Chưa có địa điểm TOP có tọa độ phù hợp trong phạm vi quanh bạn.':'Bật vị trí để xem TOP quanh bạn.'
          );if(g3)groups.appendChild(g3);
          if(!groups.childNodes.length){var empty=document.createElement('div');empty.className='tl-home-top-status';empty.textContent='Hiện chưa có địa điểm TOP phù hợp.';groups.appendChild(empty);}
        }
        function load(){
          var api=window.TL_GUIDE_API_URL||'';
          if(!api){groups.innerHTML='<div class="tl-home-top-status">Chưa kết nối dữ liệu TOP.</div>';return;}
          var callback='TL_HOME_TOP_'+Date.now()+'_'+Math.floor(Math.random()*100000),script=document.createElement('script'),done=false,timer;
          function finish(data){if(done)return;done=true;clearTimeout(timer);try{delete window[callback];}catch(e){}if(script.parentNode)script.parentNode.removeChild(script);candidates=data&&data.ok&&Array.isArray(data.places)?data.places:[];render(getSavedLocation());}
          window[callback]=function(data){finish(data);};
          script.onerror=function(){finish(null);};
          script.src=api+'?action=homepageTop&callback='+encodeURIComponent(callback)+'&_v=17.59';document.head.appendChild(script);
          timer=setTimeout(function(){finish(null);},15000);
        }
        document.addEventListener('tl:locationchange',function(ev){render(ev&&ev.detail?ev.detail:getSavedLocation());});
        load();
      }
      setupHomeTopPlaces();

      /* ---------- HOMEPAGE ADS: chỉ ads1, ads2, ads3... và đúng thứ tự ---------- */
      function setupHomeAds(){
        var host=document.getElementById('tlHomeAds');
        if(!host)return;

        function entryLink(entry){
          var alt=(entry.link||[]).filter(function(link){return link.rel==='alternate';})[0];
          return alt&&alt.href?alt.href:'';
        }
        function entryImage(entry){
          var url=entry.media$thumbnail&&entry.media$thumbnail.url||'';
          if(!url){
            var raw=entry.content&&entry.content.$t||entry.summary&&entry.summary.$t||'';
            for(var i=0;i<3&&!url;i++){
              var holder=document.createElement('div');holder.innerHTML=raw;
              var img=holder.querySelector('img');if(img){url=img.getAttribute('src')||'';break;}
              var decoded=holder.textContent||holder.innerText||'';if(decoded===raw)break;raw=decoded;
            }
          }
          return String(url||'').replace(/\/s\d+(?:-c)?\//,'/s800/');
        }
        function entryOrder(entry){
          var order=Infinity;
          (entry.category||[]).forEach(function(label){
            var match=cleanText(label.term).match(/^ads(\d+)$/i);
            var n=match?Number(match[1]):Infinity;
            if(n>0&&n<order)order=n;
          });
          return order;
        }
        function renderAds(entries){
          var slots={};
          (entries||[]).forEach(function(entry){
            var order=entryOrder(entry);if(!isFinite(order))return;
            var published=Date.parse(entry.published&&entry.published.$t||'')||0;
            if(!slots[order]||published>slots[order]._published){entry._adsOrder=order;entry._published=published;slots[order]=entry;}
          });
          var selected=Object.keys(slots).map(function(key){return slots[key];})
            .sort(function(a,b){return a._adsOrder-b._adsOrder;});

          host.innerHTML='';
          if(!selected.length){
            var empty=document.createElement('div');empty.className='tl-home-ads-status';
            empty.textContent='Chưa có nội dung được chọn.';host.appendChild(empty);return;
          }
          var grid=document.createElement('div');grid.className='tl-home-ads-grid';
          selected.forEach(function(entry){
            var url=entryLink(entry);if(!url)return;
            var card=document.createElement('a');card.className='tl-home-ad-card';card.href=url;
            var image=document.createElement('span');image.className='tl-home-ad-image';image.setAttribute('aria-hidden','true');
            var imageUrl=entryImage(entry);if(imageUrl)image.style.backgroundImage='url("'+imageUrl.replace(/["\\]/g,'\\$&')+'")';
            var copy=document.createElement('span');copy.className='tl-home-ad-copy';
            var title=document.createElement('strong');title.className='tl-home-ad-title';title.textContent=cleanText(entry.title&&entry.title.$t)||'Bài viết';
            var action=document.createElement('span');action.className='tl-home-ad-action';action.textContent='Xem bài viết';
            copy.appendChild(title);copy.appendChild(action);
            card.appendChild(image);card.appendChild(copy);grid.appendChild(card);
          });
          host.appendChild(grid);
        }

        fetch('/feeds/posts/default?alt=json&max-results=500',{credentials:'same-origin',cache:'no-store'})
          .then(function(response){if(!response.ok)throw new Error('home-ads');return response.json();})
          .then(function(data){renderAds(data&&data.feed&&data.feed.entry||[]);})
          .catch(function(){host.innerHTML='<div class="tl-home-ads-status">Tạm thời chưa tải được các bài dành cho trang chủ.</div>';});
      }
      setupHomeAds();

      /* ads1, ads2... là nhãn điều khiển nội bộ, không hiển thị cho người đọc. */
      function hideInternalAdsLabels(){
        document.querySelectorAll('.post-labels a,a[rel="tag"]').forEach(function(link){
          var label='';
          try{
            var path=new URL(link.href,location.href).pathname;
            var index=path.toLowerCase().lastIndexOf('/search/label/');
            label=index>-1?decodeURIComponent(path.slice(index+14)):cleanText(link.textContent);
          }catch(e){label=cleanText(link.textContent);}
          if(!/^ads\d+$/i.test(cleanText(label)))return;
          var parent=link.parentNode,next=link.nextSibling,prev=link.previousSibling;
          if(next&&next.nodeType===3&&/^[\s,·|]+$/.test(next.nodeValue||''))next.remove();
          else if(prev&&prev.nodeType===3&&/^[\s,·|]+$/.test(prev.nodeValue||''))prev.remove();
          link.remove();
          if(parent&&!parent.querySelector('a'))parent.style.display='none';
        });
      }
      hideInternalAdsLabels();

      function scoreItem(item,q){
        var t=item.norm;
        if(t===q)return 100;
        if(t.indexOf(q)===0)return 80;
        if(t.split(/\s+/).some(function(w){return w.indexOf(q)===0;}))return 60;
        if(t.indexOf(q)>-1)return 40;
        return 0;
      }
      function closeSuggest(){
        if(!box)return;
        if(suggestFollowFrame){cancelAnimationFrame(suggestFollowFrame);suggestFollowFrame=0;}
        box.classList.remove('is-open');box.innerHTML='';activeIndex=-1;shown=[];
        if(suggestInput)suggestInput.setAttribute('aria-expanded','false');
      }
      function positionSuggest(){
        if(!box||!suggestAnchor)return;
        var r=suggestAnchor.getBoundingClientRect();
        var gap=8, edge=8;
        var viewport=window.visualViewport;
        var viewLeft=viewport?viewport.offsetLeft:0;
        var viewTop=viewport?viewport.offsetTop:0;
        var viewWidth=viewport?viewport.width:window.innerWidth;
        var viewHeight=viewport?viewport.height:window.innerHeight;
        var viewRight=viewLeft+viewWidth,viewBottom=viewTop+viewHeight;
        var width=Math.min(r.width,viewWidth-edge*2);
        var left=Math.max(viewLeft+edge,Math.min(r.left,viewRight-width-edge));
        box.style.width=Math.max(220,width)+'px';
        box.style.left=left+'px';
        box.style.right='auto';
        box.style.bottom='auto';
        var maxH=Math.min(360,Math.max(120,viewHeight-edge*2));
        box.style.maxHeight=maxH+'px';
        var estimated=Math.min(Math.max(box.scrollHeight||220,120),maxH);
        var below=viewBottom-r.bottom-gap-edge;
        var above=r.top-viewTop-gap-edge;
        var mobile=viewWidth<=760;
        try{mobile=mobile||window.matchMedia('(pointer:coarse)').matches;}catch(e){}
        if(mobile){
          /* V17.2: hộp gợi ý tuyệt đối không được lấn lên vùng nhập. */
          var safeTop=Math.max(viewTop+edge,r.bottom+gap);
          var available=Math.max(0,viewBottom-safeTop-edge);
          box.style.top=safeTop+'px';
          box.style.maxHeight=Math.max(72,Math.min(300,available||72))+'px';
                  }else if(below>=Math.min(160,estimated) || below>=above){
          box.style.top=Math.max(viewTop+edge,r.bottom+gap)+'px';
        }else{
          box.style.top=Math.max(viewTop+edge,r.top-gap-estimated)+'px';
        }
      }
      /* V17.13: một bộ định vị gợi ý duy nhất cho mobile. */
      window.TL_POSITION_SEARCH_SUGGEST=positionSuggest;
      function followSuggest(){
        suggestFollowFrame=0;
        if(!box||!box.classList.contains('is-open')||!suggestAnchor)return;
        positionSuggest();
      }
      function startSuggestFollow(){
        if(suggestFollowFrame)return;
        suggestFollowFrame=requestAnimationFrame(followSuggest);
      }
      function renderSuggest(raw,sourceInput){
        if(!box)return;
        if(sourceInput){
          suggestInput=sourceInput;
          suggestAnchor=sourceInput.__tlSuggestAnchor||((sourceInput===input&&form)?form:(sourceInput.closest('.tl-search-control-v17')||sourceInput.closest('.tl-search-page-form')||sourceInput.closest('.tl-inline-search-form')||sourceInput.closest('.tl-category-hub-search-control')||sourceInput));
        }
        if(!suggestInput)return;
        var q=norm(raw);
        if(q.length<1){closeSuggest();return;}
        var searchMode=searchModeForInput(suggestInput);
        var typeOrder={'Trang':0,'Bài viết':1,'Địa điểm':0};
        shown=searchData.filter(function(item){return searchMode==='place'?item.type==='Địa điểm':(item.type==='Trang'||item.type==='Bài viết');}).map(function(item){
            var base=scoreItem(item,q),boost=item.type==='Trang'?10:0;
            return {item:item,score:base,effective:base?base+boost:0};
          })
          .filter(function(x){return x.score>0;})
          .sort(function(a,b){if(b.effective!==a.effective)return b.effective-a.effective;var ao=typeOrder[a.item.type]===undefined?9:typeOrder[a.item.type],bo=typeOrder[b.item.type]===undefined?9:typeOrder[b.item.type];if(ao!==bo)return ao-bo;return a.item.title.localeCompare(b.item.title,'vi');})
          .slice(0,10).map(function(x){return x.item;});
        box.innerHTML=''; activeIndex=-1;
        var groupTitle=document.createElement('div');groupTitle.className='tl-suggest-group-title';groupTitle.textContent=searchMode==='place'?'Địa điểm':'Danh mục';box.appendChild(groupTitle);
        if(!shown.length){
          var empty=document.createElement('div'); empty.className='tl-search-empty'; empty.textContent=placeSearchMessage||('Chưa có gợi ý phù hợp. Nhấn Enter để tìm “'+cleanText(raw)+'”.'); box.appendChild(empty);
        }else{
          shown.forEach(function(item,idx){
            var a=document.createElement('a');a.className='tl-suggest-item';a.href=item.url;a.setAttribute('role','option');a.dataset.index=idx;a.dataset.resultType=item.type;
            if(item.place)a.addEventListener('click',function(event){event.preventDefault();openPlaceSearchResult(item.place);});
            var icon=document.createElement('span');icon.className='tl-suggest-icon';
            if(item.type==='Địa điểm')icon.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
            else if(item.type==='Bài viết')icon.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>';
            else icon.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h6"/></svg>';
            var copy=document.createElement('span'); copy.className='tl-suggest-copy';
            var title=document.createElement('span'); title.className='tl-suggest-title'; title.textContent=item.title;
            var type=document.createElement('span');type.className='tl-suggest-type';type.textContent=item.type==='Địa điểm'?(item.subtitle||'Địa điểm'):('Danh mục'+((item.subtitle&&item.subtitle!=='Danh mục'&&item.subtitle!=='Bài viết')?(' · '+item.subtitle):''));
            copy.appendChild(title); copy.appendChild(type); a.appendChild(icon); a.appendChild(copy); box.appendChild(a);
          });
        }
        /* V17.12: mở trực tiếp dưới thanh tìm kiếm; không ẩn để đo rồi hiện lại. */
                box.classList.add('is-open');
        /* Mobile: ghim form trước, rồi mới đo vị trí gợi ý. Không đổi DOM của input. */
        if(window.TL_PIN_ACTIVE_SEARCH&&suggestAnchor)window.TL_PIN_ACTIVE_SEARCH(suggestAnchor);
        positionSuggest();
        suggestInput.setAttribute('aria-expanded','true');
        startSuggestFollow();
      }
      function setActive(n){
        if(!box||!shown.length)return;
        var nodes=box.querySelectorAll('.tl-suggest-item');
        nodes.forEach(function(x){x.classList.remove('is-active');x.setAttribute('aria-selected','false');});
        activeIndex=(n+shown.length)%shown.length;
        if(nodes[activeIndex]){nodes[activeIndex].classList.add('is-active');nodes[activeIndex].setAttribute('aria-selected','true');nodes[activeIndex].scrollIntoView({block:'nearest'});}
      }
      function activateShownItem(item){if(!item)return;if(item.place){openPlaceSearchResult(item.place);return;}location.href=item.url;}
      var existingLocation=getSavedLocation();
      showLocationState(existingLocation);
      document.addEventListener('tl:locationchange',function(ev){if(ev&&ev.detail)showLocationState(ev.detail);});
      if(locationBtn)locationBtn.addEventListener('click',requestHomeLocation);

      var proposeFab=document.getElementById('tlProposeFab');
      if(proposeFab){
        proposeFab.addEventListener('click',function(){
          var guide=document.querySelector('.post-body .vlc-local-guide[data-category]');
          var hint=guide?cleanText(guide.getAttribute('data-category')):'';
          var hubParent=cleanText(window.TL_CATEGORY_HUB_PARENT||'');
          var hubActive=cleanText(window.TL_CATEGORY_HUB_ACTIVE||'');
          var hubChildren=Array.isArray(window.TL_CATEGORY_HUB_CHILDREN)?window.TL_CATEGORY_HUB_CHILDREN.slice():[];
          if(hubParent)hint=hubActive;
          if(typeof window.TL_OPEN_PROPOSAL==='function')window.TL_OPEN_PROPOSAL(hint,hubChildren,hubParent);
        });
      }

      if(box){
        seedFromPage();
        function bindSuggestInput(node){
          if(!node||node.__tlSuggestBound)return;node.__tlSuggestBound=true;
          node.setAttribute('aria-autocomplete','list');node.setAttribute('aria-controls','tlSearchSuggest');node.setAttribute('aria-expanded','false');
          node.addEventListener('focus',function(){suggestInput=node;suggestAnchor=node.__tlSuggestAnchor||((node===input&&form)?form:(node.closest('.tl-search-control-v17')||node.closest('.tl-search-page-form')||node.closest('.tl-inline-search-form')||node.closest('.tl-category-hub-search-control')||node));loadFeed();schedulePlaceSearch(node.value,node);if(node.value.trim())renderSuggest(node.value,node);});
          node.addEventListener('input',function(){loadFeed();schedulePlaceSearch(node.value,node);renderSuggest(node.value,node);});
          node.addEventListener('keydown',function(e){
          if(e.key==='ArrowDown'&&shown.length){e.preventDefault();setActive(activeIndex+1);}
          else if(e.key==='ArrowUp'&&shown.length){e.preventDefault();setActive(activeIndex-1);}
          else if(e.key==='Escape'){closeSuggest();}
          else if(e.key==='Enter'){activeIndex=-1;if(node===hubSearchInput){e.preventDefault();var q=cleanText(node.value);if(norm(q).length>=2){if(placeSearchTimer)clearTimeout(placeSearchTimer);closeSuggest();var hm=document.getElementById('tlHubSearchMode');var mode=hm&&hm.value==='place'?'place':'category';location.href='/search?q='+encodeURIComponent(q)+'&type='+mode;}}}
          });
        }
        function bindModeSelect(select,node){
          if(!select||!node)return;
          node.__tlModeSelect=select;
          if(select.__tlModeBound){updateSearchModeUI(select,node);return;}
          select.__tlModeBound=true;updateSearchModeUI(select,node);
          select.addEventListener('change',function(){
            /* V17.11: đổi mode chỉ đổi UI + xóa trạng thái cũ. Không gọi API/render trong lúc native select đang đóng. */
            node.__tlModeSelect=select;
            updateSearchModeUI(select,node);
            if(placeSearchTimer){clearTimeout(placeSearchTimer);placeSearchTimer=0;}
            placeSearchSerial++;
            placeSearchMessage='';
            clearPlaceSearchItems();
            closeSuggest();
          });
        }
        var homeMode=document.getElementById('tlSmartSearchMode'),hubMode=document.getElementById('tlHubSearchMode');
        bindSuggestInput(input);bindModeSelect(homeMode,input);bindSuggestInput(hubSearchInput);bindModeSelect(hubMode,hubSearchInput);
        window.TL_BIND_SEARCH_UI=function(node,select,anchor){if(!node)return;node.__tlSuggestAnchor=anchor||node.closest('form')||node;node.__tlSearchScope=anchor||node.closest('form')||node;node.__tlModeSelect=select||null;bindSuggestInput(node);bindModeSelect(select,node);seedFromPage();};
        if(hubSearchButton&&hubSearchInput){hubSearchButton.addEventListener('click',function(){var q=cleanText(hubSearchInput.value);if(norm(q).length<2){hubSearchInput.focus();return;}if(placeSearchTimer)clearTimeout(placeSearchTimer);closeSuggest();var m=hubMode&&hubMode.value==='place'?'place':'category';location.href='/search?q='+encodeURIComponent(q)+'&type='+m;});}
        window.addEventListener('resize',function(){if(box.classList.contains('is-open'))startSuggestFollow();},{passive:true});
        window.addEventListener('scroll',function(){if(box.classList.contains('is-open'))startSuggestFollow();},{passive:true});
        if(window.visualViewport){
          window.visualViewport.addEventListener('resize',function(){if(box.classList.contains('is-open'))startSuggestFollow();},{passive:true});
          window.visualViewport.addEventListener('scroll',function(){if(box.classList.contains('is-open'))startSuggestFollow();},{passive:true});
        }
        document.addEventListener('click',function(e){
          var insideSearch=e.target&&e.target.closest&&(e.target.closest('.tl-search-control-v17')||e.target.closest('.tl-search-page-form')||e.target.closest('.tl-inline-search-form')||e.target.closest('.tl-category-hub-search-control'));
          if(!insideSearch&&!box.contains(e.target))closeSuggest();
        });
        if(form)form.addEventListener('submit',function(){
          /* Enter/nút Tìm luôn sang /search?q=. Chỉ click trực tiếp vào gợi ý mới mở bảng địa điểm. */
          if(placeSearchTimer)clearTimeout(placeSearchTimer);
          closeSuggest();
        });
      }
      setupGlobalSearchResults();
      setupVisibleEntityFix();

      /* ---------- SEARCH STICKY: giữ vị trí cũ, chỉ bám khi chạm dưới header ---------- */
      (function setupStickySearch(){
        if(!form||!form.parentNode)return;

        var marker=document.createElement('div');
        marker.className='tl-search-sticky-marker';
        marker.setAttribute('aria-hidden','true');
        form.parentNode.insertBefore(marker,form);

        var siteHeader=document.querySelector('.tl-site-header');
        var isSticky=false;
        var originPageTop=0;
        var outerHeight=0;
        var stickyFrame=0;
        var STICKY_GAP=10;

        function number(v){v=parseFloat(v);return isFinite(v)?v:0;}
        function stickyTop(){
          var bottom=siteHeader?Number(siteHeader.getBoundingClientRect().bottom||0):0;
          var height=siteHeader?Number(siteHeader.offsetHeight||0):0;
          /* V17.55: trên mobile dùng chiều cao header thật làm sàn cố định.
             Tránh Chrome/Safari đổi visual viewport làm search nhích lên chui dưới header. */
          if(window.innerWidth<=760)return Math.max(Math.round(height),Math.round(bottom),0)+STICKY_GAP;
          return Math.max(Math.round(bottom),0)+STICKY_GAP;
        }
        function rememberOrigin(){
          if(isSticky)return;
          var r=form.getBoundingClientRect();
          var cs=getComputedStyle(form);
          originPageTop=window.pageYOffset+r.top;
          outerHeight=Math.ceil(r.height+number(cs.marginTop)+number(cs.marginBottom));
        }
        function placeSticky(){
          var top=stickyTop();
          var parentRect=marker.parentElement.getBoundingClientRect();
          var edge=8,viewport=window.visualViewport;
          var viewLeft=viewport?Number(viewport.offsetLeft||0):0;
          var viewWidth=viewport?Number(viewport.width||window.innerWidth):window.innerWidth;
          var left,width;
          /* V17.53: mobile sticky search mở rộng theo viewport và luôn cân giữa màn hình. */
          if(window.innerWidth<=760){
            left=viewLeft+edge;
            width=Math.max(0,viewWidth-edge*2);
          }else{
            left=Math.max(edge,Math.min(parentRect.left,window.innerWidth-edge));
            width=Math.min(690,parentRect.width,window.innerWidth-left-edge);
          }
          width=Math.max(0,Math.round(width));
          form.style.setProperty('--tl-sticky-search-top',top+'px');
          form.style.setProperty('--tl-sticky-search-left',Math.round(left)+'px');
          form.style.setProperty('--tl-sticky-search-width',width+'px');
          if(box&&box.classList.contains('is-open'))positionSuggest();
        }
        function stick(){
          if(isSticky)return;
          isSticky=true;
          marker.style.height=outerHeight+'px';
          placeSticky();
          form.classList.add('tl-search-is-sticky');
          /* Đưa form ra body để không bị overflow:hidden của hero cắt mất. */
          document.body.appendChild(form);
          if(box&&box.classList.contains('is-open'))startSuggestFollow();
        }
        function unstick(){
          if(!isSticky)return;
          isSticky=false;
          form.classList.remove('tl-search-is-sticky');
          if(marker.parentNode)marker.parentNode.insertBefore(form,marker.nextSibling);
          form.style.removeProperty('--tl-sticky-search-top');
          form.style.removeProperty('--tl-sticky-search-left');
          form.style.removeProperty('--tl-sticky-search-width');
          marker.style.height='0px';
          rememberOrigin();
          if(box&&box.classList.contains('is-open'))startSuggestFollow();
        }
        function updateSticky(){
          stickyFrame=0;
          /* V17.55: sticky là nguồn duy nhất quyết định form đang bám hay ở vị trí gốc.
             tl-mobile-search-pinned chỉ hỗ trợ nhập liệu/gợi ý, không được chặn cập nhật sticky. */
          var lockTop=stickyTop();
          var markerTop=marker.getBoundingClientRect().top;
          /* V17.55: chỉ trả search về chỗ cũ khi marker thật sự đã xuống dưới header + gap.
             Khi kéo ngược lên, search không được nhả sticky sớm và chui dưới header. */
          var shouldStick=isSticky?(markerTop<=lockTop+2):(markerTop<=lockTop);
          if(shouldStick)stick();else unstick();
          if(isSticky)placeSticky();
        }
        syncStickySearch=updateSticky;
        function queueSticky(){
          if(stickyFrame)return;
          stickyFrame=requestAnimationFrame(updateSticky);
        }

        rememberOrigin();
        updateSticky();
        window.addEventListener('scroll',queueSticky,{passive:true});
        window.addEventListener('resize',function(){
          if(!isSticky)rememberOrigin();
          queueSticky();
        },{passive:true});
        window.addEventListener('load',function(){
          if(!isSticky)rememberOrigin();
          queueSticky();
        },{once:true});
        if(window.visualViewport){
          window.visualViewport.addEventListener('resize',queueSticky,{passive:true});
          window.visualViewport.addEventListener('scroll',queueSticky,{passive:true});
        }
      })();

      /* ---------- AUTO DATA-TOOLTIP + TOOLTIP BÁM CHUỘT ---------- */
      var tip=document.createElement('div'); tip.id='tlCursorTooltip'; tip.setAttribute('role','tooltip'); document.body.appendChild(tip);
      var currentLink=null;
      function buildTooltip(a){
        if(!a||a.matches('.b-tooltip-container,[data-no-tooltip]'))return;
        if(cleanText(a.getAttribute('data-tooltip')))return;
        var explicit=cleanText(a.getAttribute('title'))||cleanText(a.getAttribute('aria-label'));
        var text=cleanText(a.textContent);
        if(a.matches('.tl-category-card')){
          var categoryTitle=a.querySelector('strong'),categorySub=a.querySelector('small');
          text=cleanText((categoryTitle?categoryTitle.textContent:'')+' '+(categorySub?categorySub.textContent:''));
        }
        function cleanTooltipLabel(v){
          v=cleanText(v);
          return v.replace(/^(?:Mở\s*:?\s*|Open\s*:?\s*|打开\s*[:：]?\s*|เปิด\s*:?\s*)/i,'').trim();
        }
        var value=cleanTooltipLabel(explicit);
        if(!value&&text)value=cleanTooltipLabel(text.slice(0,100));
        if(!value){
          try{var u=new URL(a.href,location.href);value=u.hostname.replace(/^www\./,'')+(u.pathname&&u.pathname!=='/'?' - '+u.pathname:'');}catch(e){}
        }
        if(value){
          a.setAttribute('data-tooltip',value);
          if(a.hasAttribute('title')){a.setAttribute('data-tl-title',a.getAttribute('title'));a.removeAttribute('title');}
        }
      }
      function scanLinks(root){
        if(!root||root.nodeType!==1)return;
        if(root.matches&&root.matches('a[href]'))buildTooltip(root);
        if(root.querySelectorAll)root.querySelectorAll('a[href]').forEach(buildTooltip);
      }
      function moveTip(e){
        if(!tip.classList.contains('is-show'))return;
        var gap=16,x=e.clientX+gap,y=e.clientY+18;
        var r=tip.getBoundingClientRect();
        if(x+r.width>window.innerWidth-8)x=e.clientX-r.width-gap;
        if(y+r.height>window.innerHeight-8)y=e.clientY-r.height-14;
        x=Math.max(8,x); y=Math.max(8,y);
        tip.style.transform='translate3d('+Math.round(x)+'px,'+Math.round(y)+'px,0)';
      }
      scanLinks(document.body);
      document.addEventListener('mouseover',function(e){
        var a=e.target.closest&&e.target.closest('a[href]'); if(!a)return; buildTooltip(a);
        var text=cleanText(a.getAttribute('data-tooltip')); if(!text)return;
        currentLink=a; tip.textContent=text; tip.classList.add('is-show'); moveTip(e);
      });
      document.addEventListener('mousemove',function(e){if(currentLink)moveTip(e);},{passive:true});
      document.addEventListener('mouseout',function(e){
        if(!currentLink)return;
        var to=e.relatedTarget; if(to&&currentLink.contains(to))return;
        var from=e.target.closest&&e.target.closest('a[href]'); if(from===currentLink){currentLink=null;tip.classList.remove('is-show');}
      });
      window.addEventListener('scroll',function(){if(currentLink){currentLink=null;tip.classList.remove('is-show');}},{passive:true});

      if(window.MutationObserver){
        new MutationObserver(function(muts){
          muts.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)scanLinks(n);});});
        }).observe(document.body,{childList:true,subtree:true});
      }
    })();
    //


/* ---- original script block 8 ---- */
(function(){
  'use strict';

  var LANG_KEY='tl_language_v1';
  var MANUAL_KEY='tl_language_manual_v1';
  var LOCATION_KEY='tl_user_location_v1';
  var LANGS=['vi','en','zh','th','ru','ja','ko'];
  var LOCALES={vi:'vi-VN',en:'en-US',zh:'zh-CN',th:'th-TH',ru:'ru-RU',ja:'ja-JP',ko:'ko-KR'};
  var COUNTRY_LANG={VN:'vi',TH:'th',CN:'zh',TW:'zh',HK:'zh',MO:'zh',RU:'ru',JP:'ja',KR:'ko'};

  var UI={
    'Khám phá':{en:'Explore',zh:'探索',th:'สำรวจ'},
    'Ngôn ngữ':{en:'Language',zh:'语言',th:'ภาษา'},
    'Danh mục chính':{en:'Main categories',zh:'主要类别',th:'หมวดหมู่หลัก'},
    'Điều hướng nhanh':{en:'Quick navigation',zh:'快速导航',th:'เมนูด่วน'},
    'This Local - Trang chủ':{en:'This Local - Home',zh:'This Local - 首页',th:'This Local - หน้าหลัก'},
    'Ăn uống':{en:'Food',zh:'美食',th:'อาหาร'},
    'Cà phê':{en:'Cafes',zh:'咖啡',th:'คาเฟ่'},
    'Đi chơi':{en:'Things to do',zh:'游玩',th:'ที่เที่ยว'},
    'Lưu trú':{en:'Stays',zh:'住宿',th:'ที่พัก'},
    'Dịch vụ':{en:'Services',zh:'服务',th:'บริการ'},
    'Mua sắm':{en:'Shopping',zh:'购物',th:'ช้อปปิ้ง'},
    'Chưa bật vị trí':{en:'Location is off',zh:'尚未开启定位',th:'ยังไม่ได้เปิดตำแหน่ง'},
    'Đã bật vị trí':{en:'Location enabled',zh:'已开启定位',th:'เปิดตำแหน่งแล้ว'},
    'Đang xác định địa danh...':{en:'Identifying your area...',zh:'正在识别你所在的地区…',th:'กำลังระบุพื้นที่ของคุณ...'},
    'Khám phá quanh bạn':{en:'Explore around you',zh:'探索你周边',th:'สำรวจรอบตัวคุณ'},
    'Đi đâu, ăn gì, tìm gì quanh bạn?':{en:'Where to go, what to eat, what to find nearby?',zh:'附近去哪儿、吃什么、找什么？',th:'ไปไหนดี กินอะไร และหาอะไรใกล้ตัว?'},
    'This Local giúp bạn tìm quán ăn, cà phê, nơi lưu trú và dịch vụ quanh mình theo cách nhanh, trực quan và dễ cập nhật.':{en:'This Local helps you find food, cafes, stays and services nearby quickly, clearly and with up-to-date community data.',zh:'This Local 帮你快速查找附近的美食、咖啡、住宿和服务，信息直观且便于更新。',th:'This Local ช่วยค้นหาร้านอาหาร คาเฟ่ ที่พัก และบริการใกล้ตัวได้รวดเร็ว ดูง่าย และอัปเดตได้'},
    'Tìm địa điểm':{en:'Find places',zh:'查找地点',th:'ค้นหาสถานที่'},
    'Ví dụ: món ăn, cà phê, khách sạn, salon...':{en:'Example: food, cafe, hotel, salon...',zh:'例如：美食、咖啡、酒店、美发店...',th:'เช่น อาหาร คาเฟ่ โรงแรม ซาลอน...'},
    'Tìm trên This Local':{en:'Search This Local',zh:'在 This Local 搜索',th:'ค้นหาใน This Local'},
    'Gợi ý tìm kiếm':{en:'Search suggestions',zh:'搜索建议',th:'คำแนะนำการค้นหา'},
    'Tìm nhanh trong Danh mục này':{en:'Quick search in this category',zh:'在此分类中快速搜索',th:'ค้นหาอย่างรวดเร็วในหมวดนี้'},
    'Nhập tên món, loại hình hoặc địa điểm...':{en:'Enter a dish, type or place...',zh:'输入菜品、类型或地点...',th:'พิมพ์เมนู ประเภท หรือสถานที่...'},
    'Dùng vị trí hiện tại':{en:'Use current location',zh:'使用当前位置',th:'ใช้ตำแหน่งปัจจุบัน'},
    'Bật vị trí để This Local ưu tiên địa điểm gần bạn.':{en:'Enable location so This Local can prioritize places near you.',zh:'开启定位后，This Local 会优先显示你附近的地点。',th:'เปิดตำแหน่งเพื่อให้ This Local จัดลำดับสถานที่ใกล้คุณก่อน'},
    'Dữ liệu cộng đồng':{en:'Community data',zh:'社区数据',th:'ข้อมูลจากชุมชน'},
    'Có kiểm duyệt':{en:'Moderated',zh:'经过审核',th:'มีการตรวจสอบ'},
    'Ưu tiên thông tin thực tế':{en:'Practical information first',zh:'优先实用信息',th:'เน้นข้อมูลที่ใช้ได้จริง'},
    'Khám phá theo nhu cầu':{en:'Explore by need',zh:'按需求探索',th:'ค้นหาตามความต้องการ'},
    'Chọn nhanh nhóm bạn đang cần thay vì phải lướt qua hàng loạt bài.':{en:'Jump straight to what you need instead of browsing through many posts.',zh:'直接选择所需类别，不必浏览大量文章。',th:'เลือกหมวดที่ต้องการได้ทันทีโดยไม่ต้องเลื่อนดูหลายบทความ'},
    'Quán ăn · đặc sản':{en:'Restaurants · specialties',zh:'餐馆 · 特色美食',th:'ร้านอาหาร · ของขึ้นชื่อ'},
    'Đẹp · yên tĩnh · chill':{en:'Beautiful · quiet · chill',zh:'好看 · 安静 · 放松',th:'สวย · เงียบ · ชิล'},
    'Check-in · trải nghiệm':{en:'Check-ins · experiences',zh:'打卡 · 体验',th:'เช็กอิน · ประสบการณ์'},
    'Hotel · homestay':{en:'Hotels · homestays',zh:'酒店 · 民宿',th:'โรงแรม · โฮมสเตย์'},
    'Cửa hàng · đặc sản':{en:'Shops · local specialties',zh:'商店 · 地方特产',th:'ร้านค้า · ของท้องถิ่น'},
    'Tiện ích quanh bạn':{en:'Useful services nearby',zh:'附近便民服务',th:'บริการใกล้คุณ'},
    'Nội dung được chọn':{en:'Selected content',zh:'精选内容',th:'เนื้อหาที่เลือก'},
    'Xem bài viết':{en:'View post',zh:'查看文章',th:'ดูโพสต์'},
    'Đang tải các bài được chọn cho trang chủ...':{en:'Loading selected homepage posts...',zh:'正在加载首页精选文章…',th:'กำลังโหลดโพสต์ที่เลือกสำหรับหน้าแรก...'},
    'Chưa có nội dung được chọn.':{en:'No content has been selected yet.',zh:'暂未选择内容。',th:'ยังไม่ได้เลือกเนื้อหา'},
    'Tạm thời chưa tải được các bài dành cho trang chủ.':{en:'Selected homepage posts could not be loaded right now.',zh:'暂时无法加载首页精选文章。',th:'ยังไม่สามารถโหลดโพสต์สำหรับหน้าแรกได้ในขณะนี้'},
    'Dữ liệu quanh bạn, dễ tìm và dễ cập nhật.':{en:'Nearby data, easy to find and easy to update.',zh:'身边的数据，易查找、易更新。',th:'ข้อมูลรอบตัว ค้นหาง่าย อัปเดตง่าย'},
    'Đề xuất địa điểm':{en:'Suggest a place',zh:'推荐地点',th:'แนะนำสถานที่'},
    'Đề xuất':{en:'Suggest',zh:'推荐',th:'แนะนำ'},
    'Đề xuất địa điểm mới':{en:'Suggest a new place',zh:'推荐新地点',th:'แนะนำสถานที่ใหม่'},

    'THIS LOCAL - Dữ liệu cộng đồng':{en:'THIS LOCAL - Community data',zh:'THIS LOCAL - 社区数据',th:'THIS LOCAL - ข้อมูลชุมชน'},
    'Danh sách do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị.':{en:'The list is contributed by the community and reviewed by THIS LOCAL before it is shown.',zh:'列表由社区共同提供，并由 THIS LOCAL 审核后显示。',th:'รายการมาจากชุมชนและผ่านการตรวจสอบโดย THIS LOCAL ก่อนแสดงผล'},
    'Xác định vị trí':{en:'Detect location',zh:'定位当前位置',th:'ระบุตำแหน่ง'},
    'Cập nhật vị trí của tôi':{en:'Update my location',zh:'更新我的位置',th:'อัปเดตตำแหน่งของฉัน'},
    'Đang cập nhật vị trí...':{en:'Updating location...',zh:'正在更新位置…',th:'กำลังอัปเดตตำแหน่ง...'},
    'Xem thêm địa điểm':{en:'Show more places',zh:'查看更多地点',th:'ดูสถานที่เพิ่มเติม'},
    'Không lấy được vị trí. Vui lòng thử lại.':{en:'Could not get your location. Please try again.',zh:'无法获取你的位置，请重试。',th:'ไม่สามารถรับตำแหน่งของคุณได้ โปรดลองอีกครั้ง'},
    'Không lấy được vị trí. Vui lòng kiểm tra quyền vị trí và thử lại.':{en:'Could not get your location. Check location permission and try again.',zh:'无法获取你的位置，请检查定位权限后重试。',th:'ไม่สามารถรับตำแหน่งของคุณได้ โปรดตรวจสอบสิทธิ์ตำแหน่งแล้วลองอีกครั้ง'},
    'Đang tải danh sách đã kiểm duyệt...':{en:'Loading reviewed places...',zh:'正在加载已审核地点...',th:'กำลังโหลดสถานที่ที่ตรวจสอบแล้ว...'},
    'Bạn biết địa điểm khác?':{en:'Know another place?',zh:'知道其他地点吗？',th:'รู้จักสถานที่อื่นไหม?'},
    'Gửi địa điểm mới hoặc báo thông tin cần sửa. Nội dung chỉ xuất hiện sau khi THIS LOCAL duyệt.':{en:'Suggest a new place or report information that needs updating. It appears only after THIS LOCAL reviews it.',zh:'可推荐新地点或提交需要更正的信息，经 THIS LOCAL 审核后才会显示。',th:'แนะนำสถานที่ใหม่หรือแจ้งข้อมูลที่ต้องแก้ไข โดยจะแสดงหลัง THIS LOCAL ตรวจสอบแล้ว'},
    'Cập nhật vị trí':{en:'Update location',zh:'更新位置',th:'อัปเดตตำแหน่ง'},
    'Gần bạn nhất':{en:'Nearest to you',zh:'离你最近',th:'ใกล้คุณที่สุด'},
    'Chỉ đường':{en:'Directions',zh:'路线',th:'เส้นทาง'},
    'Gọi':{en:'Call',zh:'拨打电话',th:'โทร'},
    'Cập nhật thông tin':{en:'Update info',zh:'更新信息',th:'อัปเดตข้อมูล'},
    'Uy tín':{en:'Trusted',zh:'信誉商家',th:'น่าเชื่อถือ'},
    'Đang hot':{en:'Hot now',zh:'热门',th:'กำลังฮิต'},
    'Tạm thời đóng cửa':{en:'Temporarily closed',zh:'暂时关闭',th:'ปิดชั่วคราว'},
    'Đã đóng vĩnh viễn':{en:'Permanently closed',zh:'永久关闭',th:'ปิดถาวร'},
    'Đã đóng cửa vĩnh viễn':{en:'Permanently closed',zh:'永久关闭',th:'ปิดถาวร'},
    'Chưa có dữ liệu đã duyệt.':{en:'No reviewed data yet.',zh:'暂无已审核数据。',th:'ยังไม่มีข้อมูลที่ตรวจสอบแล้ว'},
    'Đang xếp từ gần đến xa':{en:'Sorting nearest first',zh:'正在按距离由近到远排序',th:'กำลังเรียงจากใกล้ไปไกล'},
    'Tạm thời chưa tải được dữ liệu.':{en:'Data is temporarily unavailable.',zh:'暂时无法加载数据。',th:'ยังโหลดข้อมูลไม่ได้ชั่วคราว'},
    'Không tải được dữ liệu':{en:'Could not load data',zh:'无法加载数据',th:'โหลดข้อมูลไม่ได้'},
    'Không thể tải danh sách lúc này. Vui lòng thử lại sau.':{en:'The list cannot be loaded right now. Please try again later.',zh:'目前无法加载列表，请稍后再试。',th:'ขณะนี้โหลดรายการไม่ได้ โปรดลองอีกครั้งภายหลัง'},
    'Địa điểm':{en:'Place',zh:'地点',th:'สถานที่'},
    'Địa chỉ':{en:'Address',zh:'地址',th:'ที่อยู่'},
    'Giá từ':{en:'Price from',zh:'最低价格',th:'ราคาเริ่มต้น'},
    'Giá đến':{en:'Price up to',zh:'最高价格',th:'ราคาสูงสุด'},

    'Cập nhật thông tin địa điểm':{en:'Update place information',zh:'更新地点信息',th:'อัปเดตข้อมูลสถานที่'},
    'Đóng':{en:'Close',zh:'关闭',th:'ปิด'},
    'Đóng cửa sổ đề xuất':{en:'Close suggestion window',zh:'关闭推荐窗口',th:'ปิดหน้าต่างแนะนำ'},
    'Đã gửi thông tin. THIS LOCAL sẽ kiểm tra trước khi công khai.':{en:'Information sent. THIS LOCAL will review it before publishing.',zh:'信息已提交，THIS LOCAL 审核后才会公开。',th:'ส่งข้อมูลแล้ว THIS LOCAL จะตรวจสอบก่อนเผยแพร่'},
    'Category':{en:'Category',zh:'类别',th:'หมวดหมู่'},
    'Tên Category mới':{en:'New category name',zh:'新类别名称',th:'ชื่อหมวดหมู่ใหม่'},
    'Ví dụ: Bánh cuốn':{en:'Example: Rice rolls',zh:'例如：越南蒸粉卷',th:'เช่น บั๋นก๊วน'},
    'Nhập tên Category mới ngắn gọn, dễ hiểu.':{en:'Enter a short, clear new category name.',zh:'请输入简短清晰的新类别名称。',th:'กรอกชื่อหมวดหมู่ใหม่ให้สั้นและเข้าใจง่าย'},
    'Category là bắt buộc. Hãy chọn Category hoặc thêm Category mới.':{en:'Category is required. Select one or add a new category.',zh:'类别为必填项，请选择或新增类别。',th:'ต้องระบุหมวดหมู่ กรุณาเลือกหรือเพิ่มหมวดใหม่'},
    'Hãy nhập tên Category mới.':{en:'Enter a new category name.',zh:'请输入新类别名称。',th:'กรุณากรอกชื่อหมวดหมู่ใหม่'},
    'Chọn Category':{en:'Select category',zh:'选择类别',th:'เลือกหมวดหมู่'},
    '+ Thêm Category mới':{en:'+ Add new category',zh:'+ 新增类别',th:'+ เพิ่มหมวดหมู่ใหม่'},
    'Mặc định theo Category của bài viết. Bạn vẫn có thể chọn Category khác.':{en:'Defaults to the post category. You can still choose another category.',zh:'默认使用文章类别，你仍可选择其他类别。',th:'ค่าเริ่มต้นใช้หมวดของบทความ แต่ยังเลือกหมวดอื่นได้'},
    'Chọn Category đã có; chỉ dùng Thêm Category mới khi chưa có mục phù hợp.':{en:'Choose an existing category; add a new one only if none fits.',zh:'优先选择已有类别，仅在没有合适类别时新增。',th:'เลือกหมวดที่มีอยู่ก่อน เพิ่มหมวดใหม่เมื่อไม่มีหมวดที่เหมาะสม'},
    'Tên địa điểm':{en:'Place name',zh:'地点名称',th:'ชื่อสถานที่'},
    'Số điện thoại':{en:'Phone number',zh:'电话号码',th:'หมายเลขโทรศัพท์'},
    'Link Google Maps':{en:'Google Maps link',zh:'Google 地图链接',th:'ลิงก์ Google Maps'},
    'Giờ mở cửa (24h)':{en:'Opening time (24h)',zh:'开放时间（24小时制）',th:'เวลาเปิด (24 ชม.)'},
    'Giờ đóng cửa (24h)':{en:'Closing time (24h)',zh:'关闭时间（24小时制）',th:'เวลาปิด (24 ชม.)'},
    'Nhập theo 24 giờ, ví dụ 06:30.':{en:'Use 24-hour time, for example 06:30.',zh:'请使用24小时制，例如 06:30。',th:'ใช้เวลาแบบ 24 ชั่วโมง เช่น 06:30'},
    'Nhập theo 24 giờ, ví dụ 22:00. Không dùng SA/CH.':{en:'Use 24-hour time, for example 22:00. Do not use AM/PM.',zh:'请使用24小时制，例如 22:00，不要使用 AM/PM。',th:'ใช้เวลาแบบ 24 ชั่วโมง เช่น 22:00 ไม่ใช้ AM/PM'},
    'Giờ phải theo dạng HH:mm, ví dụ 06:30.':{en:'Time must be HH:mm, for example 06:30.',zh:'时间格式必须为 HH:mm，例如 06:30。',th:'เวลาต้องเป็นรูปแบบ HH:mm เช่น 06:30'},
    'Giờ phải theo dạng HH:mm, ví dụ 22:00.':{en:'Time must be HH:mm, for example 22:00.',zh:'时间格式必须为 HH:mm，例如 22:00。',th:'เวลาต้องเป็นรูปแบบ HH:mm เช่น 22:00'},
    'Trạng thái hoạt động':{en:'Operating status',zh:'营业状态',th:'สถานะการให้บริการ'},
    'Đang hoạt động / không đổi':{en:'Open / no change',zh:'营业中 / 不变',th:'เปิดอยู่ / ไม่เปลี่ยน'},
    'Tạm đóng: sau khi duyệt, card sẽ có băng chéo đỏ cảnh báo. Đóng vĩnh viễn: gửi để quản trị viên xác nhận rồi xóa địa điểm.':{en:'Temporary closure: after review, the card shows a red warning ribbon. Permanent closure: submit it for admin confirmation and removal.',zh:'暂时关闭：审核后卡片会显示红色警示条。永久关闭：提交后由管理员确认并删除地点。',th:'ปิดชั่วคราว: หลังตรวจสอบ การ์ดจะแสดงแถบเตือนสีแดง ปิดถาวร: ส่งให้ผู้ดูแลยืนยันและลบสถานที่'},
    'Thông tin muốn bổ sung / sửa':{en:'Information to add / correct',zh:'需要补充 / 更正的信息',th:'ข้อมูลที่ต้องการเพิ่ม / แก้ไข'},
    'Tên người gửi (không bắt buộc)':{en:'Your name (optional)',zh:'提交者姓名（可选）',th:'ชื่อผู้ส่ง (ไม่บังคับ)'},
    'Liên hệ (không bắt buộc)':{en:'Contact (optional)',zh:'联系方式（可选）',th:'ข้อมูลติดต่อ (ไม่บังคับ)'},
    'Dùng vị trí hiện tại của tôi':{en:'Use my current location',zh:'使用我的当前位置',th:'ใช้ตำแหน่งปัจจุบันของฉัน'},
    'Gửi đề xuất':{en:'Submit suggestion',zh:'提交建议',th:'ส่งคำแนะนำ'},
    'Đã gửi':{en:'Sent',zh:'已提交',th:'ส่งแล้ว'},
    'Đang lấy vị trí chính xác...':{en:'Getting a precise location...',zh:'正在获取精确位置...',th:'กำลังหาตำแหน่งที่แม่นยำ...'},
    'Đang cải thiện vị trí...':{en:'Improving location accuracy...',zh:'正在提高定位精度...',th:'กำลังปรับความแม่นยำของตำแหน่ง...'},
    'Không lấy được vị trí':{en:'Could not get location',zh:'无法获取位置',th:'ไม่สามารถระบุตำแหน่งได้'},
    'Trình duyệt này không hỗ trợ xác định vị trí.':{en:'This browser does not support geolocation.',zh:'此浏览器不支持定位。',th:'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง'},
    'Không lấy được vị trí mới. Hãy kiểm tra quyền vị trí của trình duyệt và hệ điều hành rồi thử lại.':{en:'Could not get a new location. Check browser and system location permissions, then try again.',zh:'无法获取新位置，请检查浏览器和系统定位权限后重试。',th:'ไม่สามารถหาตำแหน่งใหม่ได้ โปรดตรวจสอบสิทธิ์ตำแหน่งของเบราว์เซอร์และระบบแล้วลองอีกครั้ง'},
    'Chủ đề':{en:'Topic',zh:'主题',th:'หัวข้อ'},
    'Bài viết':{en:'Post',zh:'文章',th:'บทความ'},
    'Danh mục':{en:'Category',zh:'分类',th:'หมวดหมู่'},
    'Chưa có gợi ý phù hợp.':{en:'No matching suggestions.',zh:'没有匹配的建议。',th:'ไม่มีคำแนะนำที่ตรงกัน'},
    'Mở':{en:'Open',zh:'打开',th:'เปิด'}
  };

  /* THIS LOCAL V8.6.3 - Russian / Japanese / Korean */
  var EXTRA_UI={};
  EXTRA_UI["Khám phá"]={ru:"Обзор",ja:"探索",ko:"探索"};
  EXTRA_UI["Ngôn ngữ"]={ru:"Язык",ja:"言語",ko:"언어"};
  EXTRA_UI["Chọn ngôn ngữ"]={ru:"Выбрать язык",ja:"言語を選択",ko:"언어 선택"};
  EXTRA_UI["Danh mục chính"]={ru:"Основные категории",ja:"主なカテゴリー",ko:"주요 카테고리"};
  EXTRA_UI["Điều hướng nhanh"]={ru:"Быстрая навигация",ja:"クイックナビゲーション",ko:"빠른 탐색"};
  EXTRA_UI["This Local - Trang chủ"]={ru:"This Local - Главная",ja:"This Local - ホーム",ko:"This Local - 홈"};
  EXTRA_UI["Ăn uống"]={ru:"Еда",ja:"グルメ",ko:"맛집"};
  EXTRA_UI["Cà phê"]={ru:"Кафе",ja:"カフェ",ko:"카페"};
  EXTRA_UI["Đi chơi"]={ru:"Куда сходить",ja:"観光・体験",ko:"즐길 거리"};
  EXTRA_UI["Lưu trú"]={ru:"Жильё",ja:"宿泊",ko:"숙박"};
  EXTRA_UI["Dịch vụ"]={ru:"Услуги",ja:"サービス",ko:"서비스"};
  EXTRA_UI["Mua sắm"]={ru:"Покупки",ja:"ショッピング",ko:"쇼핑"};
  EXTRA_UI["Chưa bật vị trí"]={ru:"Геолокация выключена",ja:"位置情報はオフです",ko:"위치 정보가 꺼져 있습니다"};
  EXTRA_UI["Đã bật vị trí"]={ru:"Геолокация включена",ja:"位置情報を有効にしました",ko:"위치 정보가 켜졌습니다"};
  EXTRA_UI["Đang xác định địa danh..."]={ru:"Определяем ваш район...",ja:"地域を確認中...",ko:"현재 지역 확인 중..."};
  EXTRA_UI["Khám phá quanh bạn"]={ru:"Исследуйте рядом",ja:"周辺を探索",ko:"내 주변 둘러보기"};
  EXTRA_UI["Đi đâu, ăn gì, tìm gì quanh bạn?"]={ru:"Куда пойти, что поесть и что найти рядом?",ja:"近くでどこへ行く？何を食べる？何を探す？",ko:"주변에서 어디 갈까, 무엇을 먹고 무엇을 찾을까?"};
  EXTRA_UI["This Local giúp bạn tìm quán ăn, cà phê, nơi lưu trú và dịch vụ quanh mình theo cách nhanh, trực quan và dễ cập nhật."]={ru:"This Local помогает быстро находить рядом рестораны, кафе, жильё и услуги по понятным и обновляемым данным.",ja:"This Local は、周辺の飲食店、カフェ、宿泊施設、サービスを素早く分かりやすく探せるようにします。",ko:"This Local은 주변 맛집, 카페, 숙박, 서비스를 빠르고 직관적으로 찾고 최신 정보로 확인할 수 있게 도와줍니다."};
  EXTRA_UI["Tìm địa điểm"]={ru:"Найти место",ja:"場所を検索",ko:"장소 찾기"};
  EXTRA_UI["Ví dụ: món ăn, cà phê, khách sạn, salon..."]={ru:"Например: еда, кафе, отель, салон...",ja:"例：料理、カフェ、ホテル、サロン...",ko:"예: 음식, 카페, 호텔, 살롱..."};
  EXTRA_UI["Tìm trên This Local"]={ru:"Искать в This Local",ja:"This Local で検索",ko:"This Local에서 검색"};
  EXTRA_UI["Gợi ý tìm kiếm"]={ru:"Подсказки поиска",ja:"検索候補",ko:"검색 제안"};
  EXTRA_UI["Tìm nhanh trong Danh mục này"]={ru:"Быстрый поиск в этой категории",ja:"このカテゴリー内を検索",ko:"이 카테고리에서 빠르게 검색"};
  EXTRA_UI["Nhập tên món, loại hình hoặc địa điểm..."]={ru:"Введите блюдо, тип или место...",ja:"料理・種類・場所を入力...",ko:"메뉴, 유형 또는 장소를 입력하세요..."};
  EXTRA_UI["Dùng vị trí hiện tại"]={ru:"Использовать текущее местоположение",ja:"現在地を使用",ko:"현재 위치 사용"};
  EXTRA_UI["Bật vị trí để This Local ưu tiên địa điểm gần bạn."]={ru:"Включите геолокацию, чтобы This Local показывал ближайшие места первыми.",ja:"位置情報を有効にすると、This Local が近い場所を優先表示します。",ko:"위치를 켜면 This Local이 가까운 장소를 우선 표시합니다."};
  EXTRA_UI["Dữ liệu cộng đồng"]={ru:"Данные сообщества",ja:"コミュニティデータ",ko:"커뮤니티 데이터"};
  EXTRA_UI["Có kiểm duyệt"]={ru:"С модерацией",ja:"審査済み",ko:"검수됨"};
  EXTRA_UI["Ưu tiên thông tin thực tế"]={ru:"Практичная информация в приоритете",ja:"実用的な情報を優先",ko:"실용 정보 우선"};
  EXTRA_UI["Khám phá theo nhu cầu"]={ru:"Ищите по потребностям",ja:"目的から探す",ko:"목적별 탐색"};
  EXTRA_UI["Chọn nhanh nhóm bạn đang cần thay vì phải lướt qua hàng loạt bài."]={ru:"Сразу выберите нужную категорию вместо просмотра множества публикаций.",ja:"多くの記事を見なくても、必要なカテゴリーをすぐ選べます。",ko:"많은 글을 넘기지 않고 필요한 카테고리를 바로 선택하세요."};
  EXTRA_UI["Quán ăn · đặc sản"]={ru:"Рестораны · местные блюда",ja:"飲食店・名物",ko:"맛집 · 특산물"};
  EXTRA_UI["Đẹp · yên tĩnh · chill"]={ru:"Красиво · тихо · атмосферно",ja:"おしゃれ・静か・くつろぎ",ko:"예쁨 · 조용함 · 힐링"};
  EXTRA_UI["Check-in · trải nghiệm"]={ru:"Фото-точки · впечатления",ja:"チェックイン・体験",ko:"체크인 · 체험"};
  EXTRA_UI["Hotel · homestay"]={ru:"Отели · хоумстеи",ja:"ホテル・ホームステイ",ko:"호텔 · 홈스테이"};
  EXTRA_UI["Cửa hàng · đặc sản"]={ru:"Магазины · местные товары",ja:"ショップ・特産品",ko:"상점 · 특산품"};
  EXTRA_UI["Tiện ích quanh bạn"]={ru:"Полезные услуги рядом",ja:"周辺の便利サービス",ko:"주변 편의 서비스"};
  EXTRA_UI["Nội dung được chọn"]={ru:"Избранные материалы",ja:"選ばれたコンテンツ",ko:"선택된 콘텐츠"};
  EXTRA_UI["Xem bài viết"]={ru:"Открыть публикацию",ja:"記事を見る",ko:"글 보기"};
  EXTRA_UI["Đang tải các bài được chọn cho trang chủ..."]={ru:"Загрузка выбранных публикаций...",ja:"ホーム用の記事を読み込み中...",ko:"홈페이지용 글을 불러오는 중..."};
  EXTRA_UI["Chưa có nội dung được chọn."]={ru:"Выбранных материалов пока нет.",ja:"選択されたコンテンツはまだありません。",ko:"선택된 콘텐츠가 아직 없습니다."};
  EXTRA_UI["Tạm thời chưa tải được các bài dành cho trang chủ."]={ru:"Сейчас не удалось загрузить публикации для главной страницы.",ja:"ホーム用の記事を現在読み込めません。",ko:"현재 홈페이지용 글을 불러올 수 없습니다."};
  EXTRA_UI["Dữ liệu quanh bạn, dễ tìm và dễ cập nhật."]={ru:"Данные рядом с вами — легко найти и обновить.",ja:"周辺情報を、探しやすく更新しやすく。",ko:"주변 데이터를 쉽게 찾고 쉽게 업데이트하세요."};
  EXTRA_UI["Đề xuất địa điểm"]={ru:"Предложить место",ja:"場所を提案",ko:"장소 제안"};
  EXTRA_UI["Đề xuất"]={ru:"Предложить",ja:"提案",ko:"제안"};
  EXTRA_UI["Đề xuất địa điểm mới"]={ru:"Предложить новое место",ja:"新しい場所を提案",ko:"새 장소 제안"};
  EXTRA_UI["THIS LOCAL - Dữ liệu cộng đồng"]={ru:"THIS LOCAL - Данные сообщества",ja:"THIS LOCAL - コミュニティデータ",ko:"THIS LOCAL - 커뮤니티 데이터"};
  EXTRA_UI["Danh sách do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị."]={ru:"Список составляется сообществом и проверяется THIS LOCAL перед публикацией.",ja:"一覧はコミュニティから投稿され、表示前に THIS LOCAL が確認します。",ko:"목록은 커뮤니티가 제보하며 공개 전에 THIS LOCAL이 검수합니다."};
  EXTRA_UI["Xác định vị trí"]={ru:"Определить местоположение",ja:"現在地を取得",ko:"위치 확인"};
  EXTRA_UI["Cập nhật vị trí của tôi"]={ru:"Обновить моё местоположение",ja:"現在地を更新",ko:"내 위치 업데이트"};
  EXTRA_UI["Đang cập nhật vị trí..."]={ru:"Обновление местоположения...",ja:"現在地を更新中…",ko:"위치 업데이트 중..."};
  EXTRA_UI["Xem thêm địa điểm"]={ru:"Показать ещё места",ja:"さらに場所を表示",ko:"장소 더보기"};
  EXTRA_UI["Không lấy được vị trí. Vui lòng thử lại."]={ru:"Не удалось определить местоположение. Попробуйте ещё раз.",ja:"現在地を取得できませんでした。もう一度お試しください。",ko:"위치를 가져오지 못했습니다. 다시 시도해 주세요."};
  EXTRA_UI["Không lấy được vị trí. Vui lòng kiểm tra quyền vị trí và thử lại."]={ru:"Не удалось определить местоположение. Проверьте разрешение и повторите попытку.",ja:"現在地を取得できませんでした。位置情報の権限を確認して再試行してください。",ko:"위치를 가져오지 못했습니다. 위치 권한을 확인하고 다시 시도해 주세요."};
  EXTRA_UI["Đang tải danh sách đã kiểm duyệt..."]={ru:"Загрузка проверенных мест...",ja:"確認済みの場所を読み込み中...",ko:"검수된 장소를 불러오는 중..."};
  EXTRA_UI["Bạn biết địa điểm khác?"]={ru:"Знаете другое место?",ja:"ほかの場所をご存じですか？",ko:"다른 장소를 알고 계신가요?"};
  EXTRA_UI["Gửi địa điểm mới hoặc báo thông tin cần sửa. Nội dung chỉ xuất hiện sau khi THIS LOCAL duyệt."]={ru:"Предложите новое место или сообщите об изменениях. Данные появятся после проверки THIS LOCAL.",ja:"新しい場所の提案や修正情報を送れます。THIS LOCAL の確認後に表示されます。",ko:"새 장소를 제안하거나 수정할 정보를 알려주세요. THIS LOCAL 검수 후 표시됩니다."};
  EXTRA_UI["Cập nhật vị trí"]={ru:"Обновить местоположение",ja:"位置情報を更新",ko:"위치 업데이트"};
  EXTRA_UI["Gần bạn nhất"]={ru:"Ближе всего к вам",ja:"最も近い",ko:"가장 가까움"};
  EXTRA_UI["Chỉ đường"]={ru:"Маршрут",ja:"経路",ko:"길찾기"};
  EXTRA_UI["Gọi"]={ru:"Позвонить",ja:"電話",ko:"전화"};
  EXTRA_UI["Cập nhật thông tin"]={ru:"Обновить данные",ja:"情報を更新",ko:"정보 업데이트"};
  EXTRA_UI["Uy tín"]={ru:"Проверено",ja:"信頼できる店",ko:"신뢰 매장"};
  EXTRA_UI["Đang hot"]={ru:"Популярно",ja:"話題",ko:"인기"};
  EXTRA_UI["Tạm thời đóng cửa"]={ru:"Временно закрыто",ja:"一時休業",ko:"임시 휴업"};
  EXTRA_UI["Đã đóng vĩnh viễn"]={ru:"Закрыто навсегда",ja:"閉業",ko:"영구 폐업"};
  EXTRA_UI["Đã đóng cửa vĩnh viễn"]={ru:"Закрыто навсегда",ja:"閉業",ko:"영구 폐업"};
  EXTRA_UI["Chưa có dữ liệu đã duyệt."]={ru:"Проверенных данных пока нет.",ja:"確認済みデータはまだありません。",ko:"검수된 데이터가 아직 없습니다."};
  EXTRA_UI["Đang xếp từ gần đến xa"]={ru:"Сортировка от ближайших к дальним",ja:"近い順に並べ替え中",ko:"가까운 순으로 정렬 중"};
  EXTRA_UI["Tạm thời chưa tải được dữ liệu."]={ru:"Данные временно недоступны.",ja:"現在データを読み込めません。",ko:"현재 데이터를 불러올 수 없습니다."};
  EXTRA_UI["Không tải được dữ liệu"]={ru:"Не удалось загрузить данные",ja:"データを読み込めません",ko:"데이터를 불러올 수 없습니다"};
  EXTRA_UI["Không thể tải danh sách lúc này. Vui lòng thử lại sau."]={ru:"Сейчас список недоступен. Повторите попытку позже.",ja:"現在一覧を読み込めません。後でもう一度お試しください。",ko:"현재 목록을 불러올 수 없습니다. 나중에 다시 시도해 주세요."};
  EXTRA_UI["Địa điểm"]={ru:"Место",ja:"場所",ko:"장소"};
  EXTRA_UI["Địa chỉ"]={ru:"Адрес",ja:"住所",ko:"주소"};
  EXTRA_UI["Giá từ"]={ru:"Цена от",ja:"最低価格",ko:"최저 가격"};
  EXTRA_UI["Giá đến"]={ru:"Цена до",ja:"最高価格",ko:"최고 가격"};
  EXTRA_UI["Cập nhật thông tin địa điểm"]={ru:"Обновить информацию о месте",ja:"場所の情報を更新",ko:"장소 정보 업데이트"};
  EXTRA_UI["Đóng"]={ru:"Закрыть",ja:"閉じる",ko:"닫기"};
  EXTRA_UI["Đóng cửa sổ đề xuất"]={ru:"Закрыть окно предложения",ja:"提案ウィンドウを閉じる",ko:"제안 창 닫기"};
  EXTRA_UI["Đã gửi thông tin. THIS LOCAL sẽ kiểm tra trước khi công khai."]={ru:"Информация отправлена. THIS LOCAL проверит её перед публикацией.",ja:"情報を送信しました。公開前に THIS LOCAL が確認します。",ko:"정보를 보냈습니다. 공개 전 THIS LOCAL이 검수합니다."};
  EXTRA_UI["Category"]={ru:"Категория",ja:"カテゴリー",ko:"카테고리"};
  EXTRA_UI["Tên Category mới"]={ru:"Название новой категории",ja:"新しいカテゴリー名",ko:"새 카테고리 이름"};
  EXTRA_UI["Ví dụ: Bánh cuốn"]={ru:"Например: Bánh cuốn",ja:"例：Bánh cuốn",ko:"예: Bánh cuốn"};
  EXTRA_UI["Nhập tên Category mới ngắn gọn, dễ hiểu."]={ru:"Введите короткое и понятное название новой категории.",ja:"短く分かりやすいカテゴリー名を入力してください。",ko:"짧고 이해하기 쉬운 새 카테고리 이름을 입력하세요."};
  EXTRA_UI["Category là bắt buộc. Hãy chọn Category hoặc thêm Category mới."]={ru:"Категория обязательна. Выберите существующую или добавьте новую.",ja:"カテゴリーは必須です。選択するか新しく追加してください。",ko:"카테고리는 필수입니다. 기존 카테고리를 선택하거나 새로 추가하세요."};
  EXTRA_UI["Hãy nhập tên Category mới."]={ru:"Введите название новой категории.",ja:"新しいカテゴリー名を入力してください。",ko:"새 카테고리 이름을 입력하세요."};
  EXTRA_UI["Chọn Category"]={ru:"Выбрать категорию",ja:"カテゴリーを選択",ko:"카테고리 선택"};
  EXTRA_UI["+ Thêm Category mới"]={ru:"+ Добавить новую категорию",ja:"＋新しいカテゴリーを追加",ko:"+ 새 카테고리 추가"};
  EXTRA_UI["Mặc định theo Category của bài viết. Bạn vẫn có thể chọn Category khác."]={ru:"По умолчанию используется категория статьи, но можно выбрать другую.",ja:"記事のカテゴリーが初期選択されますが、変更できます。",ko:"글의 카테고리가 기본 선택되며 다른 카테고리로 변경할 수 있습니다."};
  EXTRA_UI["Chọn Category đã có; chỉ dùng Thêm Category mới khi chưa có mục phù hợp."]={ru:"Выберите существующую категорию; новую добавляйте только если подходящей нет.",ja:"既存カテゴリーを選び、適切なものがない場合だけ新規追加してください。",ko:"기존 카테고리를 선택하고 적절한 항목이 없을 때만 새 카테고리를 추가하세요."};
  EXTRA_UI["Tên địa điểm"]={ru:"Название места",ja:"場所名",ko:"장소 이름"};
  EXTRA_UI["Số điện thoại"]={ru:"Телефон",ja:"電話番号",ko:"전화번호"};
  EXTRA_UI["Link Google Maps"]={ru:"Ссылка Google Maps",ja:"Google マップのリンク",ko:"Google 지도 링크"};
  EXTRA_UI["Giờ mở cửa (24h)"]={ru:"Открытие (24 ч)",ja:"開店時間（24時間）",ko:"영업 시작 (24시간)"};
  EXTRA_UI["Giờ đóng cửa (24h)"]={ru:"Закрытие (24 ч)",ja:"閉店時間（24時間）",ko:"영업 종료 (24시간)"};
  EXTRA_UI["Nhập theo 24 giờ, ví dụ 06:30."]={ru:"Формат 24 часа, например 06:30.",ja:"24時間表記で入力（例 06:30）。",ko:"24시간 형식으로 입력하세요. 예: 06:30."};
  EXTRA_UI["Nhập theo 24 giờ, ví dụ 22:00. Không dùng SA/CH."]={ru:"Формат 24 часа, например 22:00. Без AM/PM.",ja:"24時間表記で入力（例 22:00）。AM/PM は使いません。",ko:"24시간 형식으로 입력하세요. 예: 22:00. AM/PM은 사용하지 않습니다."};
  EXTRA_UI["Giờ phải theo dạng HH:mm, ví dụ 06:30."]={ru:"Время должно быть HH:mm, например 06:30.",ja:"時刻は HH:mm 形式（例 06:30）で入力してください。",ko:"시간은 HH:mm 형식이어야 합니다. 예: 06:30."};
  EXTRA_UI["Giờ phải theo dạng HH:mm, ví dụ 22:00."]={ru:"Время должно быть HH:mm, например 22:00.",ja:"時刻は HH:mm 形式（例 22:00）で入力してください。",ko:"시간은 HH:mm 형식이어야 합니다. 예: 22:00."};
  EXTRA_UI["Trạng thái hoạt động"]={ru:"Статус работы",ja:"営業状況",ko:"영업 상태"};
  EXTRA_UI["Đang hoạt động / không đổi"]={ru:"Работает / без изменений",ja:"営業中／変更なし",ko:"영업 중 / 변경 없음"};
  EXTRA_UI["Tạm đóng: sau khi duyệt, card sẽ có băng chéo đỏ cảnh báo. Đóng vĩnh viễn: gửi để quản trị viên xác nhận rồi xóa địa điểm."]={ru:"Временное закрытие: после проверки на карточке появится красное предупреждение. Постоянное закрытие: отправьте на подтверждение, после чего место можно удалить.",ja:"一時休業：承認後、カードに赤い警告帯を表示します。閉業：管理者確認後に場所を削除できます。",ko:"임시 휴업: 승인 후 카드에 빨간 경고 띠가 표시됩니다. 영구 폐업: 관리자 확인 후 장소를 삭제할 수 있습니다."};
  EXTRA_UI["Thông tin muốn bổ sung / sửa"]={ru:"Что нужно добавить / исправить",ja:"追加・修正したい情報",ko:"추가 / 수정할 정보"};
  EXTRA_UI["Tên người gửi (không bắt buộc)"]={ru:"Имя отправителя (необязательно)",ja:"送信者名（任意）",ko:"제보자 이름 (선택)"};
  EXTRA_UI["Liên hệ (không bắt buộc)"]={ru:"Контакты (необязательно)",ja:"連絡先（任意）",ko:"연락처 (선택)"};
  EXTRA_UI["Dùng vị trí hiện tại của tôi"]={ru:"Использовать моё текущее местоположение",ja:"現在地を使用",ko:"내 현재 위치 사용"};
  EXTRA_UI["Gửi đề xuất"]={ru:"Отправить предложение",ja:"提案を送信",ko:"제안 보내기"};
  EXTRA_UI["Đã gửi"]={ru:"Отправлено",ja:"送信済み",ko:"전송됨"};
  EXTRA_UI["Đang lấy vị trí chính xác..."]={ru:"Получение точного местоположения...",ja:"高精度な位置情報を取得中...",ko:"정확한 위치를 가져오는 중..."};
  EXTRA_UI["Đang cải thiện vị trí..."]={ru:"Уточнение местоположения...",ja:"位置精度を改善中...",ko:"위치 정확도를 개선하는 중..."};
  EXTRA_UI["Không lấy được vị trí"]={ru:"Не удалось определить местоположение",ja:"位置情報を取得できません",ko:"위치를 가져올 수 없습니다"};
  EXTRA_UI["Trình duyệt này không hỗ trợ xác định vị trí."]={ru:"Этот браузер не поддерживает геолокацию.",ja:"このブラウザは位置情報に対応していません。",ko:"이 브라우저는 위치 정보를 지원하지 않습니다."};
  EXTRA_UI["Không lấy được vị trí mới. Hãy kiểm tra quyền vị trí của trình duyệt và hệ điều hành rồi thử lại."]={ru:"Не удалось получить новое местоположение. Проверьте разрешения геолокации браузера и системы и повторите попытку.",ja:"新しい位置情報を取得できませんでした。ブラウザとOSの位置情報権限を確認して再試行してください。",ko:"새 위치를 가져오지 못했습니다. 브라우저와 운영체제의 위치 권한을 확인한 뒤 다시 시도하세요."};
  EXTRA_UI["Chủ đề"]={ru:"Тема",ja:"トピック",ko:"주제"};
  EXTRA_UI["Bài viết"]={ru:"Статья",ja:"記事",ko:"글"};
  EXTRA_UI["Danh mục"]={ru:"Категория",ja:"カテゴリー",ko:"카테고리"};
  EXTRA_UI["Chưa có gợi ý phù hợp."]={ru:"Подходящих подсказок нет.",ja:"一致する候補がありません。",ko:"일치하는 제안이 없습니다."};
  EXTRA_UI["Mở"]={ru:"Открыть",ja:"開く",ko:"열기"};
  Object.keys(EXTRA_UI).forEach(function(k){UI[k]=UI[k]||{};['ru','ja','ko'].forEach(function(l){if(EXTRA_UI[k][l])UI[k][l]=EXTRA_UI[k][l];});});

  var CAT={
    'Phở bò':{en:'Beef pho',zh:'牛肉河粉',th:'เฝอเนื้อ'},
    'Bún bò Huế':{en:'Bun bo Hue',zh:'顺化牛肉米粉',th:'บุ๋นบ่อเว้'},
    'Ăn uống':UI['Ăn uống'],
    'Cà phê':UI['Cà phê'],
    'Đi chơi':UI['Đi chơi'],
    'Du lịch':{en:'Travel',zh:'旅行',th:'ท่องเที่ยว'},
    'Lưu trú':UI['Lưu trú'],
    'Mua sắm':UI['Mua sắm'],
    'Dịch vụ':UI['Dịch vụ'],
    'Địa điểm':UI['Địa điểm']
  };
  CAT['Phở bò'].ru='Фо бо';CAT['Phở bò'].ja='牛肉フォー';CAT['Phở bò'].ko='소고기 쌀국수';
  CAT['Bún bò Huế'].ru='Бун бо Хюэ';CAT['Bún bò Huế'].ja='ブンボーフエ';CAT['Bún bò Huế'].ko='분보후에';
  CAT['Du lịch'].ru='Путешествия';CAT['Du lịch'].ja='旅行';CAT['Du lịch'].ko='여행';


  var originalText=new WeakMap();
  var originalAttrs=new WeakMap();
  var currentLang='vi';
  var observer=null;
  var clockUpdating=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function validLang(v){v=String(v||'').toLowerCase();if(v.indexOf('zh')===0)return'zh';if(v.indexOf('th')===0)return'th';if(v.indexOf('vi')===0)return'vi';if(v.indexOf('en')===0)return'en';if(v.indexOf('ru')===0)return'ru';if(v.indexOf('ja')===0)return'ja';if(v.indexOf('ko')===0)return'ko';return'';}
  function readSavedLocation(){try{var p=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');return p&&typeof p==='object'?p:null;}catch(e){return null;}}
  function autoLang(){
    /* Khách du lịch: ưu tiên ngôn ngữ thiết bị trước vị trí vật lý. */
    var langs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en']);
    for(var i=0;i<langs.length;i++){var l=validLang(langs[i]);if(l)return l;}
    var loc=readSavedLocation();
    var cc=clean(loc&&loc.countryCode).toUpperCase();
    if(COUNTRY_LANG[cc])return COUNTRY_LANG[cc];
    /* Quốc gia/ngôn ngữ ngoài 7 gói hỗ trợ: mặc định English. */
    return'en';
  }
  function hasManual(){try{return localStorage.getItem(MANUAL_KEY)==='1';}catch(e){return false;}}
  function initialLang(){
    try{
      var saved=validLang(localStorage.getItem(LANG_KEY));
      if(hasManual() && saved)return saved;
    }catch(e){}
    return autoLang();
  }
  function trCategory(v,lang){v=clean(v);if(lang==='vi'||!v)return v;var x=CAT[v];return x&&x[lang]?x[lang]:v;}
  function exact(v,lang){if(lang==='vi')return v;var x=UI[v];return x&&x[lang]?x[lang]:null;}


  function extraDynamic(v,lang){
    var m,c,p,a;
    if((m=v.match(/^Khám phá tại (.+)$/)))return lang==='ru'?'Исследуйте '+m[1]:lang==='ja'?m[1]+' を探索':m[1]+' 둘러보기';
    if((m=v.match(/^Khám phá quanh (.+)$/)))return lang==='ru'?'Исследуйте рядом с '+m[1]:lang==='ja'?m[1]+' 周辺を探索':m[1]+' 주변 둘러보기';
    if((m=v.match(/^(.+) quanh (.+)$/))){c=trCategory(m[1],lang);return lang==='ru'?c+' рядом с '+m[2]:lang==='ja'?m[2]+' 周辺の'+c:m[2]+' 주변 '+c;}
    if((m=v.match(/^(.+) gần bạn$/))){c=trCategory(m[1],lang);return lang==='ru'?c+' рядом с вами':lang==='ja'?'近くの'+c:'내 주변 '+c;}
    if((m=v.match(/^Đã cập nhật vị trí(?: tại (.+))?\.$/))){p=m[1]||'';return lang==='ru'?'Местоположение обновлено'+(p?' — '+p:'')+'.':lang==='ja'?'現在地を更新しました'+(p?'（'+p+'）':'')+'。':'위치를 업데이트했습니다'+(p?' - '+p:'')+'.';}
    if((m=v.match(/^Cập nhật vị trí - (.+)$/)))return lang==='ru'?'Обновить местоположение - '+m[1]:lang==='ja'?'位置情報を更新 - '+m[1]:'위치 업데이트 - '+m[1];
    if((m=v.match(/^Khám phá (.+) quanh (.+)\. Dữ liệu do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị\.$/))){c=trCategory(m[1],lang);return lang==='ru'?'Ищите '+c+' рядом с '+m[2]+'. Данные сообщества проверяются THIS LOCAL перед публикацией.':lang==='ja'?m[2]+' 周辺の'+c+'を探索。コミュニティ投稿のデータは表示前に THIS LOCAL が確認します。':m[2]+' 주변 '+c+' 탐색. 커뮤니티 제보 데이터는 표시 전 THIS LOCAL이 검수합니다.';}
    if((m=v.match(/^Chưa có địa điểm nào đã được duyệt cho (.+) quanh (.+)\. Bạn có thể là người đầu tiên đề xuất\.$/))){c=trCategory(m[1],lang);return lang==='ru'?'Пока нет проверенных мест '+c+' рядом с '+m[2]+'. Вы можете предложить первое.':lang==='ja'?m[2]+' 周辺には確認済みの'+c+'がまだありません。最初に提案できます。':m[2]+' 주변에는 아직 검수된 '+c+' 장소가 없습니다. 첫 번째로 제안해 보세요.';}
    if(v==='Chưa có địa điểm nào đã được duyệt cho chủ đề này. Bạn có thể là người đầu tiên đề xuất.')return lang==='ru'?'По этой теме пока нет проверенных мест. Вы можете предложить первое.':lang==='ja'?'このテーマには確認済みの場所がまだありません。最初に提案できます。':'이 주제에는 아직 검수된 장소가 없습니다. 첫 번째로 제안해 보세요.';
    if((m=v.match(/^Gần nhất quanh (.+)$/)))return lang==='ru'?'Ближе всего рядом с '+m[1]:lang==='ja'?m[1]+' 周辺で最も近い':m[1]+' 주변에서 가장 가까움';
    if((m=v.match(/^Từ (.+)$/)))return lang==='ru'?'От '+m[1]:lang==='ja'?m[1]+'から':m[1]+'부터';
    if((m=v.match(/^Đến (.+)$/)))return lang==='ru'?'До '+m[1]:lang==='ja'?m[1]+'まで':m[1]+'까지';
    if((m=v.match(/^Chưa có gợi ý phù hợp\. Nhấn Enter để tìm “(.+)”\.$/)))return lang==='ru'?'Подходящих подсказок нет. Нажмите Enter, чтобы искать «'+m[1]+'».':lang==='ja'?'一致する候補がありません。Enter を押して「'+m[1]+'」を検索。':'일치하는 제안이 없습니다. Enter를 눌러 “'+m[1]+'” 검색.';
    if((m=v.match(/^Bạn đang gửi đề xuất vào Category: (.+)$/)))return lang==='ru'?'Вы отправляете предложение в категорию: '+trCategory(m[1],lang):lang==='ja'?'送信先カテゴリー：'+trCategory(m[1],lang):'제안 카테고리: '+trCategory(m[1],lang);
    if((m=v.match(/^Giá: (.+)$/)))return lang==='ru'?'Цена: '+m[1]:lang==='ja'?'価格：'+m[1]:'가격: '+m[1];
    if((m=v.match(/^Địa chỉ: (.+)$/)))return lang==='ru'?'Адрес: '+m[1]:lang==='ja'?'住所：'+m[1]:'주소: '+m[1];
    if((m=v.match(/^Điện thoại: (.+)$/)))return lang==='ru'?'Телефон: '+m[1]:lang==='ja'?'電話：'+m[1]:'전화: '+m[1];
    return null;
  }

  function dynamic(v,lang){
    v=clean(v);if(!v||lang==='vi')return v;
    if(lang==='ru'||lang==='ja'||lang==='ko'){var ex=extraDynamic(v,lang);if(ex!==null)return ex;}
    var x=exact(v,lang);if(x)return x;
    if(CAT[v]&&CAT[v][lang])return CAT[v][lang];
    var m;
    if((m=v.match(/^Khám phá tại (.+)$/))){return lang==='en'?'Explore in '+m[1]:lang==='zh'?'探索 '+m[1]:'สำรวจใน '+m[1];}
    if((m=v.match(/^Khám phá quanh (.+)$/))){return lang==='en'?'Explore around '+m[1]:lang==='zh'?'探索 '+m[1]+' 周边':'สำรวจรอบ '+m[1];}
    if((m=v.match(/^(.+) quanh (.+)$/))){var c=trCategory(m[1],lang);return lang==='en'?c+' around '+m[2]:lang==='zh'?m[2]+'附近的'+c:c+' รอบ '+m[2];}
    if((m=v.match(/^(.+) gần bạn$/))){var c2=trCategory(m[1],lang);return lang==='en'?c2+' near you':lang==='zh'?'你附近的'+c2:c2+' ใกล้คุณ';}
    if((m=v.match(/^Đã cập nhật vị trí(?: tại (.+))?\.$/))){var p0=m[1]||'';return lang==='en'?'Location updated'+(p0?' in '+p0:'')+'.':lang==='zh'?'位置已更新'+(p0?'：'+p0:'')+'。':'อัปเดตตำแหน่งแล้ว'+(p0?' ที่ '+p0:'')+'.';}
    if((m=v.match(/^Cập nhật vị trí - (.+)$/))){return lang==='en'?'Update location - '+m[1]:lang==='zh'?'更新位置 - '+m[1]:'อัปเดตตำแหน่ง - '+m[1];}
    if((m=v.match(/^Khám phá (.+) quanh (.+)\. Dữ liệu do cộng đồng đóng góp và được THIS LOCAL kiểm duyệt trước khi hiển thị\.$/))){var c3=trCategory(m[1],lang);return lang==='en'?'Explore '+c3+' around '+m[2]+'. Community-contributed data is reviewed by THIS LOCAL before display.':lang==='zh'?'探索 '+m[2]+' 周边的'+c3+'。社区提交的数据会由 THIS LOCAL 审核后显示。':'ค้นหา '+c3+' รอบ '+m[2]+' ข้อมูลจากชุมชนจะผ่านการตรวจสอบโดย THIS LOCAL ก่อนแสดงผล';}
    if((m=v.match(/^Chưa có địa điểm nào đã được duyệt cho (.+) quanh (.+)\. Bạn có thể là người đầu tiên đề xuất\.$/))){var c4=trCategory(m[1],lang);return lang==='en'?'No reviewed '+c4+' places around '+m[2]+' yet. You can be the first to suggest one.':lang==='zh'?m[2]+' 周边暂时没有已审核的'+c4+'。你可以第一个推荐。':'ยังไม่มี '+c4+' ที่ตรวจสอบแล้วรอบ '+m[2]+' คุณสามารถเป็นคนแรกที่แนะนำได้';}
    if(v==='Chưa có địa điểm nào đã được duyệt cho chủ đề này. Bạn có thể là người đầu tiên đề xuất.')return lang==='en'?'No reviewed places for this topic yet. You can be the first to suggest one.':lang==='zh'?'此主题暂无已审核地点，你可以第一个推荐。':'ยังไม่มีสถานที่ที่ตรวจสอบแล้วสำหรับหัวข้อนี้ คุณสามารถเป็นคนแรกที่แนะนำได้';
    if((m=v.match(/^Gần nhất quanh (.+)$/))){return lang==='en'?'Nearest around '+m[1]:lang==='zh'?m[1]+' 周边最近':'ใกล้ที่สุดรอบ '+m[1];}
    if((m=v.match(/^Từ (.+)$/))){return lang==='en'?'From '+m[1]:lang==='zh'?'起价 '+m[1]:'เริ่มที่ '+m[1];}
    if((m=v.match(/^Đến (.+)$/))){return lang==='en'?'Up to '+m[1]:lang==='zh'?'最高 '+m[1]:'สูงสุด '+m[1];}
    if((m=v.match(/^Chưa có gợi ý phù hợp\. Nhấn Enter để tìm “(.+)”\.$/))){return lang==='en'?'No matching suggestions. Press Enter to search “'+m[1]+'”.':lang==='zh'?'没有匹配的建议。按 Enter 搜索“'+m[1]+'”。':'ไม่มีคำแนะนำที่ตรงกัน กด Enter เพื่อค้นหา “'+m[1]+'”';}
    if((m=v.match(/^Bạn đang gửi đề xuất vào Category: (.+)$/))){return lang==='en'?'You are submitting to category: '+trCategory(m[1],lang):lang==='zh'?'你正在提交到类别：'+trCategory(m[1],lang):'คุณกำลังส่งไปยังหมวดหมู่: '+trCategory(m[1],lang);}
    if((m=v.match(/^Giá: (.+)$/))){return lang==='en'?'Price: '+m[1]:lang==='zh'?'价格：'+m[1]:'ราคา: '+m[1];}
    if((m=v.match(/^Địa chỉ: (.+)$/))){return lang==='en'?'Address: '+m[1]:lang==='zh'?'地址：'+m[1]:'ที่อยู่: '+m[1];}
    if((m=v.match(/^Điện thoại: (.+)$/))){return lang==='en'?'Phone: '+m[1]:lang==='zh'?'电话：'+m[1]:'โทรศัพท์: '+m[1];}
    return v;
  }

  function isScope(node){
    var el=node&&node.nodeType===1?node:node&&node.parentElement;
    if(!el||!el.closest)return false;
    if(el.closest('[data-tl-i18n-ignore="1"],#tlLangSwitcher,.tl-lang-switcher'))return false;
    return !!el.closest('.tl-site-header,.tl-home-shell,.tl-static-footer,#tlProposeFab,.tl-mobile-dock,.tl-mobile-menu-layer,.tl-search-suggest,.vlc-local-guide,.vlc-modal');
  }
  function translateTextNode(n){
    if(!n||n.nodeType!==3||!isScope(n))return;
    var parent=n.parentElement;if(!parent||/^(SCRIPT|STYLE|TEXTAREA)$/i.test(parent.tagName))return;
    if(!originalText.has(n))originalText.set(n,n.nodeValue);
    var src=originalText.get(n),trim=clean(src);if(!trim)return;
    var before=src.match(/^\s*/)[0],after=src.match(/\s*$/)[0];
    var translated=dynamic(trim,currentLang);
    var next=before+translated+after;
    if(n.nodeValue!==next)n.nodeValue=next;
  }
  function translateAttrs(el){
    if(!el||el.nodeType!==1||!isScope(el))return;
    var attrs=['placeholder','aria-label','title'];
    var store=originalAttrs.get(el)||{};
    attrs.forEach(function(a){
      if(!el.hasAttribute(a))return;
      var dynamicSearch=(a==='placeholder'||a==='aria-label')&&el.matches&&el.matches('#tlSmartSearchInput,#tlHubSearch,#tlSearchPageInput,.tl-inline-search-form input[type="search"],input[aria-controls="tlSearchSuggest"]');
      if(dynamicSearch){store[a]=el.getAttribute(a);return;}
      if(store[a]===undefined)store[a]=el.getAttribute(a);
      var src=store[a],next=dynamic(clean(src),currentLang);
      if(el.getAttribute(a)!==next)el.setAttribute(a,next);
    });
    originalAttrs.set(el,store);
  }
  function scan(root){
    if(!root)return;
    if(root.nodeType===3){translateTextNode(root);return;}
    if(root.nodeType!==1&&root.nodeType!==9)return;
    if(root.nodeType===1){translateAttrs(root);Array.prototype.forEach.call(root.childNodes||[],function(n){if(n.nodeType===3)translateTextNode(n);});}
    if(root.querySelectorAll){root.querySelectorAll('*').forEach(function(el){translateAttrs(el);Array.prototype.forEach.call(el.childNodes||[],function(n){if(n.nodeType===3)translateTextNode(n);});});}
  }

  function i18nTimezoneLabel(d){
    var offset=-d.getTimezoneOffset(),sign=offset>=0?'+':'-',abs=Math.abs(offset),h=Math.floor(abs/60),m=abs%60;
    return 'GMT'+sign+h+(m?':'+String(m).padStart(2,'0'):'');
  }
  function updateClock(){
    var el=document.getElementById('tlHeaderClock');if(!el)return;
    try{
      clockUpdating=true;
      var now=new Date(),loc=LOCALES[currentLang]||LOCALES.en;
      var time=new Intl.DateTimeFormat(loc,{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
      var date=new Intl.DateTimeFormat(loc,{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(now);
      el.textContent=i18nTimezoneLabel(now)+' | '+time+' - '+date;
      if(el.firstChild)originalText.delete(el.firstChild);
      setTimeout(function(){clockUpdating=false;},0);
    }catch(e){clockUpdating=false;}
  }
  function updateLangBlocks(){
    document.querySelectorAll('.tl-lang[data-lang]').forEach(function(el){
      el.hidden=validLang(el.getAttribute('data-lang'))!==currentLang;
    });
  }
  function syncPickerLabel(){
    document.querySelectorAll('#tlLangSimple [data-tl-switch-lang]').forEach(function(btn){
      var active=validLang(btn.getAttribute('data-tl-switch-lang'))===currentLang;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-current',active?'true':'false');
    });
  }
  /* Thanh quốc kỳ V8.11 gọi thẳng bộ dịch trong cùng script này. */
  function applyLangFromDom(lang){
    lang=validLang(lang)||currentLang;
    currentLang=lang;
    syncPickerLabel();
    scan(document);
    updateLangBlocks();updateClock();
    setTimeout(function(){scan(document);updateLangBlocks();updateClock();},40);
  }

  var nativeConfirm=window.confirm?window.confirm.bind(window):null;
  if(nativeConfirm)window.confirm=function(msg){return nativeConfirm(dynamic(String(msg||''),currentLang));};
  var nativeAlert=window.alert?window.alert.bind(window):null;
  if(nativeAlert)window.alert=function(msg){return nativeAlert(dynamic(String(msg||''),currentLang));};

  currentLang=initialLang();
  document.documentElement.setAttribute('data-tl-lang',currentLang);
  document.documentElement.setAttribute('lang',LOCALES[currentLang]||currentLang);
  applyLangFromDom(currentLang);

  document.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest?e.target.closest('#tlLangSimple [data-tl-switch-lang]'):null;
    if(!btn)return;
    e.preventDefault();
    var next=validLang(btn.getAttribute('data-tl-switch-lang'));
    if(!next)return;
    currentLang=next;
    try{
      localStorage.setItem(LANG_KEY,next);
      localStorage.setItem(MANUAL_KEY,'1');
    }catch(x){}
    document.documentElement.setAttribute('data-tl-lang',next);
    document.documentElement.setAttribute('lang',LOCALES[next]||next);
    applyLangFromDom(next);
    if(typeof window.TL_CATEGORY_HUB_REFRESH==='function'){
      try{window.TL_CATEGORY_HUB_REFRESH();}catch(x){}
    }
  },true);

  document.addEventListener('tl:locationchange',function(){
    if(hasManual())return;
    var next=autoLang();
    if(next && next!==currentLang){
      currentLang=next;
      document.documentElement.setAttribute('data-tl-lang',currentLang);
      document.documentElement.setAttribute('lang',LOCALES[currentLang]||currentLang);
      applyLangFromDom(currentLang);
    }
  });

  observer=new MutationObserver(function(ms){
    var clockDirty=false;
    ms.forEach(function(m){
      var p=m.target&&m.target.nodeType===3?m.target.parentElement:m.target;
      if(p&&p.id==='tlHeaderClock'){if(!clockUpdating)clockDirty=true;return;}
      if(m.type==='characterData')translateTextNode(m.target);
      Array.prototype.forEach.call(m.addedNodes||[],function(n){scan(n);});
      if(m.type==='attributes')translateAttrs(m.target);
    });
    if(clockDirty)updateClock();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});

  setInterval(updateClock,10000);

  window.TL_I18N={
    getLanguage:function(){return currentLang;},
    setLanguage:function(lang){
      lang=validLang(lang)||'en';
      currentLang=lang;
      try{localStorage.setItem(LANG_KEY,lang);localStorage.setItem(MANUAL_KEY,'1');}catch(e){}
      document.documentElement.setAttribute('data-tl-lang',lang);
      document.documentElement.setAttribute('lang',LOCALES[lang]||lang);
      applyLangFromDom(lang);
    },
    t:function(text){return dynamic(String(text||''),currentLang);},
    category:function(text){return trCategory(text,currentLang);},
    resetAuto:function(){
      try{localStorage.removeItem(MANUAL_KEY);localStorage.removeItem(LANG_KEY);}catch(e){}
      currentLang=autoLang();
      document.documentElement.setAttribute('data-tl-lang',currentLang);
      document.documentElement.setAttribute('lang',LOCALES[currentLang]||currentLang);
      applyLangFromDom(currentLang);
    }
  };
})();


/* ---- original script block 9 ---- */
(function(){
  'use strict';

  var CLICK_KEY='tl_category_hub_clicks_v2';
  var LOCATION_KEY='tl_user_location_v1';
  var MAX_SUGGEST=8;
  var HUB_MAX_RESULTS=100;
  var HUB_PAGE_SIZE=100;
  var HUB_RADIUS_KM=25;

  /* Mỗi đợt là 10 hàng: PC 2 cột = 20 địa điểm, mobile 1 cột = 10. */
  function hubBatchSize(){
    return window.matchMedia&&window.matchMedia('(max-width:620px)').matches?10:20;
  }

  var TXT={
    all:{vi:'Tất cả',en:'All',zh:'全部',th:'ทั้งหมด',ru:'Все',ja:'すべて',ko:'전체'},
    suggest:{vi:'Gợi ý',en:'Suggested',zh:'推荐',th:'แนะนำ',ru:'Совет',ja:'おすすめ',ko:'추천'},
    more:{vi:'Thêm',en:'More',zh:'更多',th:'เพิ่มเติม',ru:'Ещё',ja:'その他',ko:'더보기'},
    less:{vi:'Thu gọn',en:'Less',zh:'收起',th:'ย่อ',ru:'Скрыть',ja:'閉じる',ko:'접기'},
    search:{vi:'Tìm danh mục, chủ đề, các dịch vụ, ...',en:'Enter a dish, type or place...',zh:'输入菜品、类型或地点...',th:'พิมพ์เมนู ประเภท หรือสถานที่...',ru:'Введите блюдо, тип или место...',ja:'料理・種類・場所を入力...',ko:'메뉴, 유형 또는 장소를 입력하세요...'},
    loading:{vi:'Đang kết nối Google Sheet; lần tải đầu có thể mất khoảng 30 giây...',en:'Connecting to Google Sheets; the first load may take about 30 seconds...',zh:'正在连接 Google 表格；首次加载可能需要约 30 秒...',th:'กำลังเชื่อมต่อ Google ชีต การโหลดครั้งแรกอาจใช้เวลาประมาณ 30 วินาที...',ru:'Подключение к Google Таблицам; первая загрузка может занять около 30 секунд...',ja:'Google スプレッドシートに接続中です。初回は約30秒かかることがあります...',ko:'Google 스프레드시트에 연결 중입니다. 첫 로드는 약 30초 걸릴 수 있습니다...'},
    noPlace:{vi:'Chưa có địa điểm phù hợp.',en:'No matching places yet.',zh:'暂无匹配地点。',th:'ยังไม่มีสถานที่ที่ตรงกัน',ru:'Подходящих мест пока нет.',ja:'該当する場所はまだありません。',ko:'일치하는 장소가 아직 없습니다.'},
    places:{vi:'địa điểm',en:'places',zh:'个地点',th:'สถานที่',ru:'мест',ja:'件',ko:'곳'},
    descParent:{vi:'Tổng hợp nhiều chủ đề con và ưu tiên địa điểm gần vị trí hiện tại.',en:'Combines subcategories and prioritizes places near your current location.',zh:'汇总多个子类别，并优先显示当前位置附近的地点。',th:'รวมหลายหมวดย่อยและจัดลำดับสถานที่ใกล้ตำแหน่งปัจจุบันก่อน',ru:'Объединяет подкатегории и показывает ближайшие места первыми.',ja:'複数のサブカテゴリーをまとめ、現在地に近い場所を優先表示します。',ko:'여러 하위 카테고리를 합쳐 현재 위치와 가까운 장소를 우선 표시합니다.'},
    descSingle:{vi:'Địa điểm đã duyệt, ưu tiên kết quả gần vị trí hiện tại.',en:'Reviewed places, prioritizing results near your current location.',zh:'已审核地点，优先显示当前位置附近的结果。',th:'สถานที่ที่ตรวจสอบแล้ว โดยจัดลำดับผลลัพธ์ใกล้ตำแหน่งปัจจุบันก่อน',ru:'Проверенные места с приоритетом ближайших результатов.',ja:'確認済みの場所を現在地に近い順で優先表示します。',ko:'검수된 장소를 현재 위치와 가까운 순으로 우선 표시합니다.'},
    directions:{vi:'Chỉ đường',en:'Directions',zh:'路线',th:'เส้นทาง',ru:'Маршрут',ja:'経路',ko:'길찾기'},
    call:{vi:'Gọi',en:'Call',zh:'拨打',th:'โทร',ru:'Позвонить',ja:'電話',ko:'전화'},
    website:{vi:'Website',en:'Website',zh:'网站',th:'เว็บไซต์',ru:'Сайт',ja:'ウェブサイト',ko:'웹사이트'},
    update:{vi:'Cập nhật thông tin',en:'Update info',zh:'更新信息',th:'อัปเดตข้อมูล',ru:'Обновить данные',ja:'情報を更新',ko:'정보 업데이트'},
    updateLocation:{vi:'Cập nhật vị trí của tôi',en:'Update my location',zh:'更新我的位置',th:'อัปเดตตำแหน่งของฉัน',ru:'Обновить моё местоположение',ja:'現在地を更新',ko:'내 위치 업데이트'},
    updatingLocation:{vi:'Đang cập nhật vị trí...',en:'Updating location...',zh:'正在更新位置…',th:'กำลังอัปเดตตำแหน่ง...',ru:'Обновление местоположения...',ja:'現在地を更新中…',ko:'위치 업데이트 중...'},
    morePlaces:{vi:'Xem thêm địa điểm',en:'Show more places',zh:'查看更多地点',th:'ดูสถานที่เพิ่มเติม',ru:'Показать ещё места',ja:'さらに場所を表示',ko:'장소 더보기'},
    temp:{vi:'Tạm đóng',en:'Temporarily closed',zh:'暂时关闭',th:'ปิดชั่วคราว',ru:'Временно закрыто',ja:'一時休業',ko:'임시 휴업'},
    trusted:{vi:'Uy tín',en:'Trusted',zh:'信誉商家',th:'น่าเชื่อถือ',ru:'Проверено',ja:'信頼できる店',ko:'신뢰 매장'},
    hot:{vi:'Đang hot',en:'Hot now',zh:'热门',th:'กำลังฮิต',ru:'Популярно',ja:'話題',ko:'인기'}
  };

  var state={
    label:'',
    broad:false,
    subs:[],
    places:[],
    active:'',
    expanded:false,
    loading:false,
    visibleLimit:hubBatchSize(),
    serverOffset:0,
    serverHasMore:false,
    serverLoadingMore:false
  };
  var hubLoadObserver=null;

  function stopHubLoadObserver(){
    if(hubLoadObserver&&typeof hubLoadObserver.disconnect==='function')hubLoadObserver.disconnect();
    hubLoadObserver=null;
  }
  function watchHubMore(target,total){
    stopHubLoadObserver();
    var loadNext=function(){
      stopHubLoadObserver();
      if(state.visibleLimit<total){
        state.visibleLimit=Math.min(state.visibleLimit+hubBatchSize(),total);
        renderPlaces();
        return;
      }
      if(!state.broad&&state.serverHasMore&&!state.serverLoadingMore){
        loadMoreLeafServer();
      }
    };
    if('IntersectionObserver' in window){
      hubLoadObserver=new IntersectionObserver(function(entries){
        if(entries.some(function(entry){return entry.isIntersecting;}))loadNext();
      },{root:null,rootMargin:'700px 0px',threshold:0});
      hubLoadObserver.observe(target);
      return;
    }
    var onScroll=function(){if(target.getBoundingClientRect().top<=window.innerHeight+700)loadNext();};
    window.addEventListener('scroll',onScroll,{passive:true});
    hubLoadObserver={disconnect:function(){window.removeEventListener('scroll',onScroll);}};
    setTimeout(onScroll,0);
  }

  function lang(){
    try{
      var x=window.TL_I18N&&window.TL_I18N.getLanguage?window.TL_I18N.getLanguage():'';
      if(x)return x;
    }catch(e){}
    var h=String(document.documentElement.getAttribute('data-tl-lang')||document.documentElement.lang||'vi').toLowerCase();
    if(h.indexOf('zh')===0)return'zh';if(h.indexOf('th')===0)return'th';
    if(h.indexOf('ru')===0)return'ru';if(h.indexOf('ja')===0)return'ja';
    if(h.indexOf('ko')===0)return'ko';if(h.indexOf('en')===0)return'en';return'vi';
  }
  function tr(k){var o=TXT[k]||{};return o[lang()]||o.vi||k;}
  function i18n(v){
    try{return window.TL_I18N&&window.TL_I18N.t?window.TL_I18N.t(v):v;}catch(e){return v;}
  }
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    v=clean(v).toLocaleLowerCase('vi-VN').replace(/đ/g,'d');
    try{return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return v;}
  }
  /* V17.14: tương thích tên Danh mục Blogger cũ với taxonomy Supabase/OSM mới. */
  function taxonomyAlias(value){
    var n=norm(value).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim(),map={
      'an uong':{type:'parent',ref:'Ăn uống'},
      'mua sam':{type:'parent',ref:'Mua sắm & bán lẻ'},
      'mua sam & ban le':{type:'parent',ref:'Mua sắm & bán lẻ'},
      'dich vu':{type:'parent',ref:'Dịch vụ'},
      'dich vu chuyen mon & doanh nghiep':{type:'parent',ref:'Dịch vụ chuyên môn & doanh nghiệp'},
      'lam dep':{type:'parent',ref:'Làm đẹp & chăm sóc cá nhân'},
      'lam dep & cham soc ca nhan':{type:'parent',ref:'Làm đẹp & chăm sóc cá nhân'},
      'lam dep cham soc ca nhan':{type:'parent',ref:'Làm đẹp & chăm sóc cá nhân'},
      'lam ep cham soc ca nhan':{type:'parent',ref:'Làm đẹp & chăm sóc cá nhân'},
      'y te & suc khoe':{type:'parent',ref:'Y tế & sức khỏe'},
      'giao duc & dao tao':{type:'parent',ref:'Giáo dục & đào tạo'},
      'luu tru':{type:'parent',ref:'Lưu trú'},
      'du lich':{type:'parent',ref:'Du lịch, văn hóa & giải trí'},
      'di choi':{type:'parent',ref:'Du lịch, văn hóa & giải trí'},
      'du lich, van hoa & giai tri':{type:'parent',ref:'Du lịch, văn hóa & giải trí'},
      'the thao & hoat dong ngoai troi':{type:'parent',ref:'Thể thao & hoạt động ngoài trời'},
      'giao thong & van tai':{type:'parent',ref:'Giao thông & vận tải'},
      'hanh chinh & co quan nha nuoc':{type:'parent',ref:'Hành chính & cơ quan nhà nước'},
      'tai chinh, ngan hang & bao hiem':{type:'parent',ref:'Tài chính, ngân hàng & bảo hiểm'},
      'cong nghiep, san xuat & logistics':{type:'parent',ref:'Công nghiệp, sản xuất & logistics'},
      'nong nghiep, lam nghiep & thuy san':{type:'parent',ref:'Nông nghiệp, lâm nghiệp & thủy sản'},
      'xay dung, bat dong san & toa nha':{type:'parent',ref:'Xây dựng, bất động sản & tòa nhà'},
      'o to, xe may & phuong tien':{type:'parent',ref:'Ô tô, xe máy & phương tiện'},
      'cong nghe, truyen thong & sang tao':{type:'parent',ref:'Công nghệ, truyền thông & sáng tạo'},
      'dien, nuoc, nang luong & moi truong':{type:'parent',ref:'Điện, nước, năng lượng & môi trường'},
      'ton giao & tin nguong':{type:'parent',ref:'Tôn giáo & tín ngưỡng'},
      'an ninh, cuu ho & quoc phong':{type:'parent',ref:'An ninh, cứu hộ & quốc phòng'},
      'tien ich cong cong & cong dong':{type:'parent',ref:'Tiện ích công cộng & cộng đồng'},
      'dia danh hanh chinh & khu dan cu':{type:'parent',ref:'Địa danh hành chính & khu dân cư'},
      'thien nhien, di tich & thang canh':{type:'parent',ref:'Thiên nhiên, di tích & thắng cảnh'},
      'dia diem khac':{type:'parent',ref:'Địa điểm khác'},
      'ca phe':{type:'category',ref:'Cà phê & trà'},
      'ca phe & tra':{type:'category',ref:'Cà phê & trà'},
      'cafe':{type:'category',ref:'Cà phê & trà'},
      'coffee':{type:'category',ref:'Cà phê & trà'},
      'cham soc xe':{type:'category',ref:'Rửa & chăm sóc xe'}
    };
    return map[n]||null;
  }
  function currentRoute(){
    var marker='/search/label/';
    var p=location.pathname||'',idx=p.toLowerCase().indexOf(marker);
    if(idx>=0){
      var raw=p.slice(idx+marker.length).replace(/\/+$/,'');
      try{return{type:'category',label:decodeURIComponent(raw.replace(/\+/g,' '))};}catch(e){return{type:'category',label:raw};}
    }
    var page=p.match(/^\/p\/([^/?#]+)\.html\/?$/i);
    if(!page)return null;
    var pageRef='';try{pageRef=decodeURIComponent(page[1]);}catch(e){pageRef=page[1];}
    /* V17.35: /p/danh-muc.html kiêm trang cha dự phòng.
       - ?parent=Nhóm cha => tải đúng parent + các tab con.
       - ?parent=Nhóm cha&category=Category => tải parent và tự chọn tab Category.
       - ?category=Category (không có parent) vẫn giữ tương thích route leaf cũ. */
    if(norm(pageRef).indexOf('danh-muc')===0){
      try{
        var qp=new URLSearchParams(location.search||'');
        var pageParent=clean(qp.get('parent'));
        var pageCategory=clean(qp.get('category'));
        if(pageParent)return{type:'parent',ref:pageParent,viaPage:true,genericParent:true};
        if(pageCategory)return{type:'category',label:pageCategory,viaPage:true};
      }catch(e){}
    }
    return{type:'parent',ref:pageRef};
  }
  function currentPageTitle(){
    var title=document.querySelector('h1.post-title,h2.post-title,h3.post-title,.post-title,.entry-title,#page_body h1,#page_body h2');
    var text=clean(title&&title.textContent);
    if(text)return text;
    var og=document.querySelector('meta[property="og:title"]');
    text=clean(og&&og.getAttribute('content'));
    if(text)return text;
    text=clean(document.title);
    return text.replace(/\s*[|–—-]\s*THIS LOCAL.*$/i,'');
  }
  function savedLocation(){
    try{
      var p=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');
      if(!p||!isFinite(Number(p.lat))||!isFinite(Number(p.lng)))return null;
      return p;
    }catch(e){return null;}
  }
  function locality(){var p=savedLocation();return clean(p&&(p.locality||p.region||p.countryName));}
  function distance(a,b,c,d){
    var R=6371,r=Math.PI/180,dl=(c-a)*r,dg=(d-b)*r;
    var q=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dg/2)*Math.sin(dg/2);
    return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
  }
  function distanceText(km){
    if(!isFinite(km))return'';
    if(km<1)return Math.max(1,Math.round(km*1000))+' m';
    return (km<10?km.toFixed(1):Math.round(km))+' km';
  }
  function statusOf(p){
    var raw=clean(p&&(p.business_status||p.place_status||p.status)).toUpperCase();
    var note=clean(p&&p.note);
    if(/\[THISLOCAL_STATUS:TEMP_CLOSED\]/i.test(note)||/TEMP[_ -]?CLOSED/.test(raw))return'TEMP_CLOSED';
    if(/\[THISLOCAL_STATUS:PERM_CLOSED\]/i.test(note)||/PERM(?:ANENT)?[_ -]?CLOSED/.test(raw))return'PERM_CLOSED';
    return'OPEN';
  }
  function mapsUrl(p,pos){
    var dest=(isFinite(Number(p.lat))&&isFinite(Number(p.lng)))?Number(p.lat)+','+Number(p.lng):(clean(p.address)||clean(p.name));
    var u='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest);
    if(pos)u+='&origin='+encodeURIComponent(pos.lat+','+pos.lng);
    return u+'&travelmode=driving';
  }
  function hubWebsiteUrl(value){
    var url=clean(value);if(!url)return'';
    return /^https?:\/\//i.test(url)?url:'https://'+url.replace(/^\/+/, '');
  }
  function hubSourceNode(place){
    var sourceName=clean(place&&place.source_name),sourceLicense=clean(place&&place.source_license);
    if(/^THIS LOCAL community$/i.test(sourceName)){sourceName='THIS LOCAL Community';sourceLicense='';}
    if(!sourceName&&!sourceLicense)return null;
    var row=document.createElement('div');row.className='tl-hub-source';
    row.appendChild(document.createTextNode('Nguồn: '));
    if(sourceName){
      var sourceUrl=clean(place&&place.source_url);
      if(sourceUrl){
        var sourceLink=document.createElement('a');sourceLink.textContent=sourceName;sourceLink.href=sourceUrl;
        sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';row.appendChild(sourceLink);
      }else row.appendChild(document.createTextNode(sourceName));
    }
    if(sourceName&&sourceLicense)row.appendChild(document.createTextNode(' \u00b7 '));
    if(sourceLicense){
      var licenseLink=document.createElement('a');licenseLink.textContent=sourceLicense;
      if(/odbl/i.test(sourceLicense)){
        licenseLink.href='https://www.openstreetmap.org/copyright';licenseLink.target='_blank';licenseLink.rel='noopener noreferrer';
      }
      row.appendChild(licenseLink);
    }
    return row;
  }
  function hours24(v){
    var s=clean(v);if(!s)return'';
    return s.replace(/(\d{1,2})h(\d{2})/gi,'$1:$2').replace(/\s*(SA|CH|AM|PM)\b/gi,'');
  }
  function hubTopRank(p){
    var match=clean(p&&p.top_rank).match(/(?:TOP\s*)?(\d+)/i),rank=match?Number(match[1]):NaN;
    return isFinite(rank)&&rank>0?rank:Number.POSITIVE_INFINITY;
  }
  function hubVerificationState(p){
    var raw=p&&p.verified;
    if(raw===true)return'TRUE';if(raw===false)return'FALSE';
    var value=norm(raw);
    if(['true','1','yes','y','co','verified','da xac minh'].indexOf(value)>-1)return'TRUE';
    if(['false','0','no','n','khong','unverified','chua xac minh'].indexOf(value)>-1)return'FALSE';
    return'';
  }
  function hubTopInfo(p,pos,locationLabel){
    var rank=hubTopRank(p);if(!isFinite(rank))return null;
    var rawScope=clean(p&&p.top_scope),scope=norm(rawScope).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    var radius=Number(p&&p.top_radius_km),area=clean(p&&p.top_locality||p&&p.locality||p&&p.province);
    var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
    var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
    var radii=['radius','ban_kinh','khoang_cach','distance'];
    var kind='global';
    if(scope){
      var looksRadius=scope.indexOf('radius')>-1||scope.indexOf('ban_kinh')>-1||scope.indexOf('khoang_cach')>-1||scope.indexOf('distance')>-1;
      var looksLocal=scope.indexOf('local')>-1||scope.indexOf('dia_phuong')>-1||scope.indexOf('khu_vuc')>-1||scope.indexOf('province')>-1||scope.indexOf('tinh')>-1;
      if(globals.indexOf(scope)>-1)kind='global';
      else if(radii.indexOf(scope)>-1||looksRadius)kind='radius';
      else if(locals.indexOf(scope)>-1||looksLocal)kind='local';
      else if(isFinite(radius)&&radius>0)kind='radius';
      else {kind='local';if(!clean(p&&p.top_locality))area=rawScope;}
    }else if(isFinite(radius)&&radius>0)kind='radius';
    else if(clean(p&&p.top_locality))kind='local';
    if(kind==='global')return{rank:rank,label:'TOP của THIS LOCAL',scope:'global'};
    if(kind==='local'){
      var wanted=norm(locationLabel),actual=norm(area);
      if(!wanted||!actual||(wanted.indexOf(actual)<0&&actual.indexOf(wanted)<0))return null;
      return{rank:rank,label:'TOP của '+area,scope:'local'};
    }
    if(kind==='radius'){
      var km=isFinite(Number(p&&p._distance))?Number(p._distance):NaN;
      if(!isFinite(km)&&pos&&isFinite(Number(pos.lat))&&isFinite(Number(pos.lng))&&isFinite(Number(p.lat))&&isFinite(Number(p.lng))){
        var R=6371,toRad=Math.PI/180,dLat=(Number(p.lat)-Number(pos.lat))*toRad,dLng=(Number(p.lng)-Number(pos.lng))*toRad;
        var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(Number(pos.lat)*toRad)*Math.cos(Number(p.lat)*toRad)*Math.sin(dLng/2)*Math.sin(dLng/2);
        km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      }
      if(!pos||!isFinite(radius)||radius<=0||!isFinite(km)||km>radius)return null;
      return{rank:rank,label:'TOP trong bán kính '+(Math.round(radius*10)/10)+' km',scope:'radius',distance:km};
    }
    return null;
  }
  function hubRatingText(p){
    var count=Math.max(0,Number(p&&p.rating_count)||0),average=Number(p&&p.rating_average)||0;
    return count?('Đánh giá '+(Math.round(average*10)/10)+' \u2605 / '+count):'Đánh giá';
  }
  function jsonp(url){
    return new Promise(function(resolve,reject){
      var cb='TLHUB_'+Date.now()+'_'+Math.floor(Math.random()*100000),s=document.createElement('script'),done=false,fallbackStarted=false,fallbackTimer,finalTimer;
      function cleanup(){clearTimeout(fallbackTimer);clearTimeout(finalTimer);try{delete window[cb];}catch(e){}if(s.parentNode)s.parentNode.removeChild(s);}
      function finish(error,data){if(done)return;done=true;cleanup();if(error)reject(error);else resolve(data);}
      function fetchFallback(){
        if(done||fallbackStarted)return;fallbackStarted=true;
        if(typeof fetch!=='function'){finish(new Error('api'));return;}
        fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store'})
          .then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.text();})
          .then(function(text){finish(null,JSON.parse(text));})
          .catch(function(){finish(new Error('api'));});
      }
      window[cb]=function(data){finish(null,data);};
      s.onerror=fetchFallback;
      s.src=url+(url.indexOf('?')>-1?'&':'?')+'callback='+encodeURIComponent(cb);
      document.head.appendChild(s);
      fallbackTimer=setTimeout(fetchFallback,8000);
      finalTimer=setTimeout(function(){finish(new Error('timeout'));},30000);
    });
  }
  function cachedCategoryCatalog(){
    var cached=[];
    try{cached=JSON.parse(localStorage.getItem('tl_category_catalog_v4')||'[]');}catch(e){cached=[];}
    return Array.isArray(cached)?cached:[];
  }
  function categoryMeta(category){
    var wanted=norm(category),cached=cachedCategoryCatalog();
    for(var i=0;i<cached.length;i++){
      var item=cached[i]||{},name=clean(item.name_vi||item.name);
      if(name&&norm(name)===wanted)return item;
    }
    return null;
  }
  function categoryParentMeta(item){
    item=item||{};
    var pid=clean(item.parent_id),cached=cachedCategoryCatalog();
    if(pid){
      for(var i=0;i<cached.length;i++){
        if(clean(cached[i]&&cached[i].id)===pid)return cached[i];
      }
    }
    var pname=clean(item.parent_name);
    return pname?categoryMeta(pname):null;
  }
  function categoryPageUrl(category){
    var item=categoryMeta(category)||{},pitem=categoryParentMeta(item),parent=clean((pitem&&(pitem.name_vi||pitem.name))||item.parent_name);
    /* V17.34: Category con KHÔNG dùng post_url riêng. Link luôn được sinh từ trang nhóm cha
       + ?category=...#tlCategoryHub, vì vậy Category mới được duyệt tự có link mà không cần tạo Blogger Page. */
    if(parent){
      var purl=clean(pitem&&(pitem.post_url||pitem.postUrl||pitem.url))||parentFallbackUrl(parent);
      return purl+(purl.indexOf('?')>-1?'&':'?')+'category='+encodeURIComponent(clean(category))+'#tlCategoryHub';
    }
    var direct=clean(item.post_url||item.postUrl||item.url);
    return direct||parentFallbackUrl(category);
  }
  function parentFallbackUrl(name){
    /* V17.35: post_url trong taxonomy là nguồn sự thật. Nếu parent chưa có post_url,
       dùng trang /p/danh-muc.html ở chế độ parent thay vì đoán một Blogger Page chưa tồn tại. */
    return '/p/danh-muc.html?parent='+encodeURIComponent(clean(name));
  }
  function requestedHubCategory(){
    try{return clean(new URLSearchParams(location.search||'').get('category'));}catch(e){return'';}
  }
  function applyRequestedHubCategory(){
    if(!state.broad)return;
    var wanted=requestedHubCategory();
    if(!wanted){state.active='';return;}
    var found=state.subs.find(function(sub){return norm(sub.name)===norm(wanted);});
    state.active=found?found.name:'';
  }
  function syncHubCategoryUrl(name){
    if(!state.broad||!history||!history.replaceState)return;
    try{
      var u=new URL(location.href);
      if(clean(name))u.searchParams.set('category',clean(name));else u.searchParams.delete('category');
      history.replaceState(null,'',u.pathname+(u.search||'')+(clean(name)?'#tlCategoryHub':''));
    }catch(e){}
  }
  function categoryParentName(category){
    var item=categoryMeta(category)||{},pitem=categoryParentMeta(item);
    return clean((pitem&&(pitem.name_vi||pitem.name))||item.parent_name);
  }
  function fetchPlaces(category,offset){
    var api=window.TL_GUIDE_API_URL||'';if(!api)return Promise.resolve([]);
    offset=Math.max(0,Number(offset)||0);
    /* V17.28: tên Category là khóa lọc chính. Không thay bằng category_id lấy từ cache cũ,
       vì một ID cũ/trùng tên có thể làm mất địa điểm người dùng đã duyệt dù p.category đúng. */
    var ref=clean(category);
    var query='?action=list&category='+encodeURIComponent(ref)
      +'&limit='+encodeURIComponent(HUB_PAGE_SIZE)
      +'&offset='+encodeURIComponent(offset);
    /* V17.28: KHÔNG gửi lat/lng khi duyệt Category.
       tl_list_places dùng nhánh tọa độ sẽ yêu cầu p.location IS NOT NULL, vì vậy
       địa điểm do người dùng đề xuất nhưng chưa có lat/lng có thể bị loại trước khi
       TOP được áp dụng. Duyệt danh mục phải lấy đủ địa điểm trước; vị trí chỉ được
       dùng ở selectedPlaces() phía client để tính/sắp khoảng cách sau khi dữ liệu về.
       Tìm kiếm Gần nhất riêng vẫn dùng RPC geospatial và không bị thay đổi. */
    return jsonp(api+query).then(function(data){
      var arr=data&&data.ok&&Array.isArray(data.places)?data.places:[];
      return arr.map(function(p){
        p._category=clean(p.category)||category;
        var rawLat=p.lat,rawLng=p.lng;
        p.lat=(rawLat===null||rawLat===undefined||String(rawLat).trim()==='')?NaN:Number(rawLat);
        p.lng=(rawLng===null||rawLng===undefined||String(rawLng).trim()==='')?NaN:Number(rawLng);
        return p;
      });
    }).catch(function(){return[];});
  }
  function fetchLeafFirstPage(category){
    return fetchPlaces(category,0).then(function(directRows){
      directRows=dedupe(directRows||[]);
      var directCount=directRows.length,parent=categoryParentName(category);
      if(!parent){return{places:directRows,directCount:directCount};}
      /* TOP/user-submitted safety net: merge thêm kết quả parent rồi lọc đúng Category.
         Điều này bảo đảm địa điểm TOP do người dùng đề xuất không biến mất nếu list leaf
         đang dùng dữ liệu/cache liên kết Category cũ trên Edge/DB. */
      return fetchParentPage(parent).then(function(page){
        if(!page||!Array.isArray(page.places))return{places:directRows,directCount:directCount};
        var wanted=norm(category),meta=categoryMeta(category)||{},cid=clean(meta.id);
        var extra=page.places.filter(function(p){
          return norm(p&&p.category)===wanted || (cid&&clean(p&&p.category_id)===cid);
        });
        return{places:dedupe(directRows.concat(extra)),directCount:directCount};
      }).catch(function(){return{places:directRows,directCount:directCount};});
    });
  }

  function loadMoreLeafServer(){
    if(state.broad||state.serverLoadingMore||!state.serverHasMore)return;
    state.serverLoadingMore=true;
    fetchPlaces(state.label,state.serverOffset).then(function(rows){
      rows=dedupe(rows||[]);
      var before=state.places.length;
      state.places=dedupe(state.places.concat(rows));
      state.serverOffset+=rows.length;
      state.serverHasMore=rows.length>=HUB_PAGE_SIZE;
      state.serverLoadingMore=false;
      if(state.places.length>before){
        state.visibleLimit=Math.min(state.visibleLimit+hubBatchSize(),state.places.length);
      }
      countPlacesByCategory(state.subs,state.places);
      renderChips();renderPlaces();
    }).catch(function(){state.serverLoadingMore=false;state.serverHasMore=false;renderPlaces();});
  }
  function normalizeChildren(values,parent){
    var seen={},out=[];
    (values||[]).forEach(function(item){
      var name=clean(typeof item==='string'?item:(item&&((item.name_vi||item.name)||item.category)));
      if(!name||norm(name)===norm(parent)||seen[norm(name)])return;
      seen[norm(name)]=1;
      out.push({
        name:name,
        id:clean(item&&item.id),
        url:clean(item&&((item.post_url||item.postUrl)||item.url)),
        placeCount:Number(item&&((item.place_count||item.placeCount)))||0
      });
    });
    return out;
  }
  function normalizePlaces(values){
    return (values||[]).map(function(p){
      p._category=clean(p.category||p._category);
      var rawLat=p.lat,rawLng=p.lng;
      p.lat=(rawLat===null||rawLat===undefined||String(rawLat).trim()==='')?NaN:Number(rawLat);
      p.lng=(rawLng===null||rawLng===undefined||String(rawLng).trim()==='')?NaN:Number(rawLng);
      return p;
    });
  }
  function fetchParentPage(parentRef){
    var api=window.TL_GUIDE_API_URL||'';
    if(!api)return Promise.resolve(null);

    function parseParent(data){
      if(!data||!data.ok)return null;
      var places=normalizePlaces(Array.isArray(data.places)?data.places:[]);
      /* Một số nhóm tổng hợp như “Dịch vụ” không phải parent thật trong taxonomy.
         Edge API vẫn trả places qua RPC alias; không được vứt kết quả chỉ vì data.parent=null. */
      var parentName=clean(data.parent&&((data.parent.name_vi||data.parent.name)))||clean(parentRef);
      if(!parentName)return null;
      var children=normalizeChildren(data.children||[],parentName);
      if(!children.length&&places.length){
        var seen={},derived=[];
        places.forEach(function(p){var n=clean(p.category||p._category),k=norm(n);if(!n||seen[k])return;seen[k]=1;derived.push({name:n,id:clean(p.category_id),url:'',placeCount:0});});
        children=derived;
      }
      if(!data.parent&&!places.length)return null;
      return{parent:parentName,children:children,places:places};
    }

    function broad(){
      var q='?action=parentPage&parent='+encodeURIComponent(parentRef)+'&limit='+encodeURIComponent(HUB_MAX_RESULTS);
      return jsonp(api+q).then(parseParent).catch(function(){return null;});
    }

    /* V17.28: parent category cũng luôn tải nhánh rộng, không gửi lat/lng.
       Nếu gửi tọa độ, tl_list_parent_places có thể loại các địa điểm chưa có
       p.location trước khi TOP được xét. TOP user-submitted phải luôn có cơ hội
       xuất hiện trong nhóm cha; khoảng cách vẫn được tính/sắp ở client. */
    return broad();
  }
    function countPlacesByCategory(subs,places){
    subs.forEach(function(sub){
      sub.placeCount=places.filter(function(p){return norm(p._category||p.category)===norm(sub.name);}).length;
    });
  }
  function clickMap(){
    try{var x=JSON.parse(localStorage.getItem(CLICK_KEY)||'{}');return x&&typeof x==='object'?x:{};}catch(e){return{};}
  }
  function clickKey(sub){return norm(locality()||'global')+'|'+norm(state.label)+'|'+norm(sub);}
  function clickCount(sub){return Number(clickMap()[clickKey(sub)])||0;}
  function addClick(sub){
    try{var x=clickMap(),k=clickKey(sub);x[k]=(Number(x[k])||0)+1;localStorage.setItem(CLICK_KEY,JSON.stringify(x));}catch(e){}
  }
  function dedupe(arr){
    var seen={},out=[];
    arr.forEach(function(p){
      var key=clean(p.id)||norm(clean(p.name)+'|'+clean(p.address));
      if(!key||seen[key])return;seen[key]=1;out.push(p);
    });
    return out;
  }

  function els(){
    return {
      hub:document.getElementById('tlCategoryHub'),
      title:document.getElementById('tlHubTitle'),
      sub:document.getElementById('tlHubSub'),
      locationBtn:document.getElementById('tlHubUseLocation'),
      chips:document.getElementById('tlHubChips'),
      input:document.getElementById('tlHubSearch'),
      status:document.getElementById('tlHubStatus'),
      grid:document.getElementById('tlHubGrid')
    };
  }
  function rankedSubs(){
    return state.subs.slice().sort(function(a,b){
      var sa=clickCount(a.name)*100+(a.placeCount||0),sb=clickCount(b.name)*100+(b.placeCount||0);
      if(sb!==sa)return sb-sa;
      return a.name.localeCompare(b.name,'vi');
    });
  }
  function syncProposalContext(){
    window.TL_CATEGORY_HUB_PARENT=state.broad?state.label:'';
    window.TL_CATEGORY_HUB_ACTIVE=state.broad?state.active:'';
    window.TL_CATEGORY_HUB_CHILDREN=state.broad?state.subs.map(function(x){return x.name;}):[];
  }
  function saveHubPosition(pos){
    if(!pos||!pos.coords)return null;
    var previous=savedLocation()||{};
    var p={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy)||null,locality:'',region:'',countryCode:clean(previous.countryCode),countryName:clean(previous.countryName),currency:clean(previous.currency),savedAt:Date.now()};
    try{localStorage.setItem(LOCATION_KEY,JSON.stringify(p));}catch(e){}
    try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
    if(typeof window.TL_REVERSE_CURRENT_LOCALITY==='function'){
      window.TL_REVERSE_CURRENT_LOCALITY(pos,function(meta){
        if(!meta)return;
        p.locality=clean(meta.locality);p.region=clean(meta.region);p.countryCode=clean(meta.countryCode);p.countryName=clean(meta.countryName);p.currency=clean(meta.currency);p.savedAt=Date.now();
        try{localStorage.setItem(LOCATION_KEY,JSON.stringify(p));}catch(e){}
        try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
      });
    }
    return p;
  }
  function requestHubLocation(){
    var e=els(),btn=e.locationBtn;if(!btn)return;
    if(!navigator.geolocation){if(e.status){e.status.hidden=false;e.status.textContent='Không thể sử dụng vị trí trên thiết bị này.';}return;}
    btn.disabled=true;btn.textContent=tr('updatingLocation');
    if(e.status){e.status.hidden=false;e.status.textContent=tr('updatingLocation');}
    navigator.geolocation.getCurrentPosition(function(pos){
      saveHubPosition(pos);state.visibleLimit=hubBatchSize();btn.disabled=false;btn.textContent=tr('updateLocation');renderHeader();reloadHubPlaces();
    },function(){
      btn.disabled=false;btn.textContent=tr('updateLocation');
      if(e.status){e.status.hidden=false;e.status.textContent='Không lấy được vị trí. Vui lòng thử lại.';}
    },{enableHighAccuracy:true,timeout:18000,maximumAge:0});
  }
  function renderHeader(){
    var e=els(),loc=locality();
    if(!e.hub)return;
    var label=i18n(state.label||'Địa điểm');
    e.title.textContent=loc?(label+' · '+loc):label;
    if(e.sub)e.sub.textContent=tr(state.broad?'descParent':'descSingle');
    if(e.locationBtn&&!e.locationBtn.disabled)e.locationBtn.textContent=tr('updateLocation');
    if(e.input){var modeSelect=e.hub.querySelector('.tl-search-mode-select');e.input.placeholder=(modeSelect&&modeSelect.value==='place')?'Tìm tên địa điểm bạn quan tâm':'Tìm danh mục, chủ đề, các dịch vụ, ...';}
  }
  function renderChips(){
    var e=els();if(!e.chips)return;syncProposalContext();e.chips.innerHTML='';
    var all=document.createElement('button');all.type='button';
    all.className='tl-category-hub-chip'+(!state.active?' is-active':'');
    all.textContent=tr('all');
    all.addEventListener('click',function(){state.active='';state.visibleLimit=hubBatchSize();syncHubCategoryUrl('');renderChips();renderPlaces();});
    e.chips.appendChild(all);

    var ranked=rankedSubs(),top=ranked[0]||null;
    ranked.forEach(function(sub,idx){
      var b=document.createElement('button');b.type='button';
      b.className='tl-category-hub-chip'+(state.active===sub.name?' is-active':'');
      if(!state.expanded&&idx>=MAX_SUGGEST)b.hidden=true;
      var name=document.createElement('span');name.textContent=sub.name;b.appendChild(name);
      if(top&&sub.name===top.name&&((sub.placeCount||0)>0||clickCount(sub.name)>0)){
        var badge=document.createElement('span');badge.className='tl-hub-badge';badge.textContent=tr('suggest');b.appendChild(badge);
      }
      b.addEventListener('click',function(){
        addClick(sub.name);
        /* V17.32: trên trang nhóm chính, tab Category lọc ngay tại chỗ như trước.
           URL ?category=... được cập nhật để có thể copy/share đúng trạng thái lọc. */
        state.active=sub.name;state.visibleLimit=hubBatchSize();
        if(state.broad)syncHubCategoryUrl(sub.name);
        renderChips();renderPlaces();
      });
      e.chips.appendChild(b);
    });

    if(ranked.length>MAX_SUGGEST){
      var more=document.createElement('button');more.type='button';more.className='tl-category-hub-chip tl-category-hub-more';
      more.textContent=state.expanded?tr('less'):(tr('more')+' +'+(ranked.length-MAX_SUGGEST));
      more.addEventListener('click',function(){state.expanded=!state.expanded;renderChips();});
      e.chips.appendChild(more);
    }
  }
  function selectedPlaces(){
    var e=els(),q=e.input?norm(e.input.value):'',arr=state.places.slice();
    if(state.active)arr=arr.filter(function(p){return p._category===state.active;});
    if(q)arr=arr.filter(function(p){return norm([p.name,p.address,p.note,p._category].join(' ')).indexOf(q)>-1;});
    var pos=savedLocation();
    arr.forEach(function(p,index){p._hubOrder=index;});
    if(pos){
      /* V17.25: vị trí chỉ ưu tiên thứ tự, tuyệt đối không xóa địa điểm khỏi Category.
         Bản cũ lọc cứng <=25km nên các địa điểm thiếu tọa độ hoặc ngoài bán kính biến mất. */
      arr.forEach(function(p){
        p._distance=(isFinite(p.lat)&&isFinite(p.lng)&&p.lat>=-90&&p.lat<=90&&p.lng>=-180&&p.lng<=180)
          ?distance(Number(pos.lat),Number(pos.lng),p.lat,p.lng)
          :Infinity;
      });
    }
    arr.sort(function(a,b){
      var topA=hubTopInfo(a,pos,locality()),topB=hubTopInfo(b,pos,locality());
      var rankA=topA?topA.rank:Number.POSITIVE_INFINITY,rankB=topB?topB.rank:Number.POSITIVE_INFINITY;
      if(rankA!==rankB)return rankA-rankB;
      if(pos&&a._distance!==b._distance)return a._distance-b._distance;
      return a._hubOrder-b._hubOrder;
    });
    return arr;
  }
  function renderPlaces(){
    var e=els();if(!e.grid)return;
    stopHubLoadObserver();
    var arr=selectedPlaces(),pos=savedLocation();e.grid.innerHTML='';
    if(e.status){e.status.hidden=!state.loading;e.status.textContent=state.loading?tr('loading'):'';}
    if(!arr.length&&!state.loading){
      var empty=document.createElement('div');empty.className='tl-category-hub-empty';empty.textContent=tr('noPlace');e.grid.appendChild(empty);return;
    }
    var nearestPlace=null;
    if(pos){
      arr.forEach(function(p){if(statusOf(p)!=='PERM_CLOSED'&&isFinite(p._distance)&&(!nearestPlace||p._distance<nearestPlace._distance))nearestPlace=p;});
    }
    arr.slice(0,state.visibleLimit).forEach(function(p){
      var st=statusOf(p);if(st==='PERM_CLOSED')return;
      var card=document.createElement('article');card.className='tl-hub-place'+(nearestPlace===p?' is-nearest':'')+(st==='TEMP_CLOSED'?' is-temp-closed':'');
      if(st==='TEMP_CLOSED'){var rb=document.createElement('div');rb.className='tl-hub-ribbon';rb.textContent=tr('temp');card.appendChild(rb);}
      var cat=document.createElement('div');cat.className='tl-hub-place-cat';cat.textContent=p._category||state.label;card.appendChild(cat);
      if(nearestPlace===p){var nearest=document.createElement('span');nearest.className='tl-hub-nearest';nearest.textContent=locality()?('Gần nhất quanh '+locality()):'Gần bạn nhất';card.appendChild(nearest);}
      var placeTop=hubTopInfo(p,pos,locality());
      if(placeTop||p.is_trusted||p.is_hot){
        var badges=document.createElement('div');badges.className='tl-hub-place-badges';
        if(placeTop){var top=document.createElement('span');top.className='tl-admin-badge is-top';top.textContent='\u2605 '+placeTop.label;badges.appendChild(top);}
        if(p.is_trusted){var trusted=document.createElement('span');trusted.className='tl-admin-badge is-trusted';trusted.textContent='\u2713 '+tr('trusted');badges.appendChild(trusted);}
        if(p.is_hot){var hot=document.createElement('span');hot.className='tl-admin-badge is-hot';hot.textContent='\u25CF '+tr('hot');badges.appendChild(hot);}
        card.appendChild(badges);
      }
      var h=document.createElement('h3');h.textContent=clean(p.name)||state.label;card.appendChild(h);
      if(clean(p.address)){var a=document.createElement('p');a.className='tl-hub-place-address';a.textContent=clean(p.address);card.appendChild(a);}
      var meta=document.createElement('div');meta.className='tl-hub-meta';
      if(pos&&isFinite(p._distance)){var d=document.createElement('span');d.className='is-distance';d.textContent=distanceText(p._distance);meta.appendChild(d);}
      var verifyState=hubVerificationState(p);
      if(verifyState){var verification=document.createElement('span');verification.className=verifyState==='TRUE'?'is-verified':'is-unverified';verification.textContent=verifyState==='TRUE'?'Đã xác minh':'Chưa xác minh';meta.appendChild(verification);}
      if(clean(p.price)){var pr=document.createElement('span');pr.textContent=clean(p.price);meta.appendChild(pr);}
      if(clean(p.hours)){var hr=document.createElement('span');hr.textContent=hours24(p.hours);meta.appendChild(hr);}
      if(meta.childNodes.length)card.appendChild(meta);
      var sourceRow=hubSourceNode(p);if(sourceRow)card.appendChild(sourceRow);
      var act=document.createElement('div');act.className='tl-hub-actions';
      var dir=document.createElement('a');dir.href=mapsUrl(p,pos);dir.target='_blank';dir.rel='noopener';dir.textContent=tr('directions');act.appendChild(dir);
      if(clean(p.phone)){var tel=document.createElement('a');tel.href='tel:'+clean(p.phone).replace(/[^\d+]/g,'');tel.textContent=tr('call');act.appendChild(tel);}
      if(clean(p.business_url)){var web=document.createElement('a');web.href=hubWebsiteUrl(p.business_url);web.target='_blank';web.rel='noopener noreferrer';web.textContent=tr('website');act.appendChild(web);}
      var edit=document.createElement('button');edit.type='button';edit.textContent=tr('update');
      edit.addEventListener('click',function(){if(typeof window.TL_OPEN_PLACE_UPDATE==='function')window.TL_OPEN_PLACE_UPDATE(p,p._category||state.label,state.broad?state.label:'');});
      act.appendChild(edit);
      var rate=document.createElement('button');rate.type='button';rate.textContent=hubRatingText(p);
      rate.addEventListener('click',function(){if(typeof window.TL_OPEN_PLACE_RATING==='function')window.TL_OPEN_PLACE_RATING(p,p._category||state.label,state.broad?state.label:'');});
      act.appendChild(rate);
      card.appendChild(act);e.grid.appendChild(card);
    });
    if(state.visibleLimit<arr.length||(!state.broad&&state.serverHasMore)){
      var sentinel=document.createElement('div');sentinel.className='tl-hub-load-sentinel';sentinel.setAttribute('aria-hidden','true');
      if(state.serverLoadingMore)sentinel.textContent='Đang tải thêm địa điểm...';
      e.grid.appendChild(sentinel);watchHubMore(sentinel,arr.length);
    }
  }
  function refreshLanguage(){
    if(!state.label)return;
    renderHeader();renderChips();renderPlaces();
  }
  window.TL_CATEGORY_HUB_REFRESH=refreshLanguage;

  function reloadHubPlaces(){
    state.loading=true;state.serverOffset=0;state.serverHasMore=false;state.serverLoadingMore=false;renderPlaces();
    var task=state.broad?fetchParentPage(state.label):fetchLeafFirstPage(state.label);
    task.then(function(result){
      if(state.broad){
        if(result){state.subs=result.children;state.places=dedupe(result.places);countPlacesByCategory(state.subs,state.places);}
      }else{
        var bundle=result||{places:[],directCount:0};
        var rows=dedupe(bundle.places||[]);state.places=rows;
        state.serverOffset=Math.max(0,Number(bundle.directCount)||0);
        state.serverHasMore=state.serverOffset>=HUB_PAGE_SIZE;countPlacesByCategory(state.subs,state.places);
      }
      state.loading=false;renderChips();renderPlaces();
    }).catch(function(){state.loading=false;renderPlaces();});
  }

  function activateHub(){
    var e=els();if(!e.hub||!state.label)return;
    e.hub.hidden=false;
    document.body.classList.add('tl-category-hub-active');
    if(state.broad)document.body.classList.add('tl-category-parent-page');
    renderHeader();renderChips();renderPlaces();
    if(e.input&&!e.input.__tlHubBound){e.input.__tlHubBound=true;e.input.addEventListener('input',function(){state.visibleLimit=hubBatchSize();renderPlaces();});}
    if(e.locationBtn&&!e.locationBtn.__tlLocationBound){e.locationBtn.__tlLocationBound=true;e.locationBtn.addEventListener('click',requestHubLocation);}
    if(!document.__tlHubLocationBound){
      document.__tlHubLocationBound=true;
      document.addEventListener('tl:locationchange',function(){state.visibleLimit=hubBatchSize();renderHeader();renderPlaces();});
    }
    if(!document.__tlHubRatingBound){
      document.__tlHubRatingBound=true;
      document.addEventListener('tl:ratingchange',function(ev){
        var detail=ev&&ev.detail||{};
        state.places.forEach(function(place){if(clean(place.id)===clean(detail.place_id)){place.rating_average=Number(detail.average)||0;place.rating_count=Number(detail.count)||0;}});
        renderPlaces();
      });
    }
  }

  function boot(){
    var e=els();if(!e.hub)return;
    var route=currentRoute();
    if(!route){
      e.hub.hidden=true;
      return;
    }
    if(route.genericParent)document.body.classList.add('tl-generic-parent-route');

    /* V17.24: Trang Tất cả danh mục có runtime riêng trong theme.
       Hỗ trợ cả khi Blogger tự thêm hậu tố vào slug. */
    /* V17.37: /p/danh-muc.html?parent=... là parent fallback thật, nên không được
       chặn chỉ vì tiêu đề Blogger của Page vẫn là “Danh mục”. Chỉ ẩn Hub khi
       đây là trang Tất cả danh mục thuần (không có ?parent=...). */
    if(!route.genericParent&&route.type==='parent'&&(norm(route.ref).indexOf('danh-muc')===0||norm(currentPageTitle())==='danh muc')){
      e.hub.hidden=true;
      return;
    }

    /* Trang nhãn vẫn là một Category đơn. Trang /p/{id}.html được nhận diện
       hoàn toàn từ id trong Google Sheet, không còn danh sách viết cứng. */
    if(route.type==='category'){
      var rawLabel=clean(route.label),alias=taxonomyAlias(rawLabel);
      if(alias&&alias.type==='parent'){
        state.label=alias.ref;state.broad=true;state.subs=[];state.loading=true;activateHub();
        fetchParentPage(alias.ref).then(function(page){
          if(page){state.label=page.parent;state.subs=page.children;state.places=dedupe(page.places);countPlacesByCategory(state.subs,state.places);applyRequestedHubCategory();}
          state.loading=false;renderHeader();renderChips();renderPlaces();
        }).catch(function(){state.loading=false;renderPlaces();});
        return;
      }
      state.label=alias&&alias.type==='category'?alias.ref:rawLabel;
      state.broad=false;
      state.subs=[{name:state.label,placeCount:0}];
      state.loading=true;
      activateHub();
      fetchLeafFirstPage(state.label).then(function(bundle){
        var places=dedupe(bundle&&bundle.places||[]),directCount=Math.max(0,Number(bundle&&bundle.directCount)||0);
        if(places.length)return{kind:'single',places:places,directCount:directCount};
        /* Nếu route Page/label thực ra là tên parent, tự nâng lên parent thay vì báo rỗng. */
        return fetchParentPage(rawLabel).then(function(page){return page?{kind:'parent',page:page}:{kind:'single',places:[],directCount:0};});
      }).then(function(result){
        if(result&&result.kind==='parent'){
          state.broad=true;state.label=result.page.parent;state.subs=result.page.children;state.places=dedupe(result.page.places);countPlacesByCategory(state.subs,state.places);applyRequestedHubCategory();renderHeader();
        }else{
          state.places=dedupe(result&&result.places||[]);
          state.serverOffset=Math.max(0,Number(result&&result.directCount)||0);
          state.serverHasMore=state.serverOffset>=HUB_PAGE_SIZE;
          countPlacesByCategory(state.subs,state.places);
        }
        state.loading=false;renderChips();renderPlaces();
      }).catch(function(){state.loading=false;renderPlaces();});
      return;
    }

    state.loading=true;
    var title=currentPageTitle(),titleAlias=taxonomyAlias(title),slugAlias=taxonomyAlias(route.ref);
    var refs=[];
    function addRef(v){v=clean(v);if(v&&!refs.some(function(x){return norm(x)===norm(v);}))refs.push(v);}
    if(titleAlias&&titleAlias.type==='parent')addRef(titleAlias.ref);
    if(slugAlias&&slugAlias.type==='parent')addRef(slugAlias.ref);
    addRef(title);
    addRef('parent-'+route.ref);
    addRef(route.ref);
    function tryParent(i){if(i>=refs.length)return Promise.resolve(null);return fetchParentPage(refs[i]).then(function(page){return page||tryParent(i+1);});}
    tryParent(0).then(function(page){
      if(page){
        state.label=page.parent;
        state.broad=true;
        state.subs=page.children;
        state.places=dedupe(page.places);
        countPlacesByCategory(state.subs,state.places);
        applyRequestedHubCategory();
        state.loading=false;
        activateHub();
        return;
      }

      /* V17.25: một Blogger Page/post_url có thể trỏ trực tiếp tới Category con.
         Bản cũ coi mọi /p/*.html là parent nên các trang như “Salon tóc & cắt tóc”
         bị ẩn dù Places đã có dữ liệu. Nếu không phải parent, thử lại như Category con. */
      var leafRefs=[];
      function addLeaf(v){v=clean(v);if(v&&!leafRefs.some(function(x){return norm(x)===norm(v);}))leafRefs.push(v);}
      if(titleAlias&&titleAlias.type==='category')addLeaf(titleAlias.ref);
      if(slugAlias&&slugAlias.type==='category')addLeaf(slugAlias.ref);
      addLeaf(title);
      function tryLeaf(i){
        if(i>=leafRefs.length)return Promise.resolve(null);
        var ref=leafRefs[i];
        return fetchLeafFirstPage(ref).then(function(bundle){
          var rows=dedupe(bundle&&bundle.places||[]);
          return rows.length?{label:ref,places:rows,directCount:Math.max(0,Number(bundle&&bundle.directCount)||0)}:tryLeaf(i+1);
        });
      }
      return tryLeaf(0).then(function(leaf){
        if(!leaf){state.loading=false;e.hub.hidden=true;return;}
        state.label=leaf.label;
        state.broad=false;
        state.subs=[{name:leaf.label,placeCount:leaf.places.length}];
        state.places=leaf.places;
        state.serverOffset=Math.max(0,Number(leaf.directCount)||0);
        state.serverHasMore=state.serverOffset>=HUB_PAGE_SIZE;
        state.loading=false;
        activateHub();
      });
    }).catch(function(){
      state.loading=false;e.hub.hidden=true;
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


/* ---- original script block 10 ---- */
(function(){
  'use strict';
  var LOCATION_KEY='tl_user_location_v1';
  function savedLocation(){
    try{var p=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');return p&&isFinite(Number(p.lat))&&isFinite(Number(p.lng))?p:null;}catch(e){return null;}
  }
  function saveLocation(pos){
    if(!pos||!pos.coords)return null;
    var old=savedLocation()||{};
    var p={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy)||null,locality:old.locality||'',region:old.region||'',countryCode:old.countryCode||'',countryName:old.countryName||'',savedAt:Date.now()};
    try{localStorage.setItem(LOCATION_KEY,JSON.stringify(p));}catch(e){}
    try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
    return p;
  }
  function setupLocationNotice(){
    var box=document.getElementById('tlLocationConsent'),btn=document.getElementById('tlLocationConsentButton'),title=document.getElementById('tlLocationConsentTitle'),txt=document.getElementById('tlLocationConsentText');
    if(!box||!btn)return;
    if(savedLocation()){box.hidden=true;document.documentElement.classList.remove('tl-location-notice-open');return;}
    box.hidden=false;document.documentElement.classList.add('tl-location-notice-open');
    btn.addEventListener('click',function(){
      if(!navigator.geolocation){title.textContent='Không dùng được vị trí';txt.textContent='Trình duyệt này không hỗ trợ xác định vị trí.';return;}
      btn.disabled=true;btn.textContent='Đang lấy vị trí...';
      navigator.geolocation.getCurrentPosition(function(pos){
        saveLocation(pos);box.hidden=true;document.documentElement.classList.remove('tl-location-notice-open');btn.disabled=false;btn.textContent='Bật vị trí';
      },function(){
        btn.disabled=false;btn.textContent='Thử lại';title.textContent='Chưa xác nhận được vị trí';txt.textContent='Hãy cho phép quyền vị trí của trình duyệt rồi bấm Thử lại.';
      },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
    });
    document.addEventListener('tl:locationchange',function(){box.hidden=true;document.documentElement.classList.remove('tl-location-notice-open');});
  }
  function setupMobileDock(){
    var dock=document.getElementById('tlMobileDock');if(!dock||dock.__tlFixed)return;dock.__tlFixed=true;
    dock.style.pointerEvents='auto';
    dock.addEventListener('pointerdown',function(e){if(e.target&&e.target.closest&&e.target.closest('a'))e.stopPropagation();},true);
    dock.addEventListener('click',function(e){
      var link=e.target&&e.target.closest?e.target.closest('a'):null;if(!link||!dock.contains(link))return;
      e.preventDefault();e.stopPropagation();
      var href=link.getAttribute('href')||'/';
      try{window.location.assign(new URL(href,location.href).href);}catch(err){window.location.href=href;}
    },true);
  }
  function enhanceSearchPage(){
    if(!document.body||!document.body.classList.contains('search-view'))return false;
    var pageBody=document.getElementById('page_body');if(!pageBody||!pageBody.parentNode)return false;
    var query='',mode='category';try{var p=new URLSearchParams(location.search);query=(p.get('q')||'').trim();mode=p.get('type')==='place'?'place':'category';}catch(e){}
    var form=document.getElementById('tlSearchPageForm');
    if(!form){
      form=document.createElement('form');form.id='tlSearchPageForm';form.className='tl-search-page-form tl-search-control-v17';form.action='/search';form.method='get';form.autocomplete='off';
      var sel=document.createElement('select');sel.id='tlSearchPageMode';sel.name='type';sel.className='tl-search-mode-select';sel.setAttribute('aria-label','Loại tìm kiếm');
      var o1=document.createElement('option');o1.value='category';o1.textContent='Danh mục';var o2=document.createElement('option');o2.value='place';o2.textContent='Địa điểm';sel.appendChild(o1);sel.appendChild(o2);sel.value=mode;
      var inp=document.createElement('input');inp.id='tlSearchPageInput';inp.type='search';inp.name='q';inp.value=query;inp.placeholder=mode==='place'?'Tìm tên địa điểm bạn quan tâm':'Tìm danh mục, chủ đề, các dịch vụ, ...';inp.setAttribute('aria-label',mode==='place'?'Tìm địa điểm':'Tìm danh mục');
      var btn=document.createElement('button');btn.type='submit';btn.textContent='Tìm kiếm';
      form.appendChild(sel);form.appendChild(inp);form.appendChild(btn);
      var host=document.getElementById('tlGlobalSearchPlaces');pageBody.parentNode.insertBefore(form,host||pageBody);
      if(window.TL_BIND_SEARCH_UI)window.TL_BIND_SEARCH_UI(inp,sel,form);
    }else{
      var existingInput=document.getElementById('tlSearchPageInput'),existingSelect=document.getElementById('tlSearchPageMode');
      /* V17.10: form đã tồn tại thì giữ nguyên lựa chọn người dùng; không reset theo URL vì DOM/gợi ý thay đổi. */
      if(window.TL_BIND_SEARCH_UI&&existingInput)window.TL_BIND_SEARCH_UI(existingInput,existingSelect,form);
    }
    var tabs=document.querySelectorAll('#tlGlobalSearchPlaces .tl-global-search-tab');
    if(tabs[0])tabs[0].classList.add('is-relevance');
    if(tabs[1])tabs[1].classList.add('is-nearest');
    return true;
  }
  function ensureArticleSearch(){
    if(!document.body||!document.body.classList.contains('item-view'))return;
    if(document.getElementById('tlHubSearch')||document.getElementById('tlInlineArticleSearch'))return;
    var main=document.getElementById('main');if(!main)return;
    var form=document.createElement('form');form.id='tlInlineArticleSearch';form.className='tl-inline-search-form tl-search-control-v17';form.action='/search';form.method='get';form.autocomplete='off';
    var sel=document.createElement('select');sel.name='type';sel.className='tl-search-mode-select';sel.setAttribute('aria-label','Loại tìm kiếm');sel.innerHTML='<option value="category" selected>Danh mục</option><option value="place">Địa điểm</option>';
    var inp=document.createElement('input');inp.type='search';inp.name='q';inp.placeholder='Tìm danh mục, chủ đề, các dịch vụ, ...';inp.setAttribute('aria-label','Tìm danh mục');
    var btn=document.createElement('button');btn.type='submit';btn.textContent='Tìm kiếm';
    form.appendChild(sel);form.appendChild(inp);form.appendChild(btn);
    main.insertBefore(form,main.firstChild);
    if(window.TL_BIND_SEARCH_UI)window.TL_BIND_SEARCH_UI(inp,sel,form);
  }
  function boot(){
    setupLocationNotice();setupMobileDock();ensureArticleSearch();
    if(!enhanceSearchPage()){
      var tries=0,t=setInterval(function(){tries++;if(enhanceSearchPage()||tries>80)clearInterval(t);},100);
    }
    /* V17.11: không observe toàn bộ body. Search page chỉ cần tạo/bind một lần. */
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


/* ---- original script block 11 ---- */
(function(){
  'use strict';
  var SELECTOR='.tl-category-hub-search-control,.tl-search-page-form,.tl-inline-search-form';
  var states=[];
  var frame=0;

  function num(v){v=parseFloat(v);return isFinite(v)?v:0;}
  function visible(el){
    if(!el||!el.isConnected)return false;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden')return false;
    return !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
  }
  function headerTop(){
    var header=document.querySelector('.tl-site-header');
    var bottom=header?Number(header.getBoundingClientRect().bottom||0):0;
    var height=header?Number(header.offsetHeight||0):0;
    /* V17.55: mobile lấy chiều cao header thật làm mốc cố định để không bị thanh trình duyệt
       làm top thay đổi giữa các frame cuộn. */
    if(window.innerWidth<=760)return Math.max(0,Math.round(height),Math.round(bottom))+10;
    return Math.max(0,Math.round(bottom))+10;
  }
  function findState(el){
    for(var i=0;i<states.length;i++)if(states[i].el===el)return states[i];
    return null;
  }
  function remember(st){
    if(st.sticky||!visible(st.el))return false;
    var r=st.el.getBoundingClientRect(),cs=getComputedStyle(st.el);
    if(r.width<20||r.height<20)return false;
    st.originTop=window.pageYOffset+r.top;
    st.height=Math.ceil(r.height+num(cs.marginTop)+num(cs.marginBottom));
    st.marginLeft=num(cs.marginLeft);st.marginRight=num(cs.marginRight);
    st.ready=true;
    return true;
  }
  function geometry(st){
    if(!st.marker||!st.marker.parentElement)return;
    var r=st.marker.getBoundingClientRect(),edge=8,viewport=window.visualViewport;
    var viewLeft=viewport?Number(viewport.offsetLeft||0):0;
    var viewWidth=viewport?Number(viewport.width||window.innerWidth):window.innerWidth;
    var left,width;
    /* V17.53: mọi search-follow trên mobile đều cân giữa viewport, chừa 8px hai bên. */
    if(window.innerWidth<=760){
      left=viewLeft+edge;
      width=Math.max(220,viewWidth-edge*2);
    }else{
      left=Math.max(edge,r.left+st.marginLeft);
      var maxRight=Math.min(window.innerWidth-edge,r.right-st.marginRight);
      width=Math.max(220,maxRight-left);
      if(width>window.innerWidth-edge*2)width=window.innerWidth-edge*2;
      left=Math.max(edge,Math.min(left,window.innerWidth-width-edge));
    }
    st.el.style.setProperty('--tl-follow-search-top',headerTop()+'px');
    st.el.style.setProperty('--tl-follow-search-left',Math.round(left)+'px');
    st.el.style.setProperty('--tl-follow-search-width',Math.round(width)+'px');
  }
  function stick(st){
    if(st.sticky||!st.ready)return;
    st.sticky=true;
    st.marker.style.height=st.height+'px';
    geometry(st);
    st.el.classList.add('tl-search-follow-sticky');
    document.body.appendChild(st.el);
  }
  function unstick(st){
    if(!st.sticky)return;
    st.sticky=false;
    st.el.classList.remove('tl-search-follow-sticky');
    if(st.marker&&st.marker.parentNode)st.marker.parentNode.insertBefore(st.el,st.marker.nextSibling);
    st.el.style.removeProperty('--tl-follow-search-top');
    st.el.style.removeProperty('--tl-follow-search-left');
    st.el.style.removeProperty('--tl-follow-search-width');
    st.marker.style.height='0px';
    st.ready=false;
    remember(st);
  }
  function register(el){
    if(!el||findState(el)||el.id==='tlSmartSearch')return;
    var marker=document.createElement('div');
    marker.className='tl-search-sticky-marker tl-search-sticky-marker-v17-3';
    marker.setAttribute('aria-hidden','true');
    marker.style.cssText='display:block;width:100%;height:0;min-height:0;margin:0;padding:0;border:0;pointer-events:none;';
    if(el.parentNode)el.parentNode.insertBefore(marker,el);
    var st={el:el,marker:marker,originTop:0,height:0,marginLeft:0,marginRight:0,ready:false,sticky:false};
    states.push(st);remember(st);
  }
  function scan(root){
    root=root||document;
    if(root.matches&&root.matches(SELECTOR))register(root);
    if(root.querySelectorAll)root.querySelectorAll(SELECTOR).forEach(register);
  }
  function update(){
    frame=0;
    var top=headerTop();
    states=states.filter(function(st){
      if(!st.el||!st.el.isConnected){if(st.marker&&st.marker.parentNode)st.marker.remove();return false;}
      if(!st.ready&&!st.sticky)remember(st);
      if(!st.ready)return true;
      /* V17.55: không cho mobile pin chặn sticky authority; marker luôn được kiểm tra mỗi frame. */
      var markerTop=st.marker?st.marker.getBoundingClientRect().top:Number.POSITIVE_INFINITY;
      /* V17.55: marker quyết định thời điểm nhả sticky; giữ thêm 2px hysteresis để tránh rung. */
      var should=st.sticky?(markerTop<=top+2):(markerTop<=top);
      if(should)stick(st);else unstick(st);
      if(st.sticky)geometry(st);
      return true;
    });
  }
  function queue(){if(frame)return;frame=requestAnimationFrame(update);}
  function boot(){scan(document);update();}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('scroll',queue,{passive:true});
  window.addEventListener('resize',function(){states.forEach(function(st){if(!st.sticky)st.ready=false;});queue();},{passive:true});
  window.addEventListener('orientationchange',queue,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',queue,{passive:true});
    window.visualViewport.addEventListener('scroll',queue,{passive:true});
  }

  /* V17.12: không observe toàn bộ DOM để tìm search mới. Runtime tạo search ngay khi DOMContentLoaded;
     hai lần scan nhẹ dự phòng là đủ và không gây vòng lặp khi gợi ý render. */
  setTimeout(function(){scan(document);queue();},350);
  setTimeout(function(){scan(document);queue();},1200);
})();


/* ---- original script block 12 ---- */
(function(){
  'use strict';
  var MQ='(max-width:760px)';
  var activeForm=null;
  var releaseTimer=0;

  function mobile(){
    try{return window.matchMedia(MQ).matches;}catch(e){return window.innerWidth<=760;}
  }
  function searchForm(node){
    if(!node||!node.closest)return null;
    return node.closest('.tl-search-control-v17,.tl-search-page-form,.tl-inline-search-form,.tl-category-hub-search-control');
  }
  function suggest(){return document.getElementById('tlSearchSuggest');}
  function isSuggestOpen(){var b=suggest();return !!(b&&b.classList.contains('is-open'));}
  function visualTop(){var v=window.visualViewport;return v?Number(v.offsetTop||0):0;}
  function visualHeight(){var v=window.visualViewport;return v?Number(v.height||window.innerHeight):window.innerHeight;}
  function desiredTop(){
    var header=document.querySelector('.tl-site-header');
    var hb=header?Number(header.getBoundingClientRect().bottom||0):0;
    var hh=header?Number(header.offsetHeight||0):0;
    /* V17.55: pin khi nhập dùng cùng mốc với sticky, luôn dưới header 10px. */
    return Math.max(0,Math.round(hh),Math.round(hb))+10;
  }
  function refresh(){
    if(!activeForm||!mobile())return;
    activeForm.style.setProperty('--tl-mobile-active-search-top',desiredTop()+'px');
    var b=suggest();
    if(b&&b.classList.contains('is-open')&&window.TL_POSITION_SEARCH_SUGGEST){
      /* V17.13: chỉ positionSuggest() được phép quyết định tọa độ gợi ý. */
      window.TL_POSITION_SEARCH_SUGGEST();
    }
  }
  function pin(form){
    if(!mobile()||!form)return;
    if(activeForm&&activeForm!==form)unpin(activeForm,true);
    activeForm=form;
    form.classList.add('tl-mobile-search-pinned');
    document.documentElement.classList.add('tl-mobile-search-active');
    refresh();
  }
  function unpin(form,force){
    form=form||activeForm;
    if(!form)return;
    if(!force){
      var ae=document.activeElement;
      if((ae&&form.contains(ae))||isSuggestOpen())return;
    }
    form.classList.remove('tl-mobile-search-pinned');
    form.style.removeProperty('--tl-mobile-active-search-top');
    if(activeForm===form)activeForm=null;
    if(!activeForm)document.documentElement.classList.remove('tl-mobile-search-active');
  }
  function scheduleRelease(){
    clearTimeout(releaseTimer);
    releaseTimer=setTimeout(function(){unpin(activeForm,false);},120);
  }

  function isSearchTextInput(node){return !!(node&&node.matches&&node.matches('input[type="search"],input[name="q"]'));}
  document.addEventListener('focusin',function(e){
    if(!mobile()||!isSearchTextInput(e.target))return;
    var f=searchForm(e.target);
    if(f)pin(f);
  },true);
  document.addEventListener('input',function(e){
    if(!mobile()||!isSearchTextInput(e.target))return;
    var f=searchForm(e.target);
    if(f)pin(f);
  },true);
  document.addEventListener('focusout',function(e){
    if(isSearchTextInput(e.target)&&searchForm(e.target))scheduleRelease();
  },true);
  document.addEventListener('pointerdown',function(e){
    if(!activeForm||!mobile())return;
    var b=suggest();
    if(activeForm.contains(e.target)||(b&&b.contains(e.target)))return;
    /* V17.55: chạm vào nội dung để cuộn không được làm search mất fixed trong cùng frame.
       Chỉ bỏ pin sau khi focus/gợi ý thực sự đóng; sticky class nếu có vẫn giữ nguyên. */
    scheduleRelease();
  },true);

  /* V17.13: renderSuggest gọi pin trước khi đo hộp gợi ý. */
  window.TL_PIN_ACTIVE_SEARCH=function(node){
    var f=searchForm(node)||node;
    if(f&&f.matches&&f.matches('.tl-search-control-v17,.tl-search-page-form,.tl-inline-search-form,.tl-category-hub-search-control'))pin(f);
  };
  window.TL_REFRESH_ACTIVE_SEARCH=refresh;

  window.addEventListener('scroll',refresh,{passive:true});
  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',refresh,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',refresh,{passive:true});
    window.visualViewport.addEventListener('scroll',refresh,{passive:true});
  }
})();
