import Cookies from 'js-cookie';
import {
  getBubbleView,
  getDarkMode,
  getWidgetStyle,
} from '../sdk/settingsHelper';
import {
  computeHashForUserData,
  getUserCookieName,
  hasUserKeys,
} from '../sdk/cookieHelpers';
import { addClass, removeClass } from '../sdk/DOMHelpers';
import { SDK_SET_BUBBLE_VISIBILITY } from '../shared/constants/sharedFrameEvents';
import '../sdk/IFrameHelper.js';

const runSDK = ({ baseUrl, cookieOptions = {}, websiteToken }) => {
  if (window.$chatwoot) {
    return;
  }

  const chatwootSettings = window.chatwootSettings || {};
  window.$chatwoot = {
    baseUrl,
    cookieOptions,
    hasLoaded: false,
    hideMessageBubble: chatwootSettings.hideMessageBubble || false,
    isOpen: false,
    position: chatwootSettings.position === 'left' ? 'left' : 'right',
    websiteToken,
    locale: chatwootSettings.locale,
    type: getBubbleView(chatwootSettings.type),
    launcherTitle: chatwootSettings.launcherTitle || '',
    showPopoutButton: chatwootSettings.showPopoutButton || false,
    widgetStyle: getWidgetStyle(chatwootSettings.widgetStyle) || 'standard',
    resetTriggered: false,
    darkMode: getDarkMode(chatwootSettings.darkMode),
    showOnUnread: chatwootSettings.showOnUnread || false,

    toggle(state) {
      window.IFrameHelper.events.toggleBubble(state);
    },

    toggleBubbleVisibility(visibility) {
      let widgetElm = document.querySelector('.woot--bubble-holder');
      let widgetHolder = document.querySelector('.woot-widget-holder');
      if (visibility === 'hide') {
        addClass(widgetHolder, 'woot-widget--without-bubble');
        addClass(widgetElm, 'woot-hidden');
        window.$chatwoot.hideMessageBubble = true;
      } else if (visibility === 'show') {
        removeClass(widgetElm, 'woot-hidden');
        removeClass(widgetHolder, 'woot-widget--without-bubble');
        window.$chatwoot.hideMessageBubble = false;
      }
      window.IFrameHelper.sendMessage(SDK_SET_BUBBLE_VISIBILITY, {
        hideMessageBubble: window.$chatwoot.hideMessageBubble,
      });
    },

    popoutChatWindow() {
      window.IFrameHelper.events.popoutChatWindow({
        baseUrl: window.$chatwoot.baseUrl,
        websiteToken: window.$chatwoot.websiteToken,
        locale: window.$chatwoot.locale,
      });
    },

    setUser(identifier, user) {
      if (typeof identifier !== 'string' && typeof identifier !== 'number') {
        throw new Error('Identifier should be a string or a number');
      }

      if (!hasUserKeys(user)) {
        throw new Error(
          'User object should have one of the keys [avatar_url, email, name]'
        );
      }

      const userCookieName = getUserCookieName();
      const existingCookieValue = Cookies.get(userCookieName);
      const hashToBeStored = computeHashForUserData({ identifier, user });
      if (hashToBeStored === existingCookieValue) {
        return;
      }

      window.$chatwoot.identifier = identifier;
      window.$chatwoot.user = user;
      window.IFrameHelper.sendMessage('set-user', { identifier, user });
      Cookies.set(userCookieName, hashToBeStored, {
        expires: 365,
        sameSite: 'Lax',
        ...cookieOptions,
      });
    },

    setCustomAttributes(customAttributes = {}) {
      if (!customAttributes || !Object.keys(customAttributes).length) {
        throw new Error('Custom attributes should have atleast one key');
      } else {
        window.IFrameHelper.sendMessage('set-custom-attributes', {
          customAttributes,
        });
      }
    },

    deleteCustomAttribute(customAttribute = '') {
      if (!customAttribute) {
        throw new Error('Custom attribute is required');
      } else {
        window.IFrameHelper.sendMessage('delete-custom-attribute', {
          customAttribute,
        });
      }
    },

    setLabel(label = '') {
      window.IFrameHelper.sendMessage('set-label', { label });
    },

    removeLabel(label = '') {
      window.IFrameHelper.sendMessage('remove-label', { label });
    },

    setLocale(localeToBeUsed = 'en') {
      window.IFrameHelper.sendMessage('set-locale', { locale: localeToBeUsed });
    },

    reset() {
      if (window.$chatwoot.isOpen) {
        window.IFrameHelper.events.toggleBubble();
      }

      Cookies.remove('cw_conversation');
      Cookies.remove(getUserCookieName());

      const iframe = window.IFrameHelper.getAppFrame();
      iframe.src = window.IFrameHelper.getUrl({
        baseUrl: window.$chatwoot.baseUrl,
        websiteToken: window.$chatwoot.websiteToken,
      });

      window.$chatwoot.resetTriggered = true;
    },
  };

  window.IFrameHelper.createFrame({
    baseUrl,
    websiteToken,
  });
};

window.chatwootSDK = {
  run: runSDK,
};
