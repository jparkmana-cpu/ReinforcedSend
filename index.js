import { getContext } from "../../../extensions.js";
import { eventSource, event_types, Generate } from "../../../script.js";
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
    console.log("[Reinforced Send] updateButtonState:", state);
    switch (state) {
        case 'retrying':
            buttonElement.classList.add('retrying');
            buttonElement.title = "재전송 중... (클릭하여 중지)";
            iconElement.className = 'fa-solid fa-circle-stop stop-icon';
            break;
        case 'idle':
        default:
            buttonElement.classList.remove('retrying');
            buttonElement.title = "강화된 전송 (응답 없을 시 자동 재시도)";
            iconElement.className = 'fa-solid fa-shield-halved';
            break;
    }
}

// [동작 2] 재전송 성공 또는 수동 중지 시 모든 상태를 초기화하는 함수
function stopAndReset(reason) {
    console.log("[Reinforced Send] stopAndReset:", reason);
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
async function retrySend() {
    console.log("[Reinforced Send] retrySend called");
    if (!isRetrying) return;

    retryCount++;
    if (retryCount > settings.max_retries) {
        stopAndReset('fail');
        return;
    }

    console.log(`[Reinforced Send] Retrying send (Attempt ${retryCount}/${settings.max_retries}).`);
    toastr.info(`AI 응답이 없어 메시지를 다시 전송합니다. (시도 ${retryCount}/${settings.max_retries})`, "강화된 전송");

    // 메시지 재전송
    try {
        console.log("[Reinforced Send] Calling Generate('regenerate')");
        await Generate('regenerate');
    } catch (error) {
        console.error("[Reinforced Send] Error during retry:", error);
    }
    
    retryTimer = setTimeout(retrySend, settings.retry_delay * 1000);
}

// [동작 4] 메인 버튼 클릭 핸들러
async function handleButtonClick(event) {
    console.log("[Reinforced Send] Button clicked!");
    event?.preventDefault();
    event?.stopPropagation();
    
    // 이미 재시도 중일 때 클릭하면, 수동 중지 기능으로 작동
    if (isRetrying) {
        console.log("[Reinforced Send] Already retrying, stopping...");
        stopAndReset('manual');
        return;
    }

    const textarea = document.getElementById('send_textarea');
    console.log("[Reinforced Send] Textarea element:", textarea);
    
    const messageText = textarea?.value.trim();
    console.log("[Reinforced Send] Message text:", messageText);

    if (!messageText) {
        console.log("[Reinforced Send] No message text");
        toastr.warning("메시지를 입력해주세요.", "강화된 전송");
        return;
    }

    console.log("[Reinforced Send] Starting initial send...");
    isRetrying = true;
    lastMessage = messageText;
    retryCount = 0;

    updateButtonState('retrying');
    
    // 여러 방법 시도
    try {
        console.log("[Reinforced Send] Method 1: Trying $('#send_but').trigger('click')");
        $('#send_but').trigger('click');
        
        // 대기 시간 후 재시도 타이머 시작
        retryTimer = setTimeout(retrySend, settings.retry_delay * 1000);
        console.log("[Reinforced Send] Retry timer set for", settings.retry_delay, "seconds");
    } catch (error) {
        console.error("[Reinforced Send] Error during initial send:", error);
        stopAndReset('fail');
    }
}

// [초기화] jQuery 로드 후 실행
jQuery(async () => {
    console.log("[Reinforced Send] Initializing extension...");
    
    // 1. 설정부터 로드
    loadSettings();
    console.log("[Reinforced Send] Settings loaded:", settings);

    // 2. UI 템플릿 로드 및 삽입
    const modulePath = `/scripts/extensions/third-party/${extension_name}`;
    console.log("[Reinforced Send] Loading button HTML from:", modulePath);
    
    try {
        const buttonHtml = await $.get(`${modulePath}/templates/button.html`);
        console.log("[Reinforced Send] Button HTML loaded");
        
        const sendButton = $('#send_but');
        console.log("[Reinforced Send] Send button found:", sendButton.length > 0);
        
        sendButton.before(buttonHtml);
        console.log("[Reinforced Send] Button HTML inserted");
    } catch (error) {
        console.error("[Reinforced Send] Error loading button HTML:", error);
        return;
    }

    // 3. UI 요소 캐싱 및 이벤트 연결
    buttonElement = document.getElementById('reinforced_send_button');
    iconElement = document.getElementById('reinforced_send_icon');
    
    console.log("[Reinforced Send] Button element:", buttonElement);
    console.log("[Reinforced Send] Icon element:", iconElement);
    
    if (!buttonElement) {
        console.error("[Reinforced Send] Button element not found!");
        return;
    }
    
    buttonElement.addEventListener('click', handleButtonClick);
    console.log("[Reinforced Send] Click handler attached");
    
    // 4. SillyTavern 이벤트 리스너 설정
    const successCallback = () => {
        console.log("[Reinforced Send] Success callback triggered");
        stopAndReset('success');
    };
    
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, successCallback);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, successCallback);
    console.log("[Reinforced Send] Event listeners attached");
    
    console.log("[Reinforced Send] Extension loaded successfully!");
    toastr.success("강화된 전송 버튼이 활성화되었습니다.", "확장 로드");
});
