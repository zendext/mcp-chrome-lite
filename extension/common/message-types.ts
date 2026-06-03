export const BACKGROUND_MESSAGE_TYPES = {
  ELEMENT_PICKER_UI_EVENT: 'element_picker_ui_event',
  ELEMENT_PICKER_FRAME_EVENT: 'element_picker_frame_event',
} as const;

export const TOOL_MESSAGE_TYPES = {
  SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
  SCREENSHOT_GET_PAGE_DETAILS: 'getPageDetails',
  SCREENSHOT_GET_ELEMENT_DETAILS: 'getElementDetails',
  SCREENSHOT_SCROLL_PAGE: 'scrollPage',
  SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',

  WEB_FETCHER_GET_HTML_CONTENT: 'getHtmlContent',
  WEB_FETCHER_GET_TEXT_CONTENT: 'getTextContent',

  CLICK_ELEMENT: 'clickElement',
  FILL_ELEMENT: 'fillElement',
  SIMULATE_KEYBOARD: 'simulateKeyboard',

  GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',
  GENERATE_ACCESSIBILITY_TREE: 'generateAccessibilityTree',
  RESOLVE_REF: 'resolveRef',
  ENSURE_REF_FOR_SELECTOR: 'ensureRefForSelector',
  VERIFY_FINGERPRINT: 'verifyFingerprint',
  DISPATCH_HOVER_FOR_REF: 'dispatchHoverForRef',

  NETWORK_SEND_REQUEST: 'sendPureNetworkRequest',
  WAIT_FOR_TEXT: 'waitForText',

  ELEMENT_PICKER_START: 'elementPickerStart',
  ELEMENT_PICKER_STOP: 'elementPickerStop',
  ELEMENT_PICKER_SET_ACTIVE_REQUEST: 'elementPickerSetActiveRequest',
  ELEMENT_PICKER_UI_PING: 'elementPickerUiPing',
  ELEMENT_PICKER_UI_SHOW: 'elementPickerUiShow',
  ELEMENT_PICKER_UI_UPDATE: 'elementPickerUiUpdate',
  ELEMENT_PICKER_UI_HIDE: 'elementPickerUiHide',
} as const;

export type BackgroundMessageType =
  (typeof BACKGROUND_MESSAGE_TYPES)[keyof typeof BACKGROUND_MESSAGE_TYPES];

export type ToolMessageType =
  (typeof TOOL_MESSAGE_TYPES)[keyof typeof TOOL_MESSAGE_TYPES];
