/* THIS LOCAL Next v18.11
 * 7 modules: context discovery, natural-language search, itinerary,
 * trust/freshness, owner claims, area following, PWA + structured data.
 * The module is additive and fails closed: the existing v17.96 engine remains
 * the source of truth when an optional API action has not been deployed yet.
 */
(function () {
  'use strict';

  if (window.__TL_NEXT_V1810__) return;
  window.__TL_NEXT_V1810__ = true;

  var VERSION = '18.11';
  var API = String(window.TL_DATA_API_URL || window.TL_GUIDE_API_URL || '').trim();
  var LOCATION_KEY = 'tl_user_location_v1';
  var WEATHER_KEY = 'tl_weather_cache_v1';
  var ITINERARY_KEY = 'tl_next_itinerary_v1';
  var FOLLOW_KEY = 'tl_next_followed_areas_v1';
  var DEVICE_KEY = 'tl_next_device_key_v1';
  var DISMISSED_KEY = 'tl_next_discovery_dismissed_v1';
  var STATE = { catalog: [], places: [], context: null, query: '', busy: false };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function clean(value) {
    return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
  }

  function norm(value) {
    var text = clean(value).toLowerCase();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return text.replace(/đ/g, 'd');
  }

  function truthy(value) {
    if (value === true || value === 1) return true;
    return ['true', '1', 'yes', 'y', 'co', 'checked', 'verified', 'trusted'].indexOf(norm(value)) > -1;
  }

  function number(value) {
    var result = Number(value);
    return isFinite(result) ? result : null;
  }

  function readJSON(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function button(className, text, action) {
    var node = el('button', className, text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }

  function safeUrl(value) {
    var raw = clean(value);
    if (!raw) return '';
    try {
      var url = new URL(raw, location.href);
      return /^(https?:|tel:|mailto:)$/.test(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }

  function injectStyle() {
    if (document.getElementById('tlNextStyle')) return;
    var style = document.createElement('style');
    style.id = 'tlNextStyle';
    style.textContent = [
      '.tlx-shell{margin:22px 0 30px;padding:24px;border:1px solid rgba(15,23,42,.09);border-radius:24px;background:linear-gradient(145deg,#fff 0%,#f7fbf8 100%);box-shadow:0 12px 34px rgba(15,23,42,.07);color:#17201b}',
      '.tlx-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.tlx-kicker{display:block;margin-bottom:6px;color:#25734b;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.tlx-head h2{margin:0;font-size:clamp(22px,3vw,32px);line-height:1.15}.tlx-head p{max-width:680px;margin:8px 0 0;color:#5c6861;line-height:1.55}',
      '.tlx-context{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.tlx-chip,.tlx-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 10px;background:#eaf6ee;color:#236943;font-size:12px;font-weight:750}.tlx-chip.is-muted{background:#f0f2f1;color:#5c6861}',
      '.tlx-ask{display:grid;grid-template-columns:1fr auto;gap:10px;margin:16px 0}.tlx-ask input{min-width:0;border:1px solid #cfd8d2;border-radius:14px;padding:13px 15px;background:#fff;color:#17201b;font:inherit;outline:none}.tlx-ask input:focus{border-color:#2f8b58;box-shadow:0 0 0 3px rgba(47,139,88,.13)}',
      '.tlx-btn{border:0;border-radius:14px;padding:11px 15px;background:#216c43;color:#fff;font:inherit;font-weight:750;cursor:pointer}.tlx-btn:hover{background:#185535}.tlx-btn:disabled{cursor:wait;opacity:.65}.tlx-btn.is-soft{background:#eaf6ee;color:#236943}.tlx-btn.is-plain{background:#f2f4f3;color:#36423b}.tlx-btn.is-danger{background:#fff0f0;color:#a23131}',
      '.tlx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 14px}.tlx-status{color:#5c6861;font-size:14px}.tlx-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '.tlx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.tlx-card{display:flex;flex-direction:column;min-width:0;padding:16px;border:1px solid #dde4df;border-radius:18px;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.04)}.tlx-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.tlx-card h3{margin:11px 0 5px;font-size:18px;line-height:1.3}.tlx-card-address{min-height:40px;color:#667169;font-size:13px;line-height:1.5}.tlx-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin:11px 0}.tlx-badge{padding:4px 8px;font-size:11px}.tlx-badge.is-gold{background:#fff4d6;color:#805d00}.tlx-badge.is-gray{background:#eff2f0;color:#59645d}.tlx-card-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto;padding-top:9px}.tlx-card-actions .tlx-btn{padding:8px 10px;border-radius:10px;font-size:12px}',
      '.tlx-empty{grid-column:1/-1;padding:24px;border:1px dashed #cbd5cf;border-radius:16px;color:#647068;text-align:center}.tlx-itinerary{display:none;margin-top:14px;padding:16px;border-radius:16px;background:#eef8f1}.tlx-itinerary.is-open{display:block}.tlx-itinerary h3{margin:0 0 9px}.tlx-itinerary ol{margin:0 0 12px;padding-left:22px}.tlx-itinerary li{margin:7px 0}.tlx-itinerary-row{display:flex;justify-content:space-between;gap:10px}.tlx-link{border:0;background:none;padding:0;color:#216c43;text-decoration:underline;cursor:pointer}',
      '.tlx-follow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tlx-follow input{width:190px;max-width:100%;border:1px solid #cfd8d2;border-radius:11px;padding:9px 11px;font:inherit}.tlx-feed{display:grid;gap:8px;margin-top:12px}.tlx-feed-item{padding:11px 13px;border-radius:12px;background:#f7f9f8}.tlx-feed-item strong{display:block;margin-bottom:3px}.tlx-feed-item small{color:#69736d}',
      '.tlx-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(9,18,13,.6)}.tlx-dialog{position:relative;width:min(620px,100%);max-height:min(820px,92vh);overflow:auto;border-radius:22px;background:#fff;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.26)}.tlx-dialog h2{margin:0 34px 8px 0}.tlx-close{position:absolute;right:15px;top:14px;width:34px;height:34px;border:0;border-radius:50%;background:#eef2ef;font-size:22px;cursor:pointer}.tlx-form{display:grid;gap:12px;margin-top:17px}.tlx-form label{display:grid;gap:5px;font-weight:700;font-size:13px}.tlx-form input,.tlx-form textarea{border:1px solid #cdd6d0;border-radius:11px;padding:11px;font:inherit}.tlx-form textarea{min-height:92px;resize:vertical}.tlx-note{font-size:12px;line-height:1.5;color:#657068}.tlx-toast{position:fixed;z-index:2147483647;right:18px;bottom:18px;max-width:360px;padding:12px 15px;border-radius:13px;background:#17201b;color:#fff;box-shadow:0 12px 35px rgba(0,0,0,.22)}',
      '.tlx-install{display:none}.tlx-install.is-ready{display:inline-flex}',
      '.tlx-restore{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:16px 0 22px;padding:13px 15px;border:1px dashed #b9d2c2;border-radius:15px;background:#f5fbf7;color:#526159}.tlx-restore span{font-size:13px}.tlx-restore .tlx-btn{padding:8px 12px;border-radius:10px;font-size:13px}',
      '@media(max-width:850px){.tlx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tlx-shell{padding:19px}}@media(max-width:560px){.tlx-grid{grid-template-columns:1fr}.tlx-ask{grid-template-columns:1fr}.tlx-head{display:block}.tlx-shell{margin:16px 0 22px;padding:16px;border-radius:19px}.tlx-dialog{padding:20px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function toast(message) {
    var old = document.querySelector('.tlx-toast');
    if (old) old.remove();
    var node = el('div', 'tlx-toast', message);
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
    setTimeout(function () { if (node.parentNode) node.remove(); }, 3600);
  }

  function params(object) {
    var query = [];
    Object.keys(object || {}).forEach(function (key) {
      var value = object[key];
      if (value !== '' && value !== null && value !== undefined) query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return query.join('&');
  }

  function jsonp(action, values, timeout) {
    return new Promise(function (resolve, reject) {
      if (!API) { reject(new Error('missing-api')); return; }
      var callback = 'TLX_CB_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var done = false;
      var timer;
      function finish(error, data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        if (script.parentNode) script.remove();
        if (error) reject(error); else resolve(data || {});
      }
      window[callback] = function (data) { finish(null, data); };
      script.onerror = function () { finish(new Error('network')); };
      var separator = API.indexOf('?') > -1 ? '&' : '?';
      script.src = API + separator + params(Object.assign({ action: action, callback: callback, _tlx: VERSION }, values || {}));
      document.head.appendChild(script);
      timer = setTimeout(function () { finish(new Error('timeout')); }, timeout || 15000);
    });
  }

  function post(action, payload) {
    if (!API || typeof fetch !== 'function') return Promise.reject(new Error('missing-api'));
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    }).then(function (response) {
      if (!response.ok) throw new Error('http-' + response.status);
      return response.json();
    });
  }

  function placeList(data) {
    if (Array.isArray(data)) return data;
    var candidates = [data && data.places, data && data.results, data && data.items, data && data.data];
    for (var i = 0; i < candidates.length; i += 1) if (Array.isArray(candidates[i])) return candidates[i];
    return [];
  }

  function locationValue() {
    var value = readJSON(LOCATION_KEY, null);
    if (!value) return null;
    var lat = number(value.lat), lng = number(value.lng);
    if (lat === null || lng === null) return null;
    return Object.assign({}, value, { lat: lat, lng: lng });
  }

  function weatherValue() {
    var value = readJSON(WEATHER_KEY, null);
    if (!value || typeof value !== 'object') return null;
    return value.data || value.weather || value;
  }

  function weatherKind(weather) {
    var code = number(weather && (weather.weather_code !== undefined ? weather.weather_code : weather.code));
    var text = norm(weather && (weather.description || weather.label || weather.condition));
    if ((code !== null && code >= 51) || /mua|rain|drizzle|storm|thunder/.test(text)) return 'rain';
    if ((code !== null && code <= 3) || /nang|sun|clear|cloud/.test(text)) return 'fair';
    return 'unknown';
  }

  function buildContext() {
    var hour = new Date().getHours();
    var weekend = [0, 6].indexOf(new Date().getDay()) > -1;
    var period = hour < 10 ? 'morning' : (hour < 17 ? 'day' : (hour < 22 ? 'evening' : 'night'));
    var weather = weatherValue();
    var kind = weatherKind(weather);
    var labels = [];
    labels.push(period === 'morning' ? 'Buổi sáng' : period === 'day' ? 'Ban ngày' : period === 'evening' ? 'Buổi tối' : 'Đêm muộn');
    if (weekend) labels.push('Cuối tuần');
    if (kind === 'rain') labels.push('Có thể có mưa');
    if (kind === 'fair') labels.push('Thời tiết thuận lợi');
    var loc = locationValue();
    if (loc) labels.push(clean(loc.locality || loc.region || loc.province) || 'Quanh bạn');
    return { hour: hour, weekend: weekend, period: period, weather: kind, location: loc, labels: labels };
  }

  function contextKeywords(context) {
    if (context.weather === 'rain') return ['cà phê', 'cafe', 'ẩm thực', 'ăn uống', 'mua sắm', 'giải trí', 'làm đẹp'];
    if (context.period === 'morning') return ['ăn sáng', 'cà phê', 'cafe', 'ẩm thực', 'công viên'];
    if (context.period === 'evening') return ['ẩm thực', 'ăn uống', 'giải trí', 'cà phê', 'lưu trú'];
    if (context.weekend) return ['du lịch', 'tham quan', 'thiên nhiên', 'công viên', 'ẩm thực'];
    return ['tiện ích', 'ẩm thực', 'cà phê', 'mua sắm', 'dịch vụ'];
  }

  function catalogName(item) {
    return clean(typeof item === 'string' ? item : item && (item.name || item.category || item.title || item.label));
  }

  function chooseCategory(catalog, context) {
    var keywords = contextKeywords(context);
    for (var k = 0; k < keywords.length; k += 1) {
      for (var i = 0; i < catalog.length; i += 1) {
        var name = catalogName(catalog[i]);
        if (name && norm(name).indexOf(norm(keywords[k])) > -1) return name;
      }
    }
    return '';
  }

  function haversine(a, b, c, d) {
    var radius = 6371, toRad = Math.PI / 180;
    var dLat = (c - a) * toRad, dLng = (d - b) * toRad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toRad) * Math.cos(c * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function placeDistance(place, loc) {
    if (!loc) return null;
    var lat = number(place && place.lat), lng = number(place && place.lng);
    if (lat === null || lng === null) return null;
    return haversine(loc.lat, loc.lng, lat, lng);
  }

  function openState(place) {
    var explicit = norm(place && (place.open_status || place.is_open_now || place.open_now));
    if (['true', '1', 'yes', 'open', 'dang mo cua'].indexOf(explicit) > -1) return 1;
    if (['false', '0', 'no', 'closed', 'dong cua'].indexOf(explicit) > -1) return -1;
    return 0;
  }

  function freshness(place) {
    var raw = clean(place && (place.source_checked_at || place.updated_at || place.verified_at || place.last_checked_at));
    if (!raw) return { score: 0, label: 'Chưa có ngày kiểm tra' };
    var date = new Date(raw);
    if (isNaN(date.getTime())) return { score: 0, label: 'Chưa rõ độ mới' };
    var days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days <= 30) return { score: 12, label: 'Cập nhật ' + (days === 0 ? 'hôm nay' : days + ' ngày trước') };
    if (days <= 180) return { score: 7, label: 'Kiểm tra ' + Math.round(days / 30) + ' tháng trước' };
    if (days <= 365) return { score: 3, label: 'Kiểm tra trong năm qua' };
    return { score: 0, label: 'Nên kiểm tra lại' };
  }

  function trustScore(place) {
    var score = 35;
    if (truthy(place && place.verified)) score += 20;
    if (truthy(place && place.is_trusted)) score += 10;
    if (clean(place && place.address)) score += 7;
    if (clean(place && place.phone)) score += 5;
    if (number(place && place.lat) !== null && number(place && place.lng) !== null) score += 8;
    if (number(place && place.rating_count) > 0) score += Math.min(8, number(place.rating_count));
    score += freshness(place).score;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function rankPlaces(places, context, parsed) {
    return places.slice().map(function (place) {
      var distance = placeDistance(place, context.location);
      var score = trustScore(place) + (openState(place) === 1 ? 18 : openState(place) === -1 ? -20 : 0);
      if (distance !== null) score += Math.max(0, 18 - distance * 2);
      if (parsed && parsed.open && openState(place) !== 1) score -= 22;
      if (parsed && parsed.price && norm(place.price_level || place.price_range).indexOf(parsed.price) > -1) score += 8;
      return { place: place, score: score, distance: distance };
    }).sort(function (a, b) { return b.score - a.score; }).map(function (item) {
      item.place.__tlxDistance = item.distance;
      item.place.__tlxScore = item.score;
      return item.place;
    });
  }

  function parseQuestion(question) {
    var original = clean(question), text = norm(original);
    var radiusMatch = text.match(/(?:trong|ban kinh|duoi|cach)\s*(\d+(?:[.,]\d+)?)\s*km/);
    var radius = radiusMatch ? Math.max(1, Math.min(200, Number(radiusMatch[1].replace(',', '.')))) : (/gan|quanh/.test(text) ? 5 : 0);
    var category = '';
    var map = [
      [['ca phe', 'cafe', 'coffee'], 'cà phê'], [['an sang'], 'ăn sáng'], [['an', 'quan an', 'nha hang'], 'ẩm thực'],
      [['khach san', 'homestay', 'luu tru'], 'lưu trú'], [['benh vien', 'phong kham'], 'y tế'],
      [['atm', 'ngan hang'], 'ngân hàng'], [['cay xang', 'tram xang'], 'cây xăng'],
      [['cong vien', 'thien nhien'], 'công viên'], [['mua sam', 'sieu thi', 'cho'], 'mua sắm'],
      [['du lich', 'tham quan'], 'du lịch'], [['lam dep', 'spa'], 'làm đẹp'], [['giai tri'], 'giải trí']
    ];
    map.some(function (entry) {
      if (entry[0].some(function (word) { return text.indexOf(word) > -1; })) { category = entry[1]; return true; }
      return false;
    });
    var price = /mien phi|free/.test(text) ? 'free' : (/gia re|binh dan|tiet kiem/.test(text) ? 'low' : (/cao cap|sang trong/.test(text) ? 'high' : ''));
    var open = /dang mo|mo cua|bay gio|luc nay/.test(text);
    var query = original.replace(/\b(trong|bán kính|dưới|cách)\s*\d+(?:[.,]\d+)?\s*km\b/ig, '').trim();
    return { original: original, query: query, category: category, radius: radius, price: price, open: open };
  }

  function fetchCatalog() {
    if (STATE.catalog.length) return Promise.resolve(STATE.catalog);
    var cached = readJSON('tl_category_catalog_v4', []);
    if (Array.isArray(cached) && cached.length) STATE.catalog = cached;
    return jsonp('categoryCatalog', {}).then(function (data) {
      var catalog = data && (data.categories || data.items || data.data);
      if (Array.isArray(catalog) && catalog.length) STATE.catalog = catalog;
      return STATE.catalog;
    }).catch(function () { return STATE.catalog; });
  }

  function fetchRecommendations(context) {
    return fetchCatalog().then(function (catalog) {
      var category = chooseCategory(catalog, context);
      var query = { limit: 12, offset: 0 };
      if (category) query.category = category;
      if (context.location) {
        query.sort = 'nearest'; query.lat = context.location.lat; query.lng = context.location.lng; query.radius_km = 25;
      }
      return jsonp(category ? 'list' : 'homepageTop', query).then(function (data) {
        var places = placeList(data);
        if (!places.length && category) return jsonp('homepageTop', { limit: 12 }).then(placeList);
        return places;
      }).catch(function () {
        return jsonp('homepageTop', { limit: 12 }).then(placeList).catch(function () { return []; });
      });
    });
  }

  function searchPlaces(parsed, context) {
    var query = { q: parsed.query || parsed.category || parsed.original, limit: 24, offset: 0 };
    if (context.location && parsed.radius) {
      query.sort = 'nearest'; query.lat = context.location.lat; query.lng = context.location.lng; query.radius_km = parsed.radius;
    }
    return jsonp('searchPlaces', query).then(function (data) {
      var places = placeList(data);
      if (places.length || !parsed.category) return places;
      return jsonp('list', Object.assign({ category: parsed.category }, query)).then(placeList);
    });
  }

  function itinerary() {
    var value = readJSON(ITINERARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function placeId(place) {
    return clean(place && (place.id || place.place_id || place.slug || place.name));
  }

  function compactPlace(place) {
    return {
      id: placeId(place), name: clean(place.name), category: clean(place.category || place.parent_category),
      address: clean(place.address), locality: clean(place.locality), province: clean(place.province),
      lat: number(place.lat), lng: number(place.lng), maps_url: clean(place.maps_url || place.map_url),
      category_url: clean(place.category_url), phone: clean(place.phone), business_url: clean(place.business_url || place.website)
    };
  }

  function hasItineraryPlace(place) {
    var id = placeId(place);
    return itinerary().some(function (item) { return placeId(item) === id; });
  }

  function toggleItinerary(place) {
    var items = itinerary(), id = placeId(place);
    var index = items.findIndex(function (item) { return placeId(item) === id; });
    if (index > -1) { items.splice(index, 1); toast('Đã bỏ khỏi lịch trình.'); }
    else { items.push(compactPlace(place)); toast('Đã thêm vào lịch trình.'); }
    writeJSON(ITINERARY_KEY, items.slice(0, 12));
    renderItinerary();
    renderCards(STATE.places);
  }

  function directionsUrl(items) {
    if (!items.length) return '';
    function point(place) {
      return place.lat !== null && place.lng !== null ? place.lat + ',' + place.lng : clean(place.address || place.name);
    }
    var origin = point(items[0]), destination = point(items[items.length - 1]);
    var waypoints = items.slice(1, -1).map(point).filter(Boolean).join('|');
    var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(origin) + '&destination=' + encodeURIComponent(destination);
    if (waypoints) url += '&waypoints=' + encodeURIComponent(waypoints);
    return url;
  }

  function autoItinerary() {
    var candidates = STATE.places.filter(function (place) { return openState(place) !== -1; }).slice(0, 4).map(compactPlace);
    if (!candidates.length) { toast('Chưa có đủ địa điểm để tạo lịch trình.'); return; }
    writeJSON(ITINERARY_KEY, candidates);
    renderItinerary();
    renderCards(STATE.places);
    toast('Đã tạo lịch trình gợi ý.');
  }

  function openExistingPlace(place) {
    var ui = modal(clean(place.name) || 'Địa điểm');
    ui.dialog.appendChild(el('p', '', clean(place.address) || [clean(place.locality), clean(place.province)].filter(Boolean).join(', ') || 'Chưa có địa chỉ chi tiết.'));
    var meta = el('div', 'tlx-card-meta');
    meta.appendChild(el('span', 'tlx-badge is-gold', trustScore(place) + '/100 tin cậy'));
    meta.appendChild(el('span', 'tlx-badge is-gray', freshness(place).label));
    if (openState(place) === 1) meta.appendChild(el('span', 'tlx-badge', 'Đang mở'));
    ui.dialog.appendChild(meta);
    var actions = el('div', 'tlx-actions');
    actions.appendChild(button('tlx-btn is-soft', hasItineraryPlace(place) ? 'Bỏ lịch trình' : '+ Lịch trình', function () { toggleItinerary(place); ui.overlay.remove(); }));
    var mapUrl = clean(place.maps_url || place.map_url);
    if (!mapUrl && number(place.lat) !== null && number(place.lng) !== null) mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.lat + ',' + place.lng);
    if (safeUrl(mapUrl)) { var map = el('a', 'tlx-btn', 'Chỉ đường'); map.href = safeUrl(mapUrl); map.target = '_blank'; map.rel = 'noopener noreferrer'; actions.appendChild(map); }
    if (clean(place.phone)) { var phone = el('a', 'tlx-btn is-plain', 'Gọi điện'); phone.href = 'tel:' + clean(place.phone).replace(/[^0-9+]/g, ''); actions.appendChild(phone); }
    var website = safeUrl(place.business_url || place.website);
    if (website) { var site = el('a', 'tlx-btn is-plain', 'Website'); site.href = website; site.target = '_blank'; site.rel = 'noopener noreferrer'; actions.appendChild(site); }
    if (typeof window.TL_OPEN_PLACE_RATING === 'function') actions.appendChild(button('tlx-btn is-plain', 'Đánh giá', function () { ui.overlay.remove(); window.TL_OPEN_PLACE_RATING(place, clean(place.category), clean(place.parent_category)); }));
    actions.appendChild(button('tlx-btn is-plain', 'Tôi là chủ', function () { ui.overlay.remove(); openClaim(place); }));
    ui.dialog.appendChild(actions);
  }

  function renderCard(place) {
    var card = el('article', 'tlx-card');
    var top = el('div', 'tlx-card-top');
    top.appendChild(el('span', 'tlx-badge', clean(place.category || place.parent_category) || 'Địa điểm'));
    var score = trustScore(place);
    top.appendChild(el('span', 'tlx-badge ' + (score >= 75 ? 'is-gold' : 'is-gray'), score + '/100 tin cậy'));
    card.appendChild(top);
    card.appendChild(el('h3', '', clean(place.name) || 'Địa điểm'));
    card.appendChild(el('div', 'tlx-card-address', clean(place.address) || [clean(place.locality), clean(place.province)].filter(Boolean).join(', ') || 'Xem thông tin địa điểm'));
    var meta = el('div', 'tlx-card-meta');
    var fresh = freshness(place);
    meta.appendChild(el('span', 'tlx-badge is-gray', fresh.label));
    if (openState(place) === 1) meta.appendChild(el('span', 'tlx-badge', 'Đang mở'));
    if (place.__tlxDistance !== null && place.__tlxDistance !== undefined) {
      meta.appendChild(el('span', 'tlx-badge is-gray', place.__tlxDistance < 1 ? Math.round(place.__tlxDistance * 1000) + ' m' : place.__tlxDistance.toFixed(1) + ' km'));
    }
    card.appendChild(meta);
    var actions = el('div', 'tlx-card-actions');
    actions.appendChild(button('tlx-btn is-soft', 'Xem', function () { openExistingPlace(place); }));
    actions.appendChild(button('tlx-btn is-plain', hasItineraryPlace(place) ? 'Bỏ lịch trình' : '+ Lịch trình', function () { toggleItinerary(place); }));
    actions.appendChild(button('tlx-btn is-plain', 'Tôi là chủ', function () { openClaim(place); }));
    card.appendChild(actions);
    return card;
  }

  function renderCards(places, note) {
    var grid = document.getElementById('tlNextGrid');
    var status = document.getElementById('tlNextStatus');
    if (!grid) return;
    grid.replaceChildren();
    if (status) status.textContent = note || (places.length ? places.length + ' gợi ý phù hợp' : 'Chưa tìm thấy địa điểm phù hợp.');
    if (!places.length) {
      grid.appendChild(el('div', 'tlx-empty', 'Chưa có kết quả. Bạn có thể thử câu hỏi ngắn hơn hoặc bật vị trí.'));
      return;
    }
    places.slice(0, 12).forEach(function (place) { grid.appendChild(renderCard(place)); });
    injectItemListSchema(places.slice(0, 12));
  }

  function renderItinerary() {
    var host = document.getElementById('tlNextItinerary');
    var count = document.getElementById('tlNextItineraryCount');
    if (!host) return;
    var items = itinerary();
    if (count) count.textContent = items.length ? 'Lịch trình (' + items.length + ')' : 'Lịch trình';
    host.replaceChildren();
    host.classList.toggle('is-open', items.length > 0);
    if (!items.length) return;
    host.appendChild(el('h3', '', 'Lịch trình của bạn'));
    var list = el('ol');
    items.forEach(function (place, index) {
      var item = el('li');
      var row = el('div', 'tlx-itinerary-row');
      row.appendChild(el('span', '', clean(place.name) || 'Điểm ' + (index + 1)));
      row.appendChild(button('tlx-link', 'Xóa', function () { toggleItinerary(place); }));
      item.appendChild(row); list.appendChild(item);
    });
    host.appendChild(list);
    var actions = el('div', 'tlx-actions');
    var map = el('a', 'tlx-btn', 'Mở tuyến đường');
    map.href = directionsUrl(items); map.target = '_blank'; map.rel = 'noopener noreferrer';
    actions.appendChild(map);
    actions.appendChild(button('tlx-btn is-plain', 'Xóa lịch trình', function () { writeJSON(ITINERARY_KEY, []); renderItinerary(); renderCards(STATE.places); }));
    host.appendChild(actions);
  }

  function modal(title) {
    var overlay = el('div', 'tlx-modal');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    var dialog = el('div', 'tlx-dialog');
    var close = button('tlx-close', '×', function () { overlay.remove(); });
    close.setAttribute('aria-label', 'Đóng');
    dialog.appendChild(close); dialog.appendChild(el('h2', '', title)); overlay.appendChild(dialog);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function escape(event) {
      if (event.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escape); }
    });
    document.body.appendChild(overlay); close.focus();
    return { overlay: overlay, dialog: dialog };
  }

  function openClaim(place) {
    var ui = modal('Xác nhận quyền quản lý địa điểm');
    ui.dialog.appendChild(el('p', 'tlx-note', 'Gửi thông tin để THIS LOCAL đối chiếu. Thông tin liên hệ và bằng chứng không được hiển thị công khai.'));
    var form = el('form', 'tlx-form');
    function field(label, name, type, required) {
      var wrap = el('label', '', label), input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      input.name = name;
      if (type !== 'textarea') input.type = type || 'text';
      if (required) input.required = true;
      wrap.appendChild(input); form.appendChild(wrap); return input;
    }
    var owner = field('Tên người liên hệ', 'owner_name', 'text', true);
    var contact = field('Email hoặc số điện thoại', 'contact', 'text', true);
    var proof = field('Liên kết bằng chứng (website, trang chính thức…)', 'proof_url', 'url', false);
    var note = field('Ghi chú', 'note', 'textarea', false);
    var submit = button('tlx-btn', 'Gửi yêu cầu'); submit.type = 'submit'; form.appendChild(submit);
    form.addEventListener('submit', function (event) {
      event.preventDefault(); submit.disabled = true; submit.textContent = 'Đang gửi…';
      post('submitClaim', {
        place_id: placeId(place), place_name: clean(place.name), owner_name: clean(owner.value),
        contact: clean(contact.value), proof_url: clean(proof.value), note: clean(note.value), page_url: location.href
      }).then(function (data) {
        if (data && data.ok === false) throw new Error(clean(data.error) || 'rejected');
        ui.overlay.remove(); toast('Đã gửi yêu cầu. THIS LOCAL sẽ kiểm tra trước khi xác nhận.');
      }).catch(function () {
        submit.disabled = false; submit.textContent = 'Gửi lại';
        toast('Chưa gửi được. Hãy triển khai mô-đun API v18.10 rồi thử lại.');
      });
    });
    ui.dialog.appendChild(form);
  }

  function followedAreas() {
    var value = readJSON(FOLLOW_KEY, []);
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function deviceKey() {
    try {
      var value = clean(localStorage.getItem(DEVICE_KEY));
      if (value) return value;
      value = 'TLD-' + Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, value); return value;
    } catch (e) { return 'TLD-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  }

  function followArea(area) {
    area = clean(area);
    if (!area) return;
    var items = followedAreas();
    if (!items.some(function (item) { return norm(item) === norm(area); })) items.unshift(area);
    writeJSON(FOLLOW_KEY, items.slice(0, 8));
    post('followArea', { area_name: area, device_key: deviceKey(), channel: 'ON_SITE' }).catch(function () {});
    renderFollow(); loadLocalFeed(area);
    toast('Đang theo dõi ' + area + '.');
  }

  function unfollowArea(area) {
    writeJSON(FOLLOW_KEY, followedAreas().filter(function (item) { return norm(item) !== norm(area); }));
    renderFollow();
  }

  function renderFollow() {
    var host = document.getElementById('tlNextFollowed');
    if (!host) return;
    host.replaceChildren();
    followedAreas().forEach(function (area) {
      var chip = el('span', 'tlx-chip', area + ' ');
      chip.appendChild(button('tlx-link', '×', function () { unfollowArea(area); }));
      host.appendChild(chip);
    });
  }

  function loadLocalFeed(area) {
    var host = document.getElementById('tlNextLocalFeed');
    if (!host || !area) return;
    host.replaceChildren(el('div', 'tlx-feed-item', 'Đang tải cập nhật tại ' + area + '…'));
    jsonp('localFeed', { area: area, limit: 8 }).then(function (data) {
      var items = (data && (data.changes || data.items || data.data)) || [];
      host.replaceChildren();
      if (!Array.isArray(items) || !items.length) {
        host.appendChild(el('div', 'tlx-feed-item', 'Chưa có cập nhật mới trong khu vực này.'));
        return;
      }
      items.forEach(function (item) {
        var row = el('div', 'tlx-feed-item');
        row.appendChild(el('strong', '', clean(item.title || item.place_name || item.name) || 'Cập nhật địa phương'));
        row.appendChild(el('small', '', clean(item.summary || item.change_summary || item.category) || 'Thông tin vừa được cập nhật'));
        host.appendChild(row);
      });
    }).catch(function () {
      host.replaceChildren(el('div', 'tlx-feed-item', 'Tính năng theo dõi đã lưu trên thiết bị; bảng tin sẽ hiện sau khi API v18.10 được triển khai.'));
    });
  }

  function injectJsonLd(id, object) {
    var old = document.getElementById(id); if (old) old.remove();
    var script = document.createElement('script'); script.type = 'application/ld+json'; script.id = id;
    script.textContent = JSON.stringify(object); document.head.appendChild(script);
  }

  function injectOrganizationSchema() {
    injectJsonLd('tlNextOrganizationSchema', {
      '@context': 'https://schema.org', '@type': 'Organization', name: 'THIS LOCAL',
      url: location.origin + '/'
    });
  }

  function placeSchema(place) {
    var schema = {
      '@type': 'LocalBusiness', name: clean(place.name),
      address: clean(place.address) ? { '@type': 'PostalAddress', streetAddress: clean(place.address), addressLocality: clean(place.locality), addressRegion: clean(place.province), addressCountry: 'VN' } : undefined,
      telephone: clean(place.phone) || undefined, url: safeUrl(place.business_url || place.website || place.category_url) || undefined
    };
    var lat = number(place.lat), lng = number(place.lng);
    if (lat !== null && lng !== null) schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    var rating = number(place.rating_average), count = number(place.rating_count);
    if (rating !== null && count && count > 0) schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating, ratingCount: count };
    Object.keys(schema).forEach(function (key) { if (schema[key] === undefined || schema[key] === '') delete schema[key]; });
    return schema;
  }

  function injectItemListSchema(places) {
    if (!places.length) return;
    injectJsonLd('tlNextItemListSchema', {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: places.map(function (place, index) { return { '@type': 'ListItem', position: index + 1, item: placeSchema(place) }; })
    });
  }

  function setupPlaceRoute() {
    var id = '';
    try { id = clean(new URLSearchParams(location.search).get('place')); } catch (e) {}
    if (!id) return;
    jsonp('placeDetail', { id: id }).then(function (data) {
      var place = data && (data.place || data.data || data);
      if (!place || !clean(place.name)) return;
      injectJsonLd('tlNextPlaceSchema', Object.assign({ '@context': 'https://schema.org' }, placeSchema(place)));
      var ui = modal(clean(place.name));
      ui.dialog.appendChild(el('p', '', clean(place.address) || [clean(place.locality), clean(place.province)].filter(Boolean).join(', ')));
      var meta = el('div', 'tlx-card-meta');
      meta.appendChild(el('span', 'tlx-badge is-gold', trustScore(place) + '/100 tin cậy'));
      meta.appendChild(el('span', 'tlx-badge is-gray', freshness(place).label)); ui.dialog.appendChild(meta);
      var actions = el('div', 'tlx-actions');
      actions.appendChild(button('tlx-btn is-soft', '+ Lịch trình', function () { toggleItinerary(place); }));
      actions.appendChild(button('tlx-btn is-plain', 'Tôi là chủ địa điểm', function () { ui.overlay.remove(); openClaim(place); }));
      var mapUrl = clean(place.maps_url || place.map_url);
      if (!mapUrl && number(place.lat) !== null && number(place.lng) !== null) mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.lat + ',' + place.lng);
      if (safeUrl(mapUrl)) { var link = el('a', 'tlx-btn', 'Mở bản đồ'); link.href = safeUrl(mapUrl); link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.appendChild(link); }
      ui.dialog.appendChild(actions);
    }).catch(function () {});
  }

  var installPrompt = null;
  function setupPWA() {
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault(); installPrompt = event;
      document.querySelectorAll('.tlx-install').forEach(function (node) { node.classList.add('is-ready'); });
    });
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest && event.target.closest('.tlx-install');
      if (!trigger) return;
      if (!installPrompt) { toast('Trình duyệt sẽ cho phép cài khi trang đáp ứng đủ điều kiện PWA.'); return; }
      installPrompt.prompt(); installPrompt.userChoice.finally(function () { installPrompt = null; trigger.classList.remove('is-ready'); });
    });
    var configured = clean(window.TL_SW_URL);
    if ('serviceWorker' in navigator && configured) {
      try {
        var sw = new URL(configured, location.href);
        if (sw.origin === location.origin) navigator.serviceWorker.register(sw.pathname + sw.search).catch(function () {});
      } catch (e) {}
    }
  }

  function querySubmit(question) {
    if (STATE.busy) return;
    var parsed = parseQuestion(question);
    if (norm(parsed.original).length < 2) { toast('Hãy nhập nhu cầu bạn đang tìm.'); return; }
    STATE.busy = true; STATE.query = parsed.original;
    var submit = document.getElementById('tlNextAskSubmit'); if (submit) { submit.disabled = true; submit.textContent = 'Đang tìm…'; }
    var status = document.getElementById('tlNextStatus'); if (status) status.textContent = 'THIS LOCAL đang phân tích nhu cầu…';
    searchPlaces(parsed, STATE.context).then(function (places) {
      STATE.places = rankPlaces(places, STATE.context, parsed);
      var notes = [];
      if (parsed.open) notes.push('ưu tiên đang mở');
      if (parsed.radius) notes.push('trong ' + parsed.radius + ' km');
      renderCards(STATE.places, (STATE.places.length || 0) + ' kết quả' + (notes.length ? ' · ' + notes.join(' · ') : ''));
    }).catch(function () { renderCards([], 'Chưa kết nối được dữ liệu tìm kiếm.'); }).finally(function () {
      STATE.busy = false; if (submit) { submit.disabled = false; submit.textContent = 'Hỏi THIS LOCAL'; }
    });
  }

  function showDiscoveryRestore(anchor) {
    if (!anchor || !anchor.parentNode || document.getElementById('tlNextRestore')) return;
    var restore = el('div', 'tlx-restore'); restore.id = 'tlNextRestore';
    restore.appendChild(el('span', '', 'Gợi ý thông minh đang được ẩn.'));
    restore.appendChild(button('tlx-btn is-soft', 'Hiện lại gợi ý', function () {
      writeJSON(DISMISSED_KEY, false);
      restore.remove();
      buildDiscovery();
    }));
    anchor.parentNode.insertBefore(restore, anchor);
  }

  function buildDiscovery() {
    if (document.getElementById('tlNextDiscovery')) return;
    var home = document.body && (document.body.classList.contains('tl-home-view') || location.pathname === '/');
    if (!home) return;
    var anchor = document.querySelector('.tl-home-categories');
    if (!anchor || !anchor.parentNode) return;
    if (readJSON(DISMISSED_KEY, false)) { showDiscoveryRestore(anchor); return; }
    var oldRestore = document.getElementById('tlNextRestore'); if (oldRestore) oldRestore.remove();
    var shell = el('section', 'tlx-shell'); shell.id = 'tlNextDiscovery';
    var head = el('div', 'tlx-head');
    var copy = el('div'); copy.appendChild(el('span', 'tlx-kicker', 'Khám phá thông minh')); copy.appendChild(el('h2', '', 'Đi đâu ngay bây giờ?'));
    copy.appendChild(el('p', '', 'Gợi ý theo thời điểm, thời tiết và vị trí — không cần tài khoản. Bạn cũng có thể hỏi bằng câu tự nhiên.'));
    head.appendChild(copy);
    var headActions = el('div', 'tlx-actions');
    headActions.appendChild(button('tlx-btn is-soft tlx-install', 'Cài THIS LOCAL'));
    headActions.appendChild(button('tlx-btn is-plain', 'Ẩn', function () {
      writeJSON(DISMISSED_KEY, true);
      shell.remove();
      showDiscoveryRestore(anchor);
    }));
    head.appendChild(headActions); shell.appendChild(head);
    var contextHost = el('div', 'tlx-context'); contextHost.id = 'tlNextContext'; shell.appendChild(contextHost);
    var ask = el('form', 'tlx-ask');
    var input = document.createElement('input'); input.id = 'tlNextAsk'; input.type = 'search'; input.placeholder = 'Ví dụ: quán cà phê đang mở trong 5 km'; input.setAttribute('aria-label', 'Hỏi THIS LOCAL');
    var askButton = button('tlx-btn', 'Hỏi THIS LOCAL'); askButton.id = 'tlNextAskSubmit'; askButton.type = 'submit'; ask.appendChild(input); ask.appendChild(askButton);
    ask.addEventListener('submit', function (event) { event.preventDefault(); querySubmit(input.value); }); shell.appendChild(ask);
    var toolbar = el('div', 'tlx-toolbar'); toolbar.appendChild(el('div', 'tlx-status', 'Đang chuẩn bị gợi ý…')).id = 'tlNextStatus';
    var tools = el('div', 'tlx-actions');
    var itineraryButton = button('tlx-btn is-soft', 'Lịch trình', function () {
      var panel = document.getElementById('tlNextItinerary'); if (panel) panel.classList.toggle('is-open');
    }); itineraryButton.id = 'tlNextItineraryCount';
    tools.appendChild(button('tlx-btn is-plain', 'Tạo lịch trình nhanh', autoItinerary)); tools.appendChild(itineraryButton); toolbar.appendChild(tools); shell.appendChild(toolbar);
    var grid = el('div', 'tlx-grid'); grid.id = 'tlNextGrid'; shell.appendChild(grid);
    var itineraryHost = el('div', 'tlx-itinerary'); itineraryHost.id = 'tlNextItinerary'; shell.appendChild(itineraryHost);
    var followToolbar = el('div', 'tlx-toolbar'); followToolbar.style.marginTop = '18px';
    var follow = el('div', 'tlx-follow'); follow.appendChild(el('strong', '', 'Theo dõi khu vực'));
    var areaInput = document.createElement('input'); areaInput.placeholder = 'Phường, quận hoặc tỉnh';
    if (STATE.context.location) areaInput.value = clean(STATE.context.location.locality || STATE.context.location.region || STATE.context.location.province);
    follow.appendChild(areaInput); follow.appendChild(button('tlx-btn is-soft', 'Theo dõi', function () { followArea(areaInput.value); })); followToolbar.appendChild(follow);
    var followed = el('div', 'tlx-context'); followed.id = 'tlNextFollowed'; followToolbar.appendChild(followed); shell.appendChild(followToolbar);
    var feed = el('div', 'tlx-feed'); feed.id = 'tlNextLocalFeed'; shell.appendChild(feed);
    anchor.parentNode.insertBefore(shell, anchor);
    STATE.context.labels.forEach(function (label, index) { contextHost.appendChild(el('span', 'tlx-chip' + (index === STATE.context.labels.length - 1 ? ' is-muted' : ''), label)); });
    renderFollow(); renderItinerary();
    var savedAreas = followedAreas(); if (savedAreas.length) loadLocalFeed(savedAreas[0]);
    fetchRecommendations(STATE.context).then(function (places) {
      STATE.places = rankPlaces(places, STATE.context, null); renderCards(STATE.places);
    }).catch(function () { renderCards([], 'Chưa tải được gợi ý lúc này.'); });
  }

  function init() {
    injectStyle();
    STATE.context = buildContext();
    injectOrganizationSchema();
    setupPWA();
    buildDiscovery();
    setupPlaceRoute();
    document.addEventListener('tl:locationchange', function (event) {
      if (event && event.detail) writeJSON(LOCATION_KEY, event.detail);
      STATE.context = buildContext();
      if (document.getElementById('tlNextDiscovery')) {
        fetchRecommendations(STATE.context).then(function (places) { STATE.places = rankPlaces(places, STATE.context, null); renderCards(STATE.places); });
      }
    });
  }

  ready(init);
})();
