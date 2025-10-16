import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, send_chat, main_api } from "../../../../script.js";

const extensionName = "gemini-auto-retry"; // 폴더 이름과 일치하도록 변경
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 기본 설정값
const defaultSettings = {
    enabled: true,
    retryDelay: 30, // 30초
    maxRetries: 5,
};

// 재전송 상태를 관리하는 변수들
let isWaitingForResponse = false;
let retryTimer = null;
let retryCount = 0;
let lastMessageContent = "";

// 설정 로드
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    extension_settings[extensionName] = defaultSettings;

    // UI에 설정값 반영
    $("#es_enabled").prop("checked", defaultSettings.enabled);
    $("#es_retry_delay").val(defaultSettings.retryDelay);
    $("#es_max_retries").val(defaultSettings.maxRetries);
}

// 설정 변경 시 호출되는 함수
function onSettingsChange() {
    defaultSettings.enabled = $("#es_enabled").prop("checked");
    defaultSettings.retryDelay = Number($("#es_retry_delay").val());
    defaultSettings.maxRetries = Number($("#es_max_retries").val());
    saveSettingsDebounced();
}

// 재전송 상태를 초기화하는 함수
function resetRetryState() {
    clearTimeout(retryTimer);
    isWaitingForResponse = false;
    retryCount = 0;
    lastMessageContent = "";
    $("#enhanced-send-button").removeClass("waiting").prop("disabled", false).text("🚀");
    console.log("[Enhanced Send] 재전송 상태가 초기화되었습니다.");
}

// 재전송을 시도하는 함수
function attemptRetry() {
    if (!isWaitingForResponse) return;

    retryCount++;
    if (retryCount > defaultSettings.maxRetries) {
        toastr.error(`최대 재시도 횟수(${defaultSettings.maxRetries}회)를 초과했습니다.`, "전송 실패");
        resetRetryState();
        return;
    }

    toastr.info(`${retryCount}번째 재전송을 시도합니다...`, "응답 없음");
    send_chat(lastMessageContent); // 마지막 메시지를 다시 보냄

    // 다음 재시도 타이머 설정
    retryTimer = setTimeout(attemptRetry, defaultSettings.retryDelay * 1000);
}

// 강화된 전송 버튼 클릭 시 실행될 메인 함수
function onEnhancedSend() {
    if (isWaitingForResponse) {
        toastr.warning("이미 응답을 기다리는 중입니다. 취소하려면 버튼을 다시 누르세요.");
        resetRetryState();
        return;
    }

    // 현재 API가 Gemini인지 확인 (선택적이지만 유용함)
    if (main_api !== 'gemini') {
        toastr.warning('현재 API가 Gemini가 아닙니다. 일반 전송으로 처리합니다.');
        // #send_but 클릭을 시뮬레이션하여 일반 전송 실행
        $('#send_but').click();
        return;
    }

    const context = getContext();
    const message = context.userInput;

    if (!message.trim()) return;

    isWaitingForResponse = true;
    lastMessageContent = message;
    retryCount = 0;

    // UI 업데이트: 대기 상태로 변경
    $("#enhanced-send-button").addClass("waiting").prop("disabled", true).text("⏳");

    // 첫 메시지 전송
    send_chat(message);

    // 재시도 타이머 시작
    retryTimer = setTimeout(attemptRetry, defaultSettings.retryDelay * 1000);
}

// 채팅 메시지가 생성될 때마다 응답을 감지하는 함수
function onMessageGenerated() {
    if (isWaitingForResponse) {
        // is_user 클래스가 없는, 즉 AI의 응답이 오면
        const latestMessage = $('#chat .mes:not(.is_user)').last();
        if (latestMessage.length) {
            console.log("[Enhanced Send] AI 응답을 감지했습니다.");
            toastr.success("AI 응답을 받았습니다!", "전송 성공");
            resetRetryState();
        }
    }
}

// 확장 프로그램이 로드될 때 실행
jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings2").append(settingsHtml); // 오른쪽 컬럼에 설정 UI 추가

    // 강화된 전송 버튼 생성 및 추가
    const enhancedButton = $('<button id="enhanced-send-button" title="강화된 전송">🚀</button>');
    $('#send_but').parent().append(enhancedButton);

    // 이벤트 리스너 등록
    enhancedButton.on("click", onEnhancedSend);
    $("#es_enabled, #es_retry_delay, #es_max_retries").on("input", onSettingsChange);

    // MutationObserver를 사용하여 채팅창의 변화 감지
    const observer = new MutationObserver(onMessageGenerated);
    observer.observe(document.getElementById('chat'), { childList: true });

    loadSettings();
});
