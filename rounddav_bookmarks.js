(function(window, document, $) {
  if (!window.rcmail || !$) {
    return;
  }

  const plugin = {
    state: {
      data: null,
      meta: null,
      editingId: null,
      frames: new Set(),
      filters: {
        visibility: 'all',
      },
    },

    init: function() {
      rcmail.addEventListener('init', () => {
        this.ajax_url = rcmail.env.comm_path || './?_remote=1';
        this.boot();
      });
    },

    boot: function() {
      this.setupBookmarkletLink();

      if (rcmail.task === 'settings' && rcmail.env.action === 'plugin.rounddav_bookmarks') {
        this.initSettingsView();
      }

      if (rcmail.env.action === 'plugin.rounddav_bookmarks_app') {
        this.initBookmarkletPopup();
      }

      if (rcmail.task === 'mail') {
        this.initMailHooks();
      }
    },

    setupBookmarkletLink: function() {
      const link = $('#rdv-bookmarklet-link');
      if (!link.length || !rcmail.env.rounddav_bookmarklet_url) {
        return;
      }
      const base = rcmail.env.rounddav_bookmarklet_url.replace(/'/g, '%27');
      const bookmarklet = "javascript:(function(){var w=window.open('" +
        base + (base.indexOf('?') === -1 ? '?' : '&') +
        "_bkurl='+encodeURIComponent(location.href)+'&_bktitle='+encodeURIComponent(document.title)," +
        "'rounddav_bookmarklet','width=520,height=480,noopener'); if(w){w.focus();}})();";
      link.attr('href', bookmarklet);
    },

    initSettingsView: function() {
      this.$root = $('#rounddav-bookmarks');
      if (!rcmail.env.rounddav_bookmarks_available) {
        this.$root.html(
          $('<div class="rdv-empty"/>').text(rcmail.gettext('nocredentials', 'rounddav_bookmarks'))
        );
        return;
      }

      $('#rdv-bookmark-form').on('submit', (ev) => {
        ev.preventDefault();
        this.submitForm();
      });

      $('#rdv-reset-form').on('click', (ev) => {
        ev.preventDefault();
        this.resetForm();
      });

      $('#rdv-refresh').on('click', () => this.loadData());

      this.$privateList = $('#rdv-private-list');
      this.$sharedList  = $('#rdv-shared-list');
      this.$folderSelect = $('#rdv-folder');
      $('#rdv-add-folder').on('click', (ev) => {
        ev.preventDefault();
        this.createFolderPrompt();
      });
      this.$filterForm   = $('#rdv-filter-form');
      this.$filterFolder = $('#rdv-filter-folder');
      this.$activityList = $('#rdv-activity-list');
      this.$shareSettings = $('#rdv-share-settings');
      this.$shareMode    = $('#rdv-share-mode');
      this.$shareCustom  = $('#rdv-share-custom');
      this.$shareUsers   = $('#rdv-share-users');
      this.$shareDomains = $('#rdv-share-domains');

      $('#rdv-visibility').on('change', () => this.updateShareControls());
      if (this.$shareMode && this.$shareMode.length) {
        this.$shareMode.on('change', () => this.updateShareControls());
      }
      if (this.$filterForm && this.$filterForm.length) {
        this.$filterForm.on('submit', (ev) => {
          ev.preventDefault();
          this.applyFilterForm();
        });
      }
      $('#rdv-filter-reset').on('click', (ev) => {
        ev.preventDefault();
        this.resetFilters();
      });
      this.updateShareControls();
      this.applyFiltersToForm();

      this.loadData();
    },

    initBookmarkletPopup: function() {
      if (!rcmail.env.rounddav_bookmarks_available) {
        $('.rdv-bookmarklet-popup').text(rcmail.gettext('nocredentials', 'rounddav_bookmarks'));
        return;
      }

      const $form = $('#rdv-quick-form');
      $form.find('input[name="url"]').val(rcmail.env.rounddav_bookmarklet_url_value || '');
      $form.find('input[name="title"]').val(rcmail.env.rounddav_bookmarklet_title_value || '');

      $form.on('submit', (ev) => {
        ev.preventDefault();
        const payload = {
          title: $form.find('input[name="title"]').val(),
          url: $form.find('input[name="url"]').val(),
          visibility: $form.find('select[name="visibility"]').val(),
        };
        this.api('plugin.rounddav_bookmarks.quick_add', payload)
          .done((resp) => {
            this.handleResponse(resp, rcmail.gettext('bookmarkadded', 'rounddav_bookmarks'));
            setTimeout(() => window.close(), 1000);
          })
          .fail(() => {
            this.showError();
          });
      });
    },

    initMailHooks: function() {
      if (!rcmail.env.rounddav_bookmarks_available) {
        return;
      }

      document.addEventListener('contextmenu', (ev) => this.handleContextMenu(ev, document));
      this.observeMessageFrames();
    },

    observeMessageFrames: function() {
      const bindFrame = (frame) => {
        if (!frame || !frame.contentWindow || this.state.frames.has(frame)) {
          return;
        }
        this.state.frames.add(frame);
        const handler = (ev) => this.handleContextMenu(ev, frame.contentDocument, frame);
        frame.addEventListener('load', () => {
          frame.contentDocument && frame.contentDocument.addEventListener('contextmenu', handler);
        });
        if (frame.contentDocument) {
          frame.contentDocument.addEventListener('contextmenu', handler);
        }
      };

      const scan = () => {
        document.querySelectorAll('iframe').forEach(bindFrame);
      };

      scan();
      setInterval(scan, 3000);
    },

    handleContextMenu: function(ev, doc, frame) {
      const anchor = ev.target && (ev.target.closest ? ev.target.closest('a') : null);
      if (!anchor || !anchor.href) {
        return;
      }
      ev.preventDefault();
      const title = anchor.textContent && anchor.textContent.trim() ? anchor.textContent.trim() : anchor.href;
      const coords = this.translateCoords(ev, frame);
      this.openContextMenu({
        href: anchor.href,
        title: title,
      }, coords);
    },

    translateCoords: function(ev, frame) {
      let x = ev.pageX;
      let y = ev.pageY;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        x += rect.left + window.scrollX;
        y += rect.top + window.scrollY;
      }
      return { x, y };
    },

    openContextMenu: function(link, coords) {
      this.ensureMeta().then((meta) => {
        this.closeContextMenu();
        const menu = $('<div class="rdv-context-menu" />');
        const addButton = (label, visibility) => {
          $('<button type="button"/>')
            .text(label)
            .on('click', () => {
              this.saveQuickBookmark(link, visibility);
              this.closeContextMenu();
            })
            .appendTo(menu);
        };

        $('<button type="button"/>')
          .text(rcmail.gettext('openlink', 'rounddav_bookmarks'))
          .on('click', () => {
            window.open(link.href, '_blank');
            this.closeContextMenu();
          })
          .appendTo(menu);

        addButton(rcmail.gettext('contextprivate', 'rounddav_bookmarks'), 'private');

        if (meta.shared_enabled) {
          const label = rcmail.gettext('contextshared', 'rounddav_bookmarks')
            .replace('%s', meta.shared_label || rcmail.gettext('sharedbookmarks', 'rounddav_bookmarks'));
          addButton(label, 'shared');
        }

        menu.css({
          left: coords.x + 'px',
          top: coords.y + 'px',
        });

        $(document.body).append(menu);
        this.contextMenu = menu;

        setTimeout(() => {
          $(document).on('click.rdv-menu', () => this.closeContextMenu());
        }, 0);
      });
    },

    closeContextMenu: function() {
      if (this.contextMenu) {
        this.contextMenu.remove();
        this.contextMenu = null;
        $(document).off('click.rdv-menu');
      }
    },

    ensureMeta: function() {
      if (this.state.meta) {
        return Promise.resolve(this.state.meta);
      }

      return new Promise((resolve, reject) => {
        this.api('plugin.rounddav_bookmarks.meta', {})
          .done((resp) => {
            if (resp && resp.status === 'ok') {
              this.state.meta = resp.data;
              resolve(resp.data);
            } else {
              this.showError(resp && resp.message);
              reject();
            }
          })
          .fail(() => {
            this.showError();
            reject();
          });
      });
    },

    saveQuickBookmark: function(link, visibility) {
      this.api('plugin.rounddav_bookmarks.quick_add', {
        title: link.title,
        url: link.href,
        visibility: visibility
      }).done((resp) => {
        if (resp && resp.status === 'ok') {
          this.handleResponse(resp, rcmail.gettext('bookmarkadded', 'rounddav_bookmarks'));
        } else {
          this.showError(resp && resp.message);
        }
      }).fail(() => this.showError());
    },

    loadData: function() {
      this.setLoading(true);
      const filters = this.state.filters || { visibility: 'all' };
      this.api('plugin.rounddav_bookmarks.list', { filters: filters })
        .done((resp) => {
          this.setLoading(false);
          this.handleResponse(resp);
          if (resp && resp.status === 'ok') {
            this.state.data = resp.data;
            this.state.meta = {
              shared_enabled: resp.data.shared_enabled,
              shared_label: resp.data.shared_label,
            };
            this.renderLists();
            this.loadActivity();
          }
        })
        .fail(() => {
          this.setLoading(false);
          this.showError();
        });
    },

    renderLists: function() {
      if (!this.state.data) {
        return;
      }

      this.populateFolderOptions();
      this.populateFilterFolders();
      this.applyFiltersToForm();
      this.renderListSection(this.$privateList, this.state.data.bookmarks.private || []);
      this.renderListSection(this.$sharedList, this.state.data.bookmarks.shared || []);
      $('#rdv-shared-title').text(this.state.meta && this.state.meta.shared_label
        ? this.state.meta.shared_label
        : rcmail.gettext('sharedbookmarks', 'rounddav_bookmarks'));
    },

    populateFolderOptions: function() {
      const folders = this.state.data.folders;
      const visitor = (list) => list.map((folder) => ({
        id: folder.id,
        name: folder.name,
        visibility: folder.visibility
      }));
      const allFolders = [
        { id: '', name: rcmail.gettext('nofolder', 'rounddav_bookmarks'), visibility: 'private' },
        ...visitor(folders.private || []),
        ...visitor(folders.shared || []),
      ];
      this.$folderSelect.empty();
      allFolders.forEach((f) => {
        $('<option/>')
          .attr('value', f.id)
          .attr('data-visibility', f.visibility)
        .text(f.name + (f.visibility === 'shared' ? ' • ' + (this.state.meta.shared_label || 'Shared') : ''))
        .appendTo(this.$folderSelect);
      });
    },

    populateFilterFolders: function() {
      if (!this.$filterFolder || !this.$filterFolder.length || !this.state.data) {
        return;
      }
      const sharedLabel = (this.state.meta && this.state.meta.shared_label) || rcmail.gettext('sharedbookmarks', 'rounddav_bookmarks');
      this.$filterFolder.empty();
      $('<option/>')
        .attr('value', '')
        .text(rcmail.gettext('filterfolder_all', 'rounddav_bookmarks'))
        .appendTo(this.$filterFolder);

      const addOptions = (list, visibility) => {
        (list || []).forEach((folder) => {
          $('<option/>')
            .attr('value', folder.id)
            .attr('data-visibility', visibility)
            .text(folder.name + (visibility === 'shared' ? ' • ' + sharedLabel : ''))
            .appendTo(this.$filterFolder);
        });
      };

      addOptions(this.state.data.folders.private || [], 'private');
      addOptions(this.state.data.folders.shared || [], 'shared');

      if (this.state.filters && this.state.filters.folder_id) {
        this.$filterFolder.val(String(this.state.filters.folder_id));
      }
    },

    collectFiltersFromForm: function() {
      const filters = {
        visibility: $('#rdv-filter-visibility').val() || 'all',
      };
      const search = $('#rdv-filter-search').val();
      if (search && search.trim() !== '') {
        filters.search = search.trim();
      }
      const tagsValue = $('#rdv-filter-tags').val();
      if (tagsValue && tagsValue.trim() !== '') {
        const tags = tagsValue.split(',').map((tag) => tag.trim()).filter(Boolean);
        if (tags.length) {
          filters.tags = tags;
        }
      }
      if ($('#rdv-filter-favorites').is(':checked')) {
        filters.favorite_only = 1;
      }
      if (this.$filterFolder && this.$filterFolder.length) {
        const folderVal = this.$filterFolder.val();
        if (folderVal) {
          filters.folder_id = folderVal;
          const selected = this.$filterFolder.find('option:selected');
          const visibility = selected.data('visibility');
          if (visibility) {
            filters.folder_visibility = visibility;
          }
        }
      }
      return filters;
    },

    applyFilterForm: function() {
      this.state.filters = this.collectFiltersFromForm();
      if (!this.state.filters.visibility) {
        this.state.filters.visibility = 'all';
      }
      this.loadData();
    },

    resetFilters: function() {
      this.state.filters = { visibility: 'all' };
      $('#rdv-filter-search, #rdv-filter-tags').val('');
      $('#rdv-filter-visibility').val('all');
      $('#rdv-filter-favorites').prop('checked', false);
      if (this.$filterFolder && this.$filterFolder.length) {
        this.$filterFolder.val('');
      }
      this.loadData();
    },

    applyFiltersToForm: function() {
      const filters = this.state.filters || { visibility: 'all' };
      $('#rdv-filter-visibility').val(filters.visibility || 'all');
      $('#rdv-filter-search').val(filters.search || '');
      $('#rdv-filter-tags').val(filters.tags ? filters.tags.join(', ') : '');
      $('#rdv-filter-favorites').prop('checked', !!filters.favorite_only);
      if (this.$filterFolder && this.$filterFolder.length) {
        this.$filterFolder.val(filters.folder_id ? String(filters.folder_id) : '');
      }
    },

    updateShareControls: function() {
      if (!this.$shareSettings || !this.$shareSettings.length) {
        return;
      }
      const visibility = $('#rdv-visibility').val();
      if (visibility === 'shared') {
        this.$shareSettings.show();
        if (this.$shareMode && this.$shareMode.val() === 'custom') {
          this.$shareCustom && this.$shareCustom.show();
        } else if (this.$shareCustom) {
          this.$shareCustom.hide();
        }
      } else {
        this.$shareSettings.hide();
      }
    },

    createFolderPrompt: function() {
      const label = rcmail.gettext('promptfoldername', 'rounddav_bookmarks');
      const name = window.prompt(label);
      if (!name) {
        return;
      }
      const visibility = $('#rdv-visibility').val() || 'private';
      this.api('plugin.rounddav_bookmarks.folder_create', {
        name: name,
        visibility: visibility
      }).done((resp) => {
        if (resp && resp.status === 'ok') {
          this.handleResponse(resp, rcmail.gettext('foldercreated', 'rounddav_bookmarks'));
          this.loadData();
        } else {
          this.showError(resp && resp.message);
        }
      }).fail(() => this.showError());
    },

    renderListSection: function(container, items) {
      container.empty();
      if (!items.length) {
        container.append(
          $('<div class="rdv-empty"/>').text(rcmail.gettext('nobookmarks', 'rounddav_bookmarks'))
        );
        return;
      }

      items.forEach((item) => {
      container.append(this.buildBookmarkCard(item));
      });

      container.find('[data-action]').off('click').on('click', (ev) => {
        const action = ev.currentTarget.getAttribute('data-action');
        const id = parseInt(ev.currentTarget.closest('.rdv-bookmark-card').getAttribute('data-id'), 10);
        if (action === 'edit') {
          this.startEdit(id);
        } else if (action === 'delete') {
          this.deleteBookmark(id);
        } else if (action === 'favorite') {
          this.toggleFavorite(id);
        }
      });
    },

    loadActivity: function() {
      if (!this.$activityList || !this.$activityList.length) {
        return;
      }
      this.api('plugin.rounddav_bookmarks.activity', { limit: 40 })
        .done((resp) => {
          if (resp && resp.status === 'ok') {
            this.renderActivity(resp.data || []);
          } else {
            this.renderActivity([]);
          }
        })
        .fail(() => {
          this.renderActivity([]);
        });
    },

    renderActivity: function(items) {
      if (!this.$activityList || !this.$activityList.length) {
        return;
      }
      const container = this.$activityList;
      container.empty();

      if (!items || !items.length) {
        container.append(
          $('<div class="rdv-empty"/>').text(rcmail.gettext('activityempty', 'rounddav_bookmarks'))
        );
        return;
      }

      items.forEach((item) => {
        const scope = this.scopeLabel(item);
        const actionLabel = this.describeActivity(item.action);
        const title = item.title || (item.details && item.details.title) || item.url || actionLabel;
        const card = $('<div class="rdv-activity-item"/>');
        $('<h4/>').text(title).appendTo(card);
        const meta = $('<div class="rdv-activity-meta"/>');
        $('<span/>').addClass('rdv-activity-scope').text(scope).appendTo(meta);
        $('<span/>').text(this.formatDate(item.created_at)).appendTo(meta);
        meta.appendTo(card);
        $('<div class="rdv-activity-action"/>')
          .text((item.actor || '') + ' ' + actionLabel)
          .appendTo(card);
        container.append(card);
      });
    },

    describeActivity: function(action) {
      const key = 'activityaction_' + action;
      const text = rcmail.gettext(key, 'rounddav_bookmarks');
      return text === key ? action : text;
    },

    scopeLabel: function(item) {
      if (item.share_scope === 'custom') {
        return rcmail.gettext('activitycustom', 'rounddav_bookmarks');
      }
      return item.visibility === 'shared'
        ? rcmail.gettext('activityshared', 'rounddav_bookmarks')
        : rcmail.gettext('activityprivate', 'rounddav_bookmarks');
    },

    formatDate: function(value) {
      if (!value) {
        return '';
      }
      try {
        // Safari-safe replace
        const normalized = value.replace(' ', 'T');
        return new Date(normalized).toLocaleString();
      } catch (e) {
        return value;
      }
    },

    buildBookmarkCard: function(item) {
      const card = $('<div class="rdv-bookmark-card"/>').attr('data-id', item.id);
      const favicon = $('<div class="rdv-favicon"/>');
      if (item.icon && item.icon.data) {
        $('<img/>')
          .attr('src', 'data:' + item.icon.mime + ';base64,' + item.icon.data)
          .attr('alt', '')
          .appendTo(favicon);
      } else {
        favicon.text('★');
      }
      const info = $('<div class="rdv-bookmark-info"/>');
      $('<a target="_blank"/>').attr('href', item.url).text(item.title).appendTo(info);
      $('<div class="rdv-meta"/>').text(item.url).appendTo(info);
      if (item.folder_id) {
        $('<div class="rdv-meta"/>').text(rcmail.gettext('folder', 'rounddav_bookmarks') + ': #' + item.folder_id).appendTo(info);
      }
      if (item.tags && item.tags.length) {
        const tags = $('<div class="rdv-meta"/>');
        item.tags.forEach((tag) => tags.append($('<span class="rdv-tag"/>').text(tag)));
        tags.appendTo(info);
      }

      const actions = $('<div class="rdv-bookmark-actions"/>');
      $('<button type="button" data-action="favorite"/>')
        .text(item.favorite ? rcmail.gettext('unfavorite', 'rounddav_bookmarks') : rcmail.gettext('favorite', 'rounddav_bookmarks'))
        .appendTo(actions);
      $('<button type="button" data-action="edit"/>')
        .text(rcmail.gettext('editbookmark', 'rounddav_bookmarks'))
        .appendTo(actions);
      $('<button type="button" data-action="delete"/>')
        .text(rcmail.gettext('delete', 'rounddav_bookmarks'))
        .appendTo(actions);

      card.append(favicon, info, actions);
      return card;
    },

    submitForm: function() {
      const data = $('#rdv-bookmark-form').serializeArray().reduce((acc, field) => {
        acc[field.name] = field.value;
        return acc;
      }, {});

      const action = this.state.editingId
        ? 'plugin.rounddav_bookmarks.update'
        : 'plugin.rounddav_bookmarks.create';

      if (this.state.editingId) {
        data.id = this.state.editingId;
      }

      this.api(action, data)
        .done((resp) => {
          if (resp && resp.status === 'ok') {
            this.handleResponse(resp, this.state.editingId
              ? rcmail.gettext('bookmarkupdated', 'rounddav_bookmarks')
              : rcmail.gettext('bookmarkadded', 'rounddav_bookmarks'));
            this.resetForm();
            this.loadData();
          } else {
            this.showError(resp && resp.message);
          }
        })
        .fail(() => this.showError());
    },

    startEdit: function(id) {
      const bookmark = this.findBookmark(id);
      if (!bookmark) {
        return;
      }
      this.state.editingId = id;
      const $form = $('#rdv-bookmark-form');
      $form.find('input[name="title"]').val(bookmark.title);
      $form.find('input[name="url"]').val(bookmark.url);
      $form.find('textarea[name="description"]').val(bookmark.description || '');
      $form.find('input[name="tags"]').val((bookmark.tags || []).join(', '));
      $form.find('select[name="visibility"]').val(bookmark.visibility);
      $form.find('select[name="folder_id"]').val(bookmark.folder_id || '');
      $form.find('input[name="favorite"]').prop('checked', !!bookmark.favorite);
      if (bookmark.visibility === 'shared') {
        const mode = bookmark.share_scope === 'custom' ? 'custom' : 'domain';
        $('#rdv-share-mode').val(mode);
        if (mode === 'custom') {
          const users = (bookmark.shares || []).filter((s) => s.type === 'user').map((s) => s.target);
          const domains = (bookmark.shares || []).filter((s) => s.type === 'domain').map((s) => s.target);
          this.$shareUsers && this.$shareUsers.val(users.join(', '));
          this.$shareDomains && this.$shareDomains.val(domains.join(', '));
        } else {
          this.$shareUsers && this.$shareUsers.val('');
          this.$shareDomains && this.$shareDomains.val('');
        }
      } else {
        $('#rdv-share-mode').val('domain');
        this.$shareUsers && this.$shareUsers.val('');
        this.$shareDomains && this.$shareDomains.val('');
      }
      this.updateShareControls();
    },

    resetForm: function() {
      this.state.editingId = null;
      const $form = $('#rdv-bookmark-form');
      $form[0].reset();
      $('#rdv-share-mode').val('domain');
      if (this.$shareUsers) this.$shareUsers.val('');
      if (this.$shareDomains) this.$shareDomains.val('');
      this.updateShareControls();
    },

    deleteBookmark: function(id) {
      if (!window.confirm(rcmail.gettext('confirmdelete', 'rounddav_bookmarks'))) {
        return;
      }
      this.api('plugin.rounddav_bookmarks.delete', { id })
        .done((resp) => {
          if (resp && resp.status === 'ok') {
            this.handleResponse(resp, rcmail.gettext('bookmarkdeleted', 'rounddav_bookmarks'));
            this.loadData();
          } else {
            this.showError(resp && resp.message);
          }
        })
        .fail(() => this.showError());
    },

    toggleFavorite: function(id) {
      const bookmark = this.findBookmark(id);
      if (!bookmark) {
        return;
      }
      const data = {
        id: id,
        title: bookmark.title,
        url: bookmark.url,
        visibility: bookmark.visibility,
        description: bookmark.description || '',
        tags: (bookmark.tags || []).join(','),
        folder_id: bookmark.folder_id || '',
        favorite: bookmark.favorite ? 0 : 1,
      };
      this.api('plugin.rounddav_bookmarks.update', data)
        .done((resp) => {
          if (resp && resp.status === 'ok') {
            this.loadData();
          } else {
            this.showError(resp && resp.message);
          }
        })
        .fail(() => this.showError());
    },

    findBookmark: function(id) {
      const stacks = [
        (this.state.data && this.state.data.bookmarks.private) || [],
        (this.state.data && this.state.data.bookmarks.shared) || [],
      ];
      for (const list of stacks) {
        const match = list.find((item) => item.id === id);
        if (match) {
          return match;
        }
      }
      return null;
    },

    setLoading: function(flag) {
      if (!this.$root) {
        return;
      }
      this.$root.toggleClass('rdv-loading', !!flag);
    },

    api: function(action, data) {
      data = data || {};
      data._token = rcmail.env.request_token;
      return $.ajax({
        url: this.ajax_url + '&_action=' + encodeURIComponent(action),
        type: 'POST',
        dataType: 'json',
        data: data,
      });
    },

    handleResponse: function(resp, successMsg) {
      if (!resp) {
        this.showError();
        return;
      }
      if (resp.status !== 'ok') {
        this.showError(resp.message);
        return;
      }
      if (successMsg) {
        rcmail.display_message(successMsg, 'confirmation');
      }
    },

    showError: function(msg) {
      rcmail.display_message(msg || rcmail.gettext('errorgeneric', 'rounddav_bookmarks'), 'error');
    },
  };

  plugin.init();

  window.RounddavBookmarks = plugin;
})(window, document, window.jQuery);
