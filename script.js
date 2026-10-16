// Homepage interactions and dynamic previews.

(function () {
  let WHATSAPP_NUMBER = '265YOURNUMBER';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeText(value) {
    return String(value || '');
  }

  function safeImageSource(value) {
    const source = String(value || '').trim();
    return /^(https?:\/\/|\/|images\/)/i.test(source) ? escapeHtml(source) : '';
  }

  function storeCategoryKey(value) {
    const category = String(value || '').trim().toLowerCase();
    if (/\b(phone|phones|smartphone|smartphones|mobile)\b/.test(category)) return 'phones';
    if (/\b(laptop|laptops|computer|computers)\b/.test(category)) return 'computers';
    if (category.includes('accessor')) return 'accessories';
    if (category.includes('component') || category.includes('tool')) return 'components';
    return category;
  }

  function applyStoreFilter(category) {
    const items = Array.from(document.querySelectorAll('[data-store-item]'));
    let visibleCount = 0;
    items.forEach((item) => {
      item.hidden = category !== 'all' && item.dataset.storeItem !== category;
      if (!item.hidden) visibleCount += 1;
    });
    const emptyMessage = document.querySelector('[data-store-empty]');
    if (emptyMessage) {
      emptyMessage.hidden = visibleCount > 0;
      emptyMessage.textContent = category === 'phones'
        ? 'No phones or smartphones are listed right now.'
        : category === 'all'
          ? 'No products are listed right now.'
          : 'No products are listed in this category right now.';
    }
  }

  function buildWhatsappLink(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message || '')}`;
  }

  async function initSiteSettings() {
    try {
      const response = await fetch('/api/site-settings');
      if (!response.ok) return;
      const data = await response.json();
      const settings = data.settings || {};
      const companyName = settings.site_name || 'pEc-XeL';
      const descriptor = settings.brand_descriptor || 'Innovations & Technology';
      WHATSAPP_NUMBER = settings.whatsapp_number || WHATSAPP_NUMBER;
      document.querySelectorAll('.brand-text').forEach((element) => { element.textContent = companyName; });
      document.querySelectorAll('.brand-line').forEach((element) => {
        if (element.textContent !== 'Website Manager') element.textContent = descriptor;
      });
      document.querySelectorAll('.site-footer p').forEach((element) => {
        if (element.textContent.trim().startsWith('pEc-XeL')) element.textContent = `${companyName} ${descriptor}`;
      });
      document.querySelectorAll('[data-site-setting]').forEach((element) => {
        const value = settings[element.dataset.siteSetting];
        if (value) element.textContent = value;
      });
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => {
        const current = new URL(link.href);
        link.href = `https://wa.me/${WHATSAPP_NUMBER}${current.search}`;
      });

      // Wire social links saved in site settings. Anchors should have data-social attribute matching the setting key.
      document.querySelectorAll('[data-social]').forEach((el) => {
        const key = el.dataset.social;
        const url = settings[key];
        if (url && typeof url === 'string' && url.trim()) {
          el.href = url.trim();
          if (!el.getAttribute('target')) el.target = '_blank';
          if (!el.getAttribute('rel')) el.rel = 'noopener';
        } else {
          // leave placeholder fallback
          el.href = '#';
        }
      });

    } catch (error) {
      return;
    }
  }

  async function initPublicCatalog() {
    const storeGrid = document.querySelector('[data-store-grid]');
    const serviceGrid = document.querySelector('[data-service-grid]');
    const projectGrid = document.querySelector('[data-project-grid]');
    const render = async (type, grid, makeCard) => {
      if (!grid) return;
      try {
        const response = await fetch(`/api/catalog/${type}s`);
        if (!response.ok) {
          if (grid === storeGrid) {
            grid.innerHTML = '<p class="store-empty">The store inventory is temporarily unavailable. Please try again later.</p>';
          }
          return;
        }
        const data = await response.json();
        if (!Array.isArray(data.items)) {
          if (grid === storeGrid) {
            grid.innerHTML = '<p class="store-empty">The store inventory could not be loaded.</p>';
          }
          return;
        }
        if (!data.items.length && grid === storeGrid) {
          grid.innerHTML = '<p class="store-empty" data-store-empty></p>';
          applyStoreFilter(document.querySelector('[data-store-filter].active')?.dataset.storeFilter || 'all');
          return;
        }
        if (!data.items.length) return;
        grid.innerHTML = data.items.map(makeCard).join('');
        if (grid === storeGrid) {
          grid.insertAdjacentHTML('beforeend', '<p class="store-empty" data-store-empty hidden></p>');
          const selectedFilter = document.querySelector('[data-store-filter].active')?.dataset.storeFilter || 'all';
          applyStoreFilter(selectedFilter);
        }
      } catch (error) {
        if (grid === storeGrid) {
          grid.innerHTML = '<p class="store-empty">The store inventory is temporarily unavailable. Please try again later.</p>';
        }
        return;
      }
    };

    await Promise.all([
      render('product', storeGrid, (item) => {
        const categoryName = String(item.category || 'technology');
        const category = escapeHtml(categoryName);
        const categoryKey = escapeHtml(storeCategoryKey(categoryName));
        const interest = encodeURIComponent(item.name || 'Product enquiry');
        const image = safeImageSource(item.image);
        const price = item.price_mwk === null || item.price_mwk === undefined || item.price_mwk === ''
          ? 'Contact for price'
          : `MWK ${Number(item.price_mwk).toLocaleString('en-US')}`;
        const stockCount = item.stock === null || item.stock === undefined || item.stock === ''
          ? null
          : Number(item.stock);
        const stockLabel = stockCount === null || !Number.isFinite(stockCount)
          ? 'Availability not listed'
          : stockCount === 0
            ? 'Out of stock'
            : `${stockCount} in stock`;
        const stockClass = stockCount === 0 ? 'out-of-stock' : stockCount > 0 ? 'in-stock' : 'stock-unknown';
        return `<article class="store-card" data-store-item="${categoryKey}"><a class="store-card-image" href="contact.html?interest=${interest}" aria-label="Enquire about ${escapeHtml(item.name)}">${image ? `<img src="${image}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">` : ''}</a><div class="store-card-copy"><span class="panel-kicker">${category}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><p class="store-price">${price} <span class="stock-status ${stockClass}">${stockLabel}</span></p><a class="text-link" href="contact.html?interest=${interest}">Ask about this product</a></div></article>`;
      }),
      render('service', serviceGrid, (item) => {
        const category = escapeHtml(item.category || 'other');
        const interest = encodeURIComponent(item.name || 'Service enquiry');
        return `<article class="service-card" data-service-card data-category="${category}"><span class="service-code">${String(item.position + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><a href="contact.html?interest=${interest}" class="text-link">Ask about this service</a></article>`;
      }),
      render('project', projectGrid, (item) => {
        const image = safeImageSource(item.image);
        const media = image
          ? `<div class="project-image"><img src="${image}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async"></div>`
          : `<div class="project-image image-placeholder" data-image-label="${escapeHtml(item.name)}"></div>`;
        return `<article class="project-card">${media}<div><span class="panel-kicker">${escapeHtml(item.category)}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p></div></article>`;
      })
    ]);
    initImageFallbacks();
  }

  async function initCustomNavigation() {
    const navigationLists = document.querySelectorAll('[data-nav-links]');
    if (!navigationLists.length) return;
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) return;
      const data = await response.json();
      (data.pages || []).forEach((page) => {
        navigationLists.forEach((list) => {
          if (list.querySelector(`[data-custom-page="${CSS.escape(page.slug)}"]`)) return;
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.dataset.customPage = page.slug;
          link.href = `page.html?slug=${encodeURIComponent(page.slug)}`;
          link.textContent = page.title;
          item.append(link);
          list.append(item);
        });
      });
    } catch (error) {
      return;
    }
  }

  async function initCustomPage() {
    const title = document.getElementById('customPageTitle');
    const summary = document.getElementById('customPageSummary');
    const body = document.getElementById('customPageBody');
    if (!title || !summary || !body) return;
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
      title.textContent = 'Page not found';
      body.textContent = '';
      return;
    }
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error('Page not found');
      const data = await response.json();
      title.textContent = data.page.title;
      summary.textContent = data.page.summary;
      body.textContent = data.page.body;
      document.title = `${data.page.title} | pEc-XeL Innovations & Technology`;
    } catch (error) {
      title.textContent = 'Page unavailable';
      summary.textContent = '';
      body.textContent = 'This page could not be loaded.';
    }
  }

  function initNav() {
    const toggle = document.querySelector('[data-nav-toggle]');
    const links = document.querySelector('[data-nav-links]');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    links.addEventListener('click', (event) => {
      if (event.target && event.target.matches('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initAiModal() {
    const btn = $('aiAssistantBtn');
    const modal = $('aiAssistantModal');
    if (!btn || !modal) return;

    const closeEls = modal.querySelectorAll('[data-close="true"], .ai-modal-close');

    function openModal() {
      modal.hidden = false;
    }

    function closeModal() {
      modal.hidden = true;
    }

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      openModal();
    });

    closeEls.forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  function initServiceFilters() {
    const chips = Array.from(document.querySelectorAll('[data-filter]'));
    if (!chips.length || !document.querySelector('[data-service-grid]')) return;

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter || 'all';
        chips.forEach((item) => {
          const isActive = item === chip;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-pressed', String(isActive));
        });
        document.querySelectorAll('[data-service-card]').forEach((card) => {
          const category = card.dataset.category || '';
          card.hidden = filter !== 'all' && category !== filter;
        });
      });
    });
  }

  function initStoreFilters() {
    const filters = Array.from(document.querySelectorAll('[data-store-filter]'));
    if (!filters.length || !document.querySelector('[data-store-grid]')) return;

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.dataset.storeFilter || 'all';
        filters.forEach((filter) => {
          const isActive = filter === button;
          filter.classList.toggle('active', isActive);
          filter.setAttribute('aria-pressed', String(isActive));
        });
        applyStoreFilter(category);
      });
    });
  }

  function initIntentLinks() {
    const requestType = $('requestType');
    const message = $('contactMessage');
    const quoteService = $('quoteService');

    document.querySelectorAll('[data-intent]').forEach((link) => {
      link.addEventListener('click', () => {
        const intent = link.getAttribute('data-intent') || '';
        if (requestType && intent) requestType.value = closestRequestType(intent);
        if (message && intent && !message.value.trim()) {
          message.value = `Hello pEc-XeL, I would like help with: ${intent}.`;
        }
        if (quoteService && intent) {
          const next = quoteValueFromIntent(intent);
          if (next) quoteService.value = next;
        }
      });
    });
  }

  function initImageFallbacks() {
    const images = Array.from(document.querySelectorAll('main img:not(.logo-img)'));
    images.forEach((img) => {
      img.addEventListener('error', () => {
        const holder = img.closest('.project-image, .gallery-item, .image-feature, .visual-card') || img.parentElement;
        if (!holder) return;
        holder.classList.add('image-placeholder', 'image-broken');
        if (!holder.getAttribute('data-image-label')) {
          holder.setAttribute('data-image-label', img.alt || 'Image coming soon');
        }
        img.hidden = true;
      }, { once: true });
    });
  }

  function closestRequestType(intent) {
    const text = String(intent).toLowerCase();
    if (text.includes('training')) return 'Training Enrollment';
    if (text.includes('partner')) return 'Partnership';
    if (text.includes('sponsor') || text.includes('mentor')) return 'Sponsorship';
    if (text.includes('electrical')) return 'Electrical Quote';
    if (text.includes('electronics')) return 'Electronics Project';
    if (text.includes('ai')) return 'AI Support';
    return 'Repair Booking';
  }

  function quoteValueFromIntent(intent) {
    const text = String(intent).toLowerCase();
    if (text.includes('laptop')) return 'laptop';
    if (text.includes('electrical')) return 'electrical';
    if (text.includes('electronics')) return 'electronics';
    if (text.includes('ai')) return 'ai';
    if (text.includes('training')) return 'training';
    if (text.includes('phone') || text.includes('mobile')) return 'phone';
    return '';
  }

  function initQuoteTool() {
    const form = $('quoteTool');
    const serviceEl = $('quoteService');
    const complexityEl = $('quoteComplexity');
    const timelineEl = $('quoteTimeline');
    const notesEl = $('quoteNotes');
    const rangeEl = $('quoteRange');
    const summaryEl = $('quoteSummary');
    const whatsappEl = $('quoteWhatsapp');
    if (!form || !serviceEl || !complexityEl || !timelineEl || !rangeEl || !summaryEl || !whatsappEl) return;

    const baseRanges = {
      phone: [25000, 95000],
      laptop: [35000, 180000],
      electrical: [60000, 450000],
      electronics: [50000, 350000],
      ai: [150000, 900000],
      training: [25000, 120000]
    };

    const labels = {
      phone: 'Phone repair',
      laptop: 'Laptop repair',
      electrical: 'Electrical service',
      electronics: 'Electronics project',
      ai: 'AI or software support',
      training: 'Training enrollment'
    };

    function multiplier() {
      const complexity = complexityEl.value;
      const timeline = timelineEl.value;
      let value = 1;
      if (complexity === 'advanced') value += 0.55;
      if (complexity === 'basic') value -= 0.2;
      if (timeline === 'soon') value += 0.15;
      if (timeline === 'urgent') value += 0.32;
      return value;
    }

    function money(value) {
      return `MWK ${Math.round(value).toLocaleString('en-US')}`;
    }

    function updateEstimate() {
      const service = serviceEl.value;
      const range = baseRanges[service] || baseRanges.phone;
      const factor = multiplier();
      const low = range[0] * factor;
      const high = range[1] * factor;
      const label = labels[service] || 'Service';
      const complexity = complexityEl.options[complexityEl.selectedIndex].text;
      const timeline = timelineEl.options[timelineEl.selectedIndex].text;
      const notes = notesEl ? notesEl.value.trim() : '';

      rangeEl.textContent = `${money(low)} - ${money(high)}`;
      summaryEl.textContent = `${label}, ${complexity.toLowerCase()} complexity, ${timeline.toLowerCase()} timeline.`;

      const message = [
        'Hello pEc-XeL, I would like an estimate.',
        `Service: ${label}`,
        `Complexity: ${complexity}`,
        `Timeline: ${timeline}`,
        `Starting range shown: ${rangeEl.textContent}`,
        notes ? `Notes: ${notes}` : ''
      ].filter(Boolean).join('\n');

      whatsappEl.href = buildWhatsappLink(message);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      updateEstimate();
    });

    [serviceEl, complexityEl, timelineEl, notesEl].forEach((el) => {
      if (el) el.addEventListener('input', updateEstimate);
    });

    updateEstimate();
  }

  function initContactForm() {
    const form = $('contactForm');
    const status = $('contactStatus');
    const whatsapp = $('contactWhatsapp');
    if (!form || !whatsapp) return;

    const interest = new URLSearchParams(window.location.search).get('interest');
    const messageField = form.elements.namedItem('message');
    if (interest && messageField && !messageField.value) {
      messageField.value = `Hello pEc-XeL, I would like information about ${interest}.`;
    }

    function updateLink() {
      const data = new FormData(form);
      const name = safeText(data.get('name')).trim();
      const email = safeText(data.get('email')).trim();
      const type = safeText(data.get('requestType')).trim();
      const message = safeText(data.get('message')).trim();

      const body = [
        'Hello pEc-XeL, I would like assistance.',
        name ? `Name: ${name}` : '',
        email ? `Email: ${email}` : '',
        type ? `Request: ${type}` : '',
        message ? `Message: ${message}` : ''
      ].filter(Boolean).join('\n');

      whatsapp.href = buildWhatsappLink(body);
    }

    form.addEventListener('input', updateLink);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      updateLink();
      if (status) status.textContent = 'Message prepared. Use Open WhatsApp to send it.';
    });

    updateLink();
  }

  function initWelcomeToast() {
    const toast = $('welcomeToast');
    if (!toast) return;

    const storageKey = 'pecxel_welcome_toast_v2';
    let alreadyShown = false;
    try {
      alreadyShown = localStorage.getItem(storageKey) === 'shown';
    } catch (e) {
      alreadyShown = false;
    }

    if (alreadyShown) return;

    toast.hidden = false;
    const closeBtn = toast.querySelector('[data-close-welcome]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.hidden = true;
        try {
          localStorage.setItem(storageKey, 'shown');
        } catch (e) {}
      });
    }
  }

  const blogGrid = $('blogDynamicGrid');
  const donationPreview = $('donationPreviewHtml');
  const donationMethods = $('donationMethods');

  function renderBlogCards(posts) {
    if (!blogGrid) return;

    if (!posts || !posts.length) {
      blogGrid.innerHTML =
        '<article class="blog-card"><h3>No posts yet</h3><p>Ask admin to publish a post.</p></article>';
      return;
    }

    blogGrid.innerHTML = posts.slice(0, 4).map((post) => {
      const title = escapeHtml(post.title);
      const slug = safeText(post.slug);
      const date = escapeHtml(post.date || 'No date');
      const category = post.category ? `<span class="panel-kicker">${escapeHtml(post.category)}</span>` : '';

      return `
        <article class="blog-card">
          ${category}
          <h3>${title}</h3>
          <p>${date}</p>
          <div class="section-actions">
            <a href="post.html?slug=${encodeURIComponent(slug)}" class="btn btn-ghost">Read Post</a>
          </div>
        </article>
      `;
    }).join('');
  }

  function extractMethodTextFromDonationHtml(html, label) {
    const div = document.createElement('div');
    div.innerHTML = html || '';

    const headings = Array.from(div.querySelectorAll('h1,h2,h3,b,strong'));
    const heading = headings.find((el) => String(el.textContent || '').toLowerCase().includes(String(label || '').toLowerCase()));
    if (!heading) return '';

    let out = '';
    let node = heading;
    const stopTags = new Set(['H1', 'H2', 'H3', 'B', 'STRONG']);

    while (node && node.nextSibling) {
      const next = node.nextSibling;
      if (next.nodeType === 1 && stopTags.has(next.tagName)) break;
      if (next.nodeType === 3) {
        const text = next.textContent.trim();
        if (text) out += text + ' ';
      } else if (next.nodeType === 1) {
        const text = next.textContent.trim();
        if (text) out += text + ' ';
      }
      node = next;
      if (out.length > 500) break;
    }

    return out.trim();
  }

  async function loadHomepageDynamics() {
    try {
      if (blogGrid) {
        blogGrid.innerHTML = '<article class="blog-card bb-blog-skeleton"><h3>Loading...</h3><p>Fetching latest published posts from the site.</p></article>';
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('Unable to load published posts.');
        const data = await res.json();
        renderBlogCards(data.posts || []);
      }
    } catch (e) {
      if (blogGrid) {
        blogGrid.innerHTML = '<article class="blog-card"><h3>Blog preview unavailable</h3><p>Please check server/API.</p></article>';
      }
      console.error(e);
    }

    if (!donationPreview) return;

    try {
      donationPreview.textContent = 'Loading donation preview...';
      const res = await fetch('/api/donations');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const donation = (data.donations && data.donations[0]) ? data.donations[0] : null;

      if (!donation) {
        donationPreview.innerHTML = '<p>No published donation content yet.</p>';
        return;
      }

      const html = donation.content_html || '';
      donationPreview.innerHTML = html;

      if (donationMethods) {
        const items = donationMethods.querySelectorAll('li');
        const airtel = extractMethodTextFromDonationHtml(html, 'Airtel');
        const paypal = extractMethodTextFromDonationHtml(html, 'PayPal');
        const momoOrBank =
          extractMethodTextFromDonationHtml(html, 'MoMo') ||
          extractMethodTextFromDonationHtml(html, 'Mobile') ||
          extractMethodTextFromDonationHtml(html, 'Bank') ||
          extractMethodTextFromDonationHtml(html, 'TNM');

        items.forEach((li) => {
          const text = String(li.textContent || '').toLowerCase();
          if (airtel && text.includes('airtel')) li.textContent = airtel;
          if (paypal && text.includes('paypal')) li.textContent = paypal;
          if (momoOrBank && (text.includes('tnm') || text.includes('momo') || text.includes('bank'))) {
            li.textContent = momoOrBank;
          }
        });
      }
    } catch (e) {
      donationPreview.innerHTML = '<p>Donation preview unavailable.</p>';
      console.error(e);
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(() => {
    initNav();
    initAiModal();
    initServiceFilters();
    initStoreFilters();
    initImageFallbacks();
    initIntentLinks();
    initQuoteTool();
    initContactForm();
    initWelcomeToast();
    initSiteSettings();
    initPublicCatalog();
    initCustomNavigation();
    initCustomPage();
    loadHomepageDynamics();
  });
})();
