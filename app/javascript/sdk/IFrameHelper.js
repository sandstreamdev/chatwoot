import Cookies from 'js-cookie';
import {
  wootOn,
  addClass,
  loadCSS,
  removeClass,
  toggleClass,
} from './DOMHelpers';
import { BUBBLE_DESIGN } from './constants';
import { dispatchWindowEvent } from '../shared/helpers/CustomEventHelper';

let IFrameHelper;

export const bubbleImg =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAUVBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////8IN+deAAAAGnRSTlMAAwgJEBk0TVheY2R5eo+ut8jb5OXs8fX2+cjRDTIAAADsSURBVHgBldZbkoMgFIThRgQv8SKKgGf/C51UnJqaRI30/9zfe+NQUQ3TvG7bOk9DVeCmshmj/CuOTYnrdBfkUOg0zlOtl9OWVuEk4+QyZ3DIevmSt/ioTvK1VH/s5bY3YdM9SBZ/mUUyWgx+U06ycgp7D8msxSvtc4HXL9BLdj2elSEfhBJAI0QNgJEBI1BEBsQClVBVGDgwYOLAhJkDM1YOrNg4sLFAsLJgZsHEgoEFFQt0JAFGFjQsKAMJ0LFAexKgZYFyJIDxJIBNJEDNAtSJBLCeBDCOBFAPzwFA94ED+zmhwDO9358r8ANtIsMXi7qVAwAAAABJRU5ErkJggg==';

export const body = document.getElementsByTagName('body')[0];
export const widgetHolder = document.createElement('div');

export const bubbleHolder = document.createElement('div');
export const chatBubble = document.createElement('div');
export const closeBubble = document.createElement('div');
export const notificationBubble = document.createElement('span');

export const getBubbleView = type =>
  BUBBLE_DESIGN.includes(type) ? type : BUBBLE_DESIGN[0];

export const isExpandedView = type => getBubbleView(type) === BUBBLE_DESIGN[1];

export const setBubbleText = bubbleText => {
  if (isExpandedView(window.$chatwoot.type)) {
    const textNode = document.getElementById('woot-widget--expanded__text');
    textNode.innerHTML = bubbleText;
  }
};

export const createBubbleIcon = ({ className, src, target }) => {
  let bubbleClassName = `${className} woot-elements--${window.$chatwoot.position}`;
  const bubbleIcon = document.createElement('img');
  bubbleIcon.src = src;
  bubbleIcon.alt = 'bubble-icon';
  target.appendChild(bubbleIcon);

  if (isExpandedView(window.$chatwoot.type)) {
    const textNode = document.createElement('div');
    textNode.id = 'woot-widget--expanded__text';
    textNode.innerHTML = '';
    target.appendChild(textNode);
    bubbleClassName += ' woot-widget--expanded';
  }

  target.className = bubbleClassName;
  return target;
};

export const createBubbleHolder = () => {
  addClass(bubbleHolder, 'woot--bubble-holder');
  body.appendChild(bubbleHolder);
};

export const createNotificationBubble = () => {
  addClass(notificationBubble, 'woot--notification');
  return notificationBubble;
};

export const onBubbleClick = (props = {}) => {
  const { toggleValue } = props;
  const { isOpen } = window.$chatwoot;
  if (isOpen !== toggleValue) {
    const newIsOpen = toggleValue === undefined ? !isOpen : toggleValue;
    window.$chatwoot.isOpen = newIsOpen;

    toggleClass(chatBubble, 'woot--hide');
    toggleClass(closeBubble, 'woot--hide');
    toggleClass(widgetHolder, 'woot--hide');
    IFrameHelper.events.onBubbleToggle(newIsOpen);
  }
};

export const onClickChatBubble = () => {
  wootOn(bubbleHolder, 'click', onBubbleClick);
};

const EVENT_NAME = 'chatwoot:ready';

IFrameHelper = {
  getUrl({ baseUrl, websiteToken }) {
    return `${baseUrl}/widget?website_token=${websiteToken}`;
  },
  createFrame: ({ baseUrl, websiteToken }) => {
    const iframe = document.createElement('iframe');
    const cwCookie = Cookies.get('cw_conversation');
    let widgetUrl = IFrameHelper.getUrl({ baseUrl, websiteToken });
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
    addClass(widgetHolder, holderClassName);
    widgetHolder.appendChild(iframe);
    body.appendChild(widgetHolder);
    IFrameHelper.initPostMessageCommunication();
    IFrameHelper.initLocationListener();
    IFrameHelper.initWindowSizeListener();
    IFrameHelper.preventDefaultScroll();
  },
  getAppFrame: () => document.getElementById('chatwoot_live_chat_widget'),
  sendMessage: (key, value) => {
    const element = IFrameHelper.getAppFrame();
    element.contentWindow.postMessage(
      `chatwoot-widget:${JSON.stringify({ event: key, ...value })}`,
      '*'
    );
  },
  initLocationListener: () => {
    window.onhashchange = () => {
      IFrameHelper.setCurrentUrl();
    };
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
      if (typeof IFrameHelper.events[message.event] === 'function') {
        IFrameHelper.events[message.event](message);
      }
    };
  },
  initWindowSizeListener: () => {
    wootOn(window, 'resize', () => IFrameHelper.toggleCloseButton());
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
  events: {
    loaded: message => {
      Cookies.set('cw_conversation', message.config.authToken, {
        expires: 365,
        sameSite: 'Lax',
        ...window.$chatwoot.cookieOptions,
      });
      window.$chatwoot.hasLoaded = true;
      IFrameHelper.sendMessage('config-set', {
        locale: window.$chatwoot.locale,
        position: window.$chatwoot.position,
        hideMessageBubble: window.$chatwoot.hideMessageBubble,
        showPopoutButton: window.$chatwoot.showPopoutButton,
      });
      IFrameHelper.onLoad({
        widgetColor: message.config.channelConfig.widgetColor,
      });
      IFrameHelper.setCurrentUrl();
      IFrameHelper.toggleCloseButton();

      if (window.$chatwoot.user) {
        IFrameHelper.sendMessage('set-user', window.$chatwoot.user);
      }
      dispatchWindowEvent(EVENT_NAME);
    },

    setBubbleLabel(message) {
      if (window.$chatwoot.hideMessageBubble) {
        return;
      }
      setBubbleText(window.$chatwoot.launcherTitle || message.label);
    },

    toggleBubble: () => {
      onBubbleClick();
    },

    onBubbleToggle: isOpen => {
      if (!isOpen) {
        IFrameHelper.events.resetUnreadMode();
      } else {
        IFrameHelper.pushEvent('webwidget.triggered');
      }
    },

    setUnreadMode: message => {
      const { unreadMessageCount } = message;
      const { isOpen, showOnUnread, toggle } = window.$chatwoot;
      const toggleValue = true;
      const unreadMode = !isOpen && unreadMessageCount > 0;

      if (!unreadMode) {
        return;
      }

      if (showOnUnread) {
        toggle();

        return;
      }

      IFrameHelper.sendMessage('set-unread-view');
      onBubbleClick({ toggleValue });
      const holderEl = document.querySelector('.woot-widget-holder');
      addClass(holderEl, 'has-unread-view');
    },

    resetUnreadMode: () => {
      IFrameHelper.sendMessage('unset-unread-view');
      IFrameHelper.events.removeUnreadClass();
    },

    removeUnreadClass: () => {
      const holderEl = document.querySelector('.woot-widget-holder');
      removeClass(holderEl, 'has-unread-view');
    },
  },
  pushEvent: eventName => {
    IFrameHelper.sendMessage('push-event', { eventName });
  },
  onLoad: ({ widgetColor }) => {
    loadCSS();

    const iframe = IFrameHelper.getAppFrame();
    iframe.setAttribute('id', `chatwoot_live_chat_widget`);

    createBubbleHolder();

    if (!window.$chatwoot.hideMessageBubble) {
      const chatIcon = createBubbleIcon({
        className: 'woot-widget-bubble',
        src: bubbleImg,
        target: chatBubble,
      });

      const closeIcon = closeBubble;
      const closeIconclassName = `woot-elements--${window.$chatwoot.position} woot-widget-bubble woot--close woot--hide`;
      addClass(closeIcon, closeIconclassName);

      chatIcon.style.background = widgetColor;
      closeIcon.style.background = widgetColor;

      bubbleHolder.appendChild(chatIcon);
      bubbleHolder.appendChild(closeIcon);
      bubbleHolder.appendChild(createNotificationBubble());
      onClickChatBubble();
    }

    iframe.classList.remove('chatwoot_live_chat_widget--hidden');
  },
  setCurrentUrl: () => {
    IFrameHelper.sendMessage('set-current-url', {
      referrerURL: window.location.href,
      referrerHost: window.location.host,
    });
  },
  toggleCloseButton: () => {
    if (window.matchMedia('(max-width: 668px)').matches) {
      IFrameHelper.sendMessage('toggle-close-button', {
        showClose: true,
      });
    } else {
      IFrameHelper.sendMessage('toggle-close-button', {
        showClose: false,
      });
    }
  },
};

export { IFrameHelper };
