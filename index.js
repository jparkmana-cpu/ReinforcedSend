// 올바른 코드 (수정)
import { getContext, extension_path } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";
import { loadSettings, settings } from "./settings.js";

const extension_name = "ReinforcedSend";

// 상태 관리 변수
let isRetrying = false;
let retryTimer = null;
let lastMessage = '';
let retryCount = 0;

// UI 요소 캐싱
let buttonElement;
let iconElement;

// [동작 1] 버튼의 상태와 모양을 업데이트하는 함수
function updateButtonState(state) {
    switch (state) {
        case 'retrying':
            buttonElement.classList.add('retrying');
            buttonElement.title = "재전송 중... (클릭하여 중지)";
            iconElement.className = 'fa-solid fa-circle-stop stop-icon'; // 중지 아이콘으로 변경
            break;
        case 'idle':
        default:
            buttonElement.classList.remove('retrying');
            buttonElement.title = "강화된 전송 (응답 없을 시 자동 재시도)";
            iconElement.className = 'fa-solid fa-shield-halved'; // 원래 방패 아이콘으로 복원
            break;
    }
}

// [동작 2] 재전송 성공 또는 수동 중지 시 모든 상태를 초기화하는 함수
function stopAndReset(reason) {
    if (!isRetrying) return;

    if (reason === 'success') {
        console.log("[Reinforced Send] Response received. Stopping.");
        toastr.success("AI 응답을 받았습니다.", "강화된 전송");
    } else if (reason === 'manual') {
        console.log("[Reinforced Send] Manually stopped.");
        toastr.warning("재전송을 수동으로 중지했습니다.", "강화된 전송");
    } else if (reason === 'fail') {
        console.log(`[Reinforced Send] Max retries (${settings.max_retries}) reached. Stopping.`);
        toastr.error(`최대 재시도 횟수(${settings.max_retries}회)에 도달하여 전송을 중단합니다.`, "강화된 전송");
    }

    clearTimeout(retryTimer);
    isRetrying = false;
    lastMessage = '';
    retryTimer = null;
    retryCount = 0;
    updateButtonState('idle');
}

// [동작 3] 재전송 로직
function retrySend() {
    if (!isRetrying) return;

    retryCount++;
    if (retryCount > settings.max_retries) {
        stopAndReset('fail');
        return;
    }

    const context = getContext();
    console.log(`[Reinforced Send] Retrying send (Attempt ${retryCount}/${settings.max_retries}).`);
    toastr.info(`AI 응답이 없어 메시지를 다시 전송합니다. (시도 ${retryCount}/${settings.max_retries})`, "강화된 전송");

    context.sendSystemMessage('send', lastMessage);
    retryTimer = setTimeout(retrySend, settings.retry_delay * 1000);
}

// [동작 4] 메인 버튼 클릭 핸들러
async function handleButtonClick() {
    // 이미 재시도 중일 때 클릭하면, 수동 중지 기능으로 작동
    if (isRetrying) {
        stopAndReset('manual');
        return;
    }

    const context = getContext();
    const textarea = document.getElementById('send_textarea');
    const messageText = textarea.value.trim();

    if (!messageText) return;

    console.log("[Reinforced Send] Initial send.");
    isRetrying = true;
    lastMessage = messageText;
    retryCount = 0;

    updateButtonState('retrying');
    context.submitMessage();
    retryTimer = setTimeout(retrySend, settings.retry_delay * 1000);
}

// [초기화] jQuery 로드 후 실행
jQuery(async () => {
    // 1. 설정부터 로드
    loadSettings();

    // 2. UI 템플릿 로드 및 삽입
    const buttonHtml = await $.get(`${extension_path}/${extension_name}/templates/button.html`);
    $('#send_but').before(buttonHtml);

    // 3. UI 요소 캐싱 및 이벤트 연결
    buttonElement = document.getElementById('reinforced_send_button');
    iconElement = document.getElementById('reinforced_send_icon');
    buttonElement.addEventListener('click', handleButtonClick);
    
    // 4. SillyTavern 이벤트 리스너 설정
    const successCallback = () => stopAndReset('success');
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, successCallback);
    eventSource.on(event_types.GENERATE_FOR_CHAT_START, successCallback);
});
