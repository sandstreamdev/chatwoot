import Cookies from 'js-cookie';
import {
  wootOn,
  addClass,
  loadCSS,
  removeClass,
  onLocationChangeListener,
} from './DOMHelpers';
import {
  body,
  widgetHolder,
  createBubbleHolder,
  createBubbleIcon,
  bubbleImg,
  chatBubble,
  closeBubble,
  bubbleHolder,
  createNotificationBubble,
  onClickChatBubble,
  onBubbleClick,
  setBubbleText,
  addUnreadClass,
  removeUnreadClass,
} from './bubbleHelpers';
import { dispatchWindowEvent } from '../shared/helpers/CustomEventHelper';
import { CHATWOOT_ERROR, CHATWOOT_READY } from '../widget/constants/sdkEvents';
import { SET_USER_ERROR } from '../widget/constants/errorTypes';
import { getUserCookieName } from './cookieHelpers';
import {
  getAlertAudio,
  initOnEvents,
} from '../shared/helpers/AudioNotificationHelper';
import { isFlatWidgetStyle } from './settingsHelper';
import { popoutChatWindow } from '../widget/helpers/popoutHelper';

window.IFrameHelper = {
  getUrl({ baseUrl, websiteToken }) {
    return `${baseUrl}/widget?website_token=${websiteToken}`;
  },
  createFrame: ({ baseUrl, websiteToken }) => {
    if (window.IFrameHelper.getAppFrame()) {
      return;
    }

    loadCSS();
    const iframe = document.createElement('iframe');
    const cwCookie = Cookies.get('cw_conversation');
    let widgetUrl = window.IFrameHelper.getUrl({ baseUrl, websiteToken });
    if (cwCookie) {
      widgetUrl = `${widgetUrl}&cw_conversation=${cwCookie}`;
    }
    iframe.src = widgetUrl;

    iframe.id = 'chatwoot_live_chat_widget';
    iframe.classList.add('chatwoot_live_chat_widget--hidden');

    let holderClassName = `woot-widget-holder woot--hide woot-elements--${window.$chatwoot.position}`;
    if (window.$chatwoot.hideMessageBubble) {
      holderClassName += ` woot-widget--without-bubble`;
    }
    if (isFlatWidgetStyle(window.$chatwoot.widgetStyle)) {
      holderClassName += ` woot-widget-holder--flat`;
    }

    addClass(widgetHolder, holderClassName);
    widgetHolder.appendChild(iframe);
    body.appendChild(widgetHolder);
    window.IFrameHelper.initPostMessageCommunication();
    window.IFrameHelper.initWindowSizeListener();
    window.IFrameHelper.preventDefaultScroll();
  },
  getAppFrame: () => document.getElementById('chatwoot_live_chat_widget'),
  getBubbleHolder: () => document.getElementsByClassName('woot--bubble-holder'),
  sendMessage: (key, value) => {
    const element = window.IFrameHelper.getAppFrame();
    element.contentWindow.postMessage(
      `chatwoot-widget:${JSON.stringify({ event: key, ...value })}`,
      '*'
    );
  },
  initPostMessageCommunication: () => {
    window.onmessage = e => {
      if (
        typeof e.data !== 'string' ||
        e.data.indexOf('chatwoot-widget:') !== 0
      ) {
        return;
      }
      const message = JSON.parse(e.data.replace('chatwoot-widget:', ''));
      if (typeof window.IFrameHelper.events[message.event] === 'function') {
        window.IFrameHelper.events[message.event](message);
      }
    };
  },
  initWindowSizeListener: () => {
    wootOn(window, 'resize', () => window.IFrameHelper.toggleCloseButton());
  },
  preventDefaultScroll: () => {
    widgetHolder.addEventListener('wheel', event => {
      const deltaY = event.deltaY;
      const contentHeight = widgetHolder.scrollHeight;
      const visibleHeight = widgetHolder.offsetHeight;
      const scrollTop = widgetHolder.scrollTop;

      if (
        (scrollTop === 0 && deltaY < 0) ||
        (visibleHeight + scrollTop === contentHeight && deltaY > 0)
      ) {
        event.preventDefault();
      }
    });
  },

  setFrameHeightToFitContent: (extraHeight, isFixedHeight) => {
    const iframe = window.IFrameHelper.getAppFrame();
    const updatedIframeHeight = isFixedHeight ? `${extraHeight}px` : '100%';

    if (iframe)
      iframe.setAttribute('style', `height: ${updatedIframeHeight} !important`);
  },

  setupAudioListeners: () => {
    const { baseUrl = '' } = window.$chatwoot;
    getAlertAudio(baseUrl, 'widget').then(() =>
      initOnEvents.forEach(event => {
        document.removeEventListener(
          event,
          window.IFrameHelper.setupAudioListeners,
          false
        );
      })
    );
  },

  events: {
    loaded: message => {
      Cookies.set('cw_conversation', message.config.authToken, {
        expires: 365,
        sameSite: 'Lax',
        ...window.$chatwoot.cookieOptions,
      });
      window.$chatwoot.hasLoaded = true;
      window.IFrameHelper.sendMessage('config-set', {
        locale: window.$chatwoot.locale,
        position: window.$chatwoot.position,
        hideMessageBubble: window.$chatwoot.hideMessageBubble,
        showPopoutButton: window.$chatwoot.showPopoutButton,
        widgetStyle: window.$chatwoot.widgetStyle,
        darkMode: window.$chatwoot.darkMode,
      });
      window.IFrameHelper.onLoad({
        widgetColor: message.config.channelConfig.widgetColor,
      });
      window.IFrameHelper.toggleCloseButton();

      if (window.$chatwoot.user) {
        window.IFrameHelper.sendMessage('set-user', window.$chatwoot.user);
      }

      window.playAudioAlert = () => {};

      initOnEvents.forEach(e => {
        document.addEventListener(
          e,
          window.IFrameHelper.setupAudioListeners,
          false
        );
      });

      if (!window.$chatwoot.resetTriggered) {
        dispatchWindowEvent({ eventName: CHATWOOT_READY });
      }
    },
    error: ({ errorType, data }) => {
      dispatchWindowEvent({ eventName: CHATWOOT_ERROR, data: data });

      if (errorType === SET_USER_ERROR) {
        Cookies.remove(getUserCookieName());
      }
    },

    setBubbleLabel(message) {
      setBubbleText(window.$chatwoot.launcherTitle || message.label);
    },

    toggleBubble: state => {
      let bubbleState = {};
      if (state === 'open') {
        bubbleState.toggleValue = true;
      } else if (state === 'close') {
        bubbleState.toggleValue = false;
      }

      onBubbleClick(bubbleState);
    },

    popoutChatWindow: ({ baseUrl, websiteToken, locale }) => {
      const cwCookie = Cookies.get('cw_conversation');
      window.$chatwoot.toggle('close');
      popoutChatWindow(baseUrl, websiteToken, locale, cwCookie);
    },

    closeWindow: () => {
      onBubbleClick({ toggleValue: false });
      removeUnreadClass();
    },

    onBubbleToggle: isOpen => {
      window.IFrameHelper.sendMessage('toggle-open', { isOpen });
      if (isOpen) {
        window.IFrameHelper.pushEvent('webwidget.triggered');
      }
    },
    onLocationChange: ({ referrerURL, referrerHost }) => {
      window.IFrameHelper.sendMessage('change-url', {
        referrerURL,
        referrerHost,
      });
    },
    updateIframeHeight: message => {
      const { extraHeight = 0, isFixedHeight } = message;

      window.IFrameHelper.setFrameHeightToFitContent(
        extraHeight,
        isFixedHeight
      );
    },

    setUnreadMode: () => {
      addUnreadClass();
      onBubbleClick({ toggleValue: true });
    },

    resetUnreadMode: () => removeUnreadClass(),
    handleNotificationDot: event => {
      if (window.$chatwoot.hideMessageBubble) {
        return;
      }

      const bubbleElement = document.querySelector('.woot-widget-bubble');
      if (
        event.unreadMessageCount > 0 &&
        !bubbleElement.classList.contains('unread-notification')
      ) {
        addClass(bubbleElement, 'unread-notification');
      } else if (event.unreadMessageCount === 0) {
        removeClass(bubbleElement, 'unread-notification');
      }

      const { isOpen, showOnUnread } = window.$chatwoot;
      const toggleValue =
        showOnUnread && !isOpen && event.unreadMessageCount > 0;

      window.IFrameHelper.sendMessage('set-unread-view');
      onBubbleClick({ toggleValue });
      const holderEl = document.querySelector('.woot-widget-holder');
      addClass(holderEl, 'has-unread-view');
    },

    closeChat: () => {
      onBubbleClick({ toggleValue: false });
    },

    playAudio: () => {
      window.playAudioAlert();
    },
  },
  pushEvent: eventName => {
    window.IFrameHelper.sendMessage('push-event', { eventName });
  },

  onLoad: ({ widgetColor }) => {
    loadCSS();

    const iframe = window.IFrameHelper.getAppFrame();
    iframe.setAttribute('id', `chatwoot_live_chat_widget`);

    if (window.IFrameHelper.getBubbleHolder().length) {
      return;
    }
    createBubbleHolder(window.$chatwoot.hideMessageBubble);
    onLocationChangeListener();

    let className = 'woot-widget-bubble';
    let closeBtnClassName = `woot-elements--${window.$chatwoot.position} woot-widget-bubble woot--close woot--hide`;

    if (isFlatWidgetStyle(window.$chatwoot.widgetStyle)) {
      className += ' woot-widget-bubble--flat';
      closeBtnClassName += ' woot-widget-bubble--flat';
    }

    if (!window.$chatwoot.hideMessageBubble) {
      const chatIcon = createBubbleIcon({
        className,
        src: bubbleImg,
        target: chatBubble,
      });

      addClass(closeBubble, closeBtnClassName);

      chatIcon.style.background = widgetColor;
      closeBubble.style.background = widgetColor;

      bubbleHolder.appendChild(chatIcon);
      bubbleHolder.appendChild(closeBubble);
      bubbleHolder.appendChild(createNotificationBubble());
      onClickChatBubble();
    }

    iframe.classList.remove('chatwoot_live_chat_widget--hidden');
  },
  toggleCloseButton: () => {
    let isMobile = false;
    if (window.matchMedia('(max-width: 668px)').matches) {
      isMobile = true;
    }
    window.IFrameHelper.sendMessage('toggle-close-button', { isMobile });
  },
};
