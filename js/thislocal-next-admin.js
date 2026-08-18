/* THIS LOCAL Next Admin v18.11 — owner claims and dynamic locality pages. */
(function () {
  'use strict';

  if (window.__TL_NEXT_ADMIN_V1811__) return;
  window.__TL_NEXT_ADMIN_V1811__ = true;

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
        api('?action=reviewClaim', { method: 'POST', body: JSON.stringify({ action: 'reviewClaim', id: claim.id, decision: decision, admin_note: clean(note.value) }) })
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
        list.replaceChildren(node('div', 'tla-error', (error.message || String(error)) + '\nHãy triển khai API quản trị mới nhất trước.'));
      });
    }
    select.onchange = load; return load();
  }

  function renderLocalities(content) {
    content.replaceChildren();
    var title = node('div', 'tla-section-head');
    var titleCopy = node('div'); titleCopy.appendChild(node('h2', '', 'Trang địa phương'));
    titleCopy.appendChild(node('p', 'tla-muted', 'Thêm hoặc ẩn địa phương tại đây. Menu máy tính và điện thoại sẽ tự cập nhật.'));
    title.appendChild(titleCopy); content.appendChild(title);

    var form = node('form', 'tla-grid');
    function inputField(label, name, type, wide) {
      var wrap = node('div', 'tla-field' + (wide ? ' wide' : ''));
      wrap.appendChild(node('label', '', label));
      var input = node(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type || 'text';
      input.name = name; wrap.appendChild(input); form.appendChild(wrap); return input;
    }
    var idInput = inputField('ID (để trống sẽ tự tạo)', 'id');
    var nameInput = inputField('Tên địa phương *', 'name_vi');
    var codeInput = inputField('Mã tỉnh/thành', 'province_code');
    var countryInput = inputField('Mã quốc gia', 'country_code'); countryInput.value = 'VN';
    var slugInput = inputField('Slug', 'slug');
    var pageInput = inputField('URL trang Blogger *', 'page_url', 'text', true); pageInput.placeholder = '/p/kham-pha-lao-cai.html';
    var summaryInput = inputField('Mô tả ngắn trên menu', 'summary_vi', 'textarea', true); summaryInput.placeholder = 'Điểm đến · ăn uống · lưu trú · dịch vụ';
    var sortInput = inputField('Thứ tự', 'sort_order', 'number'); sortInput.value = '100';

    var typeWrap = node('div', 'tla-field'); typeWrap.appendChild(node('label', '', 'Loại'));
    var typeSelect = node('select');
    [['province','Tỉnh'],['city','Thành phố'],['district','Quận/huyện'],['area','Khu vực']].forEach(function (pair) {
      var option = node('option', '', pair[1]); option.value = pair[0]; typeSelect.appendChild(option);
    });
    typeWrap.appendChild(typeSelect); form.appendChild(typeWrap);

    var activeWrap = node('div', 'tla-field'); activeWrap.appendChild(node('label', '', 'Hiển thị trên menu'));
    var activeSelect = node('select');
    [['true','Có'],['false','Ẩn']].forEach(function (pair) { var option = node('option', '', pair[1]); option.value = pair[0]; activeSelect.appendChild(option); });
    activeWrap.appendChild(activeSelect); form.appendChild(activeWrap);

    var actions = node('div', 'tla-actions');
    var save = node('button', 'tla-btn primary', 'Lưu địa phương'); save.type = 'submit';
    var reset = node('button', 'tla-btn', 'Tạo mục mới'); reset.type = 'button';
    actions.appendChild(save); actions.appendChild(reset); form.appendChild(actions); content.appendChild(form);
    var feedback = node('div'); content.appendChild(feedback);
    content.appendChild(node('p', 'tla-muted', 'Trong nội dung trang Blogger, dùng thẻ gốc: data-page-type="locality", data-province-code và data-province.'));
    var list = node('div', 'tla-list'); content.appendChild(list);

    function clearForm() {
      form.reset(); idInput.value = ''; countryInput.value = 'VN'; sortInput.value = '100'; typeSelect.value = 'province'; activeSelect.value = 'true'; feedback.replaceChildren();
    }
    function edit(item) {
      idInput.value = clean(item.id); nameInput.value = clean(item.name_vi); codeInput.value = clean(item.province_code);
      countryInput.value = clean(item.country_code) || 'VN'; slugInput.value = clean(item.slug); pageInput.value = clean(item.page_url);
      summaryInput.value = clean(item.summary_vi); sortInput.value = String(item.sort_order === undefined ? 100 : item.sort_order);
      typeSelect.value = clean(item.locality_type) || 'province'; activeSelect.value = item.active === false ? 'false' : 'true';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function card(item) {
      var article = node('article', 'tla-item');
      var badges = node('div', 'tla-badges'); badges.appendChild(node('span', 'tla-badge ' + (item.active ? 'ok' : 'pending'), item.active ? 'ĐANG HIỆN' : 'ĐANG ẨN')); article.appendChild(badges);
      article.appendChild(node('strong', '', clean(item.name_vi) || clean(item.id)));
      article.appendChild(node('small', '', (clean(item.country_code) || 'VN') + ' · mã ' + (clean(item.province_code) || '—') + ' · thứ tự ' + String(item.sort_order || 0)));
      var link = node('a', '', clean(item.page_url)); link.href = item.page_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; article.appendChild(link);
      if (clean(item.summary_vi)) article.appendChild(node('small', '', clean(item.summary_vi)));
      var cardActions = node('div', 'tla-actions');
      var editButton = node('button', 'tla-btn', 'Sửa'); editButton.type = 'button'; editButton.onclick = function () { edit(item); };
      var deleteButton = node('button', 'tla-btn danger', 'Xóa'); deleteButton.type = 'button';
      deleteButton.onclick = function () {
        if (!confirm('Xóa địa phương "' + clean(item.name_vi) + '" khỏi hệ thống?')) return;
        deleteButton.disabled = true;
        api('', { method: 'POST', body: JSON.stringify({ action: 'deleteLocality', id: item.id }) })
          .then(load).catch(function (error) { feedback.replaceChildren(node('div', 'tla-error', error.message || String(error))); })
          .finally(function () { deleteButton.disabled = false; });
      };
      cardActions.appendChild(editButton); cardActions.appendChild(deleteButton); article.appendChild(cardActions); return article;
    }
    function load() {
      list.replaceChildren(node('div', 'tla-status', 'Đang tải địa phương…'));
      return api('?action=localities&country_code=VN').then(function (data) {
        var rows = data.localities || []; list.replaceChildren();
        if (!rows.length) { list.appendChild(node('div', 'tla-status', 'Chưa có địa phương nào.')); return; }
        rows.forEach(function (item) { list.appendChild(card(item)); });
      }).catch(function (error) { list.replaceChildren(node('div', 'tla-error', error.message || String(error))); });
    }
    form.onsubmit = function (event) {
      event.preventDefault(); save.disabled = true; feedback.replaceChildren(node('div', 'tla-status', 'Đang lưu…'));
      var locality = {
        id: clean(idInput.value), name_vi: clean(nameInput.value), province_code: clean(codeInput.value), country_code: clean(countryInput.value) || 'VN',
        slug: clean(slugInput.value), page_url: clean(pageInput.value), summary_vi: clean(summaryInput.value), sort_order: Number(sortInput.value || 100),
        locality_type: typeSelect.value, active: activeSelect.value === 'true'
      };
      api('', { method: 'POST', body: JSON.stringify({ action: 'saveLocality', locality: locality }) })
        .then(function () { feedback.replaceChildren(node('div', 'tla-status', 'Đã lưu địa phương.')); return load(); })
        .catch(function (error) { feedback.replaceChildren(node('div', 'tla-error', error.message || String(error))); })
        .finally(function () { save.disabled = false; });
    };
    reset.onclick = clearForm; return load();
  }

  function ensureNav() {
    if (adding) return;
    var root = document.getElementById('tlAdminV2');
    var nav = root && root.querySelector('.tla-nav');
    var content = root && root.querySelector('#tlaContent');
    if (!nav || !content) return;
    adding = true;
    if (!nav.querySelector('[data-tlx-claims]')) {
      var claimsTab = node('button', '', 'Yêu cầu sở hữu'); claimsTab.type = 'button'; claimsTab.setAttribute('data-tlx-claims', 'true');
      claimsTab.onclick = function () {
        Array.prototype.forEach.call(nav.querySelectorAll('button'), function (item) { item.classList.remove('is-active'); });
        claimsTab.classList.add('is-active'); renderClaims(content);
      };
      nav.appendChild(claimsTab);
    }
    if (!nav.querySelector('[data-tlx-localities]')) {
      var localityTab = node('button', '', 'Địa phương'); localityTab.type = 'button'; localityTab.setAttribute('data-tlx-localities', 'true');
      localityTab.onclick = function () {
        Array.prototype.forEach.call(nav.querySelectorAll('button'), function (item) { item.classList.remove('is-active'); });
        localityTab.classList.add('is-active'); renderLocalities(content);
      };
      nav.appendChild(localityTab);
    }
    adding = false;
  }

  var observer = new MutationObserver(ensureNav);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureNav);
  else ensureNav();
})();
