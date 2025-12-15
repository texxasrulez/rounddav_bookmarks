<?php

class rounddav_bookmarks extends rcube_plugin
{
    public $task   = 'settings|mail';
    public $noajax = false;

    private $rcmail;
    private $api_credentials = [];

    public function init()
    {
        $this->rcmail = rcmail::get_instance();

        $this->add_texts('localization/', true);
        $this->load_api_credentials();

        $this->include_stylesheet('rounddav_bookmarks_base.css');
        $this->include_stylesheet($this->local_skin_path() . '/rounddav_bookmarks.css');
        $this->include_script('rounddav_bookmarks.js');

        $this->rcmail->output->set_env('rounddav_bookmarks_available', $this->api_credentials ? true : false);

        $this->add_label(
            'rounddav_bookmarks.loading',
            'rounddav_bookmarks.nobookmarks',
            'rounddav_bookmarks.errorgeneric',
            'rounddav_bookmarks.save',
            'rounddav_bookmarks.cancel',
            'rounddav_bookmarks.sharedlabel',
            'rounddav_bookmarks.privatelabel',
            'rounddav_bookmarks.bookmarkadded',
            'rounddav_bookmarks.bookmarkupdated',
            'rounddav_bookmarks.bookmarkdeleted',
            'rounddav_bookmarks.filterapply',
            'rounddav_bookmarks.filterclear',
            'rounddav_bookmarks.filtersearch',
            'rounddav_bookmarks.filterfavorites',
            'rounddav_bookmarks.filterscope_all',
            'rounddav_bookmarks.filterscope_private',
            'rounddav_bookmarks.filterscope_shared',
            'rounddav_bookmarks.filterfolder_all',
            'rounddav_bookmarks.activitytitle',
            'rounddav_bookmarks.activityempty',
            'rounddav_bookmarks.activityprivate',
            'rounddav_bookmarks.activityshared',
            'rounddav_bookmarks.activitycustom',
            'rounddav_bookmarks.sharemode',
            'rounddav_bookmarks.sharemode_domain',
            'rounddav_bookmarks.sharemode_custom',
            'rounddav_bookmarks.shareusers',
            'rounddav_bookmarks.sharedomains',
            'rounddav_bookmarks.filtertags',
            'rounddav_bookmarks.shareusersplaceholder',
            'rounddav_bookmarks.sharedomainsplaceholder'
        );

        $this->add_hook('settings_actions', [$this, 'settings_actions']);

        $this->register_action('plugin.rounddav_bookmarks', [$this, 'settings_screen']);
        $this->register_action('plugin.rounddav_bookmarks.list', [$this, 'action_list']);
        $this->register_action('plugin.rounddav_bookmarks.meta', [$this, 'action_meta']);
        $this->register_action('plugin.rounddav_bookmarks.create', [$this, 'action_create']);
        $this->register_action('plugin.rounddav_bookmarks.update', [$this, 'action_update']);
        $this->register_action('plugin.rounddav_bookmarks.delete', [$this, 'action_delete']);
        $this->register_action('plugin.rounddav_bookmarks.folder_create', [$this, 'action_folder_create']);
        $this->register_action('plugin.rounddav_bookmarks.folder_delete', [$this, 'action_folder_delete']);
        $this->register_action('plugin.rounddav_bookmarks.quick_add', [$this, 'action_quick_add']);
        $this->register_action('plugin.rounddav_bookmarks.activity', [$this, 'action_activity']);
        $this->register_action('plugin.rounddav_bookmarks.app', [$this, 'bookmarklet_popup']);
    }

    public function settings_actions($args)
    {
        $args['actions'][] = [
            'action' => 'plugin.rounddav_bookmarks',
            'class'  => 'rounddav_bookmarks',
            'label'  => 'rounddav_bookmarks_menu',
            'domain' => 'rounddav_bookmarks',
            'title'  => 'rounddav_bookmarks',
        ];

        return $args;
    }

    public function settings_screen()
    {
        $this->register_handler('plugin.body', [$this, 'settings_body']);

        $this->rcmail->output->set_env('rounddav_bookmarks_available', $this->api_credentials ? true : false);
        $this->rcmail->output->set_env('rounddav_bookmarklet_url', $this->build_bookmarklet_url());

        $this->rcmail->output->set_pagetitle($this->gettext('rounddav_bookmarks'));
        $this->rcmail->output->send('plugin');
    }

    public function settings_body()
    {
        $shared_label = $this->gettext('sharedbookmarks');
        $private_label = $this->gettext('privatebookmarks');

        $header = html::tag('header', ['class' => 'rdv-bookmarks-head'],
            html::tag('div', ['class' => 'rdv-title-block'],
                html::tag('h2', [], $this->gettext('rounddav_bookmarks')) .
                html::tag('p', ['class' => 'muted'], $this->gettext('introtext'))
            ) .
            html::tag('div', ['class' => 'rdv-head-actions'],
                html::tag('a', [
                    'href'        => '#',
                    'class'       => 'rdv-bookmarklet-link',
                    'id'          => 'rdv-bookmarklet-link',
                    'title'       => $this->gettext('bookmarklethelp'),
                    'draggable'   => 'true',
                ], $this->gettext('bookmarkletlink')) .
                html::tag('button', [
                    'type'  => 'button',
                    'class' => 'button rdv-refresh',
                    'id'    => 'rdv-refresh',
                ], $this->gettext('refresh'))
            )
        );

        $filter_form = html::div(['class' => 'rdv-filter-card'],
            html::tag('form', ['id' => 'rdv-filter-form', 'class' => 'rdv-filter-grid'], implode('', [
                html::div(['class' => 'rdv-filter-field'],
                    html::tag('label', ['for' => 'rdv-filter-search'], $this->gettext('filtersearch')) .
                    html::tag('input', [
                        'type'        => 'text',
                        'name'        => 'search',
                        'id'          => 'rdv-filter-search',
                        'placeholder' => $this->gettext('filtersearch'),
                    ])
                ),
                html::div(['class' => 'rdv-filter-field'],
                    html::tag('label', ['for' => 'rdv-filter-tags'], $this->gettext('filtertags')) .
                    html::tag('input', [
                        'type'        => 'text',
                        'name'        => 'tags',
                        'id'          => 'rdv-filter-tags',
                        'placeholder' => $this->gettext('fieldtags'),
                    ])
                ),
                html::div(['class' => 'rdv-filter-field'],
                    html::tag('label', ['for' => 'rdv-filter-visibility'], $this->gettext('filterscope')) .
                    html::tag('select', ['name' => 'visibility', 'id' => 'rdv-filter-visibility'],
                        html::tag('option', ['value' => 'all'], $this->gettext('filterscope_all')) .
                        html::tag('option', ['value' => 'private'], $this->gettext('filterscope_private')) .
                        html::tag('option', ['value' => 'shared'], $this->gettext('filterscope_shared'))
                    )
                ),
                html::div(['class' => 'rdv-filter-field'],
                    html::tag('label', ['for' => 'rdv-filter-folder'], $this->gettext('filterfolder')) .
                    html::tag('select', ['name' => 'folder_id', 'id' => 'rdv-filter-folder'],
                        html::tag('option', ['value' => ''], $this->gettext('filterfolder_all'))
                    )
                ),
                html::div(['class' => 'rdv-filter-field rdv-filter-checkbox'],
                    html::tag('label', ['for' => 'rdv-filter-favorites'],
                        html::tag('input', [
                            'type' => 'checkbox',
                            'name' => 'favorite_only',
                            'id'   => 'rdv-filter-favorites',
                            'value'=> '1',
                        ]) . $this->gettext('filterfavorites')
                    )
                ),
                html::div(['class' => 'rdv-filter-actions'],
                    html::tag('button', ['type' => 'submit', 'class' => 'button main-action'], $this->gettext('filterapply')) .
                    html::tag('button', ['type' => 'button', 'class' => 'button sub-action', 'id' => 'rdv-filter-reset'], $this->gettext('filterclear'))
                ),
            ]))
        );

        $form = html::div(['class' => 'rdv-form-card'],
            html::tag('h3', [], $this->gettext('addbookmark')) .
            html::tag('form', ['id' => 'rdv-bookmark-form'], implode('', [
                html::div(['class' => 'rdv-form-columns'],
                    html::div(['class' => 'rdv-form-column rdv-form-left'],
                        $this->input_group('title', $this->gettext('fieldtitle'), 'text') .
                        $this->input_group('url', $this->gettext('fieldurl'), 'url') .
                        $this->input_group('description', $this->gettext('fielddescription'), 'textarea')
                    ) .
                    html::div(['class' => 'rdv-form-column rdv-form-right'],
                        $this->visibility_group() .
                        $this->share_controls() .
                        $this->folder_group()
                    )
                ),
                html::div(['class' => 'rdv-row-wide'],
                    $this->input_group('tags', $this->gettext('fieldtags'), 'text')
                ),
                html::tag('div', ['class' => 'rdv-checkbox'],
                    html::tag('input', ['type' => 'checkbox', 'name' => 'favorite', 'value' => '1', 'id' => 'rdv-favorite']) .
                    html::tag('label', ['for' => 'rdv-favorite'], $this->gettext('favorite'))
                ),
                html::tag('div', ['class' => 'rdv-form-actions'],
                    html::tag('button', ['type' => 'submit', 'class' => 'button main-action'], $this->gettext('save')) .
                    html::tag('button', ['type' => 'button', 'class' => 'button sub-action', 'id' => 'rdv-reset-form'], $this->gettext('cancel'))
                ),
            ]))
        );

        $columns = html::div(['class' => 'rdv-columns'],
            html::div(['class' => 'rdv-column'],
                html::tag('h3', [], $private_label) .
                html::div(['id' => 'rdv-private-list', 'class' => 'rdv-bookmark-list'])
            ) .
            html::div(['class' => 'rdv-column'],
                html::tag('h3', ['id' => 'rdv-shared-title'], $shared_label) .
                html::div(['id' => 'rdv-shared-list', 'class' => 'rdv-bookmark-list'])
            ) .
            html::div(['class' => 'rdv-column rdv-activity-column'],
                html::tag('h3', [], $this->gettext('activitytitle')) .
                html::div(['id' => 'rdv-activity-list', 'class' => 'rdv-activity-list'])
            )
        );

        return html::div(['id' => 'rounddav-bookmarks'], $header . $filter_form . $form . $columns);
    }

    public function bookmarklet_popup()
    {
        $url   = trim((string) rcube_utils::get_input_value('_bkurl', rcube_utils::INPUT_GPC));
        $title = trim((string) rcube_utils::get_input_value('_bktitle', rcube_utils::INPUT_GPC));

        $this->rcmail->output->set_env('rounddav_bookmarklet_url_value', $url);
        $this->rcmail->output->set_env('rounddav_bookmarklet_title_value', $title);
        $this->rcmail->output->set_env('rounddav_bookmarks_available', $this->api_credentials ? true : false);

        $this->register_handler('plugin.body', function () {
            return html::div(['class' => 'rdv-bookmarklet-popup'],
                html::tag('h2', [], $this->gettext('quickaddtitle')) .
                html::tag('p', ['class' => 'muted'], $this->gettext('quickaddhint')) .
                html::tag('form', ['id' => 'rdv-quick-form'],
                    $this->input_group('title', $this->gettext('fieldtitle'), 'text', 'rdv-quick-title') .
                    $this->input_group('url', $this->gettext('fieldurl'), 'url', 'rdv-quick-url') .
                    $this->visibility_group('quick') .
                    html::tag('div', ['class' => 'rdv-form-actions'],
                        html::tag('button', ['type' => 'submit', 'class' => 'button main-action'], $this->gettext('save'))
                    )
                )
            );
        });

        $this->rcmail->output->set_env('framed', true);
        $this->rcmail->output->send('plugin');
    }

    public function action_list()
    {
        $filters = isset($_POST['filters']) && is_array($_POST['filters']) ? $_POST['filters'] : [];

        $data = $this->api_request('bookmarks/list', [
            'include_shared' => true,
            'filters'        => $filters,
        ]);

        $this->json_response($data);
    }

    public function action_meta()
    {
        $data = $this->api_request('bookmarks/meta');
        $this->json_response($data);
    }

    public function action_create()
    {
        $payload = $this->collect_bookmark_payload();
        $response = $this->api_request('bookmarks/create', $payload);
        $this->json_response($response);
    }

    public function action_update()
    {
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        if ($id <= 0) {
            $this->json_error('Invalid bookmark id');
        }

        $payload         = $this->collect_bookmark_payload();
        $payload['id']   = $id;
        $response        = $this->api_request('bookmarks/update', $payload);
        $this->json_response($response);
    }

    public function action_delete()
    {
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        if ($id <= 0) {
            $this->json_error('Invalid bookmark id');
        }

        $response = $this->api_request('bookmarks/delete', ['id' => $id]);
        $this->json_response($response);
    }

    public function action_folder_create()
    {
        $parent_id = rcube_utils::get_input_value('parent_id', rcube_utils::INPUT_POST);
        if ($parent_id === '' || $parent_id === null) {
            $parent_id = null;
        } else {
            $parent_id = (int) $parent_id;
        }

        $payload = [
            'name'       => trim((string) rcube_utils::get_input_value('name', rcube_utils::INPUT_POST)),
            'visibility' => rcube_utils::get_input_value('visibility', rcube_utils::INPUT_POST),
            'parent_id'  => $parent_id,
        ];

        $response = $this->api_request('bookmarks/folder/create', $payload);
        $this->json_response($response);
    }

    public function action_folder_delete()
    {
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        if ($id <= 0) {
            $this->json_error('Invalid folder id');
        }

        $response = $this->api_request('bookmarks/folder/delete', ['id' => $id]);
        $this->json_response($response);
    }

    public function action_quick_add()
    {
        $payload = $this->collect_bookmark_payload(true);
        $response = $this->api_request('bookmarks/create', $payload);
        $this->json_response($response);
    }

    public function action_activity()
    {
        $limit = (int) rcube_utils::get_input_value('limit', rcube_utils::INPUT_POST);
        if ($limit <= 0) {
            $limit = 40;
        }

        $response = $this->api_request('bookmarks/activity', ['limit' => $limit]);
        $this->json_response($response);
    }

    private function input_group($name, $label, $type = 'text', $id = null)
    {
        $id = $id ?: 'rdv-' . $name;

        if ($type === 'textarea') {
            $input = html::tag('textarea', [
                'name' => $name,
                'id'   => $id,
                'rows' => 3,
            ], '');
        } else {
            $input = html::tag('input', [
                'type' => $type,
                'name' => $name,
                'id'   => $id,
            ]);
        }

        return html::tag('label', ['for' => $id], $label) . $input;
    }

    private function visibility_group($prefix = '')
    {
        $id = $prefix ? 'rdv-visibility-' . $prefix : 'rdv-visibility';

        return html::tag('label', ['for' => $id], $this->gettext('visibility')) .
            html::tag('select', ['name' => 'visibility', 'id' => $id],
                html::tag('option', ['value' => 'private'], $this->gettext('privatelabel')) .
                html::tag('option', ['value' => 'shared'], $this->gettext('sharedlabel'))
            );
    }

    private function folder_group()
    {
        $select = html::tag('select', ['name' => 'folder_id', 'id' => 'rdv-folder'],
            html::tag('option', ['value' => ''], $this->gettext('nofolder'))
        );

        $button = html::tag('button', [
            'type'  => 'button',
            'class' => 'button sub-action',
            'id'    => 'rdv-add-folder',
        ], $this->gettext('createfolder'));

        return html::tag('label', ['for' => 'rdv-folder'], $this->gettext('folder')) .
            html::tag('div', ['class' => 'rdv-folder-row'], $select . $button);
    }

    private function share_controls()
    {
        return html::div(['class' => 'rdv-share-settings', 'id' => 'rdv-share-settings'],
            html::tag('label', ['for' => 'rdv-share-mode'], $this->gettext('sharemode')) .
            html::tag('select', ['name' => 'share_mode', 'id' => 'rdv-share-mode'],
                html::tag('option', ['value' => 'domain'], $this->gettext('sharemode_domain')) .
                html::tag('option', ['value' => 'custom'], $this->gettext('sharemode_custom'))
            ) .
            html::div(['class' => 'rdv-share-custom', 'id' => 'rdv-share-custom'],
                html::tag('label', ['for' => 'rdv-share-users'], $this->gettext('shareusers')) .
                html::tag('input', [
                    'type'        => 'text',
                    'name'        => 'share_users',
                    'id'          => 'rdv-share-users',
                    'placeholder' => $this->gettext('shareusersplaceholder'),
                ]) .
                html::tag('label', ['for' => 'rdv-share-domains'], $this->gettext('sharedomains')) .
                html::tag('input', [
                    'type'        => 'text',
                    'name'        => 'share_domains',
                    'id'          => 'rdv-share-domains',
                    'placeholder' => $this->gettext('sharedomainsplaceholder'),
                ])
            )
        );
    }

    private function load_api_credentials(): void
    {
        $hook = $this->rcmail->plugins->exec_hook('rounddav_api_credentials', ['credentials' => []]);
        $creds = isset($hook['credentials']) && is_array($hook['credentials']) ? $hook['credentials'] : [];

        if (!empty($creds['api_url']) && !empty($creds['api_token'])) {
            $this->api_credentials = [
                'api_url'   => $creds['api_url'],
                'api_token' => $creds['api_token'],
                'timeout'   => isset($creds['timeout']) ? (int) $creds['timeout'] : 5,
                'verify_ssl'=> isset($creds['verify_ssl']) ? (bool) $creds['verify_ssl'] : true,
            ];
        } else {
            rcube::write_log('errors', 'rounddav_bookmarks: API credentials missing (is rounddav_provision enabled?)');
        }
    }

    private function build_api_url(string $route): string
    {
        $base = $this->api_credentials['api_url'] ?? '';
        if ($base === '') {
            return '';
        }

        if (strpos($base, 'r=') !== false) {
            return preg_replace('/r=[^&]+/', 'r=' . rawurlencode($route), $base);
        }

        $separator = strpos($base, '?') === false ? '?' : '&';
        return $base . $separator . 'r=' . rawurlencode($route);
    }

    private function collect_bookmark_payload(bool $quick = false): array
    {
        $payload = [
            'title'       => trim((string) rcube_utils::get_input_value('title', rcube_utils::INPUT_POST)),
            'url'         => trim((string) rcube_utils::get_input_value('url', rcube_utils::INPUT_POST)),
            'description' => trim((string) rcube_utils::get_input_value('description', rcube_utils::INPUT_POST)),
            'tags'        => rcube_utils::get_input_value('tags', rcube_utils::INPUT_POST),
            'visibility'  => rcube_utils::get_input_value('visibility', rcube_utils::INPUT_POST) ?: 'private',
            'folder_id'   => rcube_utils::get_input_value('folder_id', rcube_utils::INPUT_POST),
            'favorite'    => rcube_utils::get_input_value('favorite', rcube_utils::INPUT_POST) ? 1 : 0,
        ];

        if ($payload['folder_id'] === '') {
            $payload['folder_id'] = null;
        } else {
            $payload['folder_id'] = (int) $payload['folder_id'];
        }

        if ($quick) {
            $payload['description'] = '';
            $payload['tags']        = null;
        }
        else {
            $payload['share_mode']    = rcube_utils::get_input_value('share_mode', rcube_utils::INPUT_POST) ?: 'domain';
            $payload['share_users']   = rcube_utils::get_input_value('share_users', rcube_utils::INPUT_POST);
            $payload['share_domains'] = rcube_utils::get_input_value('share_domains', rcube_utils::INPUT_POST);
        }

        return $payload;
    }

    private function api_request(string $route, array $payload = [])
    {
        if (!$this->api_credentials) {
            $this->json_error($this->gettext('nocredentials'));
        }

        $payload['username'] = $this->rcmail->get_user_name();

        $url = $this->build_api_url($route);
        if ($url === '') {
            $this->json_error($this->gettext('nocredentials'));
        }

        $payload_json = json_encode($payload);
        if ($payload_json === false) {
            $this->json_error('Invalid payload');
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload_json);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->api_credentials['timeout']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-RoundDAV-Token: ' . $this->api_credentials['api_token'],
        ]);

        if (empty($this->api_credentials['verify_ssl'])) {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        }

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            rcube::write_log('errors', 'rounddav_bookmarks API error: ' . $error);
            $this->json_error($this->gettext('errorgeneric'));
        }

        $data = json_decode($response, true);
        if ($data === null) {
            rcube::write_log('errors', 'rounddav_bookmarks API invalid JSON: ' . $response);
            $this->json_error($this->gettext('errorgeneric'));
        }

        return $data;
    }

    private function json_response($data)
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
        exit;
    }

    private function json_error(string $message)
    {
        $this->json_response(['status' => 'error', 'message' => $message]);
    }

    private function build_bookmarklet_url(): string
    {
        $task = $this->rcmail->task;
        $attrib = [
            '_task'  => $task,
            '_action'=> 'plugin.rounddav_bookmarks.app',
            '_framed'=> 1,
        ];

        return $this->rcmail->url($attrib, true);
    }
}
