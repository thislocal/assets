/* THIS LOCAL Next Admin v18.10 — owner claim review add-on. */
(function () {
  'use strict';

  if (window.__TL_NEXT_ADMIN_V1810__) return;
  window.__TL_NEXT_ADMIN_V1810__ = true;

  var path = (location.pathname || '').toLowerCase();
  if (!/^\/p\/(?:quan-tri|quan-tri-this-local|this-local-admin|admin)\.html\/?$/.test(path)) return;

  var PROJECT = 'https://dhxawrbtzloypojwmksn.supabase.co';
  var API = PROJECT + '/functions/v1/this-local-admin-api';
  var KEY_NAME = 'tl_admin_publishable_key_v2';
  var ACCESS_NAME = 'tl_admin_access_v2';
  var REFRESH_NAME = 'tl_admin_refresh_v2';
  var adding = false;

  function clean(value) { return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim(); }
  function node(tag, className, text) { var n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
  function key() { return clean(localStorage.getItem(KEY_NAME)); }
  function access() { return clean(sessionStorage.getItem(ACCESS_NAME)); }
  function refresh() { return clean(sessionStorage.getItem(REFRESH_NAME)); }
  function formatDate(value) { try { return new Date(value).toLocaleString('vi-VN'); } catch (e) { return clean(value); } }

  function saveSession(data) {
    if (data && data.access_token) sessionStorage.setItem(ACCESS_NAME, data.access_token);
    if (data && data.refresh_token) sessionStorage.setItem(REFRESH_NAME, data.refresh_token);
  }

  function renew() {
    if (!key() || !refresh()) return Promise.reject(new Error('Phiên đăng nhập đã hết.'));
    return fetch(PROJECT + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key() }, body: JSON.stringify({ refresh_token: refresh() })
    }).then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.message || 'Không thể làm mới phiên.'); saveSession(data); return data; }); });
  }

  function api(query, options, retry) {
    options = options || {}; if (retry === undefined) retry = true;
    var headers = Object.assign({ 'Content-Type': 'application/json', apikey: key() }, options.headers || {});
    if (access()) headers.Authorization = 'Bearer ' + access();
    return fetch(API + query, Object.assign({}, options, { headers: headers, cache: 'no-store' })).then(function (response) {
      if (response.status === 401 && retry && refresh()) return renew().then(function () { return api(query, options, false); });
      return response.text().then(function (raw) {
        var data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = { raw: raw }; }
        if (!response.ok || data.ok === false) throw new Error(clean(data.error || data.message || raw) || 'HTTP ' + response.status);
        return data;
      });
    });
  }

  function statusBadge(status) {
    status = clean(status).toUpperCase() || 'PENDING';
    var cls = status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'danger' : 'pending';
    return node('span', 'tla-badge ' + cls, status);
  }

  function claimCard(claim, refreshList) {
    var card = node('article', 'tla-item');
    var badges = node('div', 'tla-badges'); badges.appendChild(statusBadge(claim.status)); card.appendChild(badges);
    card.appendChild(node('strong', '', clean(claim.place_name) || clean(claim.place_id) || 'Địa điểm'));
    card.appendChild(node('small', '', 'Người liên hệ: ' + (clean(claim.owner_name) || '—') + ' · ' + (clean(claim.contact) || '—')));
    card.appendChild(node('small', '', 'Gửi lúc: ' + formatDate(claim.created_at)));
    if (clean(claim.proof_url)) {
      var proof = node('a', 'tla-btn', 'Mở bằng chứng'); proof.href = claim.proof_url; proof.target = '_blank'; proof.rel = 'noopener noreferrer'; card.appendChild(proof);
    }
    if (clean(claim.note)) card.appendChild(node('div', 'tla-note', 'Ghi chú: ' + clean(claim.note)));
    if (clean(claim.admin_note)) card.appendChild(node('div', 'tla-note', 'Phản hồi quản trị: ' + clean(claim.admin_note)));

    if (clean(claim.status).toUpperCase() === 'PENDING') {
      var review = node('div', 'tla-grid');
      var field = node('div', 'tla-field wide'); field.appendChild(node('label', '', 'Ghi chú duyệt'));
      var note = node('textarea'); note.placeholder = 'Kết quả đối chiếu, lý do từ chối…'; field.appendChild(note); review.appendChild(field);
      var actions = node('div', 'tla-actions');
      function send(decision, trigger) {
        trigger.disabled = true;
        api('?action=reviewClaim', { method: 'POST', body: JSON.stringify({ id: claim.id, decision: decision, admin_note: clean(note.value) }) })
          .then(function () { return refreshList(); }).catch(function (error) {
            var old = card.querySelector('.tla-error'); if (old) old.remove(); card.appendChild(node('div', 'tla-error', error.message || String(error)));
          }).finally(function () { trigger.disabled = false; });
      }
      var approve = node('button', 'tla-btn primary', 'Xác nhận chủ sở hữu'); approve.type = 'button'; approve.onclick = function () { send('APPROVED', approve); };
      var reject = node('button', 'tla-btn danger', 'Từ chối'); reject.type = 'button'; reject.onclick = function () { send('REJECTED', reject); };
      actions.appendChild(approve); actions.appendChild(reject); review.appendChild(actions); card.appendChild(review);
    }
    return card;
  }

  function renderClaims(content) {
    content.replaceChildren();
    var title = node('div', 'tla-section-head');
    var titleCopy = node('div'); titleCopy.appendChild(node('h2', '', 'Yêu cầu sở hữu địa điểm'));
    titleCopy.appendChild(node('p', 'tla-muted', 'Đối chiếu bằng chứng trước khi xác nhận. Thông tin liên hệ không hiển thị công khai.'));
    title.appendChild(titleCopy); content.appendChild(title);
    var controls = node('div', 'tla-grid');
    var statusField = node('div', 'tla-field'); statusField.appendChild(node('label', '', 'Trạng thái'));
    var select = node('select'); ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].forEach(function (value) { var option = node('option', '', value); option.value = value; select.appendChild(option); });
    statusField.appendChild(select); controls.appendChild(statusField); content.appendChild(controls);
    var list = node('div', 'tla-list'); content.appendChild(list);

    function load() {
      list.replaceChildren(node('div', 'tla-status', 'Đang tải yêu cầu…'));
      var query = '?action=claims&limit=100'; if (select.value !== 'ALL') query += '&status=' + encodeURIComponent(select.value);
      return api(query).then(function (data) {
        var claims = data.claims || data.items || [];
        list.replaceChildren();
        if (!claims.length) { list.appendChild(node('div', 'tla-status', 'Không có yêu cầu trong trạng thái này.')); return; }
        claims.forEach(function (claim) { list.appendChild(claimCard(claim, load)); });
      }).catch(function (error) {
        list.replaceChildren(node('div', 'tla-error', (error.message || String(error)) + '\nHãy triển khai mô-đun API và SQL v18.10 trước.'));
      });
    }
    select.onchange = load; return load();
  }

  function ensureNav() {
    if (adding) return;
    var root = document.getElementById('tlAdminV2');
    var nav = root && root.querySelector('.tla-nav');
    var content = root && root.querySelector('#tlaContent');
    if (!nav || !content || nav.querySelector('[data-tlx-claims]')) return;
    adding = true;
    var tab = node('button', '', 'Yêu cầu sở hữu'); tab.type = 'button'; tab.setAttribute('data-tlx-claims', 'true');
    tab.onclick = function () {
      Array.prototype.forEach.call(nav.querySelectorAll('button'), function (item) { item.classList.remove('is-active'); });
      tab.classList.add('is-active'); renderClaims(content);
    };
    nav.appendChild(tab); adding = false;
  }

  var observer = new MutationObserver(ensureNav);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureNav);
  else ensureNav();
})();
