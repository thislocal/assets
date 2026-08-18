/* THIS LOCAL PUBLIC V18.09 - CUSTOM DOMAIN, PWA & SOCIAL SHARING */
/* By Vinh Béo */

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
  window.TL_GUIDE_ENGINE_VERSION='2026-08-16-auto-location-v19';
  window.TL_PUBLIC_BUILD='18.09-domain-pwa-og';

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

  /* V17.68: giữ chặn tọa độ rỗng; public không hiển thị lỗi dữ liệu quản trị. */
  function validCoordValue(v,min,max){
    if(v===null||v===undefined||safe(v)==='')return false;
    var n=Number(v);
    return isFinite(n)&&n>=min&&n<=max;
  }

  function topInfo(place,userPos,localityLabel){
    var rank=topRankNumber(place);
    if(!isFinite(rank))return null;
    var rawScope=safe(place&&place.top_scope);
    var scope=normKey(rawScope).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    /* V17.65: tương thích dữ liệu từng được lưu nhiều scope bằng dấu phẩy, nhưng vẫn chạy trên parser ổn định V17.58. */
    if(/[,;|+]/.test(rawScope)){
      var scopeParts=rawScope.split(/[,;|+]+/).map(function(x){return normKey(x).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')});
      if(scopeParts.some(function(x){return ['global','data','this_local','thislocal','top_this_local'].indexOf(x)>-1}))scope='this_local';
      else if(scopeParts.some(function(x){return ['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'].indexOf(x)>-1}))scope='locality';
      else if(scopeParts.some(function(x){return ['radius','ban_kinh','khoang_cach','distance'].indexOf(x)>-1}))scope='radius';
    }
    var radius=Number(place&&place.top_radius_km);
    var area=safe(place&&place.top_locality||place&&place.locality||place&&place.province);
    var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
    var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
    var radii=['radius','ban_kinh','khoang_cach','distance'];

    /* V17.57: suy luận an toàn khi dữ liệu TOP cũ chưa chuẩn hóa hoàn toàn. */
    var kind='global';
    if(scope){
      if(globals.indexOf(scope)>-1)kind='global';
      else if(radii.indexOf(scope)>-1)kind='radius';
      else if(locals.indexOf(scope)>-1)kind='local';
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
      if(!userPos||!validCoordValue(userPos.lat,-90,90)||!validCoordValue(userPos.lng,-180,180)||!isFinite(radius)||radius<=0||!validCoordValue(place&&place.lat,-90,90)||!validCoordValue(place&&place.lng,-180,180))return null;
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

      /* V17.75: số điện thoại dùng quy tắc linh hoạt theo nhiều quốc gia.
         Không ép mẫu di động Việt Nam; chấp nhận di động, bàn, hotline,
         số quốc tế, ký hiệu quay số thông dụng và máy lẻ. */
      function normalizeFlexiblePhone(value){
        var raw=String(value||'').trim().replace(/\s+/g,' ');
        if(!raw||raw.length>40)return '';

        /* Cho phép máy lẻ ở cuối: ext 105 / ext. 105 / x105 / #105. */
        var main=raw.replace(/\s*(?:(?:ext(?:ension)?\.?|x)\s*\d+|#\s*\d+)\s*$/i,'').trim();
        if(!main)return '';

        /* Phần số chính chỉ chứa ký tự quay số thông dụng. */
        if(!/^[0-9+().\-\/\s*#]+$/.test(main))return '';

        /* Dấu + chỉ được xuất hiện tối đa 1 lần và phải đứng đầu. */
        var plusCount=(main.match(/\+/g)||[]).length;
        if(plusCount>1||(plusCount===1&&main.charAt(0)!=='+'))return '';

        var digits=main.replace(/\D/g,'');
        /* 3 chữ số vẫn cần thiết cho hotline/ngắn; không ép độ dài từng quốc gia. */
        if(digits.length<3||digits.length>20)return '';

        return raw;
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
      phoneInput.placeholder='VD: 024 3822 8898 · 1900 1234 · +1 212 555 0123';
      var existingPhone=normalizeFlexiblePhone(place&&place.phone);
      phoneInput.value=existingPhone||(place&&place.phone||'');
      addHelp(phoneField,'Bắt buộc. Chấp nhận số di động, điện thoại bàn, hotline và số quốc tế. Có thể dùng +, khoảng trắng, dấu chấm, gạch ngang, ngoặc hoặc máy lẻ (ext/x).');
      var phoneError=addError(phoneField,'Hãy nhập số điện thoại hợp lệ. THIS LOCAL không ép theo mẫu di động của riêng một quốc gia.');
      grid.appendChild(phoneField);
      form.appendChild(grid);

      var hiddenPhone=el('input','');
      hiddenPhone.type='hidden';
      hiddenPhone.name='phone';
      hiddenPhone.value=existingPhone||'';
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

      function parseProposalCoordinate(value,axis){
        var raw=safe(value);if(!raw)return null;
        var s=String(raw).toUpperCase()
          .replace(/º/g,'°')
          .replace(/[′’‘`´]/g,"'")
          .replace(/[″“”]/g,'"')
          .replace(/，/g,',')
          .replace(/,/g,'.')
          .trim();
        var dirs=s.match(/[NSEW]/g)||[];if(dirs.length>1)return NaN;
        var dir=dirs.length?dirs[0]:'';
        if(axis==='lat'&&dir&&dir!=='N'&&dir!=='S')return NaN;
        if(axis==='lng'&&dir&&dir!=='E'&&dir!=='W')return NaN;
        s=s.replace(/[NSEW]/g,' ').trim();
        var nums=s.match(/[-+]?\d+(?:\.\d+)?/g)||[];if(!nums.length||nums.length>3)return NaN;
        var residue=s.replace(/[-+]?\d+(?:\.\d+)?/g,'').replace(/[°'"\s:;,.-]/g,'');if(residue)return NaN;
        var deg=Number(nums[0]),min=nums.length>1?Number(nums[1]):0,sec=nums.length>2?Number(nums[2]):0,n;
        if(!isFinite(deg)||!isFinite(min)||!isFinite(sec)||min<0||min>=60||sec<0||sec>=60)return NaN;
        if(nums.length===1&&!/[°'"]/.test(s))n=deg;
        else {var sign=deg<0?-1:1;n=(Math.abs(deg)+(min/60)+(sec/3600))*sign;}
        if(dir)n=Math.abs(n)*((dir==='S'||dir==='W')?-1:1);
        var minRange=axis==='lat'?-90:-180,maxRange=axis==='lat'?90:180;
        return isFinite(n)&&n>=minRange&&n<=maxRange?n:NaN;
      }
      function normalizeProposalCoordInput(inp,axis){
        var raw=safe(inp&&inp.value);if(!raw)return null;
        var n=parseProposalCoordinate(raw,axis);
        if(isFinite(n)){inp.value=Number(n.toFixed(6)).toFixed(6);return n;}
        return NaN;
      }

      /* V17.73: tọa độ KHÔNG bắt buộc. Có thể lấy từ Google Maps / Apple Maps / GPS. */
      var coordGrid=el('div','vlc-grid');
      var latField=inputField('Vĩ độ','lat',place&&place.lat,false,'text');
      var lngField=inputField('Kinh độ','lng',place&&place.lng,false,'text');
      var latInp=latField.querySelector('input');
      var lngInp=lngField.querySelector('input');
      latInp.inputMode='text';lngInp.inputMode='text';
      latInp.autocomplete='off';lngInp.autocomplete='off';
      latInp.placeholder='22.483833 hoặc 22°29\'01.8"N';
      lngInp.placeholder='103.972194 hoặc 103°58\'19.9"E';
      addHelp(latField,'Không bắt buộc. Nếu biết tọa độ, nhập 22.483833 hoặc 22°29\'01.8"N.');
      addHelp(lngField,'Không bắt buộc. Nếu biết tọa độ, nhập 103.972194 hoặc 103°58\'19.9"E.');
      var latError=addError(latField,'Vĩ độ không hợp lệ. Nếu nhập tọa độ, hãy nhập đủ cả Vĩ độ và Kinh độ.');
      var lngError=addError(lngField,'Kinh độ không hợp lệ. Nếu nhập tọa độ, hãy nhập đủ cả Vĩ độ và Kinh độ.');
      coordGrid.appendChild(latField);coordGrid.appendChild(lngField);

      var coordHelp=el('div','vlc-field-help','Vĩ độ/Kinh độ không bắt buộc. Nếu bạn nhập hoặc lấy được tọa độ từ Maps/GPS, THIS LOCAL sẽ xác định vị trí địa điểm chính xác hơn và dễ đưa địa điểm tới đúng người dùng thực tế ở gần khu vực đó.');
      coordHelp.style.gridColumn='1 / -1';coordGrid.appendChild(coordHelp);

      /* Nút GPS luôn nằm ngay dưới 2 ô tọa độ, kể cả mobile. */
      var geoField=el('div','vlc-field vlc-coordinate-gps');geoField.style.gridColumn='1 / -1';
      var geoBtn=el('button','vlc-btn vlc-btn-soft','Dùng vị trí hiện tại của tôi');geoBtn.type='button';
      geoBtn.style.width='100%';geoBtn.setAttribute('aria-label','Tự động lấy Vĩ độ và Kinh độ từ vị trí hiện tại');
      geoField.appendChild(geoBtn);
      geoField.appendChild(el('div','vlc-field-help','Chỉ dùng nút này khi bạn đang có mặt tại đúng địa điểm muốn đề xuất.'));
      coordGrid.appendChild(geoField);
      form.appendChild(coordGrid);

      /* Maps: cả Google Maps và Apple Maps đều có thể trả ngược tọa độ. */
      var mapsGrid=el('div','vlc-grid');
      var googleMapField=inputField('Google Maps URL','map_url',place&&place.map_url,false,'text');
      var appleMapField=inputField('Apple Maps URL','apple_map_url',place&&place.apple_map_url,false,'text');
      var googleMapInput=googleMapField.querySelector('input');
      var appleMapInput=appleMapField.querySelector('input');
      googleMapInput.placeholder='Dán link Google Maps đã sao chép';
      appleMapInput.placeholder='Dán link Apple Maps đã sao chép';
      var googleMapError=addError(googleMapField,'Link này không phải Google Maps. Hãy dán link Google Maps vào đúng ô.');
      var appleMapError=addError(appleMapField,'Link này không phải Apple Maps. Hãy dán link Apple Maps vào đúng ô.');
      var googleMapStatus=el('div','vlc-field-help','');googleMapField.appendChild(googleMapStatus);
      var appleMapStatus=el('div','vlc-field-help','');appleMapField.appendChild(appleMapStatus);
      mapsGrid.appendChild(googleMapField);mapsGrid.appendChild(appleMapField);
      var mapsHelp=el('div','vlc-field-help','Cách lấy link: mở Google Maps hoặc Apple Maps → chọn đúng địa điểm → Chia sẻ → Sao chép đường liên kết → dán vào đúng ô tương ứng. Hệ thống hỗ trợ cả link chia sẻ rút gọn và link đầy đủ dạng /maps/place/...; một số link đầy đủ cần vài giây để đọc vị trí. Nếu dán nhầm Google/Apple, hệ thống sẽ báo lại.');
      mapsHelp.style.gridColumn='1 / -1';mapsGrid.appendChild(mapsHelp);
      form.appendChild(mapsGrid);

      function normalizeMapUrl(value){
        var raw=safe(value);if(!raw)return'';
        if(!/^https?:\/\//i.test(raw))raw='https://'+raw.replace(/^\/+/, '');
        try{return new URL(raw).href;}catch(e){return'';}
      }
      function mapLinkKind(value){
        var normalized=normalizeMapUrl(value);if(!normalized)return'';
        try{
          var h=new URL(normalized).hostname.toLowerCase();
          if(h==='maps.app.goo.gl'||h==='goo.gl'||h==='google.com'||h==='www.google.com'||h==='maps.google.com'||/\.google\.com$/.test(h))return'google';
          if(h==='maps.apple.com')return'apple';
        }catch(e){}
        return'';
      }
      function pairFromText(value){
        var text=safe(value);if(!text)return null;
        try{text=decodeURIComponent(text);}catch(e){}
        var m=text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
        if(!m)return null;
        var a=Number(m[1]),b=Number(m[2]);
        if(!isFinite(a)||!isFinite(b)||a<-90||a>90||b<-180||b>180)return null;
        return{lat:a,lng:b};
      }
      function coordsFromMapUrl(value,kind){
        var normalized=normalizeMapUrl(value);if(!normalized)return null;
        try{
          var u=new URL(normalized),href='';
          try{href=decodeURIComponent(u.href);}catch(e){href=u.href;}
          var m;
          if(kind==='google'){
            m=href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|$)/);
            if(m){var g1=pairFromText(m[1]+','+m[2]);if(g1)return g1;}
            m=href.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
            if(m){var g2=pairFromText(m[1]+','+m[2]);if(g2)return g2;}
            var gp=['query','q','center','destination','origin'];
            for(var i=0;i<gp.length;i++){var gv=u.searchParams.get(gp[i]),gc=pairFromText(gv);if(gc)return gc;}
          }else if(kind==='apple'){
            var ap=['ll','sll','near','coordinate','center','daddr','q'];
            for(var j=0;j<ap.length;j++){var av=u.searchParams.get(ap[j]),ac=pairFromText(av);if(ac)return ac;}
          }
        }catch(e){}
        return null;
      }
      function canonicalMapUrls(lat,lng){
        var a=Number(lat),b=Number(lng);if(!isFinite(a)||!isFinite(b))return null;
        var pair=Number(a.toFixed(6)).toFixed(6)+','+Number(b.toFixed(6)).toFixed(6);
        return{
          google:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(pair),
          apple:'https://maps.apple.com/?ll='+encodeURIComponent(pair)
        };
      }
      function setGeneratedMap(inp,url){
        if(!inp||!url)return;
        if(!safe(inp.value)||inp.dataset.tlAutoMap==='1'){inp.value=url;inp.dataset.tlAutoMap='1';}
      }
      function syncMapLinksFromCoords(){
        var lat=parseProposalCoordinate(latInp.value,'lat'),lng=parseProposalCoordinate(lngInp.value,'lng');
        if(!isFinite(lat)||!isFinite(lng))return;
        var urls=canonicalMapUrls(lat,lng);if(!urls)return;
        setGeneratedMap(googleMapInput,urls.google);setGeneratedMap(appleMapInput,urls.apple);
      }
      function applyMapCoordinates(coords,sourceKind){
        if(!coords||!isFinite(Number(coords.lat))||!isFinite(Number(coords.lng)))return false;
        latInp.value=Number(Number(coords.lat).toFixed(6)).toFixed(6);
        lngInp.value=Number(Number(coords.lng).toFixed(6)).toFixed(6);
        latInp.classList.remove('is-invalid');lngInp.classList.remove('is-invalid');
        latError.classList.remove('is-show');lngError.classList.remove('is-show');
        var urls=canonicalMapUrls(coords.lat,coords.lng);
        if(urls){
          if(sourceKind!=='google')setGeneratedMap(googleMapInput,urls.google);
          if(sourceKind!=='apple')setGeneratedMap(appleMapInput,urls.apple);
        }
        return true;
      }
      function validateMapField(inp,kind,err){
        var raw=safe(inp&&inp.value);if(!raw){err.classList.remove('is-show');inp.classList.remove('is-invalid');return true;}
        var normalized=normalizeMapUrl(raw);
        if(!normalized||mapLinkKind(normalized)!==kind){inp.classList.add('is-invalid');err.classList.add('is-show');return false;}
        inp.value=normalized;inp.classList.remove('is-invalid');err.classList.remove('is-show');return true;
      }
      function resolveMapField(inp,kind,err,status){
        var raw=safe(inp&&inp.value);status.textContent='';
        if(!raw){err.classList.remove('is-show');inp.classList.remove('is-invalid');return;}
        if(!validateMapField(inp,kind,err)){status.textContent=kind==='google'?'Hãy mở Google Maps → Chia sẻ → Sao chép đường liên kết rồi dán lại.':'Hãy mở Apple Maps → Chia sẻ → Sao chép đường liên kết rồi dán lại.';return;}
        inp.dataset.tlAutoMap='0';
        var direct=coordsFromMapUrl(inp.value,kind);
        if(direct){applyMapCoordinates(direct,kind);status.textContent='Đã lấy Vĩ độ/Kinh độ từ '+(kind==='google'?'Google Maps.':'Apple Maps.');return;}
        if(!VLC_API_URL||VLC_API_URL.indexOf('DAN_URL_')===0){status.textContent='Link hợp lệ nhưng chưa tự đọc được tọa độ. Bạn vẫn có thể gửi đề xuất.';return;}
        status.textContent='Đang đọc vị trí từ link '+(kind==='google'?'Google Maps...':'Apple Maps...');
        jsonp(VLC_API_URL+'?action=resolveMapUrl&kind='+encodeURIComponent(kind)+'&url='+encodeURIComponent(inp.value)+'&_v=17.75',function(e,data){
          if(e||!data||!data.ok){status.textContent='Không đọc được tọa độ từ link này. Hãy kiểm tra lại link hoặc để trống tọa độ.';return;}
          if(data.resolved_url&&mapLinkKind(data.resolved_url)===kind&&inp.dataset.tlAutoMap!=='1')inp.value=data.resolved_url;
          if(data.lat!==null&&data.lng!==null&&isFinite(Number(data.lat))&&isFinite(Number(data.lng))){applyMapCoordinates({lat:Number(data.lat),lng:Number(data.lng)},kind);status.textContent='Đã lấy Vĩ độ/Kinh độ từ '+(kind==='google'?'Google Maps.':'Apple Maps.');}
          else status.textContent='Link Maps hợp lệ nhưng chưa tìm thấy tọa độ trong link. Bạn vẫn có thể gửi đề xuất.';
        });
      }

      function bindMapAutoResolver(inp,kind,err,status){
        var timer=0,lastValue='';
        inp.addEventListener('input',function(){
          inp.dataset.tlAutoMap='0';inp.classList.remove('is-invalid');err.classList.remove('is-show');status.textContent='';
          lastValue='';
        });
        function schedule(delay){
          clearTimeout(timer);
          timer=setTimeout(function(){
            var value=safe(inp.value);if(!value||value===lastValue)return;
            lastValue=value;resolveMapField(inp,kind,err,status);
          },delay||80);
        }
        inp.addEventListener('paste',function(){schedule(120);});
        inp.addEventListener('change',function(){schedule(20);});
        inp.addEventListener('blur',function(){schedule(20);});
      }
      bindMapAutoResolver(googleMapInput,'google',googleMapError,googleMapStatus);
      bindMapAutoResolver(appleMapInput,'apple',appleMapError,appleMapStatus);

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

      [[latInp,'lat',latError],[lngInp,'lng',lngError]].forEach(function(pair){
        var inp=pair[0],axis=pair[1],err=pair[2];
        inp.addEventListener('input',function(){inp.classList.remove('is-invalid');err.classList.remove('is-show');});
        inp.addEventListener('blur',function(){normalizeProposalCoordInput(inp,axis);syncMapLinksFromCoords();});
      });
      /* Nếu địa điểm cũ đã có tọa độ thì tự tạo sẵn 2 link Maps. */
      syncMapLinksFromCoords();

      phoneInput.addEventListener('input',function(){
        /* Không tự format theo Việt Nam vì mỗi quốc gia/hotline có cấu trúc khác nhau. */
        phoneInput.classList.remove('is-invalid');
        phoneError.classList.remove('is-show');
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
        var normalizedPhone=rawPhone?normalizeFlexiblePhone(rawPhone):'';

        if(!rawPhone || !normalizedPhone){
          phoneInput.classList.add('is-invalid');
          phoneError.classList.add('is-show');
          phoneInput.focus();
          return false;
        }

        /* Giữ nguyên cách người dùng nhập thay vì ép về một định dạng quốc gia. */
        phoneInput.value=normalizedPhone;
        hiddenPhone.value=normalizedPhone;

        var latRaw=safe(latInp.value),lngRaw=safe(lngInp.value);
        var latNum=latRaw?parseProposalCoordinate(latRaw,'lat'):null,lngNum=lngRaw?parseProposalCoordinate(lngRaw,'lng'):null;
        latInp.classList.remove('is-invalid');lngInp.classList.remove('is-invalid');
        latError.classList.remove('is-show');lngError.classList.remove('is-show');
        /* Tọa độ không bắt buộc; nhưng nếu nhập thì cần đủ cả 2 ô và phải hợp lệ. */
        if(latRaw||lngRaw){
          if(!latRaw||!isFinite(latNum)){latInp.classList.add('is-invalid');latError.classList.add('is-show');latInp.focus();return false;}
          if(!lngRaw||!isFinite(lngNum)){lngInp.classList.add('is-invalid');lngError.classList.add('is-show');lngInp.focus();return false;}
          latInp.value=Number(latNum.toFixed(6)).toFixed(6);
          lngInp.value=Number(lngNum.toFixed(6)).toFixed(6);
          syncMapLinksFromCoords();
        }else{
          latInp.value='';lngInp.value='';
        }
        if(!validateMapField(googleMapInput,'google',googleMapError)){googleMapInput.focus();return false;}
        if(!validateMapField(appleMapInput,'apple',appleMapError)){appleMapInput.focus();return false;}

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
        /* map_url và apple_map_url đã được chuẩn hóa/kiểm tra ở validateMapField(). */

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
          latInp.value=String(Math.round(Number(pos.coords.latitude)*1000000)/1000000);
          lngInp.value=String(Math.round(Number(pos.coords.longitude)*1000000)/1000000);
          syncMapLinksFromCoords();
          latInp.classList.remove('is-invalid');lngInp.classList.remove('is-invalid');
          latError.classList.remove('is-show');lngError.classList.remove('is-show');
          reverseCurrentLocality(pos,function(meta){
            if(meta){
              if(provinceInput&&!safe(provinceInput.value))provinceInput.value=safe(meta.region);
              if(localityInput&&!safe(localityInput.value))localityInput.value=safe(meta.locality);
            }
            geoBtn.textContent='Đã lấy vị trí địa điểm';geoBtn.disabled=false;
          });
          setTimeout(function(){if(geoBtn.disabled){geoBtn.textContent='Đã lấy tọa độ';geoBtn.disabled=false;}},2500);
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
          safe(latInp.value) ? 'Vĩ độ: '+safe(latInp.value) : '',
          safe(lngInp.value) ? 'Kinh độ: '+safe(lngInp.value) : '',
          safe(googleMapInput.value) ? 'Google Maps: '+safe(googleMapInput.value) : '',
          safe(appleMapInput.value) ? 'Apple Maps: '+safe(appleMapInput.value) : '',
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


/* ---- THIS LOCAL V17.96: compact location-aware weather forecast ---- */
(function(){
  'use strict';

  var LOCATION_KEY='tl_user_location_v1';
  var WEATHER_CACHE_KEY='tl_weather_cache_v1';
  var WEATHER_CONSENT_KEY='tl_weather_provider_consent_v1';
  var CACHE_MS=20*60*1000;
  var activeRequest=0;
  var activeKey='';
  var widget=null,summary=null,iconEl=null,titleEl=null,metaEl=null,details=null,forecastEl=null;

  var TEXT={
    vi:{title:'Thời tiết quanh bạn',noLocation:'Bật vị trí để xem thời tiết quanh bạn.',consent:'Bấm để xem; vị trí gần đúng sẽ được gửi tới Open-Meteo.',loading:'Đang tải dự báo thời tiết...',error:'Chưa tải được thời tiết. Bấm để thử lại.',rain:'Mưa hôm nay',feels:'Cảm giác như',source:'Dữ liệu thời tiết bởi Open-Meteo',open:'Mở dự báo 5 ngày',close:'Thu gọn dự báo',today:'Hôm nay'},
    en:{title:'Weather near you',noLocation:'Enable location to see weather near you.',consent:'Tap to view; an approximate location will be sent to Open-Meteo.',loading:'Loading weather forecast...',error:'Weather is unavailable. Tap to retry.',rain:'Rain today',feels:'Feels like',source:'Weather data by Open-Meteo',open:'Open 5-day forecast',close:'Collapse forecast',today:'Today'},
    zh:{title:'你附近的天气',noLocation:'开启定位以查看附近天气。',consent:'点击查看；大致位置将发送至 Open-Meteo。',loading:'正在加载天气预报...',error:'暂时无法加载天气，点击重试。',rain:'今日降雨概率',feels:'体感',source:'天气数据由 Open-Meteo 提供',open:'打开5天天气预报',close:'收起天气预报',today:'今天'},
    zht:{title:'你附近的天氣',noLocation:'開啟定位以查看附近天氣。',consent:'點擊查看；大致位置將傳送至 Open-Meteo。',loading:'正在載入天氣預報...',error:'暫時無法載入天氣，點擊重試。',rain:'今日降雨機率',feels:'體感',source:'天氣資料由 Open-Meteo 提供',open:'開啟5天天氣預報',close:'收合天氣預報',today:'今天'},
    th:{title:'อากาศใกล้คุณ',noLocation:'เปิดตำแหน่งเพื่อดูสภาพอากาศใกล้คุณ',consent:'แตะเพื่อดู โดยจะส่งตำแหน่งโดยประมาณไปยัง Open-Meteo',loading:'กำลังโหลดพยากรณ์อากาศ...',error:'โหลดสภาพอากาศไม่ได้ แตะเพื่อลองใหม่',rain:'โอกาสฝนวันนี้',feels:'รู้สึกเหมือน',source:'ข้อมูลสภาพอากาศโดย Open-Meteo',open:'เปิดพยากรณ์ 5 วัน',close:'ย่อพยากรณ์',today:'วันนี้'},
    ru:{title:'Погода рядом',noLocation:'Включите геолокацию, чтобы увидеть погоду рядом.',consent:'Нажмите: примерное местоположение будет отправлено Open-Meteo.',loading:'Загрузка прогноза погоды...',error:'Не удалось загрузить погоду. Нажмите, чтобы повторить.',rain:'Дождь сегодня',feels:'Ощущается как',source:'Данные о погоде: Open-Meteo',open:'Открыть прогноз на 5 дней',close:'Свернуть прогноз',today:'Сегодня'},
    ja:{title:'現在地の天気',noLocation:'位置情報を有効にすると周辺の天気を確認できます。',consent:'タップすると、おおよその位置が Open-Meteo に送信されます。',loading:'天気予報を読み込んでいます...',error:'天気を読み込めません。タップして再試行。',rain:'今日の降水確率',feels:'体感',source:'気象データ: Open-Meteo',open:'5日間予報を開く',close:'予報を閉じる',today:'今日'},
    ko:{title:'내 주변 날씨',noLocation:'위치를 켜면 주변 날씨를 볼 수 있습니다.',consent:'누르면 대략적인 위치가 Open-Meteo로 전송됩니다.',loading:'날씨 예보를 불러오는 중...',error:'날씨를 불러오지 못했습니다. 눌러서 다시 시도하세요.',rain:'오늘 비 올 확률',feels:'체감',source:'날씨 데이터: Open-Meteo',open:'5일 예보 열기',close:'예보 접기',today:'오늘'}
  };
  var CONDITIONS={
    vi:{clear:'Trời quang',partly:'Ít mây',cloudy:'Nhiều mây',fog:'Có sương mù',drizzle:'Mưa phùn',rain:'Có mưa',snow:'Có tuyết',showers:'Mưa rào',storm:'Dông',unknown:'Thời tiết hiện tại'},
    en:{clear:'Clear',partly:'Partly cloudy',cloudy:'Cloudy',fog:'Foggy',drizzle:'Drizzle',rain:'Rain',snow:'Snow',showers:'Showers',storm:'Thunderstorm',unknown:'Current weather'},
    zh:{clear:'晴',partly:'少云',cloudy:'多云',fog:'有雾',drizzle:'毛毛雨',rain:'有雨',snow:'有雪',showers:'阵雨',storm:'雷雨',unknown:'当前天气'},
    zht:{clear:'晴',partly:'少雲',cloudy:'多雲',fog:'有霧',drizzle:'毛毛雨',rain:'有雨',snow:'有雪',showers:'陣雨',storm:'雷雨',unknown:'目前天氣'},
    th:{clear:'ท้องฟ้าแจ่มใส',partly:'มีเมฆบางส่วน',cloudy:'มีเมฆมาก',fog:'มีหมอก',drizzle:'ฝนปรอย',rain:'ฝนตก',snow:'หิมะตก',showers:'ฝนตกเป็นช่วง',storm:'พายุฝนฟ้าคะนอง',unknown:'สภาพอากาศปัจจุบัน'},
    ru:{clear:'Ясно',partly:'Переменная облачность',cloudy:'Облачно',fog:'Туман',drizzle:'Морось',rain:'Дождь',snow:'Снег',showers:'Ливни',storm:'Гроза',unknown:'Текущая погода'},
    ja:{clear:'晴れ',partly:'晴れ時々曇り',cloudy:'曇り',fog:'霧',drizzle:'霧雨',rain:'雨',snow:'雪',showers:'にわか雨',storm:'雷雨',unknown:'現在の天気'},
    ko:{clear:'맑음',partly:'구름 조금',cloudy:'흐림',fog:'안개',drizzle:'이슬비',rain:'비',snow:'눈',showers:'소나기',storm:'뇌우',unknown:'현재 날씨'}
  };
  var LOCALES={vi:'vi-VN',en:'en-US',zh:'zh-CN',zht:'zh-TW',th:'th-TH',ru:'ru-RU',ja:'ja-JP',ko:'ko-KR'};

  function lang(){
    var l=document.documentElement.getAttribute('data-tl-lang')||'vi';
    return TEXT[l]?l:'vi';
  }
  function tr(key){var l=lang();return (TEXT[l]&&TEXT[l][key])||TEXT.vi[key]||key;}
  function safeLocation(){
    try{
      var p=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');
      return p&&isFinite(Number(p.lat))&&isFinite(Number(p.lng))?p:null;
    }catch(e){return null;}
  }
  function placeName(p){return String((p&&(p.locality||p.region||p.countryName))||'').trim();}
  /* Khoảng 0,1 độ (~11 km): đủ cho dự báo khu vực mà không gửi GPS chính xác. */
  function rounded(v){return Math.round(Number(v)*10)/10;}
  function cacheKey(p){return rounded(p.lat)+','+rounded(p.lng);}
  function weatherAllowed(){try{return localStorage.getItem(WEATHER_CONSENT_KEY)==='1';}catch(e){return false;}}
  function allowWeather(){try{localStorage.setItem(WEATHER_CONSENT_KEY,'1');}catch(e){}}
  function readCache(p){
    try{
      var c=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');
      return c&&c.key===cacheKey(p)&&Date.now()-Number(c.savedAt)<CACHE_MS&&c.data?c.data:null;
    }catch(e){return null;}
  }
  function saveCache(p,data){
    try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({key:cacheKey(p),savedAt:Date.now(),data:data}));}catch(e){}
  }
  function weatherKind(code){
    code=Number(code);
    if(code===0)return 'clear';
    if(code===1||code===2)return 'partly';
    if(code===3)return 'cloudy';
    if(code===45||code===48)return 'fog';
    if(code>=51&&code<=57)return 'drizzle';
    if((code>=61&&code<=67)||code===80)return 'rain';
    if(code>=71&&code<=77)return 'snow';
    if(code===81||code===82||code===85||code===86)return 'showers';
    if(code>=95)return 'storm';
    return 'unknown';
  }
  function weatherIcon(code,isDay){
    var kind=weatherKind(code);
    if(kind==='clear')return Number(isDay)===0?'🌙':'☀️';
    if(kind==='partly')return Number(isDay)===0?'☁️':'🌤️';
    if(kind==='cloudy')return '☁️';
    if(kind==='fog')return '🌫️';
    if(kind==='drizzle')return '🌦️';
    if(kind==='rain')return '🌧️';
    if(kind==='snow')return '🌨️';
    if(kind==='showers')return '🌦️';
    if(kind==='storm')return '⛈️';
    return '🌡️';
  }
  function conditionText(code){var l=lang(),dict=CONDITIONS[l]||CONDITIONS.vi;return dict[weatherKind(code)]||dict.unknown;}
  function num(v){v=Number(v);return isFinite(v)?Math.round(v):'–';}
  function dayName(iso,index){
    if(index===0)return tr('today');
    try{return new Intl.DateTimeFormat(LOCALES[lang()]||'vi-VN',{weekday:'short'}).format(new Date(iso+'T12:00:00'));}catch(e){return iso;}
  }
  function injectStyle(){
    if(document.getElementById('tlWeatherStyle'))return;
    var style=document.createElement('style');style.id='tlWeatherStyle';
    style.textContent=''
      +'.tl-weather-widget{max-width:690px;margin-top:12px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(255,255,255,.1);color:#fff;overflow:hidden;box-shadow:0 10px 30px rgba(7,28,48,.12);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}'
      +'.tl-weather-summary{appearance:none;-webkit-appearance:none;width:100%;min-height:62px;padding:10px 13px;border:0;background:transparent;color:inherit;display:grid;grid-template-columns:38px minmax(0,1fr) 24px;gap:10px;align-items:center;text-align:left;cursor:pointer;font:inherit}'
      +'.tl-weather-summary:focus-visible{outline:3px solid rgba(255,255,255,.7);outline-offset:-3px}.tl-weather-icon{font-size:28px;line-height:1;text-align:center;filter:drop-shadow(0 3px 7px rgba(0,0,0,.18))}'
      +'.tl-weather-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.tl-weather-copy strong{font-size:14px;line-height:1.3;color:#fff}.tl-weather-copy small{font-size:12px;line-height:1.35;color:rgba(255,255,255,.82);white-space:normal}'
      +'.tl-weather-chevron{width:22px;height:22px;display:grid;place-items:center;font-size:18px;transition:transform .2s ease}.tl-weather-summary[aria-expanded="true"] .tl-weather-chevron{transform:rotate(180deg)}'
      +'.tl-weather-widget[data-state="needs-location"] .tl-weather-icon,.tl-weather-widget[data-state="loading"] .tl-weather-icon{filter:grayscale(.15)}'
      +'.tl-weather-details{padding:0 12px 11px;border-top:1px solid rgba(255,255,255,.14)}.tl-weather-forecast{display:grid;grid-template-columns:repeat(5,minmax(76px,1fr));gap:6px;padding-top:10px}'
      +'.tl-weather-day{min-width:0;padding:8px 5px;border-radius:11px;background:rgba(255,255,255,.1);text-align:center}.tl-weather-day strong,.tl-weather-day small{display:block}.tl-weather-day strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl-weather-day-icon{display:block;font-size:20px;line-height:1.3;margin:3px 0}.tl-weather-day-temp{font-size:11px;font-weight:800}.tl-weather-day-rain{font-size:10px;color:rgba(255,255,255,.78);margin-top:2px}'
      +'.tl-weather-attribution{display:block;margin:1px 12px 7px;color:rgba(255,255,255,.66)!important;font-size:9px;line-height:1.2;text-align:right;text-decoration:underline;text-underline-offset:2px}'
      +'@media(max-width:760px){.tl-weather-widget{margin-top:10px;border-radius:14px}.tl-weather-summary{min-height:58px;padding:9px 11px;grid-template-columns:34px minmax(0,1fr) 22px;gap:8px}.tl-weather-icon{font-size:25px}.tl-weather-copy strong{font-size:13px}.tl-weather-copy small{font-size:11px}.tl-weather-forecast{overflow-x:auto;grid-template-columns:repeat(5,82px);scrollbar-width:thin;padding-bottom:3px}}';
    document.head.appendChild(style);
  }
  function createWidget(){
    var locationTools=document.querySelector('.tl-home-hero-v24 .tl-location-tools')||document.querySelector('.tl-location-tools');
    if(!locationTools||document.getElementById('tlWeatherWidget'))return false;
    injectStyle();
    widget=document.createElement('div');widget.id='tlWeatherWidget';widget.className='tl-weather-widget';widget.setAttribute('data-state','idle');widget.setAttribute('data-tl-i18n-ignore','1');
    summary=document.createElement('button');summary.type='button';summary.id='tlWeatherSummary';summary.className='tl-weather-summary';summary.setAttribute('aria-expanded','false');summary.setAttribute('aria-controls','tlWeatherDetails');
    iconEl=document.createElement('span');iconEl.className='tl-weather-icon';iconEl.setAttribute('aria-hidden','true');iconEl.textContent='🌤️';
    var copy=document.createElement('span');copy.className='tl-weather-copy';titleEl=document.createElement('strong');metaEl=document.createElement('small');copy.appendChild(titleEl);copy.appendChild(metaEl);
    var chevron=document.createElement('span');chevron.className='tl-weather-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';
    summary.appendChild(iconEl);summary.appendChild(copy);summary.appendChild(chevron);
    details=document.createElement('div');details.id='tlWeatherDetails';details.className='tl-weather-details';details.hidden=true;
    forecastEl=document.createElement('div');forecastEl.className='tl-weather-forecast';
    var source=document.createElement('a');source.className='tl-weather-attribution';source.href='https://open-meteo.com/';source.target='_blank';source.rel='noopener noreferrer';source.setAttribute('data-tl-weather-source','1');
    details.appendChild(forecastEl);widget.appendChild(summary);widget.appendChild(details);widget.appendChild(source);
    locationTools.insertAdjacentElement('afterend',widget);
    summary.addEventListener('click',function(){
      var p=safeLocation();
      if(!p){var b=document.getElementById('tlUseLocation');if(b)b.click();return;}
      if(widget.getAttribute('data-state')==='needs-consent'){allowWeather();loadWeather(p,true);return;}
      if(widget.getAttribute('data-state')==='error'){loadWeather(p,true);return;}
      var open=summary.getAttribute('aria-expanded')!=='true';summary.setAttribute('aria-expanded',open?'true':'false');summary.setAttribute('aria-label',open?tr('close'):tr('open'));details.hidden=!open;
    });
    return true;
  }
  function renderNoLocation(){
    if(!widget)return;widget.setAttribute('data-state','needs-location');iconEl.textContent='📍';titleEl.textContent=tr('title');metaEl.textContent=tr('noLocation');forecastEl.textContent='';details.hidden=true;summary.setAttribute('aria-expanded','false');summary.setAttribute('aria-label',tr('noLocation'));
    var a=widget.querySelector('[data-tl-weather-source]');if(a)a.textContent=tr('source');
  }
  function renderConsent(p){
    if(!widget)return;widget.setAttribute('data-state','needs-consent');iconEl.textContent='🌤️';titleEl.textContent=tr('title');metaEl.textContent=(placeName(p)?placeName(p)+' · ':'')+tr('consent');forecastEl.textContent='';details.hidden=true;summary.setAttribute('aria-expanded','false');summary.setAttribute('aria-label',tr('consent'));
    var a=widget.querySelector('[data-tl-weather-source]');if(a)a.textContent=tr('source');
  }
  function renderLoading(p){
    widget.setAttribute('data-state','loading');iconEl.textContent='🌤️';titleEl.textContent=tr('title');metaEl.textContent=(placeName(p)?placeName(p)+' · ':'')+tr('loading');summary.setAttribute('aria-label',tr('loading'));
  }
  function renderError(p){
    widget.setAttribute('data-state','error');iconEl.textContent='⚠️';titleEl.textContent=tr('title');metaEl.textContent=(placeName(p)?placeName(p)+' · ':'')+tr('error');summary.setAttribute('aria-label',tr('error'));
  }
  function renderWeather(p,data){
    if(!data||!data.current||!data.daily){renderError(p);return;}
    widget.__tlWeatherData=data;widget.__tlWeatherLocation=p;widget.setAttribute('data-state','ready');
    var c=data.current,d=data.daily,code=Number(c.weather_code),prob=d.precipitation_probability_max&&d.precipitation_probability_max.length?num(d.precipitation_probability_max[0]):'–';
    iconEl.textContent=weatherIcon(code,c.is_day);titleEl.textContent=num(c.temperature_2m)+'°C · '+conditionText(code);
    var where=placeName(p)||tr('title');metaEl.textContent=where+' · '+tr('rain')+' '+prob+'% · '+tr('feels')+' '+num(c.apparent_temperature)+'°C';
    forecastEl.textContent='';
    var times=Array.isArray(d.time)?d.time:[];
    times.slice(0,5).forEach(function(iso,i){
      var day=document.createElement('div');day.className='tl-weather-day';
      var name=document.createElement('strong');name.textContent=dayName(iso,i);
      var ico=document.createElement('span');ico.className='tl-weather-day-icon';ico.setAttribute('aria-hidden','true');ico.textContent=weatherIcon(d.weather_code&&d.weather_code[i],1);
      var temp=document.createElement('small');temp.className='tl-weather-day-temp';temp.textContent=num(d.temperature_2m_max&&d.temperature_2m_max[i])+'° / '+num(d.temperature_2m_min&&d.temperature_2m_min[i])+'°';
      var rain=document.createElement('small');rain.className='tl-weather-day-rain';rain.textContent='💧 '+num(d.precipitation_probability_max&&d.precipitation_probability_max[i])+'%';
      day.appendChild(name);day.appendChild(ico);day.appendChild(temp);day.appendChild(rain);forecastEl.appendChild(day);
    });
    var a=widget.querySelector('[data-tl-weather-source]');if(a)a.textContent=tr('source');
    summary.setAttribute('aria-label',summary.getAttribute('aria-expanded')==='true'?tr('close'):tr('open'));
  }
  function apiUrl(p){
    var q=new URLSearchParams({
      latitude:String(rounded(p.lat)),longitude:String(rounded(p.lng)),
      current:'temperature_2m,apparent_temperature,weather_code,is_day',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone:'auto',forecast_days:'5'
    });
    return 'https://api.open-meteo.com/v1/forecast?'+q.toString();
  }
  function loadWeather(p,force){
    if(!widget||!p){renderNoLocation();return;}
    var key=cacheKey(p),state=widget.getAttribute('data-state');
    if(!force&&activeKey===key){
      if(state==='ready'&&widget.__tlWeatherData){widget.__tlWeatherLocation=p;renderWeather(p,widget.__tlWeatherData);}
      else if(state==='loading')renderLoading(p);
      else if(state==='error')renderError(p);
      return;
    }
    var cached=!force&&readCache(p);if(cached){renderWeather(p,cached);return;}
    activeKey=key;renderLoading(p);var requestId=++activeRequest;
    fetch(apiUrl(p),{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'}}).then(function(res){if(!res.ok)throw new Error('weather '+res.status);return res.json();}).then(function(data){
      if(requestId!==activeRequest)return;saveCache(p,data);renderWeather(p,data);
    }).catch(function(){if(requestId===activeRequest)renderError(p);});
  }
  function refresh(force){var p=safeLocation();if(!p){activeRequest++;activeKey='';renderNoLocation();return;}if(!weatherAllowed()){renderConsent(p);return;}loadWeather(p,!!force);}
  function rerenderLanguage(){
    if(!widget)return;var state=widget.getAttribute('data-state');
    if(state==='ready'&&widget.__tlWeatherData)renderWeather(widget.__tlWeatherLocation||safeLocation(),widget.__tlWeatherData);
    else if(state==='loading')renderLoading(safeLocation());
    else if(state==='error')renderError(safeLocation());
    else if(state==='needs-consent')renderConsent(safeLocation());
    else renderNoLocation();
  }
  function boot(){
    if(!createWidget())return;refresh(false);
    document.addEventListener('tl:locationchange',function(e){var p=e&&e.detail&&isFinite(Number(e.detail.lat))?e.detail:safeLocation();if(!p){renderNoLocation();return;}if(!weatherAllowed()){renderConsent(p);return;}loadWeather(p,false);});
    if(window.MutationObserver){new MutationObserver(function(m){for(var i=0;i<m.length;i++){if(m[i].attributeName==='data-tl-lang'){rerenderLanguage();break;}}}).observe(document.documentElement,{attributes:true,attributeFilter:['data-tl-lang']});}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
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
          var top=document.createElement('div');top.className='tl-global-search-card-top';var cat=document.createElement('span');cat.className='tl-global-search-card-cat';cat.textContent=(window.TL_I18N&&window.TL_I18N.category?window.TL_I18N.category(cleanText(place.category)||'Địa điểm'):(cleanText(place.category)||'Địa điểm'));var area=document.createElement('span');area.className='tl-global-search-card-open';area.textContent=cleanText(place.locality||place.province);top.appendChild(cat);top.appendChild(area);card.appendChild(top);
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

      /* ---------- V17.58 HOMEPAGE TOP: TOP THIS LOCAL kế thừa xuống KHU VỰC / BÁN KÍNH ---------- */
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
          if(/[,;|+]/.test(raw)){
            var parts=raw.split(/[,;|+]+/).map(function(x){return norm(x).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')});
            if(parts.some(function(x){return ['global','data','this_local','thislocal','top_this_local'].indexOf(x)>-1}))scope='this_local';
            else if(parts.some(function(x){return ['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'].indexOf(x)>-1}))scope='locality';
            else if(parts.some(function(x){return ['radius','ban_kinh','khoang_cach','distance'].indexOf(x)>-1}))scope='radius';
          }
          var radius=Number(place&&place.top_radius_km),area=cleanText(place&&place.top_locality||place&&place.locality||place&&place.province);
          var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
          var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
          var radii=['radius','ban_kinh','khoang_cach','distance'];
          var kind='global';
          if(scope){
            if(globals.indexOf(scope)>-1)kind='global';
            else if(radii.indexOf(scope)>-1)kind='radius';
            else if(locals.indexOf(scope)>-1)kind='local';
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
        function validHomeCoord(v,min,max){
          if(v===null||v===undefined||cleanText(v)==='')return false;
          var n=Number(v);
          return isFinite(n)&&n>=min&&n<=max;
        }
        function radiusMembership(place,scope,loc){
          var radius=Number(place&&place.top_radius_km);
          if(!isFinite(radius)||radius<=0)radius=Number(scope&&scope.radius);
          if(!loc||!validHomeCoord(loc.lat,-90,90)||!validHomeCoord(loc.lng,-180,180)||!isFinite(radius)||radius<=0||!validHomeCoord(place&&place.lat,-90,90)||!validHomeCoord(place&&place.lng,-180,180))return null;
          var km=haversineHome(Number(loc.lat),Number(loc.lng),Number(place.lat),Number(place.lng));
          if(!isFinite(km)||km>radius)return null;
          return{radius:radius,distance:km};
        }
        function memberships(place,loc){
          var rank=rankNumber(place);if(!isFinite(rank))return[];
          var scope=scopeOf(place),out=[];

          /* Giữ nguyên TOP THIS LOCAL + TOP khu vực đang chạy ổn. */
          if(scope.kind==='global')out.push({rank:rank,group:'global',original:'global',label:'TOP THIS LOCAL',distance:NaN});
          if(scope.kind==='local'&&areaMatches(place,scope,loc)){
            out.push({rank:rank,group:'local',original:'local',label:'TOP '+(scope.area||cleanText(place.locality)||cleanText(place.province)||'khu vực'),distance:NaN});
          }

          if(scope.kind==='global'&&areaMatches(place,scope,loc)){
            out.push({rank:rank,group:'local',original:'global',label:'TOP THIS LOCAL',distance:NaN,inherited:true});
          }

          /* V17.66: TOP bán kính là phạm vi độc lập.
             Chỉ cần top_radius_km > 0 thì luôn kiểm tra khoảng cách,
             không phụ thuộc top_scope là THIS_LOCAL / LOCALITY / RADIUS. */
          var configuredRadius=Number(place&&place.top_radius_km);
          var radiusEnabled=(isFinite(configuredRadius)&&configuredRadius>0)||scope.kind==='radius';
          if(radiusEnabled){
            var rm=radiusMembership(place,scope,loc);
            if(rm){
              var origin=scope.kind==='global'?'global':(scope.kind==='local'?'local':'radius');
              var label=scope.kind==='global'?'TOP THIS LOCAL':(scope.kind==='local'?'TOP '+(scope.area||cleanText(place.locality)||cleanText(place.province)||'khu vực'):'TOP bán kính');
              out.push({rank:rank,group:'radius',original:origin,label:label,distance:rm.distance,radius:rm.radius,inherited:scope.kind!=='radius'});
            }
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
            if(a.info.original!==b.info.original){if(a.info.original==='global')return-1;if(b.info.original==='global')return 1;}
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
          var cat=document.createElement('span');cat.className='tl-home-top-category';cat.textContent=(window.TL_I18N&&window.TL_I18N.category?window.TL_I18N.category(cleanText(p.category)||cleanText(p.parent_category)||'Địa điểm'):(cleanText(p.category)||cleanText(p.parent_category)||'Địa điểm'));
          head.appendChild(badge);head.appendChild(cat);
          var title=document.createElement('strong');title.className='tl-home-top-title';title.textContent=cleanText(p.name)||'Địa điểm';
          var address=document.createElement('span');address.className='tl-home-top-address';address.textContent=cleanText(p.address)||[cleanText(p.locality),cleanText(p.province)].filter(Boolean).join(', ')||'Xem thông tin địa điểm';
          var meta=document.createElement('div');meta.className='tl-home-top-meta';
          if(info.inherited){var ih=document.createElement('span');ih.className='is-inherited';ih.textContent=info.group==='local'?'TOP THIS LOCAL tại khu vực này':'TOP THIS LOCAL quanh bạn';meta.appendChild(ih);}
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
          if(items.length){
            var grid=document.createElement('div');grid.className='tl-home-top-grid';items.forEach(function(item){grid.appendChild(makeCard(item));});wrap.appendChild(grid);
          }else if(emptyText){
            var empty=document.createElement('div');empty.className='tl-home-top-status';empty.textContent=emptyText;wrap.appendChild(empty);
          }
          return wrap;
        }
        function radiusDiagnostic(loc){
          if(!loc||!validHomeCoord(loc.lat,-90,90)||!validHomeCoord(loc.lng,-180,180))return 'Bật vị trí để xem TOP bán kính quanh bạn.';
          return 'Hiện chưa có địa điểm TOP bán kính phù hợp với vị trí của bạn.';
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
          var g2=makeGroup('local',area?('TOP khu vực '+area):'TOP khu vực của bạn',area?'Bao gồm TOP khu vực và TOP THIS LOCAL nằm tại khu vực này.':'Bật vị trí để xác định khu vực.',buckets.local);if(g2)groups.appendChild(g2);
          var g3=makeGroup('radius','TOP bán kính quanh bạn','Chỉ những địa điểm có Bán kính TOP (km) và tọa độ phù hợp với vị trí hiện tại.',buckets.radius,buckets.radius.length?'':radiusDiagnostic(loc));if(g3)groups.appendChild(g3);
          if(!groups.childNodes.length){var empty=document.createElement('div');empty.className='tl-home-top-status';empty.textContent='Hiện chưa có địa điểm TOP phù hợp.';groups.appendChild(empty);}
        }
        function load(){
          var api=window.TL_GUIDE_API_URL||'';
          if(!api){groups.innerHTML='<div class="tl-home-top-status">Chưa kết nối dữ liệu TOP.</div>';return;}
          var callback='TL_HOME_TOP_'+Date.now()+'_'+Math.floor(Math.random()*100000),script=document.createElement('script'),done=false,timer;
          function finish(data){if(done)return;done=true;clearTimeout(timer);try{delete window[callback];}catch(e){}if(script.parentNode)script.parentNode.removeChild(script);candidates=data&&data.ok&&Array.isArray(data.places)?data.places:[];render(getSavedLocation());}
          window[callback]=function(data){finish(data);};
          script.onerror=function(){finish(null);};
          script.src=api+'?action=homepageTop&callback='+encodeURIComponent(callback)+'&_v=17.68';document.head.appendChild(script);
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
  var LANGS=['vi','en','zh','zht','th','ru','ja','ko'];
  var LOCALES={vi:'vi-VN',en:'en-US',zh:'zh-CN',zht:'zh-TW',th:'th-TH',ru:'ru-RU',ja:'ja-JP',ko:'ko-KR'};
  var COUNTRY_LANG={VN:'vi',TH:'th',CN:'zh',TW:'zht',HK:'zht',MO:'zht',RU:'ru',JP:'ja',KR:'ko'};

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
    'Vĩ độ':{en:'Latitude',zh:'纬度',th:'ละติจูด'},
    'Kinh độ':{en:'Longitude',zh:'经度',th:'ลองจิจูด'},
    'Có thể nhập tọa độ thập phân hoặc DMS. Ví dụ: Vĩ độ 22.483833 hoặc 22°29\'01.8"N · Kinh độ 103.972194 hoặc 103°58\'19.9"E. Không đảo hai ô. Tọa độ càng chính xác, địa điểm càng dễ tiếp cận đúng người dùng thực tế ở gần khu vực đó.':{en:'Example: Latitude 22.480123 · Longitude 103.971234. Enter numbers only, do not add N/E, and do not swap the two fields. More accurate coordinates help the place appear correctly to real users nearby. If you are at the place, use “Use my current location” below.',zh:'正确示例：纬度 22.480123 · 经度 103.971234。只输入数字，不要输入 N/E，也不要把两个字段填反。坐标越准确，地点越容易正确展示给附近的真实用户。如果你正在该地点，请使用下方“使用我的当前位置”。',th:'ตัวอย่างที่ถูกต้อง: ละติจูด 22.480123 · ลองจิจูด 103.971234 กรอกเฉพาะตัวเลข ไม่ต้องใส่ N/E และอย่าสลับสองช่อง พิกัดที่แม่นยำช่วยให้สถานที่แสดงต่อผู้ใช้จริงที่อยู่ใกล้ได้ถูกต้อง หากคุณอยู่ที่สถานที่นั้น ให้ใช้ปุ่ม “ใช้ตำแหน่งปัจจุบันของฉัน” ด้านล่าง'},
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
  /* V17.95.1: newer public UI strings across all 8 languages. */
  var SUPPLEMENT_UI={"Chọn ngôn ngữ":{"en":"Choose language","zh":"选择语言","th":"เลือกภาษา","ru":"Выбрать язык","ja":"言語を選択","ko":"언어 선택"},"Khám phá nhanh":{"en":"Quick explore","zh":"快速探索","th":"สำรวจด่วน","ru":"Быстрый обзор","ja":"クイック探索","ko":"빠른 탐색"},"Các nhóm phổ biến trên THIS LOCAL":{"en":"Popular categories on THIS LOCAL","zh":"THIS LOCAL 热门分类","th":"หมวดหมู่ยอดนิยมบน THIS LOCAL","ru":"Популярные категории THIS LOCAL","ja":"THIS LOCAL の人気カテゴリー","ko":"THIS LOCAL 인기 카테고리"},"Tất cả danh mục":{"en":"All categories","zh":"全部分类","th":"หมวดหมู่ทั้งหมด","ru":"Все категории","ja":"すべてのカテゴリー","ko":"모든 카테고리"},"Duyệt toàn bộ 24 nhóm chính và các danh mục con":{"en":"Browse all 24 main groups and their subcategories","zh":"浏览全部24个主分类及子分类","th":"ดูทั้ง 24 หมวดหลักและหมวดย่อย","ru":"Все 24 основные группы и подкатегории","ja":"24の主要グループとサブカテゴリーを表示","ko":"24개 주요 그룹과 하위 카테고리 전체 보기"},"Liên hệ":{"en":"Contact","zh":"联系","th":"ติดต่อ","ru":"Контакты","ja":"お問い合わせ","ko":"문의"},"Tìm đúng nơi bạn cần, ngay quanh mình.":{"en":"Find the right place you need, right nearby.","zh":"找到你需要的地方，就在身边。","th":"ค้นหาสถานที่ที่ใช่ ใกล้ตัวคุณ","ru":"Найдите нужное место рядом с вами.","ja":"必要な場所を、すぐ近くで見つけよう。","ko":"원하는 곳을 내 주변에서 바로 찾아보세요."},"Tìm địa điểm theo tên, nhu cầu hoặc danh mục. THIS LOCAL ưu tiên thông tin thực tế, địa chỉ và liên hệ để bạn quyết định nhanh hơn.":{"en":"Search places by name, need or category. THIS LOCAL prioritizes practical details, addresses and contacts so you can decide faster.","zh":"按名称、需求或分类查找地点。THIS LOCAL 优先提供实用信息、地址和联系方式，帮助你更快决定。","th":"ค้นหาสถานที่ตามชื่อ ความต้องการ หรือหมวดหมู่ THIS LOCAL เน้นข้อมูลจริง ที่อยู่ และช่องทางติดต่อเพื่อช่วยให้ตัดสินใจได้เร็วขึ้น","ru":"Ищите места по названию, потребности или категории. THIS LOCAL показывает практичные данные, адреса и контакты, чтобы вы быстрее приняли решение.","ja":"名前・目的・カテゴリーから場所を検索。THIS LOCAL は実用情報、住所、連絡先を優先し、素早い判断をサポートします。","ko":"이름, 목적, 카테고리로 장소를 검색하세요. THIS LOCAL은 실제 정보, 주소, 연락처를 우선해 빠른 결정을 돕습니다."},"Cẩm nang & bài viết":{"en":"Guides & articles","zh":"指南与文章","th":"คู่มือและบทความ","ru":"Гиды и статьи","ja":"ガイド・記事","ko":"가이드·글"},"Vị trí giúp THIS LOCAL ưu tiên địa điểm gần bạn.":{"en":"Location helps THIS LOCAL prioritize places near you.","zh":"定位可帮助 THIS LOCAL 优先显示你附近的地点。","th":"ตำแหน่งช่วยให้ THIS LOCAL จัดลำดับสถานที่ใกล้คุณก่อน","ru":"Геолокация помогает THIS LOCAL показывать ближайшие места первыми.","ja":"位置情報により THIS LOCAL が近くの場所を優先表示します。","ko":"위치 정보를 사용하면 THIS LOCAL이 가까운 장소를 우선 표시합니다."},"Thông tin dễ liên hệ":{"en":"Easy-to-use contact details","zh":"联系信息清晰易用","th":"ข้อมูลติดต่อใช้งานง่าย","ru":"Удобные контактные данные","ja":"連絡先がわかりやすい","ko":"연락 정보 확인이 쉬움"},"Đang cần gì?":{"en":"What do you need?","zh":"现在需要什么？","th":"กำลังหาอะไรอยู่?","ru":"Что вам нужно?","ja":"何をお探しですか？","ko":"무엇이 필요하세요?"},"Những nhóm được tìm nhiều":{"en":"Popular categories","zh":"热门搜索分类","th":"หมวดที่ค้นหาบ่อย","ru":"Популярные категории","ja":"よく検索されるカテゴリー","ko":"많이 찾는 카테고리"},"Đi thẳng vào danh sách địa điểm thay vì phải lướt qua nhiều nội dung.":{"en":"Go straight to place listings instead of browsing through lots of content.","zh":"直接查看地点列表，无需浏览大量内容。","th":"ไปยังรายการสถานที่ได้ทันทีโดยไม่ต้องเลื่อนดูเนื้อหามากมาย","ru":"Сразу переходите к списку мест, не просматривая множество материалов.","ja":"多くのコンテンツを見ずに、場所一覧へ直接移動できます。","ko":"많은 콘텐츠를 넘기지 않고 장소 목록으로 바로 이동하세요."},"Chưa thấy nhóm bạn cần?":{"en":"Can’t find the category you need?","zh":"没找到需要的分类？","th":"ยังไม่พบหมวดที่ต้องการ?","ru":"Не нашли нужную категорию?","ja":"必要なカテゴリーが見つかりませんか？","ko":"필요한 카테고리가 안 보이나요?"},"THIS LOCAL còn nhiều nhóm về công nghệ, cơ quan nhà nước, xây dựng, tiện ích công cộng, thiên nhiên và hơn thế nữa.":{"en":"THIS LOCAL also covers technology, government, construction, public utilities, nature and more.","zh":"THIS LOCAL 还涵盖科技、政府机构、建筑、公共设施、自然等更多分类。","th":"THIS LOCAL ยังมีหมวดเทคโนโลยี หน่วยงานรัฐ ก่อสร้าง สาธารณูปโภค ธรรมชาติ และอื่น ๆ","ru":"В THIS LOCAL также есть технологии, госучреждения, строительство, общественные услуги, природа и многое другое.","ja":"THIS LOCAL にはテクノロジー、行政、建設、公共施設、自然などのカテゴリーもあります。","ko":"THIS LOCAL에는 기술, 정부 기관, 건설, 공공 편의, 자연 등 더 많은 카테고리가 있습니다."},"Xem toàn bộ 24 nhóm chính":{"en":"View all 24 main groups","zh":"查看全部24个主分类","th":"ดูทั้ง 24 หมวดหลัก","ru":"Все 24 основные группы","ja":"24の主要グループをすべて見る","ko":"24개 주요 그룹 전체 보기"},"Cẩm nang địa phương":{"en":"Local guide","zh":"本地指南","th":"คู่มือท้องถิ่น","ru":"Местный гид","ja":"ローカルガイド","ko":"로컬 가이드"},"Dùng vị trí gần bạn":{"en":"Use your nearby location","zh":"使用你附近的位置","th":"ใช้ตำแหน่งใกล้ตัวคุณ","ru":"Использовать ваше местоположение","ja":"現在地を使用","ko":"현재 위치 사용"},"Cho phép vị trí để THIS LOCAL ưu tiên các địa điểm phù hợp quanh bạn.":{"en":"Allow location so THIS LOCAL can prioritize relevant places around you.","zh":"允许定位后，THIS LOCAL 会优先显示你周边合适的地点。","th":"อนุญาตตำแหน่งเพื่อให้ THIS LOCAL จัดลำดับสถานที่ที่เหมาะสมรอบตัวคุณ","ru":"Разрешите геолокацию, чтобы THIS LOCAL показывал подходящие места рядом.","ja":"位置情報を許可すると、THIS LOCAL が周辺の適切な場所を優先表示します。","ko":"위치를 허용하면 THIS LOCAL이 주변의 적합한 장소를 우선 표시합니다."},"Cho phép":{"en":"Allow","zh":"允许","th":"อนุญาต","ru":"Разрешить","ja":"許可","ko":"허용"},"Thử lại":{"en":"Try again","zh":"重试","th":"ลองอีกครั้ง","ru":"Повторить","ja":"再試行","ko":"다시 시도"},"Quyền vị trí đang bị chặn":{"en":"Location permission is blocked","zh":"定位权限已被阻止","th":"สิทธิ์ตำแหน่งถูกบล็อก","ru":"Доступ к геолокации заблокирован","ja":"位置情報の権限がブロックされています","ko":"위치 권한이 차단되었습니다"},"Tìm kiếm":{"en":"Search","zh":"搜索","th":"ค้นหา","ru":"Поиск","ja":"検索","ko":"검색"},"Đang tải danh sách địa điểm...":{"en":"Loading places...","zh":"正在加载地点列表…","th":"กำลังโหลดรายการสถานที่...","ru":"Загрузка списка мест...","ja":"場所一覧を読み込み中…","ko":"장소 목록 불러오는 중..."},"Đang tổng hợp các địa điểm đã được kiểm duyệt.":{"en":"Compiling reviewed places.","zh":"正在汇总已审核地点。","th":"กำลังรวบรวมสถานที่ที่ตรวจสอบแล้ว","ru":"Собираем проверенные места.","ja":"確認済みの場所をまとめています。","ko":"검수된 장소를 모으는 중입니다."},"Gợi ý chủ đề":{"en":"Suggested topics","zh":"推荐主题","th":"หัวข้อแนะนำ","ru":"Рекомендуемые темы","ja":"おすすめテーマ","ko":"추천 주제"},"Xem tất cả ▾":{"en":"View all ▾","zh":"查看全部 ▾","th":"ดูทั้งหมด ▾","ru":"Показать все ▾","ja":"すべて見る ▾","ko":"모두 보기 ▾"},"Địa điểm nổi bật":{"en":"Featured places","zh":"精选地点","th":"สถานที่เด่น","ru":"Избранные места","ja":"注目の場所","ko":"주요 장소"},"TOP dành cho bạn":{"en":"TOP picks for you","zh":"为你推荐的TOP","th":"TOP สำหรับคุณ","ru":"TOP для вас","ja":"あなた向けTOP","ko":"나를 위한 TOP"},"Những địa điểm TOP trên toàn hệ thống.":{"en":"TOP places across THIS LOCAL.","zh":"THIS LOCAL 全站TOP地点。","th":"สถานที่ TOP ทั่วทั้ง THIS LOCAL","ru":"TOP-места по всему THIS LOCAL.","ja":"THIS LOCAL 全体のTOPスポット。","ko":"THIS LOCAL 전체 TOP 장소입니다."},"TOP bán kính quanh bạn":{"en":"TOP within your radius","zh":"你周边范围内的TOP","th":"TOP ในรัศมีรอบตัวคุณ","ru":"TOP в радиусе рядом с вами","ja":"周辺半径内のTOP","ko":"내 주변 반경 TOP"},"Bật vị trí để xem TOP bán kính quanh bạn.":{"en":"Enable location to see TOP places within your radius.","zh":"开启定位以查看你周边范围内的TOP地点。","th":"เปิดตำแหน่งเพื่อดูสถานที่ TOP ในรัศมีรอบตัวคุณ","ru":"Включите геолокацию, чтобы увидеть TOP-места в вашем радиусе.","ja":"位置情報を有効にして周辺半径内のTOPを表示します。","ko":"위치를 켜면 주변 반경의 TOP 장소를 볼 수 있습니다."},"Hiện chưa có địa điểm TOP phù hợp.":{"en":"No matching TOP places right now.","zh":"目前没有符合条件的TOP地点。","th":"ขณะนี้ยังไม่มีสถานที่ TOP ที่ตรงกัน","ru":"Сейчас подходящих TOP-мест нет.","ja":"現在、該当するTOPスポットはありません。","ko":"현재 조건에 맞는 TOP 장소가 없습니다."},"Địa điểm phù hợp":{"en":"Matching places","zh":"匹配地点","th":"สถานที่ที่ตรงกัน","ru":"Подходящие места","ja":"該当する場所","ko":"일치하는 장소"},"Trùng khớp nhất":{"en":"Best match","zh":"最佳匹配","th":"ตรงกันมากที่สุด","ru":"Лучшее совпадение","ja":"最も一致","ko":"가장 일치"},"Gần nhất":{"en":"Nearest","zh":"最近","th":"ใกล้ที่สุด","ru":"Ближайшие","ja":"最寄り","ko":"가까운 순"},"Ưu tiên tên giống từ khóa":{"en":"Prioritize names matching the keyword","zh":"优先显示名称匹配关键词的地点","th":"ให้ชื่อที่ตรงกับคำค้นอยู่ก่อน","ru":"Приоритет названиям, совпадающим с запросом","ja":"キーワードに近い名前を優先","ko":"검색어와 유사한 이름 우선"},"Xem đầy đủ thông tin →":{"en":"View full details →","zh":"查看完整信息 →","th":"ดูข้อมูลทั้งหมด →","ru":"Полная информация →","ja":"詳細を見る →","ko":"전체 정보 보기 →"},"Tất cả":{"en":"All","zh":"全部","th":"ทั้งหมด","ru":"Все","ja":"すべて","ko":"전체"},"Xóa":{"en":"Clear","zh":"清除","th":"ล้าง","ru":"Очистить","ja":"クリア","ko":"지우기"},"Mở tất cả":{"en":"Expand all","zh":"全部展开","th":"เปิดทั้งหมด","ru":"Развернуть все","ja":"すべて開く","ko":"모두 펼치기"},"Thu gọn":{"en":"Collapse","zh":"收起","th":"ย่อ","ru":"Свернуть","ja":"折りたたむ","ko":"접기"},"Vào nhóm":{"en":"Open group","zh":"进入分类","th":"เข้าหมวด","ru":"Открыть группу","ja":"グループを開く","ko":"그룹 열기"},"Không tìm thấy danh mục phù hợp.":{"en":"No matching categories found.","zh":"未找到匹配的分类。","th":"ไม่พบหมวดหมู่ที่ตรงกัน","ru":"Подходящих категорий не найдено.","ja":"該当するカテゴリーが見つかりません。","ko":"일치하는 카테고리가 없습니다."},"Đang tải danh mục...":{"en":"Loading categories...","zh":"正在加载分类…","th":"กำลังโหลดหมวดหมู่...","ru":"Загрузка категорий...","ja":"カテゴリーを読み込み中…","ko":"카테고리 불러오는 중..."},"Đang tải danh mục từ THIS LOCAL...":{"en":"Loading categories from THIS LOCAL...","zh":"正在从 THIS LOCAL 加载分类…","th":"กำลังโหลดหมวดหมู่จาก THIS LOCAL...","ru":"Загрузка категорий из THIS LOCAL...","ja":"THIS LOCAL からカテゴリーを読み込み中…","ko":"THIS LOCAL에서 카테고리 불러오는 중..."},"Duyệt toàn bộ nhóm chính và danh mục con đang hoạt động trên THIS LOCAL. Bấm một mục để mở danh sách địa điểm tương ứng.":{"en":"Browse all active main groups and subcategories on THIS LOCAL. Select one to open its place list.","zh":"浏览 THIS LOCAL 上所有启用的主分类和子分类。点击分类即可查看对应地点列表。","th":"ดูหมวดหลักและหมวดย่อยที่เปิดใช้งานทั้งหมดบน THIS LOCAL แล้วแตะเพื่อเปิดรายการสถานที่","ru":"Просматривайте все активные основные группы и подкатегории THIS LOCAL. Выберите категорию, чтобы открыть список мест.","ja":"THIS LOCAL の有効な主要グループとサブカテゴリーをすべて表示。選択すると場所一覧が開きます。","ko":"THIS LOCAL의 활성 주요 그룹과 하위 카테고리를 모두 둘러보고 선택하면 장소 목록이 열립니다."},"Tìm nhà hàng, nhà thuốc, ngân hàng, salon...":{"en":"Find restaurants, pharmacies, banks, salons...","zh":"搜索餐馆、药店、银行、美发店…","th":"ค้นหาร้านอาหาร ร้านขายยา ธนาคาร ซาลอน...","ru":"Ищите рестораны, аптеки, банки, салоны...","ja":"レストラン、薬局、銀行、サロンを検索…","ko":"식당, 약국, 은행, 살롱 검색..."},"Khám phá địa điểm":{"en":"Explore places","zh":"探索地点","th":"สำรวจสถานที่","ru":"Исследовать места","ja":"場所を探索","ko":"장소 둘러보기"},"Nguồn:":{"en":"Source:","zh":"来源：","th":"แหล่งที่มา:","ru":"Источник:","ja":"出典：","ko":"출처:"}};
  Object.keys(SUPPLEMENT_UI).forEach(function(k){UI[k]=UI[k]||{};Object.keys(SUPPLEMENT_UI[k]).forEach(function(l){UI[k][l]=SUPPLEMENT_UI[k][l];});});
  var V1795_ALIAS_UI={"Du lịch & giải trí":{"en":"Travel & entertainment","zh":"旅游与娱乐","th":"ท่องเที่ยวและบันเทิง","ru":"Туризм и развлечения","ja":"旅行・エンタメ","ko":"여행·엔터테인먼트"},"Làm đẹp":{"en":"Beauty","zh":"美容","th":"ความงาม","ru":"Красота","ja":"美容","ko":"뷰티"},"Xe & phương tiện":{"en":"Vehicles","zh":"车辆与交通工具","th":"ยานพาหนะ","ru":"Транспорт","ja":"車・乗り物","ko":"차량·이동수단"},"Thể thao":{"en":"Sports","zh":"运动","th":"กีฬา","ru":"Спорт","ja":"スポーツ","ko":"스포츠"},"Tài chính":{"en":"Finance","zh":"金融","th":"การเงิน","ru":"Финансы","ja":"金融","ko":"금융"},"Giáo dục":{"en":"Education","zh":"教育","th":"การศึกษา","ru":"Образование","ja":"教育","ko":"교육"},"Giao thông":{"en":"Transport","zh":"交通","th":"การเดินทาง","ru":"Транспорт","ja":"交通","ko":"교통"},"Sức khỏe":{"en":"Health","zh":"健康","th":"สุขภาพ","ru":"Здоровье","ja":"健康","ko":"건강"},"Chỗ ở":{"en":"Places to stay","zh":"住宿","th":"ที่พัก","ru":"Где остановиться","ja":"宿泊","ko":"숙소"},"Khám phá địa điểm gần bạn":{"en":"Explore places near you","zh":"探索你附近的地点","th":"สำรวจสถานที่ใกล้คุณ","ru":"Места рядом с вами","ja":"近くの場所を探索","ko":"내 주변 장소 둘러보기"}};Object.keys(V1795_ALIAS_UI).forEach(function(k){UI[k]=UI[k]||{};Object.keys(V1795_ALIAS_UI[k]).forEach(function(l){UI[k][l]=V1795_ALIAS_UI[k][l];});});

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

  /* V17.95.1: complete English fallback for the current 24 + 369 taxonomy. */
  var AUTO_CATEGORY_EN={"Ăn uống":"Food & drink","Mua sắm & bán lẻ":"Shopping & retail","Dịch vụ chuyên môn & doanh nghiệp":"Professional & business services","Làm đẹp & chăm sóc cá nhân":"Beauty & personal care","Y tế & sức khỏe":"Health & medical","Giáo dục & đào tạo":"Education & training","Lưu trú":"Accommodation","Du lịch, văn hóa & giải trí":"Travel, culture & entertainment","Thể thao & hoạt động ngoài trời":"Sports & outdoor activities","Giao thông & vận tải":"Transport & mobility","Hành chính & cơ quan nhà nước":"Government & public administration","Tài chính, ngân hàng & bảo hiểm":"Finance, banking & insurance","Công nghiệp, sản xuất & logistics":"Industry, manufacturing & logistics","Nông nghiệp, lâm nghiệp & thủy sản":"Agriculture, forestry & fisheries","Xây dựng, bất động sản & tòa nhà":"Construction, real estate & buildings","Ô tô, xe máy & phương tiện":"Cars, motorbikes & vehicles","Công nghệ, truyền thông & sáng tạo":"Technology, media & creative services","Điện, nước, năng lượng & môi trường":"Utilities, energy & environment","Tôn giáo & tín ngưỡng":"Religion & faith","An ninh, cứu hộ & quốc phòng":"Security, rescue & defense","Tiện ích công cộng & cộng đồng":"Public utilities & community","Địa danh hành chính & khu dân cư":"Administrative areas & neighborhoods","Thiên nhiên, di tích & thắng cảnh":"Nature, heritage & attractions","Địa điểm khác":"Other places","Bánh kẹo & sô-cô-la":"Confectionery & chocolate","Cà phê & trà":"Coffee & tea","Cà phê, trà & nguyên liệu":"Coffee, tea & ingredients","Đồ ăn nhanh":"Fast food","Đồ uống & rượu bia":"Beverages, beer & wine","Kem & đồ ngọt":"Ice cream & desserts","Khu ẩm thực":"Food court","Khu nướng BBQ":"BBQ area","Nhà hàng & quán ăn":"Restaurants & eateries","Quán bar & pub":"Bars & pubs","Thực phẩm & đặc sản":"Food & local specialties","Tiệm bánh":"Bakery","Bách hóa tổng hợp":"Department store","Chợ & khu mua bán":"Markets & shopping areas","Cửa hàng chuyên doanh khác":"Other specialty stores","Cửa hàng tiện lợi & tạp hóa":"Convenience & grocery stores","Điện tử, điện máy & công nghệ":"Electronics, appliances & technology","Đồ thể thao & dã ngoại":"Sports & outdoor goods","Giày dép, túi xách & đồ da":"Shoes, bags & leather goods","Hoa & cây cảnh":"Flowers & plants","Khu bán lẻ & trung tâm mua sắm":"Retail areas & shopping centers","Máy bán hàng tự động":"Vending machines","Nội thất & đồ gia dụng":"Furniture & homeware","Quà tặng, đồ chơi & mẹ bé":"Gifts, toys & baby products","Sách, văn phòng phẩm & in ấn":"Books, stationery & printing","Siêu thị":"Supermarket","Thời trang & quần áo":"Fashion & clothing","Thú cưng & phụ kiện":"Pets & accessories","Tòa nhà bán lẻ":"Retail building","Trang sức & đồng hồ":"Jewelry & watches","Trung tâm thương mại":"Shopping mall","Vật liệu xây dựng & kim khí":"Building materials & hardware","Công chứng":"Notary services","Công ty & văn phòng doanh nghiệp":"Companies & business offices","Giặt là & vệ sinh":"Laundry & cleaning","Hiệp hội & tổ chức xã hội":"Associations & social organizations","Hợp tác xã":"Cooperatives","Kế toán & thuế":"Accounting & tax","Không gian làm việc chung":"Coworking spaces","Luật & tư vấn pháp lý":"Legal services & advice","Sửa chữa & dịch vụ kỹ thuật":"Repair & technical services","Tuyển dụng & việc làm":"Recruitment & employment","Tư vấn doanh nghiệp":"Business consulting","Văn phòng & dịch vụ chuyên môn khác":"Other offices & professional services","Massage & trị liệu thư giãn":"Massage & relaxation therapy","May đo & sửa quần áo":"Tailoring & clothing alterations","May đo & thủ công cá nhân":"Personal tailoring & crafts","Mỹ phẩm & nước hoa":"Cosmetics & perfume","Salon tóc & cắt tóc":"Hair salons & barbers","Spa, làm đẹp & chăm sóc da":"Spa, beauty & skincare","Xăm hình & piercing":"Tattoo & piercing","Xông hơi & sauna":"Steam bath & sauna","Bác sĩ & cơ sở khám bệnh":"Doctors & medical practices","Bệnh viện":"Hospital","Chăm sóc người cao tuổi":"Senior care","Cơ sở bảo trợ & chăm sóc xã hội":"Social welfare & care facilities","Cơ sở y tế khác":"Other medical facilities","Kính mắt & đo thị lực":"Eyewear & vision testing","Nha khoa":"Dentistry","Nhà thuốc":"Pharmacy","Phòng khám":"Clinic","Phục hồi chức năng":"Rehabilitation","Sản khoa & trung tâm sinh":"Maternity & birth centers","Thiết bị y tế & thực phẩm bổ sung":"Medical equipment & supplements","Thú y":"Veterinary care","Trung tâm hiến máu":"Blood donation center","Trung tâm tiêm chủng":"Vaccination center","Xét nghiệm & chẩn đoán":"Testing & diagnostics","Y học cổ truyền & thay thế":"Traditional & alternative medicine","Cơ sở giáo dục & đào tạo khác":"Other education & training facilities","Đài quan sát":"Observatory","Đào tạo nghệ thuật & âm nhạc":"Arts & music education","Khu giáo dục":"Education campus","Thư viện":"Library","Trung tâm đào tạo lái xe":"Driving school","Trung tâm ngoại ngữ":"Language center","Trường cao đẳng":"College","Trường đại học":"University","Trường mầm non":"Preschool","Trường phổ thông":"School","Viện nghiên cứu":"Research institute","Căn hộ & villa lưu trú":"Serviced apartments & villas","Hostel":"Hostel","Khách sạn":"Hotel","Khu cắm trại":"Campground","Khu nghỉ dưỡng":"Resort","Motel":"Motel","Nhà gỗ & bungalow":"Cabins & bungalows","Nhà nghỉ & homestay":"Guesthouses & homestays","Nhà nghỉ trên núi":"Mountain lodge","Bảo tàng":"Museum","Bowling":"Bowling","Casino & trò chơi có thưởng":"Casino & gaming","Công viên chủ đề":"Theme park","Công viên nước":"Water park","Dịch vụ du lịch khác":"Other travel services","Đại lý du lịch & vé":"Travel agency & tickets","Địa điểm tổ chức sự kiện":"Event venue","Điểm ngắm cảnh & check-in":"Scenic viewpoint & check-in spot","Điểm tham quan":"Tourist attraction","Hướng dẫn & dịch vụ du lịch":"Tour guides & travel services","Karaoke":"Karaoke","Khiêu vũ & câu lạc bộ":"Dance & clubs","Khu trò chơi giải trí":"Amusement arcade","Nhà hát & sân khấu":"Theater & stage","Phòng trưng bày":"Gallery","Rạp chiếu phim":"Cinema","Tác phẩm nghệ thuật công cộng":"Public art","Thông tin du lịch":"Tourist information","Thủy cung":"Aquarium","Trung tâm hội nghị":"Convention center","Trung tâm nghệ thuật":"Arts center","Vũ trường & giải trí ban đêm":"Nightclub & nightlife","Vườn thú":"Zoo","Bể bơi":"Swimming pool","Bến du thuyền":"Marina","Billiards & bi-a":"Billiards & pool","Bóng chuyền":"Volleyball","Bóng đá":"Football","Bơi lội":"Swimming","Câu lạc bộ & hội nhóm":"Clubs & groups","Câu lạc bộ thể thao":"Sports club","Cầu lông":"Badminton","Công viên":"Park","Cưỡi ngựa":"Horse riding","Điểm dã ngoại":"Picnic spot","Điểm tập thể dục ngoài trời":"Outdoor fitness area","Đua xe thể thao":"Motorsport","Đường chạy & đường đua":"Running track & racecourse","Hoạt động ngoài trời khác":"Other outdoor activities","Khu câu cá":"Fishing area","Khu vui chơi & sinh hoạt ngoài trời":"Outdoor recreation area","Lặn biển & thể thao nước":"Diving & water sports","Leo núi & leo tường":"Climbing & bouldering","Môn thể thao khác":"Other sports","Nhà thi đấu":"Indoor arena","Phòng gym & fitness":"Gym & fitness","Pickleball":"Pickleball","Sân chơi trẻ em":"Playground","Sân golf":"Golf course","Sân thể thao":"Sports field","Sân vận động":"Stadium","Tennis":"Tennis","Trung tâm thể thao":"Sports center","Vườn & không gian xanh":"Garden & green space","Bãi đáp trực thăng":"Helipad","Bến phà & bến tàu":"Ferry terminal & pier","Bến xe khách":"Bus station","Cáp treo & đường sắt trên không":"Cable car & aerial railway","Cầu & công trình giao thông":"Bridges & transport structures","Cầu cảng & bến tàu":"Pier & wharf","Doanh nghiệp vận tải":"Transport company","Điểm dừng & nhà chờ công cộng":"Public stop & shelter","Điểm dừng phương tiện công cộng":"Public transport stop","Điểm dừng xe buýt":"Bus stop","Điểm taxi":"Taxi stand","Ga đường sắt":"Railway station","Hạ tầng đường sắt":"Rail infrastructure","Hạ tầng giao thông công cộng":"Public transport infrastructure","Hạ tầng giao thông đường bộ":"Road transport infrastructure","Hạ tầng hàng không":"Aviation infrastructure","Hãng hàng không":"Airline","Hầm & công trình ngầm":"Tunnel & underground structure","Khu đường sắt":"Railway area","Lối vào metro":"Metro entrance","Nhà ga & trạm trung chuyển":"Station & transit hub","Nhà ga sân bay":"Airport terminal","Sân bay & sân bay nhỏ":"Airport & airfield","Tòa nhà giao thông":"Transport building","Trạm dừng nghỉ":"Rest area","Công an & cảnh sát":"Police","Cơ quan nhà nước khác":"Other government offices","Cứu hỏa":"Fire station","Đại sứ quán & lãnh sự quán":"Embassy & consulate","Khu cơ quan & tổ chức":"Government & organization complex","Khu hành chính":"Administrative area","Tòa án":"Court","Tòa nhà cơ quan nhà nước":"Government office building","Tổ chức chính trị":"Political organization","Trại giam & cơ sở cải tạo":"Prison & correctional facility","UBND & cơ quan hành chính":"People’s Committee & administrative office","ATM":"ATM","Bảo hiểm":"Insurance","Công ty tài chính & đầu tư":"Finance & investment company","Đổi tiền":"Currency exchange","Ngân hàng":"Bank","Tư vấn tài chính":"Financial advisory","Bán buôn & phân phối":"Wholesale & distribution","Cảng hàng hóa & logistics":"Cargo port & logistics","Chế biến gỗ & nội thất":"Wood processing & furniture","Chuyển phát & giao hàng":"Courier & delivery","Cơ khí, kim loại & máy móc":"Mechanical engineering, metal & machinery","Cơ sở sản xuất khác":"Other manufacturing facilities","Dầu khí & lọc hóa dầu":"Oil, gas & refining","Dệt may, da giày":"Textiles, apparel & leather","Điện tử & thiết bị điện":"Electronics & electrical equipment","Đóng tàu & sửa chữa tàu thuyền":"Shipbuilding & boat repair","Hạ tầng sản xuất & vận chuyển":"Manufacturing & transport infrastructure","Hóa chất, nhựa & phân bón":"Chemicals, plastics & fertilizer","Kho bãi & phân phối":"Warehousing & distribution","Khu công nghiệp & cụm sản xuất":"Industrial park & production cluster","Logistics & giao nhận":"Logistics & freight forwarding","Mỏ & khai khoáng":"Mining & quarrying","Nhà máy & cơ sở sản xuất":"Factory & manufacturing facility","Nhà xưởng công nghiệp":"Industrial workshop","Sản xuất & nghề thủ công khác":"Other manufacturing & crafts","Sản xuất thực phẩm & đồ uống":"Food & beverage manufacturing","Thủ công mỹ nghệ":"Handicrafts","Xi măng, gạch & vật liệu xây dựng":"Cement, bricks & building materials","Công trình nông nghiệp":"Agricultural structures","Dịch vụ nông nghiệp":"Agricultural services","Lâm nghiệp":"Forestry","Nhà kính & nông nghiệp công nghệ cao":"Greenhouses & high-tech agriculture","Nuôi trồng thủy sản":"Aquaculture","Sản xuất muối":"Salt production","Trang trại & chăn nuôi":"Farms & livestock","Vật tư nông nghiệp":"Agricultural supplies","Vùng trồng trọt":"Cultivation area","Vườn cây & cây ăn quả":"Orchards & fruit gardens","Vườn cộng đồng":"Community garden","Vườn ươm & cây giống":"Nursery & seedlings","Chung cư & căn hộ":"Apartment buildings & apartments","Công trình đang xây dựng":"Construction site","Công ty xây dựng":"Construction company","Khu thương mại & văn phòng":"Commercial & office complex","Kiến trúc & thiết kế":"Architecture & design","Kỹ thuật & khảo sát":"Engineering & surveying","Ký túc xá":"Dormitory","Môi giới bất động sản":"Real estate agency","Nhà ở & khu dân cư":"Housing & residential area","Quản lý bất động sản":"Property management","Thợ xây dựng & hoàn thiện":"Builders & finishing services","Tòa nhà & công trình có tên khác":"Other named buildings & structures","Tòa nhà thương mại":"Commercial building","Tòa nhà văn phòng":"Office building","Bãi đỗ xe":"Parking","Bãi đỗ xe đạp":"Bicycle parking","Bãi đỗ xe máy":"Motorbike parking","Cho thuê ô tô":"Car rental","Cho thuê xe đạp":"Bicycle rental","Cho thuê xe máy":"Motorbike rental","Cửa hàng xe đạp":"Bicycle shop","Cửa hàng xe máy":"Motorbike shop","Đại lý ô tô":"Car dealership","Đăng kiểm phương tiện":"Vehicle inspection","Phụ tùng & lốp xe":"Parts & tires","Rửa & chăm sóc xe":"Car wash & detailing","Sửa chữa ô tô":"Auto repair","Sửa chữa xe máy":"Motorbike repair","Trạm sạc xe điện":"EV charging station","Trạm xăng dầu":"Petrol station","Ảnh, máy ảnh & dịch vụ nhiếp ảnh":"Photography, cameras & photo services","Báo chí & truyền thông":"Press & media","Công nghệ thông tin & phần mềm":"Information technology & software","Điểm Internet & gaming":"Internet cafe & gaming","Hạ tầng viễn thông":"Telecommunications infrastructure","Quảng cáo & sáng tạo":"Advertising & creative services","Studio ghi hình & sáng tạo":"Recording & creative studio","Trung tâm dữ liệu":"Data center","Viễn thông":"Telecommunications","Xuất bản":"Publishing","Bãi chôn lấp chất thải":"Landfill","Bồn & kho chứa":"Tank & storage facility","Công trình kỹ thuật khác":"Other engineering structures","Cột & tháp điện":"Power poles & towers","Doanh nghiệp cấp nước":"Water utility company","Doanh nghiệp năng lượng":"Energy company","Điểm cấp nước":"Water point","Điểm tái chế":"Recycling point","Điểm thu gom rác":"Waste collection point","Đường dây điện":"Power line","Đường ống kỹ thuật":"Utility pipeline","Giếng & nguồn nước":"Well & water source","Hạ tầng điện khác":"Other electrical infrastructure","Hạ tầng khí đốt":"Gas infrastructure","Máy biến áp":"Transformer","Nhà máy & công trình cấp nước":"Water plant & supply infrastructure","Nhà máy điện & máy phát":"Power plant & generator","Nhà máy xử lý nước thải":"Wastewater treatment plant","Tháp nước":"Water tower","Trạm biến áp":"Substation","Trạm bơm":"Pumping station","Trạm quan trắc":"Monitoring station","Trạm trung chuyển chất thải":"Waste transfer station","Chùa, thiền viện & Phật giáo":"Buddhist temple & monastery","Cơ sở tôn giáo khác":"Other religious facilities","Đạo quán & Đạo giáo":"Taoist temple","Hỏa táng & dịch vụ tang lễ":"Cremation & funeral services","Khu tôn giáo":"Religious complex","Nghĩa trang & nghĩa địa":"Cemetery & graveyard","Nhà tang lễ & nhà xác":"Funeral home & morgue","Nhà thờ & Kitô giáo":"Church & Christianity","Thánh đường Hồi giáo":"Mosque","Thánh thất Cao Đài":"Cao Dai temple","Tổ chức tôn giáo":"Religious organization","Bể nước chữa cháy":"Firefighting water tank","Căn cứ hải quân":"Naval base","Căn cứ quân sự":"Military base","Chốt kiểm soát quân sự":"Military checkpoint","Cơ quan quân sự":"Military office","Cứu hộ bờ biển":"Coastal rescue","Cứu hộ đường thủy":"Water rescue","Dịch vụ bảo vệ & an ninh":"Security & guard services","Doanh trại":"Barracks","Điểm khẩn cấp & cứu hộ":"Emergency & rescue point","Điểm sơ cứu":"First aid point","Hầm & công trình quân sự":"Military tunnel & structure","Học viện quân sự":"Military academy","Kho quân dụng":"Military storage","Khu huấn luyện quân sự":"Military training area","Khu quân sự":"Military area","Sân bay quân sự":"Military airfield","Trạm cấp cứu":"Emergency station","Trường bắn":"Shooting range","Bưu điện":"Post office","Cơ sở tiện ích khác":"Other utility facilities","Điểm nước uống công cộng":"Public drinking water point","Nhà chờ & nơi trú ẩn":"Waiting shelter & refuge","Nhà văn hóa & trung tâm cộng đồng":"Cultural house & community center","Nhà vệ sinh công cộng":"Public toilet","Tiện ích công cộng khác":"Other public utilities","Tòa nhà công cộng":"Public building","Tủ sách cộng đồng":"Community bookshelf","Đảo & quần đảo":"Island & archipelago","Địa danh địa phương":"Local place name","Địa danh khác":"Other place name","Đơn vị hành chính":"Administrative unit","Khu dân cư & tổ dân phố":"Neighborhood & residential group","Khu nhà & ô phố":"Housing block & city block","Phường & khu phố":"Ward & neighborhood","Quảng trường":"Square","Quận, huyện & khu ngoại ô":"District, county & suburb","Thành phố":"City","Thị xã & thị trấn":"Town & township","Thôn, bản & ấp":"Hamlet & village","Xã & làng":"Commune & village","Âu thuyền & cửa van":"Lock & sluice gate","Bãi biển":"Beach","Bến nước & ụ tàu":"Waterfront landing & dry dock","Bờ biển":"Coastline","Cây cổ thụ & cây nổi bật":"Ancient & notable tree","Cổng & công trình biểu tượng":"Gateway & landmark structure","Di tích kiến trúc & khảo cổ":"Architectural & archaeological heritage","Di tích lịch sử khác":"Other historic site","Di tích quân sự & chiến trường":"Military heritage & battlefield","Di tích, tượng đài & tưởng niệm":"Monument & memorial","Đập & hồ chứa":"Dam & reservoir","Đất ngập nước":"Wetland","Địa điểm tự nhiên khác":"Other natural site","Hải đăng":"Lighthouse","Hang động":"Cave","Hồ chứa":"Reservoir","Hồ, ao & mặt nước":"Lake, pond & waterbody","Khu bảo tồn thiên nhiên":"Nature reserve","Lăng mộ & khu tưởng niệm":"Tomb & memorial site","Mốc lịch sử":"Historic marker","Mũi đất & vịnh":"Cape & bay","Núi, đỉnh & đèo":"Mountain, peak & pass","Rạn san hô":"Coral reef","Rừng & khu cây xanh":"Forest & green area","Suối & nguồn nước":"Stream & spring","Suối nước nóng":"Hot spring","Thác nước":"Waterfall","Thành cổ, pháo đài & cổng thành":"Citadel, fortress & city gate","Tháp & công trình nổi bật":"Tower & landmark structure","Thung lũng":"Valley","Trạm nhiên liệu đường thủy":"Marine fuel station","Vách đá & địa hình đá":"Cliff & rock formation","Địa điểm chưa phân loại":"Uncategorized place"};
  var PARENT_CATEGORY_NATIVE={"Ăn uống":{"zh":"餐饮美食","th":"อาหารและเครื่องดื่ม","ru":"Еда и напитки","ja":"飲食・グルメ","ko":"음식·음료"},"Mua sắm & bán lẻ":{"zh":"购物与零售","th":"ช้อปปิ้งและค้าปลีก","ru":"Покупки и розничная торговля","ja":"ショッピング・小売","ko":"쇼핑·소매"},"Dịch vụ chuyên môn & doanh nghiệp":{"zh":"专业与企业服务","th":"บริการวิชาชีพและธุรกิจ","ru":"Профессиональные и бизнес-услуги","ja":"専門・ビジネスサービス","ko":"전문·비즈니스 서비스"},"Làm đẹp & chăm sóc cá nhân":{"zh":"美容与个人护理","th":"ความงามและการดูแลส่วนบุคคล","ru":"Красота и уход за собой","ja":"美容・パーソナルケア","ko":"뷰티·개인 관리"},"Y tế & sức khỏe":{"zh":"医疗与健康","th":"การแพทย์และสุขภาพ","ru":"Медицина и здоровье","ja":"医療・健康","ko":"의료·건강"},"Giáo dục & đào tạo":{"zh":"教育与培训","th":"การศึกษาและการฝึกอบรม","ru":"Образование и обучение","ja":"教育・研修","ko":"교육·훈련"},"Lưu trú":{"zh":"住宿","th":"ที่พัก","ru":"Проживание","ja":"宿泊","ko":"숙박"},"Du lịch, văn hóa & giải trí":{"zh":"旅游、文化与娱乐","th":"ท่องเที่ยว วัฒนธรรม และบันเทิง","ru":"Туризм, культура и развлечения","ja":"旅行・文化・エンタメ","ko":"여행·문화·엔터테인먼트"},"Thể thao & hoạt động ngoài trời":{"zh":"运动与户外活动","th":"กีฬาและกิจกรรมกลางแจ้ง","ru":"Спорт и активный отдых","ja":"スポーツ・アウトドア","ko":"스포츠·야외 활동"},"Giao thông & vận tải":{"zh":"交通与运输","th":"การเดินทางและขนส่ง","ru":"Транспорт и перевозки","ja":"交通・輸送","ko":"교통·운송"},"Hành chính & cơ quan nhà nước":{"zh":"行政与政府机构","th":"หน่วยงานรัฐและการปกครอง","ru":"Государственные учреждения","ja":"行政・政府機関","ko":"행정·정부 기관"},"Tài chính, ngân hàng & bảo hiểm":{"zh":"金融、银行与保险","th":"การเงิน ธนาคาร และประกันภัย","ru":"Финансы, банки и страхование","ja":"金融・銀行・保険","ko":"금융·은행·보험"},"Công nghiệp, sản xuất & logistics":{"zh":"工业、制造与物流","th":"อุตสาหกรรม การผลิต และโลจิสติกส์","ru":"Промышленность, производство и логистика","ja":"産業・製造・物流","ko":"산업·제조·물류"},"Nông nghiệp, lâm nghiệp & thủy sản":{"zh":"农业、林业与渔业","th":"เกษตร ป่าไม้ และประมง","ru":"Сельское, лесное и рыбное хозяйство","ja":"農業・林業・水産","ko":"농업·임업·수산업"},"Xây dựng, bất động sản & tòa nhà":{"zh":"建筑、房地产与楼宇","th":"ก่อสร้าง อสังหาริมทรัพย์ และอาคาร","ru":"Строительство, недвижимость и здания","ja":"建設・不動産・建物","ko":"건설·부동산·건물"},"Ô tô, xe máy & phương tiện":{"zh":"汽车、摩托车与车辆","th":"รถยนต์ มอเตอร์ไซค์ และยานพาหนะ","ru":"Автомобили, мотоциклы и транспорт","ja":"自動車・バイク・車両","ko":"자동차·오토바이·차량"},"Công nghệ, truyền thông & sáng tạo":{"zh":"科技、媒体与创意","th":"เทคโนโลยี สื่อ และงานสร้างสรรค์","ru":"Технологии, медиа и креатив","ja":"テクノロジー・メディア・クリエイティブ","ko":"기술·미디어·크리에이티브"},"Điện, nước, năng lượng & môi trường":{"zh":"电力、水务、能源与环境","th":"ไฟฟ้า น้ำ พลังงาน และสิ่งแวดล้อม","ru":"Электроэнергия, вода, энергия и экология","ja":"電気・水道・エネルギー・環境","ko":"전기·수도·에너지·환경"},"Tôn giáo & tín ngưỡng":{"zh":"宗教与信仰","th":"ศาสนาและความเชื่อ","ru":"Религия и вера","ja":"宗教・信仰","ko":"종교·신앙"},"An ninh, cứu hộ & quốc phòng":{"zh":"安全、救援与国防","th":"ความปลอดภัย กู้ภัย และกลาโหม","ru":"Безопасность, спасение и оборона","ja":"安全・救助・防衛","ko":"안전·구조·국방"},"Tiện ích công cộng & cộng đồng":{"zh":"公共设施与社区","th":"สาธารณูปโภคและชุมชน","ru":"Общественные услуги и сообщество","ja":"公共施設・コミュニティ","ko":"공공 편의·커뮤니티"},"Địa danh hành chính & khu dân cư":{"zh":"行政区划与居民区","th":"เขตการปกครองและชุมชนที่อยู่อาศัย","ru":"Административные районы и жилые территории","ja":"行政地域・居住地域","ko":"행정 구역·주거 지역"},"Thiên nhiên, di tích & thắng cảnh":{"zh":"自然、遗产与景点","th":"ธรรมชาติ มรดก และแหล่งท่องเที่ยว","ru":"Природа, наследие и достопримечательности","ja":"自然・史跡・景勝地","ko":"자연·유산·명소"},"Địa điểm khác":{"zh":"其他地点","th":"สถานที่อื่น ๆ","ru":"Другие места","ja":"その他の場所","ko":"기타 장소"}};
  var TRAD_PHRASES={"全部分类":"全部分類","主要类别":"主要類別","子类别":"子類別","类别":"類別","搜索":"搜尋","信息":"資訊","视频":"影片","网站":"網站","数据":"資料","社区":"社群","当前位置":"目前位置","位置已更新":"位置已更新","地点":"地點","暂时":"暫時","关闭":"關閉","开启":"開啟","显示":"顯示","选择":"選擇","建议":"建議","推荐":"推薦","服务":"服務","购物":"購物","旅游":"旅遊","娱乐":"娛樂","运动":"運動","活动":"活動","运输":"運輸","行政区划":"行政區劃","遗产":"遺產","景点":"景點","汽车":"汽車","车辆":"車輛","银行":"銀行","保险":"保險","电力":"電力","环境":"環境","设施":"設施","医疗":"醫療","药店":"藥局","医院":"醫院","诊断":"診斷","传统":"傳統","艺术":"藝術","培训":"培訓","图书馆":"圖書館","电影院":"電影院","公共":"公共","广场":"廣場","乡镇":"鄉鎮","地区":"地區","办公":"辦公","建筑":"建築","楼宇":"建築物","专业":"專業","企业":"企業","农业":"農業","林业":"林業","渔业":"漁業","制造":"製造","创意":"創意","媒体":"媒體","通讯":"通訊","电信":"電信","宗教":"宗教","救援":"救援","国防":"國防","自然":"自然","历史":"歷史","纪念":"紀念","纪念碑":"紀念碑","检查":"檢查","审核":"審核","电话":"電話","价格":"價格","地址":"地址","查看":"查看","加载":"載入","无法":"無法","请":"請","重试":"重試","优先":"優先","范围":"範圍","名称":"名稱","关键词":"關鍵字","匹配":"符合","开启定位":"開啟定位","定位权限":"定位權限","全站":"全站"};
  var TRAD_CHARS={"这":"這","为":"為","个":"個","与":"與","类":"類","览":"覽","语":"語","体":"體","门":"門","间":"間","时":"時","车":"車","书":"書","网":"網","线":"線","华":"華","国":"國","区":"區","点":"點","万":"萬","专":"專","业":"業","东":"東","丝":"絲","两":"兩","严":"嚴","丧":"喪","丰":"豐","临":"臨","丽":"麗","举":"舉","义":"義","乌":"烏","乐":"樂","乔":"喬","习":"習","乡":"鄉","买":"買","乱":"亂","争":"爭","于":"於","亏":"虧","亚":"亞","产":"產","亩":"畝","亲":"親","亿":"億","仅":"僅","从":"從","仓":"倉","仪":"儀","们":"們","价":"價","众":"眾","优":"優","会":"會","伞":"傘","伟":"偉","传":"傳","伤":"傷","伦":"倫","伪":"偽","余":"餘","侠":"俠","侣":"侶","侦":"偵","侧":"側","侨":"僑","侩":"儈","俩":"倆","俭":"儉","债":"債","倾":"傾","偿":"償","儿":"兒","兑":"兌","党":"黨","兰":"蘭","关":"關","兴":"興","养":"養","兽":"獸","冈":"岡","册":"冊","写":"寫","军":"軍","农":"農","冬":"冬","冲":"衝","决":"決","况":"況","冻":"凍","净":"淨","凉":"涼","减":"減","几":"幾","凤":"鳳","凭":"憑","凯":"凱","击":"擊","凿":"鑿","划":"劃","刘":"劉","则":"則","刚":"剛","创":"創","删":"刪","别":"別","剂":"劑","剑":"劍","剧":"劇","办":"辦","务":"務","动":"動","励":"勵","劲":"勁","劳":"勞","势":"勢","勋":"勳","匀":"勻","医":"醫","协":"協","单":"單","卖":"賣","卢":"盧","卫":"衛","却":"卻","厂":"廠","历":"歷","压":"壓","厌":"厭","厕":"廁","县":"縣","参":"參","双":"雙","发":"發","变":"變","叙":"敘","叶":"葉","号":"號","叹":"嘆","吕":"呂","吗":"嗎","听":"聽","启":"啟","吴":"吳","员":"員","呐":"吶","呕":"嘔","呗":"唄","呜":"嗚","咏":"詠","咙":"嚨","咛":"嚀","响":"響","哑":"啞","哟":"喲","团":"團","园":"園","围":"圍","图":"圖","圆":"圓","圣":"聖","场":"場","坏":"壞","块":"塊","坚":"堅","坛":"壇","坝":"壩","坞":"塢","坟":"墳","坠":"墜","垄":"壟","垒":"壘","垦":"墾","垫":"墊","垭":"埡","埘":"塒","埙":"塤","埚":"堝","堑":"塹","墙":"牆","壮":"壯","声":"聲","壳":"殼","壶":"壺","处":"處","备":"備","复":"復","够":"夠","头":"頭","夹":"夾","夺":"奪","奋":"奮","奖":"獎","妇":"婦","妈":"媽","妆":"妝","姜":"薑","娱":"娛","婴":"嬰","孙":"孫","学":"學","宁":"寧","宝":"寶","实":"實","宠":"寵","审":"審","宪":"憲","宫":"宮","宽":"寬","宾":"賓","对":"對","导":"導","寿":"壽","将":"將","尔":"爾","尘":"塵","尝":"嘗","层":"層","屉":"屜","届":"屆","属":"屬","岁":"歲","岂":"豈","岗":"崗","岛":"島","岭":"嶺","岳":"嶽","峡":"峽","币":"幣","帅":"帥","师":"師","帐":"帳","带":"帶","帮":"幫","庄":"莊","庆":"慶","库":"庫","应":"應","庙":"廟","废":"廢","广":"廣","归":"歸","当":"當","录":"錄","彦":"彥","彻":"徹","径":"徑","忆":"憶","志":"志","忧":"憂","态":"態","怀":"懷","怜":"憐","总":"總","恋":"戀","恳":"懇","恶":"惡","恼":"惱","悦":"悅","惊":"驚","惧":"懼","惨":"慘","惩":"懲","惯":"慣","愤":"憤","愿":"願","慑":"懾","戏":"戲","户":"戶","执":"執","扩":"擴","扫":"掃","扬":"揚","扰":"擾","抚":"撫","护":"護","报":"報","担":"擔","拟":"擬","拢":"攏","拣":"揀","拥":"擁","拦":"攔","拨":"撥","择":"擇","挂":"掛","挚":"摯","挛":"攣","挠":"撓","挡":"擋","挣":"掙","挤":"擠","挥":"揮","损":"損","捡":"撿","换":"換","据":"據","掳":"擄","掺":"摻","揽":"攬","搀":"攙","搁":"擱","搂":"摟","搅":"攪","搜":"搜","摄":"攝","摆":"擺","摇":"搖","摊":"攤","撑":"撐","撵":"攆","敌":"敵","数":"數","斋":"齋","断":"斷","无":"無","旧":"舊","旷":"曠","显":"顯","晋":"晉","晒":"曬","晓":"曉","暂":"暫","术":"術","机":"機","杀":"殺","杂":"雜","权":"權","条":"條","来":"來","杨":"楊","极":"極","构":"構","枪":"槍","柜":"櫃","标":"標","栈":"棧","栋":"棟","栏":"欄","树":"樹","样":"樣","桥":"橋","桨":"槳","梦":"夢","检":"檢","楼":"樓","欢":"歡","欧":"歐","歼":"殲","殴":"毆","毁":"毀","毕":"畢","气":"氣","汇":"匯","汉":"漢","汤":"湯","沟":"溝","没":"沒","沪":"滬","沦":"淪","沧":"滄","泛":"泛","泞":"濘","泪":"淚","泼":"潑","泽":"澤","洁":"潔","浅":"淺","浆":"漿","浇":"澆","测":"測","济":"濟","浑":"渾","浓":"濃","涂":"塗","涌":"湧","涛":"濤","润":"潤","涧":"澗","涨":"漲","涩":"澀","渔":"漁","渗":"滲","湾":"灣","湿":"濕","溃":"潰","溅":"濺","滚":"滾","滞":"滯","满":"滿","滤":"濾","滥":"濫","滨":"濱","滩":"灘","潇":"瀟","潜":"潛","澜":"瀾","灭":"滅","灯":"燈","灵":"靈","灾":"災","灿":"燦","炉":"爐","炼":"煉","烟":"煙","烦":"煩","烧":"燒","热":"熱","爱":"愛","爷":"爺","牵":"牽","状":"狀","犹":"猶","狈":"狽","狮":"獅","玛":"瑪","环":"環","现":"現","珐":"琺","琐":"瑣","琼":"瓊","电":"電","疗":"療","监":"監","盖":"蓋","盘":"盤","眯":"瞇","砖":"磚","础":"礎","确":"確","码":"碼","矿":"礦","砀":"碭","礼":"禮","祸":"禍","离":"離","秃":"禿","积":"積","称":"稱","税":"稅","稳":"穩","窝":"窩","窥":"窺","竞":"競","笃":"篤","笔":"筆","笺":"箋","筑":"築","筛":"篩","签":"簽","简":"簡","粮":"糧","紧":"緊","纠":"糾","红":"紅","纤":"纖","约":"約","级":"級","纪":"紀","纬":"緯","纯":"純","纲":"綱","纳":"納","纵":"縱","纷":"紛","纸":"紙","纹":"紋","纺":"紡","纽":"紐","练":"練","组":"組","细":"細","织":"織","终":"終","绍":"紹","经":"經","绒":"絨","绑":"綁","绦":"絛","维":"維","绵":"綿","综":"綜","绿":"綠","缀":"綴","编":"編","缘":"緣","缩":"縮","缴":"繳","罢":"罷","罗":"羅","罚":"罰","职":"職","联":"聯","聪":"聰","肃":"肅","肠":"腸","肤":"膚","胜":"勝","胶":"膠","脏":"髒","脑":"腦","脚":"腳","脱":"脫","脸":"臉","腊":"臘","腻":"膩","腾":"騰","舰":"艦","舱":"艙","艺":"藝","节":"節","范":"範","茧":"繭","荐":"薦","药":"藥","获":"獲","莲":"蓮","营":"營","萧":"蕭","萨":"薩","蓝":"藍","虑":"慮","虚":"虛","虫":"蟲","虽":"雖","虾":"蝦","蚀":"蝕","蚁":"蟻","蚂":"螞","蚕":"蠶","蛊":"蠱","蛎":"蠣","蜡":"蠟","蝇":"蠅","蝉":"蟬","补":"補","袜":"襪","袭":"襲","装":"裝","见":"見","观":"觀","规":"規","觅":"覓","视":"視","觉":"覺","触":"觸","誉":"譽","计":"計","订":"訂","认":"認","讨":"討","让":"讓","训":"訓","议":"議","讯":"訊","记":"記","讲":"講","许":"許","论":"論","设":"設","访":"訪","证":"證","评":"評","词":"詞","译":"譯","试":"試","诗":"詩","诚":"誠","话":"話","诞":"誕","询":"詢","该":"該","详":"詳","误":"誤","说":"說","请":"請","诸":"諸","诺":"諾","读":"讀","课":"課","谁":"誰","调":"調","谈":"談","谋":"謀","谍":"諜","谎":"謊","谓":"謂","谜":"謎","谢":"謝","谨":"謹","谱":"譜","贝":"貝","负":"負","贡":"貢","财":"財","责":"責","贤":"賢","账":"賬","货":"貨","质":"質","贩":"販","贪":"貪","贫":"貧","贬":"貶","购":"購","贷":"貸","贸":"貿","费":"費","贺":"賀","贼":"賊","资":"資","赋":"賦","赌":"賭","赏":"賞","赐":"賜","赔":"賠","赞":"贊","赠":"贈","赢":"贏","赵":"趙","赶":"趕","趋":"趨","跃":"躍","践":"踐","踪":"蹤","轨":"軌","轩":"軒","转":"轉","轮":"輪","软":"軟","轰":"轟","轻":"輕","载":"載","较":"較","辆":"輛","辈":"輩","辉":"輝","辑":"輯","输":"輸","辖":"轄","辙":"轍","边":"邊","辽":"遼","达":"達","迁":"遷","过":"過","迈":"邁","运":"運","还":"還","进":"進","远":"遠","违":"違","连":"連","迟":"遲","适":"適","选":"選","逊":"遜","递":"遞","逻":"邏","遗":"遺","邻":"鄰","郑":"鄭","酝":"醞","释":"釋","鉴":"鑒","针":"針","钉":"釘","钮":"鈕","钞":"鈔","钟":"鐘","钢":"鋼","钥":"鑰","钦":"欽","钱":"錢","钳":"鉗","钻":"鑽","铁":"鐵","铃":"鈴","铅":"鉛","铲":"鏟","银":"銀","链":"鏈","销":"銷","锁":"鎖","锅":"鍋","锈":"鏽","锋":"鋒","锐":"銳","错":"錯","锡":"錫","锣":"鑼","锦":"錦","锨":"鍁","键":"鍵","锯":"鋸","锰":"錳","镜":"鏡","长":"長","闩":"閂","闪":"閃","闭":"閉","问":"問","闯":"闖","闲":"閒","闷":"悶","闸":"閘","闹":"鬧","闻":"聞","阀":"閥","阁":"閣","阅":"閱","队":"隊","阳":"陽","阴":"陰","阵":"陣","阶":"階","际":"際","陆":"陸","陈":"陳","险":"險","随":"隨","隐":"隱","难":"難","雏":"雛","雳":"靂","雾":"霧","静":"靜","页":"頁","顶":"頂","项":"項","顺":"順","须":"須","顾":"顧","顿":"頓","颁":"頒","预":"預","领":"領","颇":"頗","频":"頻","题":"題","颜":"顏","额":"額","风":"風","飘":"飄","飞":"飛","饭":"飯","饮":"飲","饲":"飼","饰":"飾","饱":"飽","饼":"餅","馆":"館","马":"馬","驯":"馴","驰":"馳","驱":"驅","驳":"駁","驴":"驢","驶":"駛","驻":"駐","驾":"駕","骂":"罵","骄":"驕","骆":"駱","验":"驗","骑":"騎","骗":"騙","骚":"騷","鱼":"魚","鲁":"魯","鲜":"鮮","鸟":"鳥","鸡":"雞","鸣":"鳴","鸭":"鴨","鸽":"鴿","麦":"麥","黄":"黃","齐":"齊","齿":"齒","龙":"龍","龟":"龜"};
  function toTraditionalChinese(value){
    var s=String(value==null?'':value);
    Object.keys(TRAD_PHRASES).sort(function(a,b){return b.length-a.length;}).forEach(function(a){if(s.indexOf(a)>-1)s=s.split(a).join(TRAD_PHRASES[a]);});
    return Array.from(s).map(function(ch){return TRAD_CHARS[ch]||ch;}).join('');
  }
  function hydrateCategoryCatalog(items){
    if(!Array.isArray(items))return;
    items.forEach(function(item){
      var vi=clean(item&&(item.name_vi||item.name));if(!vi)return;
      var row=CAT[vi]||{};
      var native=PARENT_CATEGORY_NATIVE[vi]||{};
      row.en=clean(item&&item.name_en)||AUTO_CATEGORY_EN[vi]||row.en||vi;
      row.zh=clean(item&&item.name_zh)||native.zh||row.zh||row.en;
      row.th=clean(item&&item.name_th)||native.th||row.th||row.en;
      row.ru=clean(item&&item.name_ru)||native.ru||row.ru||row.en;
      row.ja=clean(item&&item.name_ja)||native.ja||row.ja||row.en;
      row.ko=clean(item&&item.name_ko)||native.ko||row.ko||row.en;
      row.zht=clean(item&&item.name_zht)||toTraditionalChinese(row.zh||row.en);
      CAT[vi]=row;
    });
  }
  /* Parent fallback is available before categoryCatalog returns. */
  Object.keys(PARENT_CATEGORY_NATIVE).forEach(function(vi){
    var row=CAT[vi]||{},n=PARENT_CATEGORY_NATIVE[vi],en=AUTO_CATEGORY_EN[vi]||vi;
    row.en=row.en||en;row.zh=row.zh||n.zh;row.th=row.th||n.th;row.ru=row.ru||n.ru;row.ja=row.ja||n.ja;row.ko=row.ko||n.ko;row.zht=row.zht||toTraditionalChinese(row.zh||en);CAT[vi]=row;
  });
  Object.keys(AUTO_CATEGORY_EN).forEach(function(vi){if(!CAT[vi])CAT[vi]={en:AUTO_CATEGORY_EN[vi]};else if(!CAT[vi].en)CAT[vi].en=AUTO_CATEGORY_EN[vi];});
  var COMMON_CATEGORY_NATIVE={"Cà phê & trà":{"zh":"咖啡与茶","th":"กาแฟและชา","ru":"Кофе и чай","ja":"コーヒー・お茶","ko":"커피·차"},"Nhà hàng & quán ăn":{"zh":"餐厅与餐馆","th":"ร้านอาหาร","ru":"Рестораны и кафе","ja":"レストラン・飲食店","ko":"식당·맛집"},"Khách sạn":{"zh":"酒店","th":"โรงแรม","ru":"Отели","ja":"ホテル","ko":"호텔"},"Nhà nghỉ & homestay":{"zh":"旅馆与民宿","th":"เกสต์เฮาส์และโฮมสเตย์","ru":"Гостевые дома и хоумстеи","ja":"ゲストハウス・ホームステイ","ko":"게스트하우스·홈스테이"},"Khu nghỉ dưỡng":{"zh":"度假村","th":"รีสอร์ต","ru":"Курорты","ja":"リゾート","ko":"리조트"},"Nhà thuốc":{"zh":"药店","th":"ร้านขายยา","ru":"Аптеки","ja":"薬局","ko":"약국"},"Phòng khám":{"zh":"诊所","th":"คลินิก","ru":"Клиники","ja":"クリニック","ko":"클리닉"},"Bệnh viện":{"zh":"医院","th":"โรงพยาบาล","ru":"Больницы","ja":"病院","ko":"병원"},"Nha khoa":{"zh":"牙科","th":"ทันตกรรม","ru":"Стоматология","ja":"歯科","ko":"치과"},"Salon tóc & cắt tóc":{"zh":"美发沙龙与理发店","th":"ร้านทำผมและตัดผม","ru":"Салоны и парикмахерские","ja":"ヘアサロン・理容室","ko":"헤어살롱·미용실"},"Spa, làm đẹp & chăm sóc da":{"zh":"SPA、美容与护肤","th":"สปา ความงาม และดูแลผิว","ru":"Спа, красота и уход за кожей","ja":"スパ・美容・スキンケア","ko":"스파·뷰티·스킨케어"},"Massage & trị liệu thư giãn":{"zh":"按摩与放松理疗","th":"นวดและบำบัดเพื่อผ่อนคลาย","ru":"Массаж и расслабляющая терапия","ja":"マッサージ・リラクゼーション","ko":"마사지·릴랙스 테라피"},"Siêu thị":{"zh":"超市","th":"ซูเปอร์มาร์เก็ต","ru":"Супермаркеты","ja":"スーパーマーケット","ko":"슈퍼마켓"},"Trung tâm thương mại":{"zh":"购物中心","th":"ศูนย์การค้า","ru":"Торговые центры","ja":"ショッピングモール","ko":"쇼핑몰"},"Cửa hàng tiện lợi & tạp hóa":{"zh":"便利店与杂货店","th":"ร้านสะดวกซื้อและร้านขายของชำ","ru":"Магазины у дома и продукты","ja":"コンビニ・食料品店","ko":"편의점·식료품점"},"Chợ & khu mua bán":{"zh":"市场与购物区","th":"ตลาดและย่านช้อปปิ้ง","ru":"Рынки и торговые зоны","ja":"市場・ショッピングエリア","ko":"시장·쇼핑 구역"},"ATM":{"zh":"ATM","th":"ATM","ru":"Банкоматы","ja":"ATM","ko":"ATM"},"Ngân hàng":{"zh":"银行","th":"ธนาคาร","ru":"Банки","ja":"銀行","ko":"은행"},"Đổi tiền":{"zh":"货币兑换","th":"แลกเงิน","ru":"Обмен валюты","ja":"両替","ko":"환전"},"Bãi đỗ xe":{"zh":"停车场","th":"ที่จอดรถ","ru":"Парковки","ja":"駐車場","ko":"주차장"},"Cho thuê ô tô":{"zh":"租车","th":"เช่ารถยนต์","ru":"Аренда автомобилей","ja":"レンタカー","ko":"자동차 렌트"},"Cho thuê xe máy":{"zh":"摩托车租赁","th":"เช่ามอเตอร์ไซค์","ru":"Аренда мотоциклов","ja":"バイクレンタル","ko":"오토바이 대여"},"Cho thuê xe đạp":{"zh":"自行车租赁","th":"เช่าจักรยาน","ru":"Аренда велосипедов","ja":"自転車レンタル","ko":"자전거 대여"},"Rửa & chăm sóc xe":{"zh":"洗车与汽车护理","th":"ล้างและดูแลรถ","ru":"Мойка и уход за авто","ja":"洗車・カーケア","ko":"세차·차량 관리"},"Sửa chữa ô tô":{"zh":"汽车维修","th":"ซ่อมรถยนต์","ru":"Ремонт автомобилей","ja":"自動車修理","ko":"자동차 수리"},"Sửa chữa xe máy":{"zh":"摩托车维修","th":"ซ่อมมอเตอร์ไซค์","ru":"Ремонт мотоциклов","ja":"バイク修理","ko":"오토바이 수리"},"Trạm sạc xe điện":{"zh":"电动车充电站","th":"สถานีชาร์จรถไฟฟ้า","ru":"Зарядные станции для электромобилей","ja":"EV充電ステーション","ko":"전기차 충전소"},"Trạm xăng dầu":{"zh":"加油站","th":"ปั๊มน้ำมัน","ru":"АЗС","ja":"ガソリンスタンド","ko":"주유소"},"Bảo tàng":{"zh":"博物馆","th":"พิพิธภัณฑ์","ru":"Музеи","ja":"博物館","ko":"박물관"},"Điểm tham quan":{"zh":"旅游景点","th":"สถานที่ท่องเที่ยว","ru":"Достопримечательности","ja":"観光スポット","ko":"관광 명소"},"Điểm ngắm cảnh & check-in":{"zh":"观景与打卡点","th":"จุดชมวิวและเช็กอิน","ru":"Смотровые и фото-точки","ja":"景勝・チェックインスポット","ko":"전망·체크인 명소"},"Rạp chiếu phim":{"zh":"电影院","th":"โรงภาพยนตร์","ru":"Кинотеатры","ja":"映画館","ko":"영화관"},"Karaoke":{"zh":"卡拉OK","th":"คาราโอเกะ","ru":"Караоке","ja":"カラオケ","ko":"노래방"},"Vườn thú":{"zh":"动物园","th":"สวนสัตว์","ru":"Зоопарки","ja":"動物園","ko":"동물원"},"Thủy cung":{"zh":"水族馆","th":"พิพิธภัณฑ์สัตว์น้ำ","ru":"Океанариумы","ja":"水族館","ko":"아쿠아리움"},"Công viên":{"zh":"公园","th":"สวนสาธารณะ","ru":"Парки","ja":"公園","ko":"공원"},"Bãi biển":{"zh":"海滩","th":"ชายหาด","ru":"Пляжи","ja":"ビーチ","ko":"해변"},"Thác nước":{"zh":"瀑布","th":"น้ำตก","ru":"Водопады","ja":"滝","ko":"폭포"},"Hang động":{"zh":"洞穴","th":"ถ้ำ","ru":"Пещеры","ja":"洞窟","ko":"동굴"},"Khu bảo tồn thiên nhiên":{"zh":"自然保护区","th":"เขตอนุรักษ์ธรรมชาติ","ru":"Природные заповедники","ja":"自然保護区","ko":"자연보호구역"},"Núi, đỉnh & đèo":{"zh":"山、山峰与山口","th":"ภูเขา ยอดเขา และช่องเขา","ru":"Горы, вершины и перевалы","ja":"山・山頂・峠","ko":"산·봉우리·고개"},"Phòng gym & fitness":{"zh":"健身房与健身","th":"ยิมและฟิตเนส","ru":"Тренажёрные залы и фитнес","ja":"ジム・フィットネス","ko":"헬스장·피트니스"},"Pickleball":{"zh":"匹克球","th":"พิกเคิลบอล","ru":"Пиклбол","ja":"ピックルボール","ko":"피클볼"},"Bể bơi":{"zh":"游泳池","th":"สระว่ายน้ำ","ru":"Бассейны","ja":"プール","ko":"수영장"},"Sân golf":{"zh":"高尔夫球场","th":"สนามกอล์ฟ","ru":"Поля для гольфа","ja":"ゴルフ場","ko":"골프장"},"Sân vận động":{"zh":"体育场","th":"สนามกีฬา","ru":"Стадионы","ja":"スタジアム","ko":"경기장"},"Sân bay & sân bay nhỏ":{"zh":"机场与小型机场","th":"สนามบินและสนามบินขนาดเล็ก","ru":"Аэропорты и аэродромы","ja":"空港・小規模飛行場","ko":"공항·소형 비행장"},"Nhà ga sân bay":{"zh":"机场航站楼","th":"อาคารผู้โดยสารสนามบิน","ru":"Аэропортовые терминалы","ja":"空港ターミナル","ko":"공항 터미널"},"Bến xe khách":{"zh":"客运站","th":"สถานีขนส่งผู้โดยสาร","ru":"Автовокзалы","ja":"バスターミナル","ko":"버스터미널"},"Ga đường sắt":{"zh":"火车站","th":"สถานีรถไฟ","ru":"Железнодорожные вокзалы","ja":"鉄道駅","ko":"기차역"},"Điểm dừng xe buýt":{"zh":"公交车站","th":"ป้ายรถเมล์","ru":"Автобусные остановки","ja":"バス停","ko":"버스 정류장"},"Điểm taxi":{"zh":"出租车站","th":"จุดแท็กซี่","ru":"Стоянки такси","ja":"タクシー乗り場","ko":"택시 승강장"},"Đại sứ quán & lãnh sự quán":{"zh":"大使馆与领事馆","th":"สถานทูตและสถานกงสุล","ru":"Посольства и консульства","ja":"大使館・領事館","ko":"대사관·영사관"},"Công an & cảnh sát":{"zh":"公安与警察","th":"ตำรวจ","ru":"Полиция","ja":"警察","ko":"경찰"},"Cứu hỏa":{"zh":"消防站","th":"สถานีดับเพลิง","ru":"Пожарные части","ja":"消防署","ko":"소방서"},"Bưu điện":{"zh":"邮局","th":"ที่ทำการไปรษณีย์","ru":"Почтовые отделения","ja":"郵便局","ko":"우체국"},"Nhà vệ sinh công cộng":{"zh":"公共厕所","th":"ห้องน้ำสาธารณะ","ru":"Общественные туалеты","ja":"公衆トイレ","ko":"공중화장실"},"Điểm nước uống công cộng":{"zh":"公共饮水点","th":"จุดน้ำดื่มสาธารณะ","ru":"Пункты питьевой воды","ja":"公共給水スポット","ko":"공공 음수대"}};
  Object.keys(COMMON_CATEGORY_NATIVE).forEach(function(vi){var row=CAT[vi]||{},n=COMMON_CATEGORY_NATIVE[vi],en=AUTO_CATEGORY_EN[vi]||row.en||vi;row.en=row.en||en;row.zh=n.zh;row.th=n.th;row.ru=n.ru;row.ja=n.ja;row.ko=n.ko;row.zht=toTraditionalChinese(n.zh);CAT[vi]=row;});



  var originalText=new WeakMap();
  var originalAttrs=new WeakMap();
  var currentLang='vi';
  var observer=null;
  var clockUpdating=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function validLang(v){v=String(v||'').toLowerCase().replace(/_/g,'-');if(v==='zht'||v.indexOf('zh-tw')===0||v.indexOf('zh-hk')===0||v.indexOf('zh-mo')===0||v.indexOf('zh-hant')===0)return'zht';if(v.indexOf('zh')===0)return'zh';if(v.indexOf('th')===0)return'th';if(v.indexOf('vi')===0)return'vi';if(v.indexOf('en')===0)return'en';if(v.indexOf('ru')===0)return'ru';if(v.indexOf('ja')===0)return'ja';if(v.indexOf('ko')===0)return'ko';return'';}
  function readSavedLocation(){try{var p=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');return p&&typeof p==='object'?p:null;}catch(e){return null;}}
  function autoLang(){
    /* Khách du lịch: ưu tiên ngôn ngữ thiết bị trước vị trí vật lý. */
    var langs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en']);
    for(var i=0;i<langs.length;i++){var l=validLang(langs[i]);if(l)return l;}
    var loc=readSavedLocation();
    var cc=clean(loc&&loc.countryCode).toUpperCase();
    if(COUNTRY_LANG[cc])return COUNTRY_LANG[cc];
    /* Quốc gia/ngôn ngữ ngoài 8 gói hỗ trợ: mặc định English. */
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
  function trCategory(v,lang){v=clean(v);if(lang==='vi'||!v)return v;var x=CAT[v]||{};if(lang==='zht')return x.zht||toTraditionalChinese(x.zh||x.en||AUTO_CATEGORY_EN[v]||v);return x[lang]||x.en||AUTO_CATEGORY_EN[v]||v;}
  function exact(v,lang){if(lang==='vi')return v;var x=UI[v];if(lang==='zht'){if(x&&x.zht)return x.zht;if(x&&x.zh)return toTraditionalChinese(x.zh);return null;}return x&&x[lang]?x[lang]:null;}


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
    if(lang==='zht')return toTraditionalChinese(dynamic(v,'zh'));
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
    if((m=v.match(/^(\d+) địa điểm$/))){return lang==='en'?m[1]+' places':lang==='zh'?m[1]+' 个地点':lang==='ru'?m[1]+' мест':lang==='ja'?m[1]+'件':lang==='ko'?m[1]+'곳':m[1]+' สถานที่';}
    if((m=v.match(/^(\d+) danh mục con$/))){return lang==='en'?m[1]+' subcategories':lang==='zh'?m[1]+' 个子类别':lang==='ru'?m[1]+' подкатегорий':lang==='ja'?m[1]+' サブカテゴリー':lang==='ko'?m[1]+'개 하위 카테고리':m[1]+' หมวดย่อย';}
    if((m=v.match(/^(\d+) nhóm chính · (\d+) danh mục con$/))){return lang==='en'?m[1]+' main groups · '+m[2]+' subcategories':lang==='zh'?m[1]+' 个主分类 · '+m[2]+' 个子类别':lang==='ru'?m[1]+' основных групп · '+m[2]+' подкатегорий':lang==='ja'?m[1]+' 主要グループ · '+m[2]+' サブカテゴリー':lang==='ko'?m[1]+'개 주요 그룹 · '+m[2]+'개 하위 카테고리':m[1]+' หมวดหลัก · '+m[2]+' หมวดย่อย';}
    if((m=v.match(/^(\d+) nhóm phù hợp với “(.+)”$/))){return lang==='en'?m[1]+' groups matching “'+m[2]+'”':lang==='zh'?m[1]+' 个分类匹配“'+m[2]+'”':lang==='ru'?m[1]+' групп по запросу «'+m[2]+'»':lang==='ja'?m[1]+' グループが「'+m[2]+'」に一致':lang==='ko'?m[1]+'개 그룹이 “'+m[2]+'”와 일치':m[1]+' หมวดที่ตรงกับ “'+m[2]+'”';}
    if((m=v.match(/^TOP khu vực (.+)$/))){return lang==='en'?'TOP in '+m[1]:lang==='zh'?m[1]+' 地区TOP':lang==='ru'?'TOP в '+m[1]:lang==='ja'?m[1]+' のTOP':lang==='ko'?m[1]+' 지역 TOP':'TOP ใน '+m[1];}
    if((m=v.match(/^TOP của (.+)$/))){return lang==='en'?'TOP of '+m[1]:lang==='zh'?m[1]+' TOP':lang==='ru'?'TOP '+m[1]:lang==='ja'?m[1]+' のTOP':lang==='ko'?m[1]+' TOP':'TOP ของ '+m[1];}
    if((m=v.match(/^Cách (.+)$/))){return lang==='en'?'Distance '+m[1]:lang==='zh'?'距离 '+m[1]:lang==='ru'?'Расстояние '+m[1]:lang==='ja'?'距離 '+m[1]:lang==='ko'?'거리 '+m[1]:'ระยะ '+m[1];}
    if((m=v.match(/^Đang tìm các địa điểm có “(.+)” trong tên\.$/))){return lang==='en'?'Finding places with “'+m[1]+'” in the name.':lang==='zh'?'正在查找名称中包含“'+m[1]+'”的地点。':lang==='ru'?'Ищем места, в названии которых есть «'+m[1]+'».':lang==='ja'?'名前に「'+m[1]+'」を含む場所を検索中。':lang==='ko'?'이름에 “'+m[1]+'”가 포함된 장소를 찾는 중입니다.':'กำลังค้นหาสถานที่ที่มี “'+m[1]+'” ในชื่อ';}
    return v;
  }

  function isScope(node){
    var el=node&&node.nodeType===1?node:node&&node.parentElement;
    if(!el||!el.closest)return false;
    if(el.closest('[data-tl-i18n-ignore="1"],#tlLangSwitcher,.tl-lang-switcher'))return false;
    return !!el.closest('.tl-site-header,.tl-lang-simple-wrap,.tl-home-shell,.tl-static-footer,#tlProposeFab,.tl-mobile-dock,.tl-mobile-menu-layer,.tl-search-suggest,.vlc-local-guide,.vlc-modal,.tl-category-hub,.tl-global-search-places,.tl-place-search-modal,.tl-home-top-places,.tl-location-consent,.tl-allcats-v24,.tl-ac-hero,.tl-ac-toolbar,.tl-ac-grid');
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

    /* V17.95.2: safety-net for homepage hero headline. */
    var heroTitle=document.querySelector('.tl-home-hero-v24 h2');
    if(heroTitle){
      heroTitle.textContent=dynamic('Tìm đúng nơi bạn cần, ngay quanh mình.',currentLang);
    }

    updateLangBlocks();updateClock();
    setTimeout(function(){
      scan(document);
      var heroTitle2=document.querySelector('.tl-home-hero-v24 h2');
      if(heroTitle2)heroTitle2.textContent=dynamic('Tìm đúng nơi bạn cần, ngay quanh mình.',currentLang);
      updateLangBlocks();updateClock();
    },40);
  }

  var nativeConfirm=window.confirm?window.confirm.bind(window):null;
  if(nativeConfirm)window.confirm=function(msg){return nativeConfirm(dynamic(String(msg||''),currentLang));};
  var nativeAlert=window.alert?window.alert.bind(window):null;
  if(nativeAlert)window.alert=function(msg){return nativeAlert(dynamic(String(msg||''),currentLang));};

  try{var cachedI18nCatalog=JSON.parse(localStorage.getItem('tl_category_catalog_v4')||'[]');if(Array.isArray(cachedI18nCatalog))hydrateCategoryCatalog(cachedI18nCatalog);}catch(e){}
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

  function refreshI18nCatalog(){
    var api=window.TL_GUIDE_API_URL||window.TL_DATA_API_URL||'';if(!api)return;
    var cb='TL_I18N_CAT_'+Date.now()+'_'+Math.floor(Math.random()*100000),s=document.createElement('script'),done=false,timer=0;
    function finish(){if(done)return;done=true;if(timer)clearTimeout(timer);try{delete window[cb];}catch(e){}if(s.parentNode)s.parentNode.removeChild(s);}
    window[cb]=function(data){if(data&&data.ok&&Array.isArray(data.categories)){hydrateCategoryCatalog(data.categories);try{localStorage.setItem('tl_category_catalog_v4',JSON.stringify(data.categories));}catch(e){}scan(document);if(typeof window.TL_CATEGORY_HUB_REFRESH==='function')try{window.TL_CATEGORY_HUB_REFRESH();}catch(e){}}finish();};
    s.onerror=finish;s.src=api+'?action=categoryCatalog&callback='+encodeURIComponent(cb)+'&_v=17.95';document.head.appendChild(s);timer=setTimeout(finish,12000);
  }
  setTimeout(refreshI18nCatalog,0);

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
    toTraditional:function(text){return toTraditionalChinese(text);},
    hydrateCategories:function(items){hydrateCategoryCatalog(items);scan(document);},
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
    allChildren:{vi:'Tất cả danh mục con',en:'All subcategories',zh:'全部子类别',th:'หมวดย่อยทั้งหมด',ru:'Все подкатегории',ja:'すべてのサブカテゴリー',ko:'모든 하위 카테고리'},
    viewAll:{vi:'Xem tất cả',en:'View all',zh:'查看全部',th:'ดูทั้งหมด',ru:'Показать все',ja:'すべて見る',ko:'모두 보기'},
    findChild:{vi:'Tìm danh mục con...',en:'Find a subcategory...',zh:'搜索子类别...',th:'ค้นหาหมวดย่อย...',ru:'Найти подкатегорию...',ja:'サブカテゴリーを検索...',ko:'하위 카테고리 검색...'},
    closePicker:{vi:'Đóng',en:'Close',zh:'关闭',th:'ปิด',ru:'Закрыть',ja:'閉じる',ko:'닫기'},
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
    pickerOpen:false,
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
    if(h==='zht'||h.indexOf('zh-tw')===0||h.indexOf('zh-hk')===0||h.indexOf('zh-hant')===0)return'zht';if(h.indexOf('zh')===0)return'zh';if(h.indexOf('th')===0)return'th';
    if(h.indexOf('ru')===0)return'ru';if(h.indexOf('ja')===0)return'ja';
    if(h.indexOf('ko')===0)return'ko';if(h.indexOf('en')===0)return'en';return'vi';
  }
  function tr(k){var o=TXT[k]||{},l=lang();if(l==='zht'){var z=o.zht||o.zh||o.vi||k;try{return window.TL_I18N&&window.TL_I18N.toTraditional?window.TL_I18N.toTraditional(z):z;}catch(e){return z;}}return o[l]||o.vi||k;}
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
    var dest=(clean(p&&p.lat)!==''&&clean(p&&p.lng)!==''&&isFinite(Number(p.lat))&&isFinite(Number(p.lng)))?Number(p.lat)+','+Number(p.lng):(clean(p.address)||clean(p.name));
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
    if(/[,;|+]/.test(rawScope)){
      var scopeParts=rawScope.split(/[,;|+]+/).map(function(x){return norm(x).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')});
      if(scopeParts.some(function(x){return ['global','data','this_local','thislocal','top_this_local'].indexOf(x)>-1}))scope='this_local';
      else if(scopeParts.some(function(x){return ['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'].indexOf(x)>-1}))scope='locality';
      else if(scopeParts.some(function(x){return ['radius','ban_kinh','khoang_cach','distance'].indexOf(x)>-1}))scope='radius';
    }
    var radius=Number(p&&p.top_radius_km),area=clean(p&&p.top_locality||p&&p.locality||p&&p.province);
    var globals=['global','data','this_local','thislocal','top_this_local','toan_data','toan_this_local','top_toan_data','top_toan_data_this_local','toan_data_this_local'];
    var locals=['local','locality','dia_phuong','khu_vuc','area','province','tinh','tinh_thanh'];
    var radii=['radius','ban_kinh','khoang_cach','distance'];
    var kind='global';
    if(scope){
      if(globals.indexOf(scope)>-1)kind='global';
      else if(radii.indexOf(scope)>-1)kind='radius';
      else if(locals.indexOf(scope)>-1)kind='local';
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
      if(!isFinite(km)&&pos&&clean(pos.lat)!==''&&clean(pos.lng)!==''&&clean(p&&p.lat)!==''&&clean(p&&p.lng)!==''&&isFinite(Number(pos.lat))&&isFinite(Number(pos.lng))&&isFinite(Number(p.lat))&&isFinite(Number(p.lng))){
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
  function ensureChipRow(){
    var e=els();if(!e.chips)return null;
    var row=e.chips.parentNode;
    if(row&&row.classList&&row.classList.contains('tl-hub-chips-row')){
      row.__tlMoreSlot=row.querySelector('.tl-hub-more-slot');
      return row;
    }
    var parent=e.chips.parentNode;if(!parent)return null;
    row=document.createElement('div');row.className='tl-hub-chips-row';
    parent.insertBefore(row,e.chips);row.appendChild(e.chips);
    var slot=document.createElement('div');slot.className='tl-hub-more-slot';row.appendChild(slot);
    row.__tlMoreSlot=slot;
    return row;
  }

  function ensureChildPicker(){
    var e=els();if(!e.hub||!e.chips)return null;
    var row=ensureChipRow();if(!row)return null;
    var panel=e.hub.querySelector('.tl-hub-child-picker');
    if(panel)return panel;

    panel=document.createElement('div');panel.className='tl-hub-child-picker';panel.hidden=true;

    var head=document.createElement('div');head.className='tl-hub-child-picker-head';
    var title=document.createElement('strong');title.className='tl-hub-child-picker-title';title.textContent=tr('allChildren');
    var close=document.createElement('button');close.type='button';close.className='tl-hub-child-picker-close';close.textContent=tr('closePicker');
    head.appendChild(title);head.appendChild(close);

    var searchWrap=document.createElement('div');searchWrap.className='tl-hub-child-picker-search-wrap';
    var search=document.createElement('input');search.type='search';search.className='tl-hub-child-picker-search';search.autocomplete='off';search.placeholder=tr('findChild');
    searchWrap.appendChild(search);

    var grid=document.createElement('div');grid.className='tl-hub-child-picker-grid';
    var empty=document.createElement('div');empty.className='tl-hub-child-picker-empty';empty.hidden=true;empty.textContent=tr('noPlace');

    panel.appendChild(head);panel.appendChild(searchWrap);panel.appendChild(grid);panel.appendChild(empty);
    row.parentNode.insertBefore(panel,row.nextSibling);

    function filterPicker(){
      var q=norm(search.value),visible=0;
      Array.prototype.forEach.call(grid.querySelectorAll('.tl-hub-child-option'),function(btn){
        var ok=!q||norm(btn.getAttribute('data-category-name')||btn.textContent).indexOf(q)>-1;
        btn.hidden=!ok;if(ok)visible++;
      });
      empty.hidden=visible!==0;
    }
    search.addEventListener('input',filterPicker);
    close.addEventListener('click',function(){state.pickerOpen=false;panel.hidden=true;});
    panel.__tlSearch=search;panel.__tlGrid=grid;panel.__tlEmpty=empty;panel.__tlTitle=title;panel.__tlClose=close;
    return panel;
  }

  function renderChildPicker(){
    var panel=ensureChildPicker();if(!panel)return;
    panel.hidden=!state.pickerOpen;
    if(panel.__tlTitle)panel.__tlTitle.textContent=tr('allChildren')+' ('+state.subs.length+')';
    if(panel.__tlClose)panel.__tlClose.textContent=tr('closePicker');
    if(panel.__tlSearch)panel.__tlSearch.placeholder=tr('findChild');
    var grid=panel.__tlGrid;if(!grid)return;grid.innerHTML='';

    state.subs.slice().sort(function(a,b){return a.name.localeCompare(b.name,'vi');}).forEach(function(sub){
      var b=document.createElement('button');b.type='button';
      b.className='tl-hub-child-option'+(state.active===sub.name?' is-active':'');
      b.setAttribute('data-category-name',sub.name);
      var label=document.createElement('span');label.className='tl-hub-child-option-name';label.textContent=i18n(sub.name);b.appendChild(label);
      var count=document.createElement('small');count.className='tl-hub-child-option-count';count.textContent=String(sub.placeCount||0)+' '+tr('places');b.appendChild(count);
      b.addEventListener('click',function(){
        addClick(sub.name);state.active=sub.name;state.visibleLimit=hubBatchSize();state.pickerOpen=false;
        if(state.broad)syncHubCategoryUrl(sub.name);
        renderChips();renderPlaces();
        try{els().chips.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){}
      });
      grid.appendChild(b);
    });
    if(panel.__tlSearch){panel.__tlSearch.value='';panel.__tlSearch.dispatchEvent(new Event('input'));}
  }

  function renderChips(){
    var e=els();if(!e.chips)return;syncProposalContext();
    var chipRow=ensureChipRow(),moreSlot=chipRow&&chipRow.__tlMoreSlot;
    e.chips.innerHTML='';if(moreSlot)moreSlot.innerHTML='';
    var all=document.createElement('button');all.type='button';
    all.className='tl-category-hub-chip'+(!state.active?' is-active':'');
    all.textContent=tr('all');
    all.addEventListener('click',function(){state.active='';state.visibleLimit=hubBatchSize();state.pickerOpen=false;syncHubCategoryUrl('');renderChips();renderPlaces();});
    e.chips.appendChild(all);

    var ranked=rankedSubs(),top=ranked[0]||null;
    var visible=ranked.slice(0,MAX_SUGGEST);
    if(state.active&&!visible.some(function(x){return x.name===state.active;})){
      var activeSub=ranked.find(function(x){return x.name===state.active;});
      if(activeSub)visible.push(activeSub);
    }

    visible.forEach(function(sub){
      var b=document.createElement('button');b.type='button';
      b.className='tl-category-hub-chip'+(state.active===sub.name?' is-active':'');
      var name=document.createElement('span');name.textContent=i18n(sub.name);b.appendChild(name);
      if(top&&sub.name===top.name&&((sub.placeCount||0)>0||clickCount(sub.name)>0)){
        var badge=document.createElement('span');badge.className='tl-hub-badge';badge.textContent=tr('suggest');b.appendChild(badge);
      }
      b.addEventListener('click',function(){
        addClick(sub.name);state.active=sub.name;state.visibleLimit=hubBatchSize();state.pickerOpen=false;
        if(state.broad)syncHubCategoryUrl(sub.name);
        renderChips();renderPlaces();
      });
      e.chips.appendChild(b);
    });

    if(state.broad&&ranked.length){
      var more=document.createElement('button');more.type='button';
      more.className='tl-category-hub-chip tl-category-hub-more'+(state.pickerOpen?' is-open':'');
      more.setAttribute('aria-expanded',state.pickerOpen?'true':'false');
      more.setAttribute('aria-label',tr('viewAll'));
      more.textContent=tr('viewAll')+' '+(state.pickerOpen?'▴':'▾');
      more.addEventListener('click',function(){state.pickerOpen=!state.pickerOpen;renderChips();if(state.pickerOpen){var p=ensureChildPicker();if(p&&p.__tlSearch)setTimeout(function(){try{p.__tlSearch.focus();}catch(e){}},0);}});
      (moreSlot||e.chips).appendChild(more);
    }else state.pickerOpen=false;

    renderChildPicker();
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
      var cat=document.createElement('div');cat.className='tl-hub-place-cat';cat.textContent=i18n(p._category||state.label);card.appendChild(cat);
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
    var box=document.getElementById('tlLocationConsent'),btn=document.getElementById('tlLocationConsentButton'),closeBtn=document.getElementById('tlLocationConsentClose'),title=document.getElementById('tlLocationConsentTitle'),txt=document.getElementById('tlLocationConsentText');
    if(!box||!btn)return;
    var DISMISS_KEY='tl_location_notice_dismissed_v2';
    var requesting=false;
    function isDismissed(){try{return sessionStorage.getItem(DISMISS_KEY)==='1';}catch(e){return false;}}
    function setDismissed(v){try{if(v)sessionStorage.setItem(DISMISS_KEY,'1');else sessionStorage.removeItem(DISMISS_KEY);}catch(e){}}
    function setOpen(open){box.hidden=!open;document.documentElement.classList.toggle('tl-location-notice-open',!!open);}
    function setNotice(state,heading,message,buttonText,force){
      box.setAttribute('data-state',state||'idle');
      if(title)title.textContent=heading||'Dùng vị trí gần bạn';
      if(txt)txt.textContent=message||'Cho phép vị trí để THIS LOCAL ưu tiên các địa điểm phù hợp quanh bạn.';
      btn.hidden=false;btn.disabled=state==='requesting';btn.textContent=buttonText||(state==='requesting'?'Đang lấy...':'Cho phép');
      if(force||!isDismissed())setOpen(true);else setOpen(false);
    }
    function clearStaleLocation(){
      try{localStorage.removeItem(LOCATION_KEY);}catch(e){}
      var h=document.getElementById('tlHeaderLocality');if(h)h.textContent='Chưa bật vị trí';
      var s=document.getElementById('tlLocationStatus');if(s){s.textContent='Vị trí giúp THIS LOCAL ưu tiên địa điểm gần bạn.';s.classList.remove('is-active','is-warning');}
    }
    function enrichLocation(p,pos){
      if(!p||!pos||!pos.coords||typeof window.TL_REVERSE_CURRENT_LOCALITY!=='function')return;
      window.TL_REVERSE_CURRENT_LOCALITY(pos,function(meta){
        if(!meta)return;
        p.locality=meta.locality||'';p.region=meta.region||'';p.countryCode=meta.countryCode||'';p.countryName=meta.countryName||'';p.currency=meta.currency||p.currency||'';p.savedAt=Date.now();
        try{localStorage.setItem(LOCATION_KEY,JSON.stringify(p));}catch(e){}
        try{document.dispatchEvent(new CustomEvent('tl:locationchange',{detail:p}));}catch(e){}
      });
    }
    function storePosition(pos){var p=saveLocation(pos);if(p)enrichLocation(p,pos);return p;}
    function requestLocation(manual){
      if(requesting)return;
      if(!navigator.geolocation){
        setNotice('unsupported','Không dùng được vị trí','Trình duyệt hoặc thiết bị này không hỗ trợ xác định vị trí.','Đóng',true);btn.onclick=function(){setDismissed(true);setOpen(false);};return;
      }
      requesting=true;
      if(manual)setDismissed(false);
      if(manual)setNotice('requesting','Đang xác định vị trí','THIS LOCAL đang lấy vị trí hiện tại của bạn.','Đang lấy...',true);else setOpen(false);
      navigator.geolocation.getCurrentPosition(function(pos){
        requesting=false;btn.disabled=false;btn.textContent='Cho phép';btn.onclick=null;
        if(storePosition(pos)){setDismissed(false);setOpen(false);}
      },function(err){
        requesting=false;btn.disabled=false;btn.onclick=null;
        if(err&&err.code===1){
          clearStaleLocation();
          setNotice('denied','Quyền vị trí đang bị chặn','Bật quyền Vị trí cho '+(location.hostname||'thislocal.net')+' trong cài đặt trình duyệt, sau đó bấm Thử lại.','Thử lại',true);
        }else{
          setNotice('error','Chưa lấy được vị trí','Hãy kiểm tra GPS/kết nối mạng rồi bấm Thử lại.','Thử lại',!!manual);
        }
      },{enableHighAccuracy:true,timeout:15000,maximumAge:manual?0:120000});
    }
    function handlePermission(state){
      if(state==='granted'){setOpen(false);requestLocation(false);return;}
      if(state==='denied'){
        clearStaleLocation();
        setNotice('denied','Quyền vị trí đang bị chặn','Bật quyền Vị trí cho '+(location.hostname||'thislocal.net')+' trong cài đặt trình duyệt, sau đó bấm Thử lại.','Thử lại',false);
        return;
      }
      /* state=prompt: chủ động gọi Geolocation để trình duyệt hiện hộp xin quyền trên cả PC và mobile. */
      requestLocation(false);
    }
    btn.addEventListener('click',function(){requestLocation(true);});
    if(closeBtn)closeBtn.addEventListener('click',function(){setDismissed(true);setOpen(false);});
    document.addEventListener('tl:locationchange',function(){setDismissed(false);setOpen(false);});

    if(!navigator.geolocation){
      setNotice('unsupported','Không dùng được vị trí','Trình duyệt hoặc thiết bị này không hỗ trợ xác định vị trí.','Đóng',false);
      return;
    }
    if(navigator.permissions&&typeof navigator.permissions.query==='function'){
      navigator.permissions.query({name:'geolocation'}).then(function(permission){
        handlePermission(permission.state);
        permission.onchange=function(){handlePermission(permission.state);};
      }).catch(function(){
        var cached=savedLocation();
        if(cached&&cached.savedAt&&Date.now()-Number(cached.savedAt)<600000){setOpen(false);return;}
        requestLocation(false);
      });
    }else{
      /* Safari/thiết bị không có Permissions API: tránh hỏi lặp nếu vừa có vị trí trong 10 phút. */
      var cached=savedLocation();
      if(cached&&cached.savedAt&&Date.now()-Number(cached.savedAt)<600000)setOpen(false);else requestLocation(false);
    }
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

/* THIS LOCAL V18.09: enable installable PWA on the custom domain. */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)||!/(^|\.)thislocal\.net$/i.test(location.hostname))return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(error){
      if(window.console&&console.warn)console.warn('THIS LOCAL service worker:',error);
    });
  });
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
