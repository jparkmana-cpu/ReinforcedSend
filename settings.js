import { getContext, extension_settings, extension_path } from "../../../extensions.js";

const extension_name = "ReinforcedSend";

export let settings;

const defaultSettings = {
    retry_delay: 30, // seconds
    max_retries: 3,
};

// 설정 값 변경 시 호출되는 함수
function onSettingsChanged() {
    const delayInput = document.getElementById('retry_delay_input');
    const retriesInput = document.getElementById('max_retries_input');

    settings.retry_delay = parseInt(delayInput.value) || defaultSettings.retry_delay;
    settings.max_retries = parseInt(retriesInput.value) || defaultSettings.max_retries;

    getContext().saveSettingsDebounced();
}

// 설정 UI를 로드하는 함수
async function loadSettingsUI() {
    const modulePath = `/scripts/extensions/third-party/${extension_name}`;
    const settingsHtml = await $.get(`${modulePath}/templates/settings_panel.html`);
    $('#extensions_settings').append(settingsHtml);

    // 저장된 값으로 UI 초기화
    $('#retry_delay_input').val(settings.retry_delay);
    $('#max_retries_input').val(settings.max_retries);

    // 이벤트 리스너 연결
    $('#retry_delay_input').on('change', onSettingsChanged);
    $('#max_retries_input').on('change', onSettingsChanged);
}

// 메인 함수: 설정 객체를 초기화하고 UI를 로드
export function loadSettings() {
    settings = extension_settings[extension_name] ?? {};
    Object.assign(settings, { ...defaultSettings, ...settings });
    extension_settings[extension_name] = settings;

    loadSettingsUI();
}
