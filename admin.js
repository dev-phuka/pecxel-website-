(function () {
  const $ = (id) => document.getElementById(id);
  const state = { mode: 'products', records: [] };
  const tokenKey = 'pecxel_admin_token';
  let imageUploadInProgress = false;
  const modes = {
    products: { title: 'Products', item: 'product', endpoint: '/api/admin/catalog/products', key: 'items', fields: ['name', 'category', 'image', 'price_mwk', 'stock', 'position', 'description', 'status'] },
    services: { title: 'Services', item: 'service', endpoint: '/api/admin/catalog/services', key: 'items', fields: ['name', 'category', 'image', 'position', 'description', 'status'] },
    projects: { title: 'Projects', item: 'project', endpoint: '/api/admin/catalog/projects', key: 'items', fields: ['name', 'category', 'image', 'position', 'description', 'status'] },
    posts: { title: 'Blog posts', item: 'post', endpoint: '/api/admin/posts', key: 'posts', fields: ['title', 'slug', 'category', 'date', 'image', 'content_html', 'content_markdown', 'status'] },
    donations: { title: 'Donations', item: 'donation entry', endpoint: '/api/admin/donations', key: 'posts', fields: ['title', 'slug', 'category', 'date', 'image', 'content_html', 'content_markdown', 'status'] },
    pages: { title: 'Custom pages', item: 'page', endpoint: '/api/admin/pages', key: 'pages', fields: ['title', 'slug', 'summary', 'body', 'status', 'show_in_nav'] }
  };
  const fieldIds = {
    name: 'recordName', title: 'recordTitle', slug: 'recordSlug', category: 'recordCategory',
    date: 'recordDate', image: 'recordImage', price_mwk: 'recordPrice', stock: 'recordStock',
    position: 'recordPosition', description: 'recordDescription', summary: 'recordSummary',
    body: 'recordBody', content_html: 'recordContent', content_markdown: 'recordMarkdown', status: 'recordStatus'
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function setStatus(message, tone) {
    const status = $('adminStatus');
    status.textContent = message || '';
    status.dataset.tone = tone || '';
  }

  function authHeaders(json) {
    const headers = { Authorization: `Bearer ${$('adminToken').value.trim()}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function apiRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }

  function activeMode() {
    return modes[state.mode];
  }

  function setEditorFields() {
    const fields = new Set(activeMode().fields);
    document.querySelectorAll('[data-field]').forEach((label) => {
      label.hidden = !fields.has(label.dataset.field);
    });
    $('recordName').required = fields.has('name');
    $('recordTitle').required = fields.has('title');
    $('recordContent').required = fields.has('content_html');
    $('listTitle').textContent = activeMode().title;
    $('editorTitle').textContent = `Add ${activeMode().item}`;
    $('saveRecord').textContent = `Add ${activeMode().item}`;
  }

  function resetForm() {
    $('recordForm').reset();
    $('recordId').value = '';
    $('recordPosition').value = '0';
    $('recordStatus').value = 'published';
    $('recordShowNav').checked = true;
    $('imagePreview').hidden = true;
    $('imagePreview').removeAttribute('src');
    $('imageUploadStatus').hidden = true;
    $('imageUploadStatus').textContent = '';
    setEditorFields();
  }

  function showImagePreview(source) {
    const value = String(source || '').trim();
    if (!/^(https?:\/\/|\/|images\/)/i.test(value)) {
      $('imagePreview').hidden = true;
      $('imagePreview').removeAttribute('src');
      return;
    }
    $('imagePreview').src = value;
    $('imagePreview').hidden = false;
  }

  async function uploadImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const acceptedExtension = /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name);
    if ((!file.type.startsWith('image/') && !acceptedExtension) || file.size > 10 * 1024 * 1024) {
      setStatus(file.size > 10 * 1024 * 1024
        ? 'Choose an image smaller than 10 MB.'
        : 'Choose a JPG, PNG, WebP, AVIF, or HEIC image.', 'error');
      event.target.value = '';
      return;
    }

    const uploadStatus = $('imageUploadStatus');
    imageUploadInProgress = true;
    event.target.disabled = true;
    $('saveRecord').disabled = true;
    $('resetRecord').disabled = true;
    document.querySelectorAll('[data-admin-mode]').forEach((button) => { button.disabled = true; });
    uploadStatus.hidden = false;
    uploadStatus.dataset.tone = '';
    uploadStatus.textContent = 'Uploading image...';
    setStatus('Uploading image to Cloudinary...', '');

    try {
      const signedUpload = await apiRequest('/api/admin/uploads/sign', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({})
      });
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', signedUpload.apiKey);
      body.append('timestamp', String(signedUpload.timestamp));
      body.append('folder', signedUpload.folder);
      body.append('allowed_formats', signedUpload.allowed_formats);
      body.append('signature', signedUpload.signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signedUpload.cloudName)}/image/upload`,
        { method: 'POST', body }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || `Image upload failed (${response.status}).`);
      }

      const imageUrl = new URL(result.secure_url);
      if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'res.cloudinary.com') {
        throw new Error('Cloudinary returned an unexpected image address.');
      }
      imageUrl.pathname = imageUrl.pathname.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
      $('recordImage').value = imageUrl.href;
      showImagePreview(imageUrl.href);
      uploadStatus.dataset.tone = 'success';
      uploadStatus.textContent = 'Image uploaded. Save the entry to attach it.';
      setStatus('Image uploaded. Save the entry to publish it with this image.', 'success');
      event.target.value = '';
    } catch (error) {
      uploadStatus.dataset.tone = 'error';
      uploadStatus.textContent = error.message;
      setStatus(error.message, 'error');
    } finally {
      imageUploadInProgress = false;
      event.target.disabled = false;
      $('saveRecord').disabled = false;
      $('resetRecord').disabled = false;
      document.querySelectorAll('[data-admin-mode]').forEach((button) => { button.disabled = false; });
    }
  }

  function itemName(record) {
    return record.name || record.title || '';
  }

  function formatPrice(value) {
    return value === null || value === undefined || value === '' ? 'Not set' : `MWK ${Number(value).toLocaleString('en-US')}`;
  }

  function renderRows() {
    const mode = state.mode;
    const columns = mode === 'products'
      ? ['Product', 'Category', 'Price', 'Stock', 'Visibility', 'Actions']
      : mode === 'services' || mode === 'projects'
        ? ['Name', 'Category', 'Visibility', 'Actions']
        : mode === 'pages'
          ? ['Page', 'Address', 'Visibility', 'Navigation', 'Actions']
          : ['Title', 'Category', 'Visibility', 'Date', 'Actions'];
    $('recordHead').innerHTML = `<tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>`;
    if (!state.records.length) {
      $('recordRows').innerHTML = `<tr><td colspan="${columns.length}">No ${activeMode().title.toLowerCase()} yet. Use the form to add one.</td></tr>`;
      return;
    }

    $('recordRows').innerHTML = state.records.map((record) => {
      const visibility = `<span class="status-pill ${record.status === 'published' ? 'status-published' : 'status-draft'}">${escapeHtml(record.status || 'draft')}</span>`;
      let cells;
      if (mode === 'products') {
        cells = `<td><strong>${escapeHtml(itemName(record))}</strong></td><td>${escapeHtml(record.category)}</td><td>${formatPrice(record.price_mwk)}</td><td>${record.stock ?? 'Not set'}</td><td>${visibility}</td>`;
      } else if (mode === 'services' || mode === 'projects') {
        cells = `<td><strong>${escapeHtml(itemName(record))}</strong><br>${escapeHtml(record.description)}</td><td>${escapeHtml(record.category)}</td><td>${visibility}</td>`;
      } else if (mode === 'pages') {
        cells = `<td><strong>${escapeHtml(record.title)}</strong><br>${escapeHtml(record.summary)}</td><td>/${escapeHtml(record.slug)}</td><td>${visibility}</td><td>${Number(record.show_in_nav) ? 'Shown' : 'Hidden'}</td>`;
      } else {
        cells = `<td><strong>${escapeHtml(record.title)}</strong></td><td>${escapeHtml(record.category)}</td><td>${visibility}</td><td>${escapeHtml(record.date)}</td>`;
      }
      return `<tr>${cells}<td><div class="admin-row-actions"><button class="btn btn-outline" type="button" data-edit-id="${record.id}">Edit</button><button class="btn btn-ghost" type="button" data-delete-id="${record.id}" aria-label="Delete ${escapeHtml(itemName(record))}">Delete</button></div></td></tr>`;
    }).join('');
  }

  async function loadRecords() {
    const config = activeMode();
    $('recordRows').innerHTML = '<tr><td>Loading...</td></tr>';
    const data = await apiRequest(config.endpoint, { headers: authHeaders(false) });
    state.records = data[config.key] || [];
    renderRows();
  }

  async function loadSettings() {
    const data = await apiRequest('/api/admin/settings', { headers: authHeaders(false) });
    for (const [key, value] of Object.entries(data.settings || {})) {
      const input = $('settingsForm').elements.namedItem(key);
      if (input) input.value = value;
    }
  }

  async function connect() {
    const token = $('adminToken').value.trim();
    if (!token) {
      setStatus('Enter the admin token from the server configuration.', 'error');
      return;
    }
    sessionStorage.setItem(tokenKey, token);
    setStatus('Connecting...', '');
    try {
      if (state.mode === 'settings') await loadSettings();
      else await loadRecords();
      setStatus('Connected. Changes save to the website database.', 'success');
    } catch (error) {
      setStatus(error.message === 'Unauthorized' ? 'Token not accepted. Check the server admin token.' : error.message, 'error');
    }
  }

  function setMode(mode) {
    if (!modes[mode] && mode !== 'settings') return;
    state.mode = mode;
    document.querySelectorAll('[data-admin-mode]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.adminMode === mode));
    });
    const isSettings = mode === 'settings';
    $('contentPanel').hidden = isSettings;
    $('settingsPanel').hidden = !isSettings;
    if (!isSettings) {
      setEditorFields();
      resetForm();
    }
    if ($('adminToken').value.trim()) connect();
  }

  function editRecord(id) {
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record) return;
    resetForm();
    $('recordId').value = String(record.id);
    $('recordName').value = record.name || '';
    $('recordTitle').value = record.title || '';
    $('recordSlug').value = record.slug || '';
    $('recordCategory').value = record.category || '';
    $('recordDate').value = record.date || '';
    $('recordImage').value = record.image || record.thumbnail || '';
    showImagePreview($('recordImage').value);
    $('recordPrice').value = record.price_mwk ?? '';
    $('recordStock').value = record.stock ?? '';
    $('recordPosition').value = record.position ?? 0;
    $('recordDescription').value = record.description || '';
    $('recordSummary').value = record.summary || '';
    $('recordBody').value = record.body || '';
    $('recordContent').value = record.content_html || '';
    $('recordMarkdown').value = record.content_markdown || '';
    $('recordStatus').value = record.status || 'draft';
    $('recordShowNav').checked = Boolean(Number(record.show_in_nav));
    $('editorTitle').textContent = `Edit ${activeMode().item}`;
    $('saveRecord').textContent = 'Save changes';
    setStatus(`Editing ${itemName(record)}.`, '');
  }

  function recordPayload() {
    const payload = {};
    for (const field of activeMode().fields) {
      if (field === 'show_in_nav') payload.show_in_nav = $('recordShowNav').checked;
      else if (field === 'image' && (state.mode === 'posts' || state.mode === 'donations')) {
        payload.thumbnail = $('recordImage').value.trim();
      } else payload[field] = $(fieldIds[field]).value.trim();
    }
    if (activeMode().fields.includes('image')) payload.image = $('recordImage').value.trim();
    if (state.mode === 'donations') payload.category = 'donation';
    return payload;
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (imageUploadInProgress) {
      setStatus('Wait for the image upload to finish before saving.', 'error');
      return;
    }
    const config = activeMode();
    const id = $('recordId').value;
    const base = state.mode === 'posts' || state.mode === 'donations'
      ? '/api/admin/posts'
      : state.mode === 'pages'
        ? '/api/admin/pages'
        : config.endpoint;
    const url = id ? `${base}/${encodeURIComponent(id)}` : base;
    try {
      await apiRequest(url, {
        method: id ? 'PUT' : 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(recordPayload())
      });
      resetForm();
      setStatus(`${config.item[0].toUpperCase()}${config.item.slice(1)} saved.`, 'success');
      await loadRecords();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function deleteRecord(id) {
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record || !window.confirm(`Remove “${itemName(record)}” from the website?`)) return;
    const base = state.mode === 'posts' || state.mode === 'donations'
      ? '/api/admin/posts'
      : state.mode === 'pages'
        ? '/api/admin/pages'
        : activeMode().endpoint;
    try {
      await apiRequest(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(false) });
      setStatus('Entry removed.', 'success');
      if ($('recordId').value === String(id)) resetForm();
      await loadRecords();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = $('settingsForm');
    const invalidField = Array.from(form.querySelectorAll('[name]'))
      .find((input) => !validateSettingField(input));
    if (invalidField) {
      invalidField.reportValidity();
      setStatus('Check the highlighted contact or social link before saving.', 'error');
      return;
    }
    const settings = Object.fromEntries(new FormData(form).entries());
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ settings })
      });
      setStatus('Site details saved.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function validateSettingField(input) {
    let message = '';
    const value = input.value.trim();

    if (input.name === 'whatsapp_number' && value && !/^[0-9]{7,15}$/.test(value)) {
      message = 'Enter 7 to 15 digits, including your country code, without spaces or a plus sign.';
    } else if (input.hasAttribute('data-social-url') && value) {
      const allowedDomains = {
        facebook_url: ['facebook.com', 'fb.com'],
        instagram_url: ['instagram.com'],
        linkedin_url: ['linkedin.com'],
        youtube_url: ['youtube.com', 'youtu.be']
      };
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        const isAllowedDomain = (allowedDomains[input.name] || [])
          .some((domain) => host === domain || host.endsWith(`.${domain}`));
        if (url.protocol !== 'https:' || !isAllowedDomain) {
          message = `Enter an HTTPS ${input.name.replace('_url', '')} link.`;
        }
      } catch (error) {
        message = 'Enter a complete HTTPS social profile URL.';
      }
    }

    input.setCustomValidity(message);
    return !message;
  }

  $('settingsForm').querySelectorAll('[name]').forEach((input) => {
    input.addEventListener('input', () => validateSettingField(input));
  });

  $('connectAdmin').addEventListener('click', connect);
  $('refreshContent').addEventListener('click', connect);
  $('recordForm').addEventListener('submit', saveRecord);
  $('resetRecord').addEventListener('click', resetForm);
  $('recordImageFile').addEventListener('change', uploadImage);
  $('recordImage').addEventListener('input', (event) => showImagePreview(event.target.value));
  $('settingsForm').addEventListener('submit', saveSettings);
  document.querySelectorAll('[data-admin-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.adminMode));
  });
  $('recordRows').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-id]');
    const deleteButton = event.target.closest('[data-delete-id]');
    if (editButton) editRecord(editButton.dataset.editId);
    if (deleteButton) deleteRecord(deleteButton.dataset.deleteId);
  });

  const savedToken = sessionStorage.getItem(tokenKey);
  if (savedToken) $('adminToken').value = savedToken;
  setEditorFields();
})();
