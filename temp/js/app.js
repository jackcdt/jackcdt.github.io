/**
 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
 *
 * @version 1.0.3
 * @codingstandard ftlabs-jsv2
 * @copyright The Financial Times Limited [All Rights Reserved]
 * @license MIT License (see LICENSE.txt)
 */

/*jslint browser:true, node:true*/
/*global define, Event, Node*/


/**
 * Instantiate fast-clicking listeners on the specified layer.
 *
 * @constructor
 * @param {Element} layer The layer to listen on
 * @param {Object} options The options to override the defaults
 */
function FastClick(layer, options) {
	'use strict';
	var oldOnClick;

	options = options || {};

	/**
	 * Whether a click is currently being tracked.
	 *
	 * @type boolean
	 */
	this.trackingClick = false;


	/**
	 * Timestamp for when click tracking started.
	 *
	 * @type number
	 */
	this.trackingClickStart = 0;


	/**
	 * The element being tracked for a click.
	 *
	 * @type EventTarget
	 */
	this.targetElement = null;


	/**
	 * X-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartX = 0;


	/**
	 * Y-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartY = 0;


	/**
	 * ID of the last touch, retrieved from Touch.identifier.
	 *
	 * @type number
	 */
	this.lastTouchIdentifier = 0;


	/**
	 * Touchmove boundary, beyond which a click will be cancelled.
	 *
	 * @type number
	 */
	this.touchBoundary = options.touchBoundary || 10;


	/**
	 * The FastClick layer.
	 *
	 * @type Element
	 */
	this.layer = layer;

	/**
	 * The minimum time between tap(touchstart and touchend) events
	 *
	 * @type number
	 */
	this.tapDelay = options.tapDelay || 200;

	if (FastClick.notNeeded(layer)) {
		return;
	}

	// Some old versions of Android don't have Function.prototype.bind
	function bind(method, context) {
		return function() { return method.apply(context, arguments); };
	}


	var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
	var context = this;
	for (var i = 0, l = methods.length; i < l; i++) {
		context[methods[i]] = bind(context[methods[i]], context);
	}

	// Set up event handlers as required
	if (deviceIsAndroid) {
		layer.addEventListener('mouseover', this.onMouse, true);
		layer.addEventListener('mousedown', this.onMouse, true);
		layer.addEventListener('mouseup', this.onMouse, true);
	}

	layer.addEventListener('click', this.onClick, true);
	layer.addEventListener('touchstart', this.onTouchStart, false);
	layer.addEventListener('touchmove', this.onTouchMove, false);
	layer.addEventListener('touchend', this.onTouchEnd, false);
	layer.addEventListener('touchcancel', this.onTouchCancel, false);

	// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
	// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
	// layer when they are cancelled.
	if (!Event.prototype.stopImmediatePropagation) {
		layer.removeEventListener = function(type, callback, capture) {
			var rmv = Node.prototype.removeEventListener;
			if (type === 'click') {
				rmv.call(layer, type, callback.hijacked || callback, capture);
			} else {
				rmv.call(layer, type, callback, capture);
			}
		};

		layer.addEventListener = function(type, callback, capture) {
			var adv = Node.prototype.addEventListener;
			if (type === 'click') {
				adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
					if (!event.propagationStopped) {
						callback(event);
					}
				}), capture);
			} else {
				adv.call(layer, type, callback, capture);
			}
		};
	}

	// If a handler is already declared in the element's onclick attribute, it will be fired before
	// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
	// adding it as listener.
	if (typeof layer.onclick === 'function') {

		// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
		// - the old one won't work if passed to addEventListener directly.
		oldOnClick = layer.onclick;
		layer.addEventListener('click', function(event) {
			oldOnClick(event);
		}, false);
		layer.onclick = null;
	}
}


/**
 * Android requires exceptions.
 *
 * @type boolean
 */
var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0;


/**
 * iOS requires exceptions.
 *
 * @type boolean
 */
var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent);


/**
 * iOS 4 requires an exception for select elements.
 *
 * @type boolean
 */
var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


/**
 * iOS 6.0(+?) requires the target element to be manually derived
 *
 * @type boolean
 */
var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS ([6-9]|\d{2})_\d/).test(navigator.userAgent);

/**
 * BlackBerry requires exceptions.
 *
 * @type boolean
 */
var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

/**
 * Determine whether a given element requires a native click.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element needs a native click
 */
FastClick.prototype.needsClick = function(target) {
	'use strict';
	switch (target.nodeName.toLowerCase()) {

	// Don't send a synthetic click to disabled inputs (issue #62)
	case 'button':
	case 'select':
	case 'textarea':
		if (target.disabled) {
			return true;
		}

		break;
	case 'input':

		// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
		if ((deviceIsIOS && target.type === 'file') || target.disabled) {
			return true;
		}

		break;
	case 'label':
	case 'video':
		return true;
	}

	return (/\bneedsclick\b/).test(target.className);
};


/**
 * Determine whether a given element requires a call to focus to simulate click into element.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
 */
FastClick.prototype.needsFocus = function(target) {
	'use strict';
	switch (target.nodeName.toLowerCase()) {
	case 'textarea':
		return true;
	case 'select':
		return !deviceIsAndroid;
	case 'input':
		switch (target.type) {
		case 'button':
		case 'checkbox':
		case 'file':
		case 'image':
		case 'radio':
		case 'submit':
			return false;
		}

		// No point in attempting to focus disabled inputs
		return !target.disabled && !target.readOnly;
	default:
		return (/\bneedsfocus\b/).test(target.className);
	}
};


/**
 * Send a click event to the specified element.
 *
 * @param {EventTarget|Element} targetElement
 * @param {Event} event
 */
FastClick.prototype.sendClick = function(targetElement, event) {
	'use strict';
	var clickEvent, touch;

	// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
	if (document.activeElement && document.activeElement !== targetElement) {
		document.activeElement.blur();
	}

	touch = event.changedTouches[0];

	// Synthesise a click event, with an extra attribute so it can be tracked
	clickEvent = document.createEvent('MouseEvents');
	clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
	clickEvent.forwardedTouchEvent = true;
	targetElement.dispatchEvent(clickEvent);
};

FastClick.prototype.determineEventType = function(targetElement) {
	'use strict';

	//Issue #159: Android Chrome Select Box does not open with a synthetic click event
	if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
		return 'mousedown';
	}

	return 'click';
};


/**
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.focus = function(targetElement) {
	'use strict';
	var length;

	// Issue #160: on iOS 7, some input elements (e.g. date datetime) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
	if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time') {
		length = targetElement.value.length;
		targetElement.setSelectionRange(length, length);
	} else {
		targetElement.focus();
	}
};


/**
 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
 *
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.updateScrollParent = function(targetElement) {
	'use strict';
	var scrollParent, parentElement;

	scrollParent = targetElement.fastClickScrollParent;

	// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
	// target element was moved to another parent.
	if (!scrollParent || !scrollParent.contains(targetElement)) {
		parentElement = targetElement;
		do {
			if (parentElement.scrollHeight > parentElement.offsetHeight) {
				scrollParent = parentElement;
				targetElement.fastClickScrollParent = parentElement;
				break;
			}

			parentElement = parentElement.parentElement;
		} while (parentElement);
	}

	// Always update the scroll top tracker if possible.
	if (scrollParent) {
		scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
	}
};


/**
 * @param {EventTarget} targetElement
 * @returns {Element|EventTarget}
 */
FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {
	'use strict';

	// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
	if (eventTarget.nodeType === Node.TEXT_NODE) {
		return eventTarget.parentNode;
	}

	return eventTarget;
};


/**
 * On touch start, record the position and scroll offset.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchStart = function(event) {
	'use strict';
	var targetElement, touch, selection;

	// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
	if (event.targetTouches.length > 1) {
		return true;
	}

	targetElement = this.getTargetElementFromEventTarget(event.target);
	touch = event.targetTouches[0];

	if (deviceIsIOS) {

		// Only trusted events will deselect text on iOS (issue #49)
		selection = window.getSelection();
		if (selection.rangeCount && !selection.isCollapsed) {
			return true;
		}

		if (!deviceIsIOS4) {

			// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
			// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
			// with the same identifier as the touch event that previously triggered the click that triggered the alert.
			// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
			// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
			// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
			// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
			// random integers, it's safe to to continue if the identifier is 0 here.
			if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
				event.preventDefault();
				return false;
			}

			this.lastTouchIdentifier = touch.identifier;

			// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
			// 1) the user does a fling scroll on the scrollable layer
			// 2) the user stops the fling scroll with another tap
			// then the event.target of the last 'touchend' event will be the element that was under the user's finger
			// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
			// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
			this.updateScrollParent(targetElement);
		}
	}

	this.trackingClick = true;
	this.trackingClickStart = event.timeStamp;
	this.targetElement = targetElement;

	this.touchStartX = touch.pageX;
	this.touchStartY = touch.pageY;

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
		event.preventDefault();
	}

	return true;
};


/**
 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.touchHasMoved = function(event) {
	'use strict';
	var touch = event.changedTouches[0], boundary = this.touchBoundary;

	if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
		return true;
	}

	return false;
};


/**
 * Update the last position.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchMove = function(event) {
	'use strict';
	if (!this.trackingClick) {
		return true;
	}

	// If the touch has moved, cancel the click tracking
	if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
		this.trackingClick = false;
		this.targetElement = null;
	}

	return true;
};


/**
 * Attempt to find the labelled control for the given label element.
 *
 * @param {EventTarget|HTMLLabelElement} labelElement
 * @returns {Element|null}
 */
FastClick.prototype.findControl = function(labelElement) {
	'use strict';

	// Fast path for newer browsers supporting the HTML5 control attribute
	if (labelElement.control !== undefined) {
		return labelElement.control;
	}

	// All browsers under test that support touch events also support the HTML5 htmlFor attribute
	if (labelElement.htmlFor) {
		return document.getElementById(labelElement.htmlFor);
	}

	// If no for attribute exists, attempt to retrieve the first labellable descendant element
	// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
	return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
};


/**
 * On touch end, determine whether to send a click event at once.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchEnd = function(event) {
	'use strict';
	var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

	if (!this.trackingClick) {
		return true;
	}

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
		this.cancelNextClick = true;
		return true;
	}

	// Reset to prevent wrong click cancel on input (issue #156).
	this.cancelNextClick = false;

	this.lastClickTime = event.timeStamp;

	trackingClickStart = this.trackingClickStart;
	this.trackingClick = false;
	this.trackingClickStart = 0;

	// On some iOS devices, the targetElement supplied with the event is invalid if the layer
	// is performing a transition or scroll, and has to be re-detected manually. Note that
	// for this to function correctly, it must be called *after* the event target is checked!
	// See issue #57; also filed as rdar://13048589 .
	if (deviceIsIOSWithBadTarget) {
		touch = event.changedTouches[0];

		// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
		targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
		targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
	}

	targetTagName = targetElement.tagName.toLowerCase();
	if (targetTagName === 'label') {
		forElement = this.findControl(targetElement);
		if (forElement) {
			this.focus(targetElement);
			if (deviceIsAndroid) {
				return false;
			}

			targetElement = forElement;
		}
	} else if (this.needsFocus(targetElement)) {

		// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
		// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
		if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
			this.targetElement = null;
			return false;
		}

		this.focus(targetElement);
		this.sendClick(targetElement, event);

		// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
		// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
		if (!deviceIsIOS || targetTagName !== 'select') {
			this.targetElement = null;
			event.preventDefault();
		}

		return false;
	}

	if (deviceIsIOS && !deviceIsIOS4) {

		// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
		// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
		scrollParent = targetElement.fastClickScrollParent;
		if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
			return true;
		}
	}

	// Prevent the actual click from going though - unless the target node is marked as requiring
	// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
	if (!this.needsClick(targetElement)) {
		event.preventDefault();
		this.sendClick(targetElement, event);
	}

	return false;
};


/**
 * On touch cancel, stop tracking the click.
 *
 * @returns {void}
 */
FastClick.prototype.onTouchCancel = function() {
	'use strict';
	this.trackingClick = false;
	this.targetElement = null;
};


/**
 * Determine mouse events which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onMouse = function(event) {
	'use strict';

	// If a target element was never set (because a touch event was never fired) allow the event
	if (!this.targetElement) {
		return true;
	}

	if (event.forwardedTouchEvent) {
		return true;
	}

	// Programmatically generated events targeting a specific element should be permitted
	if (!event.cancelable) {
		return true;
	}

	// Derive and check the target element to see whether the mouse event needs to be permitted;
	// unless explicitly enabled, prevent non-touch click events from triggering actions,
	// to prevent ghost/doubleclicks.
	if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

		// Prevent any user-added listeners declared on FastClick element from being fired.
		if (event.stopImmediatePropagation) {
			event.stopImmediatePropagation();
		} else {

			// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
			event.propagationStopped = true;
		}

		// Cancel the event
		event.stopPropagation();
		event.preventDefault();

		return false;
	}

	// If the mouse event is permitted, return true for the action to go through.
	return true;
};


/**
 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
 * an actual click which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onClick = function(event) {
	'use strict';
	var permitted;

	// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
	if (this.trackingClick) {
		this.targetElement = null;
		this.trackingClick = false;
		return true;
	}

	// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
	if (event.target.type === 'submit' && event.detail === 0) {
		return true;
	}

	permitted = this.onMouse(event);

	// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
	if (!permitted) {
		this.targetElement = null;
	}

	// If clicks are permitted, return true for the action to go through.
	return permitted;
};


/**
 * Remove all FastClick's event listeners.
 *
 * @returns {void}
 */
FastClick.prototype.destroy = function() {
	'use strict';
	var layer = this.layer;

	if (deviceIsAndroid) {
		layer.removeEventListener('mouseover', this.onMouse, true);
		layer.removeEventListener('mousedown', this.onMouse, true);
		layer.removeEventListener('mouseup', this.onMouse, true);
	}

	layer.removeEventListener('click', this.onClick, true);
	layer.removeEventListener('touchstart', this.onTouchStart, false);
	layer.removeEventListener('touchmove', this.onTouchMove, false);
	layer.removeEventListener('touchend', this.onTouchEnd, false);
	layer.removeEventListener('touchcancel', this.onTouchCancel, false);
};


/**
 * Check whether FastClick is needed.
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.notNeeded = function(layer) {
	'use strict';
	var metaViewport;
	var chromeVersion;
	var blackberryVersion;

	// Devices that don't support touch don't need FastClick
	if (typeof window.ontouchstart === 'undefined') {
		return true;
	}

	// Chrome version - zero for other browsers
	chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

	if (chromeVersion) {

		if (deviceIsAndroid) {
			metaViewport = document.querySelector('meta[name=viewport]');

			if (metaViewport) {
				// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
				if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
					return true;
				}
				// Chrome 32 and above with width=device-width or less don't need FastClick
				if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
					return true;
				}
			}

		// Chrome desktop doesn't need FastClick (issue #15)
		} else {
			return true;
		}
	}

	if (deviceIsBlackBerry10) {
		blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

		// BlackBerry 10.3+ does not require Fastclick library.
		// https://github.com/ftlabs/fastclick/issues/251
		if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
			metaViewport = document.querySelector('meta[name=viewport]');

			if (metaViewport) {
				// user-scalable=no eliminates click delay.
				if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
					return true;
				}
				// width=device-width (or less than device-width) eliminates click delay.
				if (document.documentElement.scrollWidth <= window.outerWidth) {
					return true;
				}
			}
		}
	}

	// IE10 with -ms-touch-action: none, which disables double-tap-to-zoom (issue #97)
	if (layer.style.msTouchAction === 'none') {
		return true;
	}

	return false;
};


/**
 * Factory method for creating a FastClick object
 *
 * @param {Element} layer The layer to listen on
 * @param {Object} options The options to override the defaults
 */
FastClick.attach = function(layer, options) {
	'use strict';
	return new FastClick(layer, options);
};


if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {

	// AMD. Register as an anonymous module.
	define(function() {
		'use strict';
		return FastClick;
	});
} else if (typeof module !== 'undefined' && module.exports) {
	module.exports = FastClick.attach;
	module.exports.FastClick = FastClick;
} else {
	window.FastClick = FastClick;
}

!function(e){e.fn.hoverIntent=function(t,n,i){var r={interval:100,sensitivity:7,timeout:0};r="object"==typeof t?e.extend(r,t):e.isFunction(n)?e.extend(r,{over:t,out:n,selector:i}):e.extend(r,{over:t,out:t,selector:n});var a,s,o,u,c=function(e){a=e.pageX,s=e.pageY},l=function(t,n){return n.hoverIntent_t=clearTimeout(n.hoverIntent_t),Math.abs(o-a)+Math.abs(u-s)<r.sensitivity?(e(n).off("mousemove.hoverIntent",c),n.hoverIntent_s=1,r.over.apply(n,[t])):(o=a,u=s,n.hoverIntent_t=setTimeout(function(){l(t,n)},r.interval),void 0)},d=function(e,t){return t.hoverIntent_t=clearTimeout(t.hoverIntent_t),t.hoverIntent_s=0,r.out.apply(t,[e])},h=function(t){var n=jQuery.extend({},t),i=this;i.hoverIntent_t&&(i.hoverIntent_t=clearTimeout(i.hoverIntent_t)),"mouseenter"==t.type?(o=n.pageX,u=n.pageY,e(i).on("mousemove.hoverIntent",c),1!=i.hoverIntent_s&&(i.hoverIntent_t=setTimeout(function(){l(n,i)},r.interval))):(e(i).off("mousemove.hoverIntent",c),1==i.hoverIntent_s&&(i.hoverIntent_t=setTimeout(function(){d(n,i)},r.timeout)))};return this.on({"mouseenter.hoverIntent":h,"mouseleave.hoverIntent":h},r.selector)}}(jQuery),!function(e,t){"use strict";function n(){i.READY||(i.event.determineEventTypes(),i.utils.each(i.gestures,function(e){i.detection.register(e)}),i.event.onTouch(i.DOCUMENT,i.EVENT_MOVE,i.detection.detect),i.event.onTouch(i.DOCUMENT,i.EVENT_END,i.detection.detect),i.READY=!0)}var i=function(e,t){return new i.Instance(e,t||{})};i.defaults={stop_browser_behavior:{userSelect:"none",touchAction:"none",touchCallout:"none",contentZooming:"none",userDrag:"none",tapHighlightColor:"rgba(0,0,0,0)"}},i.HAS_POINTEREVENTS=e.navigator.pointerEnabled||e.navigator.msPointerEnabled,i.HAS_TOUCHEVENTS="ontouchstart"in e,i.MOBILE_REGEX=/mobile|tablet|ip(ad|hone|od)|android|silk/i,i.NO_MOUSEEVENTS=i.HAS_TOUCHEVENTS&&e.navigator.userAgent.match(i.MOBILE_REGEX),i.EVENT_TYPES={},i.DIRECTION_DOWN="down",i.DIRECTION_LEFT="left",i.DIRECTION_UP="up",i.DIRECTION_RIGHT="right",i.POINTER_MOUSE="mouse",i.POINTER_TOUCH="touch",i.POINTER_PEN="pen",i.EVENT_START="start",i.EVENT_MOVE="move",i.EVENT_END="end",i.DOCUMENT=e.document,i.plugins=i.plugins||{},i.gestures=i.gestures||{},i.READY=!1,i.utils={extend:function(e,n,i){for(var r in n)e[r]!==t&&i||(e[r]=n[r]);return e},each:function(e,n,i){var r,a;if("forEach"in e)e.forEach(n,i);else if(e.length!==t){for(r=0,a=e.length;a>r;r++)if(n.call(i,e[r],r,e)===!1)return}else for(r in e)if(e.hasOwnProperty(r)&&n.call(i,e[r],r,e)===!1)return},hasParent:function(e,t){for(;e;){if(e==t)return!0;e=e.parentNode}return!1},getCenter:function(e){var t=[],n=[];return i.utils.each(e,function(e){t.push("undefined"!=typeof e.clientX?e.clientX:e.pageX),n.push("undefined"!=typeof e.clientY?e.clientY:e.pageY)}),{pageX:(Math.min.apply(Math,t)+Math.max.apply(Math,t))/2,pageY:(Math.min.apply(Math,n)+Math.max.apply(Math,n))/2}},getVelocity:function(e,t,n){return{x:Math.abs(t/e)||0,y:Math.abs(n/e)||0}},getAngle:function(e,t){var n=t.pageY-e.pageY,i=t.pageX-e.pageX;return 180*Math.atan2(n,i)/Math.PI},getDirection:function(e,t){var n=Math.abs(e.pageX-t.pageX),r=Math.abs(e.pageY-t.pageY);return n>=r?e.pageX-t.pageX>0?i.DIRECTION_LEFT:i.DIRECTION_RIGHT:e.pageY-t.pageY>0?i.DIRECTION_UP:i.DIRECTION_DOWN},getDistance:function(e,t){var n=t.pageX-e.pageX,i=t.pageY-e.pageY;return Math.sqrt(n*n+i*i)},getScale:function(e,t){return e.length>=2&&t.length>=2?this.getDistance(t[0],t[1])/this.getDistance(e[0],e[1]):1},getRotation:function(e,t){return e.length>=2&&t.length>=2?this.getAngle(t[1],t[0])-this.getAngle(e[1],e[0]):0},isVertical:function(e){return e==i.DIRECTION_UP||e==i.DIRECTION_DOWN},stopDefaultBrowserBehavior:function(e,t){t&&e&&e.style&&(i.utils.each(["webkit","khtml","moz","Moz","ms","o",""],function(n){i.utils.each(t,function(t){n&&(t=n+t.substring(0,1).toUpperCase()+t.substring(1)),t in e.style&&(e.style[t]=t)})}),"none"==t.userSelect&&(e.onselectstart=function(){return!1}),"none"==t.userDrag&&(e.ondragstart=function(){return!1}))}},i.Instance=function(e,t){var r=this;return n(),this.element=e,this.enabled=!0,this.options=i.utils.extend(i.utils.extend({},i.defaults),t||{}),this.options.stop_browser_behavior&&i.utils.stopDefaultBrowserBehavior(this.element,this.options.stop_browser_behavior),i.event.onTouch(e,i.EVENT_START,function(e){r.enabled&&i.detection.startDetect(r,e)}),this},i.Instance.prototype={on:function(e,t){var n=e.split(" ");return i.utils.each(n,function(e){this.element.addEventListener(e,t,!1)},this),this},off:function(e,t){var n=e.split(" ");return i.utils.each(n,function(e){this.element.removeEventListener(e,t,!1)},this),this},trigger:function(e,t){t||(t={});var n=i.DOCUMENT.createEvent("Event");n.initEvent(e,!0,!0),n.gesture=t;var r=this.element;return i.utils.hasParent(t.target,r)&&(r=t.target),r.dispatchEvent(n),this},enable:function(e){return this.enabled=e,this}};var r=null,a=!1,s=!1;i.event={bindDom:function(e,t,n){var r=t.split(" ");i.utils.each(r,function(t){e.addEventListener(t,n,!1)})},onTouch:function(e,t,n){var o=this;this.bindDom(e,i.EVENT_TYPES[t],function(u){var c=u.type.toLowerCase();if(!c.match(/mouse/)||!s){c.match(/touch/)||c.match(/pointerdown/)||c.match(/mouse/)&&1===u.which?a=!0:c.match(/mouse/)&&!u.which&&(a=!1),c.match(/touch|pointer/)&&(s=!0);var l=0;a&&(i.HAS_POINTEREVENTS&&t!=i.EVENT_END?l=i.PointerEvent.updatePointer(t,u):c.match(/touch/)?l=u.touches.length:s||(l=c.match(/up/)?0:1),l>0&&t==i.EVENT_END?t=i.EVENT_MOVE:l||(t=i.EVENT_END),(l||null===r)&&(r=u),n.call(i.detection,o.collectEventData(e,t,o.getTouchList(r,t),u)),i.HAS_POINTEREVENTS&&t==i.EVENT_END&&(l=i.PointerEvent.updatePointer(t,u))),l||(r=null,a=!1,s=!1,i.PointerEvent.reset())}})},determineEventTypes:function(){var e;e=i.HAS_POINTEREVENTS?i.PointerEvent.getEvents():i.NO_MOUSEEVENTS?["touchstart","touchmove","touchend touchcancel"]:["touchstart mousedown","touchmove mousemove","touchend touchcancel mouseup"],i.EVENT_TYPES[i.EVENT_START]=e[0],i.EVENT_TYPES[i.EVENT_MOVE]=e[1],i.EVENT_TYPES[i.EVENT_END]=e[2]},getTouchList:function(e){return i.HAS_POINTEREVENTS?i.PointerEvent.getTouchList():e.touches?e.touches:(e.identifier=1,[e])},collectEventData:function(e,t,n,r){var a=i.POINTER_TOUCH;return(r.type.match(/mouse/)||i.PointerEvent.matchType(i.POINTER_MOUSE,r))&&(a=i.POINTER_MOUSE),{center:i.utils.getCenter(n),timeStamp:(new Date).getTime(),target:r.target,touches:n,eventType:t,pointerType:a,srcEvent:r,preventDefault:function(){this.srcEvent.preventManipulation&&this.srcEvent.preventManipulation(),this.srcEvent.preventDefault&&this.srcEvent.preventDefault()},stopPropagation:function(){this.srcEvent.stopPropagation()},stopDetect:function(){return i.detection.stopDetect()}}}},i.PointerEvent={pointers:{},getTouchList:function(){var e=this,t=[];return i.utils.each(e.pointers,function(e){t.push(e)}),t},updatePointer:function(e,t){return e==i.EVENT_END?this.pointers={}:(t.identifier=t.pointerId,this.pointers[t.pointerId]=t),Object.keys(this.pointers).length},matchType:function(e,t){if(!t.pointerType)return!1;var n=t.pointerType,r={};return r[i.POINTER_MOUSE]=n===t.MSPOINTER_TYPE_MOUSE||n===i.POINTER_MOUSE,r[i.POINTER_TOUCH]=n===t.MSPOINTER_TYPE_TOUCH||n===i.POINTER_TOUCH,r[i.POINTER_PEN]=n===t.MSPOINTER_TYPE_PEN||n===i.POINTER_PEN,r[e]},getEvents:function(){return["pointerdown MSPointerDown","pointermove MSPointerMove","pointerup pointercancel MSPointerUp MSPointerCancel"]},reset:function(){this.pointers={}}},i.detection={gestures:[],current:null,previous:null,stopped:!1,startDetect:function(e,t){this.current||(this.stopped=!1,this.current={inst:e,startEvent:i.utils.extend({},t),lastEvent:!1,name:""},this.detect(t))},detect:function(e){if(this.current&&!this.stopped){e=this.extendEventData(e);var t=this.current.inst.options;return i.utils.each(this.gestures,function(n){return this.stopped||t[n.name]===!1||n.handler.call(n,e,this.current.inst)!==!1?void 0:(this.stopDetect(),!1)},this),this.current&&(this.current.lastEvent=e),e.eventType==i.EVENT_END&&!e.touches.length-1&&this.stopDetect(),e}},stopDetect:function(){this.previous=i.utils.extend({},this.current),this.current=null,this.stopped=!0},extendEventData:function(e){var t=this.current.startEvent;!t||e.touches.length==t.touches.length&&e.touches!==t.touches||(t.touches=[],i.utils.each(e.touches,function(e){t.touches.push(i.utils.extend({},e))}));var n,r,a=e.timeStamp-t.timeStamp,s=e.center.pageX-t.center.pageX,o=e.center.pageY-t.center.pageY,u=i.utils.getVelocity(a,s,o);return"end"===e.eventType?(n=this.current.lastEvent&&this.current.lastEvent.interimAngle,r=this.current.lastEvent&&this.current.lastEvent.interimDirection):(n=this.current.lastEvent&&i.utils.getAngle(this.current.lastEvent.center,e.center),r=this.current.lastEvent&&i.utils.getDirection(this.current.lastEvent.center,e.center)),i.utils.extend(e,{deltaTime:a,deltaX:s,deltaY:o,velocityX:u.x,velocityY:u.y,distance:i.utils.getDistance(t.center,e.center),angle:i.utils.getAngle(t.center,e.center),interimAngle:n,direction:i.utils.getDirection(t.center,e.center),interimDirection:r,scale:i.utils.getScale(t.touches,e.touches),rotation:i.utils.getRotation(t.touches,e.touches),startEvent:t}),e},register:function(e){var n=e.defaults||{};return n[e.name]===t&&(n[e.name]=!0),i.utils.extend(i.defaults,n,!0),e.index=e.index||1e3,this.gestures.push(e),this.gestures.sort(function(e,t){return e.index<t.index?-1:e.index>t.index?1:0}),this.gestures}},i.gestures.Drag={name:"drag",index:50,defaults:{drag_min_distance:10,correct_for_drag_min_distance:!0,drag_max_touches:1,drag_block_horizontal:!1,drag_block_vertical:!1,drag_lock_to_axis:!1,drag_lock_min_distance:25},triggered:!1,handler:function(e,t){if(i.detection.current.name!=this.name&&this.triggered)return t.trigger(this.name+"end",e),void(this.triggered=!1);if(!(t.options.drag_max_touches>0&&e.touches.length>t.options.drag_max_touches))switch(e.eventType){case i.EVENT_START:this.triggered=!1;break;case i.EVENT_MOVE:if(e.distance<t.options.drag_min_distance&&i.detection.current.name!=this.name)return;if(i.detection.current.name!=this.name&&(i.detection.current.name=this.name,t.options.correct_for_drag_min_distance&&e.distance>0)){var n=Math.abs(t.options.drag_min_distance/e.distance);i.detection.current.startEvent.center.pageX+=e.deltaX*n,i.detection.current.startEvent.center.pageY+=e.deltaY*n,e=i.detection.extendEventData(e)}(i.detection.current.lastEvent.drag_locked_to_axis||t.options.drag_lock_to_axis&&t.options.drag_lock_min_distance<=e.distance)&&(e.drag_locked_to_axis=!0);var r=i.detection.current.lastEvent.direction;e.drag_locked_to_axis&&r!==e.direction&&(e.direction=i.utils.isVertical(r)?e.deltaY<0?i.DIRECTION_UP:i.DIRECTION_DOWN:e.deltaX<0?i.DIRECTION_LEFT:i.DIRECTION_RIGHT),this.triggered||(t.trigger(this.name+"start",e),this.triggered=!0),t.trigger(this.name,e),t.trigger(this.name+e.direction,e),(t.options.drag_block_vertical&&i.utils.isVertical(e.direction)||t.options.drag_block_horizontal&&!i.utils.isVertical(e.direction))&&e.preventDefault();break;case i.EVENT_END:this.triggered&&t.trigger(this.name+"end",e),this.triggered=!1}}},i.gestures.Hold={name:"hold",index:10,defaults:{hold_timeout:500,hold_threshold:1},timer:null,handler:function(e,t){switch(e.eventType){case i.EVENT_START:clearTimeout(this.timer),i.detection.current.name=this.name,this.timer=setTimeout(function(){"hold"==i.detection.current.name&&t.trigger("hold",e)},t.options.hold_timeout);break;case i.EVENT_MOVE:e.distance>t.options.hold_threshold&&clearTimeout(this.timer);break;case i.EVENT_END:clearTimeout(this.timer)}}},i.gestures.Release={name:"release",index:1/0,handler:function(e,t){e.eventType==i.EVENT_END&&t.trigger(this.name,e)}},i.gestures.Swipe={name:"swipe",index:40,defaults:{swipe_min_touches:1,swipe_max_touches:1,swipe_velocity:.7},handler:function(e,t){if(e.eventType==i.EVENT_END){if(t.options.swipe_max_touches>0&&e.touches.length<t.options.swipe_min_touches&&e.touches.length>t.options.swipe_max_touches)return;(e.velocityX>t.options.swipe_velocity||e.velocityY>t.options.swipe_velocity)&&(t.trigger(this.name,e),t.trigger(this.name+e.direction,e))}}},i.gestures.Tap={name:"tap",index:100,defaults:{tap_max_touchtime:250,tap_max_distance:10,tap_always:!0,doubletap_distance:20,doubletap_interval:300},handler:function(e,t){if(e.eventType==i.EVENT_END&&"touchcancel"!=e.srcEvent.type){var n=i.detection.previous,r=!1;if(e.deltaTime>t.options.tap_max_touchtime||e.distance>t.options.tap_max_distance)return;n&&"tap"==n.name&&e.timeStamp-n.lastEvent.timeStamp<t.options.doubletap_interval&&e.distance<t.options.doubletap_distance&&(t.trigger("doubletap",e),r=!0),(!r||t.options.tap_always)&&(i.detection.current.name="tap",t.trigger(i.detection.current.name,e))}}},i.gestures.Touch={name:"touch",index:-1/0,defaults:{prevent_default:!1,prevent_mouseevents:!1},handler:function(e,t){return t.options.prevent_mouseevents&&e.pointerType==i.POINTER_MOUSE?void e.stopDetect():(t.options.prevent_default&&e.preventDefault(),void(e.eventType==i.EVENT_START&&t.trigger(this.name,e)))}},i.gestures.Transform={name:"transform",index:45,defaults:{transform_min_scale:.01,transform_min_rotation:1,transform_always_block:!1},triggered:!1,handler:function(e,t){if(i.detection.current.name!=this.name&&this.triggered)return t.trigger(this.name+"end",e),void(this.triggered=!1);if(!(e.touches.length<2))switch(t.options.transform_always_block&&e.preventDefault(),e.eventType){case i.EVENT_START:this.triggered=!1;break;case i.EVENT_MOVE:var n=Math.abs(1-e.scale),r=Math.abs(e.rotation);if(n<t.options.transform_min_scale&&r<t.options.transform_min_rotation)return;i.detection.current.name=this.name,this.triggered||(t.trigger(this.name+"start",e),this.triggered=!0),t.trigger(this.name,e),r>t.options.transform_min_rotation&&t.trigger("rotate",e),n>t.options.transform_min_scale&&(t.trigger("pinch",e),t.trigger("pinch"+(e.scale<1?"in":"out"),e));break;case i.EVENT_END:this.triggered&&t.trigger(this.name+"end",e),this.triggered=!1}}},"function"==typeof define&&"object"==typeof define.amd&&define.amd?define(function(){return i}):"object"==typeof module&&"object"==typeof module.exports?module.exports=i:e.Hammer=i}(this),function(e,t){"use strict";function n(e,n){e.event.bindDom=function(e,i,r){n(e).on(i,function(e){var n=e.originalEvent||e;n.pageX===t&&(n.pageX=e.pageX,n.pageY=e.pageY),n.target||(n.target=e.target),n.which===t&&(n.which=n.button),n.preventDefault||(n.preventDefault=e.preventDefault),n.stopPropagation||(n.stopPropagation=e.stopPropagation),r.call(this,n)})},e.Instance.prototype.on=function(e,t){return n(this.element).on(e,t)},e.Instance.prototype.off=function(e,t){return n(this.element).off(e,t)},e.Instance.prototype.trigger=function(e,t){var i=n(this.element);return i.has(t.target).length&&(i=n(t.target)),i.trigger({type:e,gesture:t})},n.fn.hammer=function(t){return this.each(function(){var i=n(this),r=i.data("hammer");r?r&&t&&e.utils.extend(r.options,t):i.data("hammer",new e(this,t||{}))})}}"function"==typeof define&&"object"==typeof define.amd&&define.amd?define(["hammer","jquery"],n):n(e.Hammer,e.jQuery||e.Zepto)}(this),!function(e){"use strict";"function"==typeof define&&define.amd?define(["jquery"],e):e("undefined"!=typeof jQuery?jQuery:window.Zepto)}(function(e){"use strict";function t(t){var n=t.data;t.isDefaultPrevented()||(t.preventDefault(),e(t.target).ajaxSubmit(n))}function n(t){var n=t.target,i=e(n);if(!i.is("[type=submit],[type=image]")){var r=i.closest("[type=submit]");if(0===r.length)return;n=r[0]}var a=this;if(a.clk=n,"image"==n.type)if(void 0!==t.offsetX)a.clk_x=t.offsetX,a.clk_y=t.offsetY;else if("function"==typeof e.fn.offset){var s=i.offset();a.clk_x=t.pageX-s.left,a.clk_y=t.pageY-s.top}else a.clk_x=t.pageX-n.offsetLeft,a.clk_y=t.pageY-n.offsetTop;setTimeout(function(){a.clk=a.clk_x=a.clk_y=null},100)}function i(){if(e.fn.ajaxSubmit.debug){var t="[jquery.form] "+Array.prototype.join.call(arguments,"");window.console&&window.console.log?window.console.log(t):window.opera&&window.opera.postError&&window.opera.postError(t)}}var r={};r.fileapi=void 0!==e("<input type='file'/>").get(0).files,r.formdata=void 0!==window.FormData;var a=!!e.fn.prop;e.fn.attr2=function(){if(!a)return this.attr.apply(this,arguments);var e=this.prop.apply(this,arguments);return e&&e.jquery||"string"==typeof e?e:this.attr.apply(this,arguments)},e.fn.ajaxSubmit=function(t){function n(n){var i,r,a=e.param(n,t.traditional).split("&"),s=a.length,o=[];for(i=0;s>i;i++)a[i]=a[i].replace(/\+/g," "),r=a[i].split("="),o.push([decodeURIComponent(r[0]),decodeURIComponent(r[1])]);return o}function s(i){for(var r=new FormData,a=0;a<i.length;a++)r.append(i[a].name,i[a].value);if(t.extraData){var s=n(t.extraData);for(a=0;a<s.length;a++)s[a]&&r.append(s[a][0],s[a][1])}t.data=null;var o=e.extend(!0,{},e.ajaxSettings,t,{contentType:!1,processData:!1,cache:!1,type:u||"POST"});t.uploadProgress&&(o.xhr=function(){var n=e.ajaxSettings.xhr();return n.upload&&n.upload.addEventListener("progress",function(e){var n=0,i=e.loaded||e.position,r=e.total;e.lengthComputable&&(n=Math.ceil(i/r*100)),t.uploadProgress(e,i,r,n)},!1),n}),o.data=null;var c=o.beforeSend;return o.beforeSend=function(e,n){n.data=t.formData?t.formData:r,c&&c.call(this,e,n)},e.ajax(o)}function o(n){function r(e){var t=null;try{e.contentWindow&&(t=e.contentWindow.document)}catch(n){i("cannot get iframe.contentWindow document: "+n)}if(t)return t;try{t=e.contentDocument?e.contentDocument:e.document}catch(n){i("cannot get iframe.contentDocument: "+n),t=e.document}return t}function s(){function t(){try{var e=r(v).readyState;i("state = "+e),e&&"uninitialized"==e.toLowerCase()&&setTimeout(t,50)}catch(n){i("Server abort: ",n," (",n.name,")"),o(w),y&&clearTimeout(y),y=void 0}}var n=d.attr2("target"),a=d.attr2("action"),s="multipart/form-data",c=d.attr("enctype")||d.attr("encoding")||s;x.setAttribute("target",f),(!u||/post/i.test(u))&&x.setAttribute("method","POST"),a!=h.url&&x.setAttribute("action",h.url),h.skipEncodingOverride||u&&!/post/i.test(u)||d.attr({encoding:"multipart/form-data",enctype:"multipart/form-data"}),h.timeout&&(y=setTimeout(function(){b=!0,o(D)},h.timeout));var l=[];try{if(h.extraData)for(var m in h.extraData)h.extraData.hasOwnProperty(m)&&l.push(e.isPlainObject(h.extraData[m])&&h.extraData[m].hasOwnProperty("name")&&h.extraData[m].hasOwnProperty("value")?e('<input type="hidden" name="'+h.extraData[m].name+'">').val(h.extraData[m].value).appendTo(x)[0]:e('<input type="hidden" name="'+m+'">').val(h.extraData[m]).appendTo(x)[0]);h.iframeTarget||g.appendTo("body"),v.attachEvent?v.attachEvent("onload",o):v.addEventListener("load",o,!1),setTimeout(t,15);try{x.submit()}catch(p){var _=document.createElement("form").submit;_.apply(x)}}finally{x.setAttribute("action",a),x.setAttribute("enctype",c),n?x.setAttribute("target",n):d.removeAttr("target"),e(l).remove()}}function o(t){if(!_.aborted&&!I){if(k=r(v),k||(i("cannot access response document"),t=w),t===D&&_)return _.abort("timeout"),void T.reject(_,"timeout");if(t==w&&_)return _.abort("server abort"),void T.reject(_,"error","server abort");if(k&&k.location.href!=h.iframeSrc||b){v.detachEvent?v.detachEvent("onload",o):v.removeEventListener("load",o,!1);var n,a="success";try{if(b)throw"timeout";var s="xml"==h.dataType||k.XMLDocument||e.isXMLDoc(k);if(i("isXml="+s),!s&&window.opera&&(null===k.body||!k.body.innerHTML)&&--O)return i("requeing onLoad callback, DOM not available"),void setTimeout(o,250);var u=k.body?k.body:k.documentElement;_.responseText=u?u.innerHTML:null,_.responseXML=k.XMLDocument?k.XMLDocument:k,s&&(h.dataType="xml"),_.getResponseHeader=function(e){var t={"content-type":h.dataType};return t[e.toLowerCase()]},u&&(_.status=Number(u.getAttribute("status"))||_.status,_.statusText=u.getAttribute("statusText")||_.statusText);var c=(h.dataType||"").toLowerCase(),l=/(json|script|text)/.test(c);if(l||h.textarea){var d=k.getElementsByTagName("textarea")[0];if(d)_.responseText=d.value,_.status=Number(d.getAttribute("status"))||_.status,_.statusText=d.getAttribute("statusText")||_.statusText;else if(l){var f=k.getElementsByTagName("pre")[0],p=k.getElementsByTagName("body")[0];f?_.responseText=f.textContent?f.textContent:f.innerText:p&&(_.responseText=p.textContent?p.textContent:p.innerText)}}else"xml"==c&&!_.responseXML&&_.responseText&&(_.responseXML=R(_.responseText));try{S=P(_,c,h)}catch(E){a="parsererror",_.error=n=E||a}}catch(E){i("error caught: ",E),a="error",_.error=n=E||a}_.aborted&&(i("upload aborted"),a=null),_.status&&(a=_.status>=200&&_.status<300||304===_.status?"success":"error"),"success"===a?(h.success&&h.success.call(h.context,S,"success",_),T.resolve(_.responseText,"success",_),m&&e.event.trigger("ajaxSuccess",[_,h])):a&&(void 0===n&&(n=_.statusText),h.error&&h.error.call(h.context,_,a,n),T.reject(_,"error",n),m&&e.event.trigger("ajaxError",[_,h,n])),m&&e.event.trigger("ajaxComplete",[_,h]),m&&!--e.active&&e.event.trigger("ajaxStop"),h.complete&&h.complete.call(h.context,_,a),I=!0,h.timeout&&clearTimeout(y),setTimeout(function(){h.iframeTarget?g.attr("src",h.iframeSrc):g.remove(),_.responseXML=null},100)}}}var c,l,h,m,f,g,v,_,E,F,b,y,x=d[0],T=e.Deferred();if(T.abort=function(e){_.abort(e)},n)for(l=0;l<p.length;l++)c=e(p[l]),a?c.prop("disabled",!1):c.removeAttr("disabled");if(h=e.extend(!0,{},e.ajaxSettings,t),h.context=h.context||h,f="jqFormIO"+(new Date).getTime(),h.iframeTarget?(g=e(h.iframeTarget),F=g.attr2("name"),F?f=F:g.attr2("name",f)):(g=e('<iframe name="'+f+'" src="'+h.iframeSrc+'" />'),g.css({position:"absolute",top:"-1000px",left:"-1000px"})),v=g[0],_={aborted:0,responseText:null,responseXML:null,status:0,statusText:"n/a",getAllResponseHeaders:function(){},getResponseHeader:function(){},setRequestHeader:function(){},abort:function(t){var n="timeout"===t?"timeout":"aborted";i("aborting upload... "+n),this.aborted=1;try{v.contentWindow.document.execCommand&&v.contentWindow.document.execCommand("Stop")}catch(r){}g.attr("src",h.iframeSrc),_.error=n,h.error&&h.error.call(h.context,_,n,t),m&&e.event.trigger("ajaxError",[_,h,n]),h.complete&&h.complete.call(h.context,_,n)}},m=h.global,m&&0===e.active++&&e.event.trigger("ajaxStart"),m&&e.event.trigger("ajaxSend",[_,h]),h.beforeSend&&h.beforeSend.call(h.context,_,h)===!1)return h.global&&e.active--,T.reject(),T;if(_.aborted)return T.reject(),T;E=x.clk,E&&(F=E.name,F&&!E.disabled&&(h.extraData=h.extraData||{},h.extraData[F]=E.value,"image"==E.type&&(h.extraData[F+".x"]=x.clk_x,h.extraData[F+".y"]=x.clk_y)));var D=1,w=2,C=e("meta[name=csrf-token]").attr("content"),N=e("meta[name=csrf-param]").attr("content");N&&C&&(h.extraData=h.extraData||{},h.extraData[N]=C),h.forceSync?s():setTimeout(s,10);var S,k,I,O=50,R=e.parseXML||function(e,t){return window.ActiveXObject?(t=new ActiveXObject("Microsoft.XMLDOM"),t.async="false",t.loadXML(e)):t=(new DOMParser).parseFromString(e,"text/xml"),t&&t.documentElement&&"parsererror"!=t.documentElement.nodeName?t:null},A=e.parseJSON||function(e){return window.eval("("+e+")")},P=function(t,n,i){var r=t.getResponseHeader("content-type")||"",a="xml"===n||!n&&r.indexOf("xml")>=0,s=a?t.responseXML:t.responseText;return a&&"parsererror"===s.documentElement.nodeName&&e.error&&e.error("parsererror"),i&&i.dataFilter&&(s=i.dataFilter(s,n)),"string"==typeof s&&("json"===n||!n&&r.indexOf("json")>=0?s=A(s):("script"===n||!n&&r.indexOf("javascript")>=0)&&e.globalEval(s)),s};return T}if(!this.length)return i("ajaxSubmit: skipping submit process - no element selected"),this;var u,c,l,d=this;"function"==typeof t?t={success:t}:void 0===t&&(t={}),u=t.type||this.attr2("method"),c=t.url||this.attr2("action"),l="string"==typeof c?e.trim(c):"",l=l||window.location.href||"",l&&(l=(l.match(/^([^#]+)/)||[])[1]),t=e.extend(!0,{url:l,success:e.ajaxSettings.success,type:u||e.ajaxSettings.type,iframeSrc:/^https/i.test(window.location.href||"")?"javascript:false":"about:blank"},t);var h={};if(this.trigger("form-pre-serialize",[this,t,h]),h.veto)return i("ajaxSubmit: submit vetoed via form-pre-serialize trigger"),this;if(t.beforeSerialize&&t.beforeSerialize(this,t)===!1)return i("ajaxSubmit: submit aborted via beforeSerialize callback"),this;var m=t.traditional;void 0===m&&(m=e.ajaxSettings.traditional);var f,p=[],g=this.formToArray(t.semantic,p);if(t.data&&(t.extraData=t.data,f=e.param(t.data,m)),t.beforeSubmit&&t.beforeSubmit(g,this,t)===!1)return i("ajaxSubmit: submit aborted via beforeSubmit callback"),this;if(this.trigger("form-submit-validate",[g,this,t,h]),h.veto)return i("ajaxSubmit: submit vetoed via form-submit-validate trigger"),this;var v=e.param(g,m);f&&(v=v?v+"&"+f:f),"GET"==t.type.toUpperCase()?(t.url+=(t.url.indexOf("?")>=0?"&":"?")+v,t.data=null):t.data=v;var _=[];if(t.resetForm&&_.push(function(){d.resetForm()}),t.clearForm&&_.push(function(){d.clearForm(t.includeHidden)}),!t.dataType&&t.target){var E=t.success||function(){};_.push(function(n){var i=t.replaceTarget?"replaceWith":"html";e(t.target)[i](n).each(E,arguments)})}else t.success&&_.push(t.success);if(t.success=function(e,n,i){for(var r=t.context||this,a=0,s=_.length;s>a;a++)_[a].apply(r,[e,n,i||d,d])},t.error){var F=t.error;t.error=function(e,n,i){var r=t.context||this;F.apply(r,[e,n,i,d])}}if(t.complete){var b=t.complete;t.complete=function(e,n){var i=t.context||this;b.apply(i,[e,n,d])}}var y=e("input[type=file]:enabled",this).filter(function(){return""!==e(this).val()}),x=y.length>0,T="multipart/form-data",D=d.attr("enctype")==T||d.attr("encoding")==T,w=r.fileapi&&r.formdata;i("fileAPI :"+w);var C,N=(x||D)&&!w;t.iframe!==!1&&(t.iframe||N)?t.closeKeepAlive?e.get(t.closeKeepAlive,function(){C=o(g)}):C=o(g):C=(x||D)&&w?s(g):e.ajax(t),d.removeData("jqxhr").data("jqxhr",C);for(var S=0;S<p.length;S++)p[S]=null;return this.trigger("form-submit-notify",[this,t]),this},e.fn.ajaxForm=function(r){if(r=r||{},r.delegation=r.delegation&&e.isFunction(e.fn.on),!r.delegation&&0===this.length){var a={s:this.selector,c:this.context};return!e.isReady&&a.s?(i("DOM not ready, queuing ajaxForm"),e(function(){e(a.s,a.c).ajaxForm(r)}),this):(i("terminating; zero elements found by selector"+(e.isReady?"":" (DOM not ready)")),this)}return r.delegation?(e(document).off("submit.form-plugin",this.selector,t).off("click.form-plugin",this.selector,n).on("submit.form-plugin",this.selector,r,t).on("click.form-plugin",this.selector,r,n),this):this.ajaxFormUnbind().bind("submit.form-plugin",r,t).bind("click.form-plugin",r,n)},e.fn.ajaxFormUnbind=function(){return this.unbind("submit.form-plugin click.form-plugin")},e.fn.formToArray=function(t,n){var i=[];if(0===this.length)return i;var a,s=this[0],o=this.attr("id"),u=t?s.getElementsByTagName("*"):s.elements;if(u&&(u=e(u).get()),o&&(a=e(":input[form="+o+"]").get(),a.length&&(u=(u||[]).concat(a))),!u||!u.length)return i;var c,l,d,h,m,f,p;for(c=0,f=u.length;f>c;c++)if(m=u[c],d=m.name,d&&!m.disabled)if(t&&s.clk&&"image"==m.type)s.clk==m&&(i.push({name:d,value:e(m).val(),type:m.type}),i.push({name:d+".x",value:s.clk_x},{name:d+".y",value:s.clk_y}));else if(h=e.fieldValue(m,!0),h&&h.constructor==Array)for(n&&n.push(m),l=0,p=h.length;p>l;l++)i.push({name:d,value:h[l]});else if(r.fileapi&&"file"==m.type){n&&n.push(m);var g=m.files;if(g.length)for(l=0;l<g.length;l++)i.push({name:d,value:g[l],type:m.type});else i.push({name:d,value:"",type:m.type})}else null!==h&&"undefined"!=typeof h&&(n&&n.push(m),i.push({name:d,value:h,type:m.type,required:m.required}));if(!t&&s.clk){var v=e(s.clk),_=v[0];d=_.name,d&&!_.disabled&&"image"==_.type&&(i.push({name:d,value:v.val()}),i.push({name:d+".x",value:s.clk_x},{name:d+".y",value:s.clk_y}))}return i},e.fn.formSerialize=function(t){return e.param(this.formToArray(t))},e.fn.fieldSerialize=function(t){var n=[];return this.each(function(){var i=this.name;if(i){var r=e.fieldValue(this,t);if(r&&r.constructor==Array)for(var a=0,s=r.length;s>a;a++)n.push({name:i,value:r[a]});else null!==r&&"undefined"!=typeof r&&n.push({name:this.name,value:r})}}),e.param(n)},e.fn.fieldValue=function(t){for(var n=[],i=0,r=this.length;r>i;i++){var a=this[i],s=e.fieldValue(a,t);null===s||"undefined"==typeof s||s.constructor==Array&&!s.length||(s.constructor==Array?e.merge(n,s):n.push(s))}return n},e.fieldValue=function(t,n){var i=t.name,r=t.type,a=t.tagName.toLowerCase();if(void 0===n&&(n=!0),n&&(!i||t.disabled||"reset"==r||"button"==r||("checkbox"==r||"radio"==r)&&!t.checked||("submit"==r||"image"==r)&&t.form&&t.form.clk!=t||"select"==a&&-1==t.selectedIndex))return null;if("select"==a){var s=t.selectedIndex;if(0>s)return null;for(var o=[],u=t.options,c="select-one"==r,l=c?s+1:u.length,d=c?s:0;l>d;d++){var h=u[d];if(h.selected){var m=h.value;if(m||(m=h.attributes&&h.attributes.value&&!h.attributes.value.specified?h.text:h.value),c)return m;o.push(m)}}return o}return e(t).val()},e.fn.clearForm=function(t){return this.each(function(){e("input,select,textarea",this).clearFields(t)})},e.fn.clearFields=e.fn.clearInputs=function(t){var n=/^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i;return this.each(function(){var i=this.type,r=this.tagName.toLowerCase();n.test(i)||"textarea"==r?this.value="":"checkbox"==i||"radio"==i?this.checked=!1:"select"==r?this.selectedIndex=-1:"file"==i?/MSIE/.test(navigator.userAgent)?e(this).replaceWith(e(this).clone(!0)):e(this).val(""):t&&(t===!0&&/hidden/.test(i)||"string"==typeof t&&e(this).is(t))&&(this.value="")})},e.fn.resetForm=function(){return this.each(function(){("function"==typeof this.reset||"object"==typeof this.reset&&!this.reset.nodeType)&&this.reset()})},e.fn.enable=function(e){return void 0===e&&(e=!0),this.each(function(){this.disabled=!e})},e.fn.selected=function(t){return void 0===t&&(t=!0),this.each(function(){var n=this.type;if("checkbox"==n||"radio"==n)this.checked=t;else if("option"==this.tagName.toLowerCase()){var i=e(this).parent("select");t&&i[0]&&"select-one"==i[0].type&&i.find("option").selected(!1),this.selected=t}})},e.fn.ajaxSubmit.debug=!1}),function(e){e.extend(e.fn,{validate:function(t){if(!this.length)return void(t&&t.debug&&window.console&&console.warn("Nothing selected, can't validate, returning nothing."));var n=e.data(this[0],"validator");return n?n:(this.attr("novalidate","novalidate"),n=new e.validator(t,this[0]),e.data(this[0],"validator",n),n.settings.onsubmit&&(this.validateDelegate(":submit","click",function(t){n.settings.submitHandler&&(n.submitButton=t.target),e(t.target).hasClass("cancel")&&(n.cancelSubmit=!0),void 0!==e(t.target).attr("formnovalidate")&&(n.cancelSubmit=!0)}),this.submit(function(t){function i(){var i;return n.settings.submitHandler?(n.submitButton&&(i=e("<input type='hidden'/>").attr("name",n.submitButton.name).val(e(n.submitButton).val()).appendTo(n.currentForm)),n.settings.submitHandler.call(n,n.currentForm,t),n.submitButton&&i.remove(),!1):!0}return n.settings.debug&&t.preventDefault(),n.cancelSubmit?(n.cancelSubmit=!1,i()):n.form()?n.pendingRequest?(n.formSubmitted=!0,!1):i():(n.focusInvalid(),!1)})),n)},valid:function(){if(e(this[0]).is("form"))return this.validate().form();var t=!0,n=e(this[0].form).validate();return this.each(function(){t=t&&n.element(this)}),t},removeAttrs:function(t){var n={},i=this;return e.each(t.split(/\s/),function(e,t){n[t]=i.attr(t),i.removeAttr(t)}),n},rules:function(t,n){var i=this[0];if(t){var r=e.data(i.form,"validator").settings,a=r.rules,s=e.validator.staticRules(i);switch(t){case"add":e.extend(s,e.validator.normalizeRule(n)),delete s.messages,a[i.name]=s,n.messages&&(r.messages[i.name]=e.extend(r.messages[i.name],n.messages));break;case"remove":if(!n)return delete a[i.name],s;var o={};return e.each(n.split(/\s/),function(e,t){o[t]=s[t],delete s[t]}),o}}var u=e.validator.normalizeRules(e.extend({},e.validator.classRules(i),e.validator.attributeRules(i),e.validator.dataRules(i),e.validator.staticRules(i)),i);if(u.required){var c=u.required;delete u.required,u=e.extend({required:c},u)}return u}}),e.extend(e.expr[":"],{blank:function(t){return!e.trim(""+e(t).val())},filled:function(t){return!!e.trim(""+e(t).val())
},unchecked:function(t){return!e(t).prop("checked")}}),e.validator=function(t,n){this.settings=e.extend(!0,{},e.validator.defaults,t),this.currentForm=n,this.init()},e.validator.format=function(t,n){return 1===arguments.length?function(){var n=e.makeArray(arguments);return n.unshift(t),e.validator.format.apply(this,n)}:(arguments.length>2&&n.constructor!==Array&&(n=e.makeArray(arguments).slice(1)),n.constructor!==Array&&(n=[n]),e.each(n,function(e,n){t=t.replace(RegExp("\\{"+e+"\\}","g"),function(){return n})}),t)},e.extend(e.validator,{defaults:{messages:{},groups:{},rules:{},errorClass:"error",validClass:"valid",errorElement:"label",focusInvalid:!0,errorContainer:e([]),errorLabelContainer:e([]),onsubmit:!0,ignore:":hidden",ignoreTitle:!1,onfocusin:function(e){this.lastActive=e,this.settings.focusCleanup&&!this.blockFocusCleanup&&(this.settings.unhighlight&&this.settings.unhighlight.call(this,e,this.settings.errorClass,this.settings.validClass),this.addWrapper(this.errorsFor(e)).hide())},onfocusout:function(e){this.checkable(e)||!(e.name in this.submitted)&&this.optional(e)||this.element(e)},onkeyup:function(e,t){(9!==t.which||""!==this.elementValue(e))&&(e.name in this.submitted||e===this.lastElement)&&this.element(e)},onclick:function(e){e.name in this.submitted?this.element(e):e.parentNode.name in this.submitted&&this.element(e.parentNode)},highlight:function(t,n,i){"radio"===t.type?this.findByName(t.name).addClass(n).removeClass(i):e(t).addClass(n).removeClass(i)},unhighlight:function(t,n,i){"radio"===t.type?this.findByName(t.name).removeClass(n).addClass(i):e(t).removeClass(n).addClass(i)}},setDefaults:function(t){e.extend(e.validator.defaults,t)},messages:{required:"This field is required.",remote:"Please fix this field.",email:"Please enter a valid email address.",url:"Please enter a valid URL.",date:"Please enter a valid date.",dateISO:"Please enter a valid date (ISO).",number:"Please enter a valid number.",digits:"Please enter only digits.",creditcard:"Please enter a valid credit card number.",equalTo:"Please enter the same value again.",maxlength:e.validator.format("Please enter no more than {0} characters."),minlength:e.validator.format("Please enter at least {0} characters."),rangelength:e.validator.format("Please enter a value between {0} and {1} characters long."),range:e.validator.format("Please enter a value between {0} and {1}."),max:e.validator.format("Please enter a value less than or equal to {0}."),min:e.validator.format("Please enter a value greater than or equal to {0}.")},autoCreateRanges:!1,prototype:{init:function(){function t(t){var n=e.data(this[0].form,"validator"),i="on"+t.type.replace(/^validate/,"");n.settings[i]&&n.settings[i].call(n,this[0],t)}this.labelContainer=e(this.settings.errorLabelContainer),this.errorContext=this.labelContainer.length&&this.labelContainer||e(this.currentForm),this.containers=e(this.settings.errorContainer).add(this.settings.errorLabelContainer),this.submitted={},this.valueCache={},this.pendingRequest=0,this.pending={},this.invalid={},this.reset();var n=this.groups={};e.each(this.settings.groups,function(t,i){"string"==typeof i&&(i=i.split(/\s/)),e.each(i,function(e,i){n[i]=t})});var i=this.settings.rules;e.each(i,function(t,n){i[t]=e.validator.normalizeRule(n)}),e(this.currentForm).validateDelegate(":text, [type='password'], [type='file'], select, textarea, [type='number'], [type='search'] ,[type='tel'], [type='url'], [type='email'], [type='datetime'], [type='date'], [type='month'], [type='week'], [type='time'], [type='datetime-local'], [type='range'], [type='color'] ","focusin focusout keyup",t).validateDelegate("[type='radio'], [type='checkbox'], select, option","click",t),this.settings.invalidHandler&&e(this.currentForm).bind("invalid-form.validate",this.settings.invalidHandler)},form:function(){return this.checkForm(),e.extend(this.submitted,this.errorMap),this.invalid=e.extend({},this.errorMap),this.valid()||e(this.currentForm).triggerHandler("invalid-form",[this]),this.showErrors(),this.valid()},checkForm:function(){this.prepareForm();for(var e=0,t=this.currentElements=this.elements();t[e];e++)this.check(t[e]);return this.valid()},element:function(t){t=this.validationTargetFor(this.clean(t)),this.lastElement=t,this.prepareElement(t),this.currentElements=e(t);var n=this.check(t)!==!1;return n?delete this.invalid[t.name]:this.invalid[t.name]=!0,this.numberOfInvalids()||(this.toHide=this.toHide.add(this.containers)),this.showErrors(),n},showErrors:function(t){if(t){e.extend(this.errorMap,t),this.errorList=[];for(var n in t)this.errorList.push({message:t[n],element:this.findByName(n)[0]});this.successList=e.grep(this.successList,function(e){return!(e.name in t)})}this.settings.showErrors?this.settings.showErrors.call(this,this.errorMap,this.errorList):this.defaultShowErrors()},resetForm:function(){e.fn.resetForm&&e(this.currentForm).resetForm(),this.submitted={},this.lastElement=null,this.prepareForm(),this.hideErrors(),this.elements().removeClass(this.settings.errorClass).removeData("previousValue")},numberOfInvalids:function(){return this.objectLength(this.invalid)},objectLength:function(e){var t=0;for(var n in e)t++;return t},hideErrors:function(){this.addWrapper(this.toHide).hide()},valid:function(){return 0===this.size()},size:function(){return this.errorList.length},focusInvalid:function(){if(this.settings.focusInvalid)try{e(this.findLastActive()||this.errorList.length&&this.errorList[0].element||[]).filter(":visible").focus().trigger("focusin")}catch(t){}},findLastActive:function(){var t=this.lastActive;return t&&1===e.grep(this.errorList,function(e){return e.element.name===t.name}).length&&t},elements:function(){var t=this,n={};return e(this.currentForm).find("input, select, textarea").not(":submit, :reset, :image, [disabled]").not(this.settings.ignore).filter(function(){return!this.name&&t.settings.debug&&window.console&&console.error("%o has no name assigned",this),this.name in n||!t.objectLength(e(this).rules())?!1:(n[this.name]=!0,!0)})},clean:function(t){return e(t)[0]},errors:function(){var t=this.settings.errorClass.replace(" ",".");return e(this.settings.errorElement+"."+t,this.errorContext)},reset:function(){this.successList=[],this.errorList=[],this.errorMap={},this.toShow=e([]),this.toHide=e([]),this.currentElements=e([])},prepareForm:function(){this.reset(),this.toHide=this.errors().add(this.containers)},prepareElement:function(e){this.reset(),this.toHide=this.errorsFor(e)},elementValue:function(t){var n=e(t).attr("type"),i=e(t).val();return"radio"===n||"checkbox"===n?e("input[name='"+e(t).attr("name")+"']:checked").val():"string"==typeof i?i.replace(/\r/g,""):i},check:function(t){t=this.validationTargetFor(this.clean(t));var n,i=e(t).rules(),r=!1,a=this.elementValue(t);for(var s in i){var o={method:s,parameters:i[s]};try{if(n=e.validator.methods[s].call(this,a,t,o.parameters),"dependency-mismatch"===n){r=!0;continue}if(r=!1,"pending"===n)return void(this.toHide=this.toHide.not(this.errorsFor(t)));if(!n)return this.formatAndAdd(t,o),!1}catch(u){throw this.settings.debug&&window.console&&console.log("Exception occurred when checking element "+t.id+", check the '"+o.method+"' method.",u),u}}return r?void 0:(this.objectLength(i)&&this.successList.push(t),!0)},customDataMessage:function(t,n){return e(t).data("msg-"+n.toLowerCase())||t.attributes&&e(t).attr("data-msg-"+n.toLowerCase())},customMessage:function(e,t){var n=this.settings.messages[e];return n&&(n.constructor===String?n:n[t])},findDefined:function(){for(var e=0;arguments.length>e;e++)if(void 0!==arguments[e])return arguments[e];return void 0},defaultMessage:function(t,n){return this.findDefined(this.customMessage(t.name,n),this.customDataMessage(t,n),!this.settings.ignoreTitle&&t.title||void 0,e.validator.messages[n],"<strong>Warning: No message defined for "+t.name+"</strong>")},formatAndAdd:function(t,n){var i=this.defaultMessage(t,n.method),r=/\$?\{(\d+)\}/g;"function"==typeof i?i=i.call(this,n.parameters,t):r.test(i)&&(i=e.validator.format(i.replace(r,"{$1}"),n.parameters)),this.errorList.push({message:i,element:t}),this.errorMap[t.name]=i,this.submitted[t.name]=i},addWrapper:function(e){return this.settings.wrapper&&(e=e.add(e.parent(this.settings.wrapper))),e},defaultShowErrors:function(){var e,t;for(e=0;this.errorList[e];e++){var n=this.errorList[e];this.settings.highlight&&this.settings.highlight.call(this,n.element,this.settings.errorClass,this.settings.validClass),this.showLabel(n.element,n.message)}if(this.errorList.length&&(this.toShow=this.toShow.add(this.containers)),this.settings.success)for(e=0;this.successList[e];e++)this.showLabel(this.successList[e]);if(this.settings.unhighlight)for(e=0,t=this.validElements();t[e];e++)this.settings.unhighlight.call(this,t[e],this.settings.errorClass,this.settings.validClass);this.toHide=this.toHide.not(this.toShow),this.hideErrors(),this.addWrapper(this.toShow).show()},validElements:function(){return this.currentElements.not(this.invalidElements())},invalidElements:function(){return e(this.errorList).map(function(){return this.element})},showLabel:function(t,n){var i=this.errorsFor(t);i.length?(i.removeClass(this.settings.validClass).addClass(this.settings.errorClass),i.html(n)):(i=e("<"+this.settings.errorElement+">").attr("for",this.idOrName(t)).addClass(this.settings.errorClass).html(n||""),this.settings.wrapper&&(i=i.hide().show().wrap("<"+this.settings.wrapper+"/>").parent()),this.labelContainer.append(i).length||(this.settings.errorPlacement?this.settings.errorPlacement(i,e(t)):i.insertAfter(t))),!n&&this.settings.success&&(i.text(""),"string"==typeof this.settings.success?i.addClass(this.settings.success):this.settings.success(i,t)),this.toShow=this.toShow.add(i)},errorsFor:function(t){var n=this.idOrName(t);return this.errors().filter(function(){return e(this).attr("for")===n})},idOrName:function(e){return this.groups[e.name]||(this.checkable(e)?e.name:e.id||e.name)},validationTargetFor:function(e){return this.checkable(e)&&(e=this.findByName(e.name).not(this.settings.ignore)[0]),e},checkable:function(e){return/radio|checkbox/i.test(e.type)},findByName:function(t){return e(this.currentForm).find("[name='"+t+"']")},getLength:function(t,n){switch(n.nodeName.toLowerCase()){case"select":return e("option:selected",n).length;case"input":if(this.checkable(n))return this.findByName(n.name).filter(":checked").length}return t.length},depend:function(e,t){return this.dependTypes[typeof e]?this.dependTypes[typeof e](e,t):!0},dependTypes:{"boolean":function(e){return e},string:function(t,n){return!!e(t,n.form).length},"function":function(e,t){return e(t)}},optional:function(t){var n=this.elementValue(t);return!e.validator.methods.required.call(this,n,t)&&"dependency-mismatch"},startRequest:function(e){this.pending[e.name]||(this.pendingRequest++,this.pending[e.name]=!0)},stopRequest:function(t,n){this.pendingRequest--,0>this.pendingRequest&&(this.pendingRequest=0),delete this.pending[t.name],n&&0===this.pendingRequest&&this.formSubmitted&&this.form()?(e(this.currentForm).submit(),this.formSubmitted=!1):!n&&0===this.pendingRequest&&this.formSubmitted&&(e(this.currentForm).triggerHandler("invalid-form",[this]),this.formSubmitted=!1)},previousValue:function(t){return e.data(t,"previousValue")||e.data(t,"previousValue",{old:null,valid:!0,message:this.defaultMessage(t,"remote")})}},classRuleSettings:{required:{required:!0},email:{email:!0},url:{url:!0},date:{date:!0},dateISO:{dateISO:!0},number:{number:!0},digits:{digits:!0},creditcard:{creditcard:!0}},addClassRules:function(t,n){t.constructor===String?this.classRuleSettings[t]=n:e.extend(this.classRuleSettings,t)},classRules:function(t){var n={},i=e(t).attr("class");return i&&e.each(i.split(" "),function(){this in e.validator.classRuleSettings&&e.extend(n,e.validator.classRuleSettings[this])}),n},attributeRules:function(t){var n={},i=e(t),r=i[0].getAttribute("type");for(var a in e.validator.methods){var s;"required"===a?(s=i.get(0).getAttribute(a),""===s&&(s=!0),s=!!s):s=i.attr(a),/min|max/.test(a)&&(null===r||/number|range|text/.test(r))&&(s=Number(s)),s?n[a]=s:r===a&&"range"!==r&&(n[a]=!0)}return n.maxlength&&/-1|2147483647|524288/.test(n.maxlength)&&delete n.maxlength,n},dataRules:function(t){var n,i,r={},a=e(t);for(n in e.validator.methods)i=a.data("rule-"+n.toLowerCase()),void 0!==i&&(r[n]=i);return r},staticRules:function(t){var n={},i=e.data(t.form,"validator");return i.settings.rules&&(n=e.validator.normalizeRule(i.settings.rules[t.name])||{}),n},normalizeRules:function(t,n){return e.each(t,function(i,r){if(r===!1)return void delete t[i];if(r.param||r.depends){var a=!0;switch(typeof r.depends){case"string":a=!!e(r.depends,n.form).length;break;case"function":a=r.depends.call(n,n)}a?t[i]=void 0!==r.param?r.param:!0:delete t[i]}}),e.each(t,function(i,r){t[i]=e.isFunction(r)?r(n):r}),e.each(["minlength","maxlength"],function(){t[this]&&(t[this]=Number(t[this]))}),e.each(["rangelength","range"],function(){var n;t[this]&&(e.isArray(t[this])?t[this]=[Number(t[this][0]),Number(t[this][1])]:"string"==typeof t[this]&&(n=t[this].split(/[\s,]+/),t[this]=[Number(n[0]),Number(n[1])]))}),e.validator.autoCreateRanges&&(t.min&&t.max&&(t.range=[t.min,t.max],delete t.min,delete t.max),t.minlength&&t.maxlength&&(t.rangelength=[t.minlength,t.maxlength],delete t.minlength,delete t.maxlength)),t},normalizeRule:function(t){if("string"==typeof t){var n={};e.each(t.split(/\s/),function(){n[this]=!0}),t=n}return t},addMethod:function(t,n,i){e.validator.methods[t]=n,e.validator.messages[t]=void 0!==i?i:e.validator.messages[t],3>n.length&&e.validator.addClassRules(t,e.validator.normalizeRule(t))},methods:{required:function(t,n,i){if(!this.depend(i,n))return"dependency-mismatch";if("select"===n.nodeName.toLowerCase()){var r=e(n).val();return r&&r.length>0}return this.checkable(n)?this.getLength(t,n)>0:e.trim(t).length>0},email:function(e,t){return this.optional(t)||/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(e)},url:function(e,t){return this.optional(t)||/^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(e)},date:function(e,t){return this.optional(t)||!/Invalid|NaN/.test(""+new Date(e))},dateISO:function(e,t){return this.optional(t)||/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(e)},number:function(e,t){return this.optional(t)||/^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(e)},digits:function(e,t){return this.optional(t)||/^\d+$/.test(e)},creditcard:function(e,t){if(this.optional(t))return"dependency-mismatch";if(/[^0-9 \-]+/.test(e))return!1;var n=0,i=0,r=!1;e=e.replace(/\D/g,"");for(var a=e.length-1;a>=0;a--){var s=e.charAt(a);i=parseInt(s,10),r&&(i*=2)>9&&(i-=9),n+=i,r=!r}return 0===n%10},minlength:function(t,n,i){var r=e.isArray(t)?t.length:this.getLength(e.trim(t),n);return this.optional(n)||r>=i},maxlength:function(t,n,i){var r=e.isArray(t)?t.length:this.getLength(e.trim(t),n);return this.optional(n)||i>=r},rangelength:function(t,n,i){var r=e.isArray(t)?t.length:this.getLength(e.trim(t),n);return this.optional(n)||r>=i[0]&&i[1]>=r},min:function(e,t,n){return this.optional(t)||e>=n},max:function(e,t,n){return this.optional(t)||n>=e},range:function(e,t,n){return this.optional(t)||e>=n[0]&&n[1]>=e},equalTo:function(t,n,i){var r=e(i);return this.settings.onfocusout&&r.unbind(".validate-equalTo").bind("blur.validate-equalTo",function(){e(n).valid()}),t===r.val()},remote:function(t,n,i){if(this.optional(n))return"dependency-mismatch";var r=this.previousValue(n);if(this.settings.messages[n.name]||(this.settings.messages[n.name]={}),r.originalMessage=this.settings.messages[n.name].remote,this.settings.messages[n.name].remote=r.message,i="string"==typeof i&&{url:i}||i,r.old===t)return r.valid;r.old=t;var a=this;this.startRequest(n);var s={};return s[n.name]=t,e.ajax(e.extend(!0,{url:i,mode:"abort",port:"validate"+n.name,dataType:"json",data:s,success:function(i){a.settings.messages[n.name].remote=r.originalMessage;var s=i===!0||"true"===i;if(s){var o=a.formSubmitted;a.prepareElement(n),a.formSubmitted=o,a.successList.push(n),delete a.invalid[n.name],a.showErrors()}else{var u={},c=i||a.defaultMessage(n,"remote");u[n.name]=r.message=e.isFunction(c)?c(t):c,a.invalid[n.name]=!0,a.showErrors(u)}r.valid=s,a.stopRequest(n,s)}},i)),"pending"}}}),e.format=e.validator.format}(jQuery),function(e){var t={};if(e.ajaxPrefilter)e.ajaxPrefilter(function(e,n,i){var r=e.port;"abort"===e.mode&&(t[r]&&t[r].abort(),t[r]=i)});else{var n=e.ajax;e.ajax=function(i){var r=("mode"in i?i:e.ajaxSettings).mode,a=("port"in i?i:e.ajaxSettings).port;return"abort"===r?(t[a]&&t[a].abort(),t[a]=n.apply(this,arguments),t[a]):n.apply(this,arguments)}}}(jQuery),function(e){e.extend(e.fn,{validateDelegate:function(t,n,i){return this.bind(n,function(n){var r=e(n.target);return r.is(t)?i.apply(r,arguments):void 0})}})}(jQuery),function(e){e.megaMenuCompleteSet=function(t,n){function i(){var t=e(this);switch(s.menu_effect){case"hover_fade":t.find(y).first().fadeIn(s.menu_speed_show);break;case"hover_slide":t.find(y).first().slideDown(s.menu_speed_show);break;case"hover_toggle":t.find(y).first().show(s.menu_speed_show);break;case"click_fade":t.click(function(){t.find(y).first().fadeIn(s.menu_speed_show)});break;case"click_slide":t.click(function(){t.find(y).first().slideDown(s.menu_speed_show)});break;case"click_toggle":t.click(function(){t.find(y).first().show(s.menu_speed_show)})}}function r(){var t=e(this).find(y);switch(s.menu_effect){case"hover_fade":case"click_fade":t.fadeOut(s.menu_speed_hide);break;case"hover_slide":case"click_slide":t.slideUp(s.menu_speed_hide);break;case"hover_toggle":case"click_toggle":t.hide(s.menu_speed_hide)}}function a(){e("#megamenu_form").validate({rules:{name:{required:!0,minlength:2},email:{required:!0,email:!0},message:{required:!0},captcha:{required:!0,answercheck:!0}},messages:{name:{required:"Please enter your name",minlength:"Your name should contain at least 2 characters"},email:{required:"Please enter your email address"},message:{required:"Please enter your message",minlength:"This is too short"},captcha:{required:"Wrong answer !"}},submitHandler:function(t){e(t).ajaxSubmit({type:"POST",data:e(t).serialize(),url:"contact.php",success:function(){e("#megamenu_form fieldset").fadeTo("slow",.3,function(){e("#success").fadeIn()})},error:function(){e("#megamenu_form fieldset").fadeTo("slow",.3,function(){e("#error").fadeIn()})}})}}),jQuery.validator.addMethod("answercheck",function(e,t){return this.optional(t)||/^\b5\b$/.test(e)},"Please type the correct answer")}var s={menu_speed_show:300,menu_speed_hide:200,menu_speed_delay:200,menu_effect:"hover_fade",menu_click_outside:0,menu_show_onload:0,menu_responsive:1},o=this;o.options={};var u=e(t),t=t,c=u.children("li"),l=e(c).children(".megamenu_drop"),d=e(c).find(".dropdown_container"),h=e(".megamenu_container_vertical"),m=e(c).find(".dropdown_fullwidth"),f=e(d).add(m),p=e(".dropdown_first"),g=e(c).find(".dropdown_parent"),v=e(g).children("a"),_=e(g).find(".dropdown_flyout_level"),E=e(g).find(".dropdown_flyout_level_left"),F=e(".megamenu_button"),b=e(c).add(g),y=e(f).add(_).add(E);o.init=function(){s=e.extend(1,s,n),hoverIntentConfig={over:i,out:r,timeout:200,sensitivity:2,interval:s.menu_speed_delay},x(),e("#megamenu_form").length>0&&a()};var x=function(){if("ontouchstart"in document.documentElement&&1===s.menu_responsive)return e(document).width()<768?(e(f).css({left:"-1px",top:"auto"}).hide(),e(_).css({left:"0",top:"0"}).hide(),e(c).hide(0),e(F).show(0)):T(),e(F).hammer().on("tap",function(){e(this).toggleClass("megamenu_button_active"),e(c).not(":eq(0)").toggle(0)}),e(b).toggleClass("noactive"),e(l).hammer().on("tap",function(){var t=e(this);return t.parent(c).toggleClass("active noactive").find(f).toggle(0),t.parent(c).siblings().addClass("noactive").removeClass("active").find(f).hide(0),e(g).addClass("noactive").removeClass("active").find(_).hide(0),!1}),e(v).hammer().on("tap",function(){var t=e(this);return t.parent(g).toggleClass("active noactive").find(_).first().toggle(0),t.parent(g).siblings().addClass("noactive").removeClass("active").find(_).hide(0),t.parent(g).siblings().find(g).addClass("noactive").removeClass("active"),!1}),e(document).hammer().on("tap",function(){e(b).addClass("noactive"),e(y).hide(0)}),u.hammer().on("tap",function(e){e.stopPropagation()}),void e(window).bind("orientationchange",function(){e(b).addClass("noactive"),e(y).hide(0),e(document).width()<768?(e(c).hide(0),e(F).show(0)):(e(c).show(0),e(F).hide(0))});switch(T(),e(window).resize(function(){e(F).removeClass("megamenu_button_active"),T()}),e(F).children("a").click(function(){e(F).toggleClass("megamenu_button_active"),e(c).not(":eq(0)").toggle(0)}),1===s.menu_click_outside&&(e(document).click(function(){e(b).removeClass("active"),e(y).hide(0)}),u.click(function(e){e.stopPropagation()})),s.menu_effect){case"open_close_fade":var t="fadeToggle",n="fadeOut";break;case"open_close_slide":var t="slideToggle",n="slideUp";break;case"open_close_toggle":var t="toggle",n="hide"}switch(s.menu_effect){case"hover_fade":case"hover_slide":case"hover_toggle":case"click_fade":case"click_slide":case"click_toggle":e(b).hoverIntent(hoverIntentConfig);break;case"open_close_fade":case"open_close_slide":case"open_close_toggle":e(".megamenu > li:nth-child("+(1+s.menu_show_onload)+")").find(f).show().closest(c).toggleClass("active"),e(c).unbind("mouseenter mouseleave").click(function(){var i=e(this);i.siblings().removeClass("active").find(f)[n](s.menu_speed_hide),i.toggleClass("active").find(f).first().delay(s.menu_speed_delay)[t](s.menu_speed_show).click(function(e){e.stopPropagation()})}),e(g).unbind("mouseenter mouseleave").click(function(){var i=e(this);i.siblings().removeClass("active").find(_)[n](s.menu_speed_hide),i.siblings().find("li").removeClass("active"),i.toggleClass("active").find(_).first().delay(s.menu_speed_delay)[t](s.menu_speed_show).click(function(e){e.stopPropagation()})})}},T=function(){e(document).width()<768&&1===s.menu_responsive?(e(f).css({left:"-1px",top:"auto"}).hide(),e(p).css({left:"0"}).hide(),e(_).css({left:"0",top:"0"}).hide(),u.children("li").hide(0),e(F).show(0)):(e(d).css({left:"auto",top:"auto"}).hide(),e(m).css({left:"-1px",top:"auto"}).hide(),e(_).css({left:"95%",top:"-21px"}).hide(),e(E).css({left:"-108%",right:"100%"}).hide(),u.children("li").show(0),e(F).hide(0)),e(h).find(f).css({top:"0"})};o.init()},e.fn.megaMenuCompleteSet=function(t){return this.each(function(){if(void 0==e(this).data("megaMenuCompleteSet")){var n=new e.megaMenuCompleteSet(this,t);e(this).data("megaMenuCompleteSet",n)}})}}(jQuery);
!function(t){t.fn.ngResponsiveTables=function(n){var a={smallPaddingCharNo:5,mediumPaddingCharNo:10,largePaddingCharNo:15},i=this,d={opt:"",dataContent:"",globalWidth:0,init:function(){this.opt=t.extend(a,n),d.targetTable()},targetTable:function(){var n=this;i.find("tr").each(function(){t(this).find("td").each(function(a){n.checkForTableHead(t(this),a),t(this).addClass("tdno"+a)})})},checkForTableHead:function(n,a){this.dataContent=i.find("th").length?i.find("th")[a].textContent:i.find("tr:first td")[a].textContent,this.opt.smallPaddingCharNo>t.trim(this.dataContent).length?n.addClass("small-padding"):this.opt.mediumPaddingCharNo>t.trim(this.dataContent).length?n.addClass("medium-padding"):n.addClass("large-padding"),n.attr("data-content",this.dataContent)}};return t(function(){d.init()}),this}}(jQuery);
(function($) {
	window.CDT = jQuery.extend(window.CDT || {}, {
		list_participants: {
			setupQuantity: function(product) {
				var capture_area = product.find(".capture-details");

				capture_area.prepend('Number of Participants<br/><input type="text" class="productTextInput quantity-field number-of-participants" value="1" /><br/>Participant Names<br/>');
				capture_area.after('<li class="price"><a class="pointer validate-participants"><img src="/images/book/book-now.png"></a></li>');
			},
			controlFields: function(product) {
				var capture_area = product.find(".capture-details"),
					quantity = Number(capture_area.find(".number-of-participants").val()),
					currentParticipants = new Array();

				if (quantity <= 0 || isNaN(quantity)) {
					quantity = 1;
				}
				capture_area.find(".participant").each(function() {
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();

					currentParticipants.push({
						name: (name != "Name (Required)") ? name : "",
						email: (email != "Email") ? email : ""
					});
				});
				capture_area.find(".participant").remove();
				for (var i = 0; i < quantity; i++) {
					var participant = currentParticipants[i],
						name = "",
						email = "";

					if (participant != null) {
						name = participant.name;
						email = participant.email;
					}

					capture_area.append(
						'<div class="participant cf">\
							<input type="text" class="name" value="' + ((name != "") ? name : "Name (Required)") + '" onblur="if(this.value == \'\'){this.value = \'Name (Required)\';}" onfocus="if(this.value == \'Name (Required)\'){this.value = \'\';}"/><br>\
							<input type="text" class="email" value="' + ((email != "") ? email : "Email (Optional)") + '"onblur="if(this.value == \'\'){this.value = \'Email (Optional)\';}" onfocus="if(this.value == \'Email (Optional)\'){this.value = \'\';}"/>\
						</div>'
					);
				}
			},
			validateFields: function() {
				var capture_area = jQuery(".capture-details"),
					valid = true;

				capture_area.find(".participant input.name").each(function() {
					var thisValue = jQuery(this).val();

					if (thisValue == "" || thisValue == "Name (Required)") {
						valid = false;
						return false;
					}
				});

				return valid;
			},
			concatenateFields: function() {
				var capture_details = jQuery(".capture-details"),
					concatString = "";

				capture_details.find(".participant").each(function() {
					var participant = jQuery(this),
						name = participant.find(".name").val(),
						email = participant.find(".email").val();

					concatString = concatString + ((concatString != "") ? ", " : "") + name + ((email != "" && email != "Email (Optional)") ? " (" + email + ")" : "");
				});

				return (concatString + ".");
			},
			init: function() {
				jQuery("[data-applyMultipleParticipants]").each(function() {
					var product = jQuery(this);

					product.find(".product-quantity").hide();
					CDT.list_participants.setupQuantity(product);
					CDT.list_participants.controlFields(product);
					product.find(".number-of-participants").on("change", function() {
						CDT.list_participants.controlFields(product);
					});
					product.find(".validate-participants").on("click", function(e) {
						e.preventDefault();
						e.stopPropagation();

						var numParticipants = Number(product.find(".number-of-participants").val());

						if (numParticipants > 0) {
							var valid = CDT.list_participants.validateFields(product);
							if (valid) {
								product.find(".capture-details-input").val(CDT.list_participants.concatenateFields(product));
								product.find("input[name=AddToCart_Amount]").val(numParticipants);
								product.find(".product-quantity img").click();
							} else {
								alert("- Please ensure that a name has been entered for each participant");
							}
						} else {
							alert("- Please enter Number of Participants");
						}
					});
				});
			}
		}
	});
})(jQuery);

jQuery(function() {
	CDT.list_participants.init();

	jQuery("body").on("change", "select[name=AddToCart_Grouping]", function() {
		CDT.list_participants.init();
	});
});

!function(a,b,c,d){"use strict";function e(a){return("string"==typeof a||a instanceof String)&&(a=a.replace(/^['\\/"]+|(;\s?})+|['\\/"]+$/g,"")),a}var f=function(b){for(var c=b.length,d=a("head");c--;)0===d.has("."+b[c]).length&&d.append('<meta class="'+b[c]+'" />')};f(["foundation-mq-small","foundation-mq-medium","foundation-mq-large","foundation-mq-xlarge","foundation-mq-xxlarge","foundation-data-attribute-namespace"]),a(function(){"undefined"!=typeof FastClick&&"undefined"!=typeof c.body&&FastClick.attach(c.body)});var g=function(b,d){if("string"==typeof b){if(d){var e;if(d.jquery){if(e=d[0],!e)return d}else e=d;return a(e.querySelectorAll(b))}return a(c.querySelectorAll(b))}return a(b,d)},h=function(a){var b=[];return a||b.push("data"),this.namespace.length>0&&b.push(this.namespace),b.push(this.name),b.join("-")},i=function(a){for(var b=a.split("-"),c=b.length,d=[];c--;)0!==c?d.push(b[c]):this.namespace.length>0?d.push(this.namespace,b[c]):d.push(b[c]);return d.reverse().join("-")},j=function(b,c){var d=this,e=!g(this).data(this.attr_name(!0));return g(this.scope).is("["+this.attr_name()+"]")?(g(this.scope).data(this.attr_name(!0)+"-init",a.extend({},this.settings,c||b,this.data_options(g(this.scope)))),e&&this.events(this.scope)):g("["+this.attr_name()+"]",this.scope).each(function(){var e=!g(this).data(d.attr_name(!0)+"-init");g(this).data(d.attr_name(!0)+"-init",a.extend({},d.settings,c||b,d.data_options(g(this)))),e&&d.events(this)}),"string"==typeof b?this[b].call(this,c):void 0},k=function(a,b){function c(){b(a[0])}function d(){if(this.one("load",c),/MSIE (\d+\.\d+);/.test(navigator.userAgent)){var a=this.attr("src"),b=a.match(/\?/)?"&":"?";b+="random="+(new Date).getTime(),this.attr("src",a+b)}}return a.attr("src")?void(a[0].complete||4===a[0].readyState?c():d.call(a)):void c()};b.matchMedia=b.matchMedia||function(a){var b,c=a.documentElement,d=c.firstElementChild||c.firstChild,e=a.createElement("body"),f=a.createElement("div");return f.id="mq-test-1",f.style.cssText="position:absolute;top:-100em",e.style.background="none",e.appendChild(f),function(a){return f.innerHTML='&shy;<style media="'+a+'"> #mq-test-1 { width: 42px; }</style>',c.insertBefore(e,d),b=42===f.offsetWidth,c.removeChild(e),{matches:b,media:a}}}(c),function(){function a(){c&&(f(a),h&&jQuery.fx.tick())}for(var c,d=0,e=["webkit","moz"],f=b.requestAnimationFrame,g=b.cancelAnimationFrame,h="undefined"!=typeof jQuery.fx;d<e.length&&!f;d++)f=b[e[d]+"RequestAnimationFrame"],g=g||b[e[d]+"CancelAnimationFrame"]||b[e[d]+"CancelRequestAnimationFrame"];f?(b.requestAnimationFrame=f,b.cancelAnimationFrame=g,h&&(jQuery.fx.timer=function(b){b()&&jQuery.timers.push(b)&&!c&&(c=!0,a())},jQuery.fx.stop=function(){c=!1})):(b.requestAnimationFrame=function(a){var c=(new Date).getTime(),e=Math.max(0,16-(c-d)),f=b.setTimeout(function(){a(c+e)},e);return d=c+e,f},b.cancelAnimationFrame=function(a){clearTimeout(a)})}(jQuery),b.Foundation={name:"Foundation",version:"5.4.3",media_queries:{small:g(".foundation-mq-small").css("font-family").replace(/^[\/\\'"]+|(;\s?})+|[\/\\'"]+$/g,""),medium:g(".foundation-mq-medium").css("font-family").replace(/^[\/\\'"]+|(;\s?})+|[\/\\'"]+$/g,""),large:g(".foundation-mq-large").css("font-family").replace(/^[\/\\'"]+|(;\s?})+|[\/\\'"]+$/g,""),xlarge:g(".foundation-mq-xlarge").css("font-family").replace(/^[\/\\'"]+|(;\s?})+|[\/\\'"]+$/g,""),xxlarge:g(".foundation-mq-xxlarge").css("font-family").replace(/^[\/\\'"]+|(;\s?})+|[\/\\'"]+$/g,"")},stylesheet:a("<style></style>").appendTo("head")[0].sheet,global:{namespace:d},init:function(a,c,d,e,f){var h=[a,d,e,f],i=[];if(this.rtl=/rtl/i.test(g("html").attr("dir")),this.scope=a||this.scope,this.set_namespace(),c&&"string"==typeof c&&!/reflow/i.test(c))this.libs.hasOwnProperty(c)&&i.push(this.init_lib(c,h));else for(var j in this.libs)i.push(this.init_lib(j,c));return g(b).load(function(){g(b).trigger("resize.fndtn.clearing").trigger("resize.fndtn.dropdown").trigger("resize.fndtn.equalizer").trigger("resize.fndtn.interchange").trigger("resize.fndtn.joyride").trigger("resize.fndtn.magellan").trigger("resize.fndtn.topbar").trigger("resize.fndtn.slider")}),a},init_lib:function(b,c){return this.libs.hasOwnProperty(b)?(this.patch(this.libs[b]),c&&c.hasOwnProperty(b)?("undefined"!=typeof this.libs[b].settings?a.extend(!0,this.libs[b].settings,c[b]):"undefined"!=typeof this.libs[b].defaults&&a.extend(!0,this.libs[b].defaults,c[b]),this.libs[b].init.apply(this.libs[b],[this.scope,c[b]])):(c=c instanceof Array?c:new Array(c),this.libs[b].init.apply(this.libs[b],c))):function(){}},patch:function(a){a.scope=this.scope,a.namespace=this.global.namespace,a.rtl=this.rtl,a.data_options=this.utils.data_options,a.attr_name=h,a.add_namespace=i,a.bindings=j,a.S=this.utils.S},inherit:function(a,b){for(var c=b.split(" "),d=c.length;d--;)this.utils.hasOwnProperty(c[d])&&(a[c[d]]=this.utils[c[d]])},set_namespace:function(){var b=this.global.namespace===d?a(".foundation-data-attribute-namespace").css("font-family"):this.global.namespace;this.global.namespace=b===d||/false/i.test(b)?"":b},libs:{},utils:{S:g,throttle:function(a,b){var c=null;return function(){var d=this,e=arguments;null==c&&(c=setTimeout(function(){a.apply(d,e),c=null},b))}},debounce:function(a,b,c){var d,e;return function(){var f=this,g=arguments,h=function(){d=null,c||(e=a.apply(f,g))},i=c&&!d;return clearTimeout(d),d=setTimeout(h,b),i&&(e=a.apply(f,g)),e}},data_options:function(b,c){function d(a){return!isNaN(a-0)&&null!==a&&""!==a&&a!==!1&&a!==!0}function e(b){return"string"==typeof b?a.trim(b):b}c=c||"options";var f,g,h,i={},j=function(a){var b=Foundation.global.namespace;return a.data(b.length>0?b+"-"+c:c)},k=j(b);if("object"==typeof k)return k;for(h=(k||":").split(";"),f=h.length;f--;)g=h[f].split(":"),g=[g[0],g.slice(1).join(":")],/true/i.test(g[1])&&(g[1]=!0),/false/i.test(g[1])&&(g[1]=!1),d(g[1])&&(g[1]=-1===g[1].indexOf(".")?parseInt(g[1],10):parseFloat(g[1])),2===g.length&&g[0].length>0&&(i[e(g[0])]=e(g[1]));return i},register_media:function(b,c){Foundation.media_queries[b]===d&&(a("head").append('<meta class="'+c+'"/>'),Foundation.media_queries[b]=e(a("."+c).css("font-family")))},add_custom_rule:function(a,b){if(b===d&&Foundation.stylesheet)Foundation.stylesheet.insertRule(a,Foundation.stylesheet.cssRules.length);else{var c=Foundation.media_queries[b];c!==d&&Foundation.stylesheet.insertRule("@media "+Foundation.media_queries[b]+"{ "+a+" }")}},image_loaded:function(a,b){var c=this,d=a.length;0===d&&b(a),a.each(function(){k(c.S(this),function(){d-=1,0===d&&b(a)})})},random_str:function(){return this.fidx||(this.fidx=0),this.prefix=this.prefix||[this.name||"F",(+new Date).toString(36)].join("-"),this.prefix+(this.fidx++).toString(36)}}},a.fn.foundation=function(){var a=Array.prototype.slice.call(arguments,0);return this.each(function(){return Foundation.init.apply(Foundation,[this].concat(a)),this})}}(jQuery,window,window.document),function(a,b,c){"use strict";Foundation.libs.abide={name:"abide",version:"5.4.3",settings:{live_validate:!0,focus_on_invalid:!0,error_labels:!0,timeout:1e3,patterns:{alpha:/^[a-zA-Z]+$/,alpha_numeric:/^[a-zA-Z0-9]+$/,integer:/^[-+]?\d+$/,number:/^[-+]?\d*(?:[\.\,]\d+)?$/,card:/^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/,cvv:/^([0-9]){3,4}$/,email:/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,url:/^(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/,domain:/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/,datetime:/^([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))$/,date:/(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))$/,time:/^(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}$/,dateISO:/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,month_day_year:/^(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.]\d{4}$/,day_month_year:/^(0[1-9]|[12][0-9]|3[01])[- \/.](0[1-9]|1[012])[- \/.]\d{4}$/,color:/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/},validators:{equalTo:function(a){var b=c.getElementById(a.getAttribute(this.add_namespace("data-equalto"))).value,d=a.value,e=b===d;return e}}},timer:null,init:function(a,b,c){this.bindings(b,c)},events:function(b){var c=this,d=c.S(b).attr("novalidate","novalidate"),e=d.data(this.attr_name(!0)+"-init")||{};this.invalid_attr=this.add_namespace("data-invalid"),d.off(".abide").on("submit.fndtn.abide validate.fndtn.abide",function(a){var b=/ajax/i.test(c.S(this).attr(c.attr_name()));return c.validate(c.S(this).find("input, textarea, select").get(),a,b)}).on("reset",function(){return c.reset(a(this))}).find("input, textarea, select").off(".abide").on("blur.fndtn.abide change.fndtn.abide",function(a){c.validate([this],a)}).on("keydown.fndtn.abide",function(a){e.live_validate===!0&&(clearTimeout(c.timer),c.timer=setTimeout(function(){c.validate([this],a)}.bind(this),e.timeout))})},reset:function(b){b.removeAttr(this.invalid_attr),a(this.invalid_attr,b).removeAttr(this.invalid_attr),a(".error",b).not("small").removeClass("error")},validate:function(a,b,c){for(var d=this.parse_patterns(a),e=d.length,f=this.S(a[0]).closest("form"),g=/submit/.test(b.type),h=0;e>h;h++)if(!d[h]&&(g||c))return this.settings.focus_on_invalid&&a[h].focus(),f.trigger("invalid"),this.S(a[h]).closest("form").attr(this.invalid_attr,""),!1;return(g||c)&&f.trigger("valid"),f.removeAttr(this.invalid_attr),c?!1:!0},parse_patterns:function(a){for(var b=a.length,c=[];b--;)c.push(this.pattern(a[b]));return this.check_validation_and_apply_styles(c)},pattern:function(a){var b=a.getAttribute("type"),c="string"==typeof a.getAttribute("required"),d=a.getAttribute("pattern")||"";return this.settings.patterns.hasOwnProperty(d)&&d.length>0?[a,this.settings.patterns[d],c]:d.length>0?[a,new RegExp(d),c]:this.settings.patterns.hasOwnProperty(b)?[a,this.settings.patterns[b],c]:(d=/.*/,[a,d,c])},check_validation_and_apply_styles:function(b){var c=b.length,d=[],e=this.S(b[0][0]).closest("[data-"+this.attr_name(!0)+"]");for(e.data(this.attr_name(!0)+"-init")||{};c--;){var f,g,h=b[c][0],i=b[c][2],j=h.value.trim(),k=this.S(h).parent(),l=h.getAttribute(this.add_namespace("data-abide-validator")),m="radio"===h.type,n="checkbox"===h.type,o=this.S('label[for="'+h.getAttribute("id")+'"]'),p=i?h.value.length>0:!0,q=[];if(h.getAttribute(this.add_namespace("data-equalto"))&&(l="equalTo"),f=k.is("label")?k.parent():k,l&&(g=this.settings.validators[l].apply(this,[h,i,f]),q.push(g)),m&&i)q.push(this.valid_radio(h,i));else if(n&&i)q.push(this.valid_checkbox(h,i));else{if(q.push(b[c][1].test(j)&&p||!i&&h.value.length<1||a(h).attr("disabled")?!0:!1),q=[q.every(function(a){return a})],q[0])this.S(h).removeAttr(this.invalid_attr),h.setAttribute("aria-invalid","false"),h.removeAttribute("aria-describedby"),f.removeClass("error"),o.length>0&&this.settings.error_labels&&o.removeClass("error").removeAttr("role"),a(h).triggerHandler("valid");else{this.S(h).attr(this.invalid_attr,""),h.setAttribute("aria-invalid","true");var r=f.find("small.error, span.error"),s=r.length>0?r[0].id:"";s.length>0&&h.setAttribute("aria-describedby",s),f.addClass("error"),o.length>0&&this.settings.error_labels&&o.addClass("error").attr("role","alert"),a(h).triggerHandler("invalid")}d.push(q[0])}}return d=[d.every(function(a){return a})]},valid_checkbox:function(a,b){var a=this.S(a),c=a.is(":checked")||!b;return c?a.removeAttr(this.invalid_attr).parent().removeClass("error"):a.attr(this.invalid_attr,"").parent().addClass("error"),c},valid_radio:function(a){for(var b=a.getAttribute("name"),c=this.S(a).closest("[data-"+this.attr_name(!0)+"]").find("[name='"+b+"']"),d=c.length,e=!1,f=0;d>f;f++)c[f].checked&&(e=!0);for(var f=0;d>f;f++)e?this.S(c[f]).removeAttr(this.invalid_attr).parent().removeClass("error"):this.S(c[f]).attr(this.invalid_attr,"").parent().addClass("error");return e},valid_equal:function(a,b,d){var e=c.getElementById(a.getAttribute(this.add_namespace("data-equalto"))).value,f=a.value,g=e===f;return g?(this.S(a).removeAttr(this.invalid_attr),d.removeClass("error"),label.length>0&&settings.error_labels&&label.removeClass("error")):(this.S(a).attr(this.invalid_attr,""),d.addClass("error"),label.length>0&&settings.error_labels&&label.addClass("error")),g},valid_oneof:function(a,b,c,d){var a=this.S(a),e=this.S("["+this.add_namespace("data-oneof")+"]"),f=e.filter(":checked").length>0;if(f?a.removeAttr(this.invalid_attr).parent().removeClass("error"):a.attr(this.invalid_attr,"").parent().addClass("error"),!d){var g=this;e.each(function(){g.valid_oneof.call(g,this,null,null,!0)})}return f}}}(jQuery,window,window.document),function(a){"use strict";Foundation.libs.accordion={name:"accordion",version:"5.4.3",settings:{active_class:"active",multi_expand:!1,toggleable:!0,callback:function(){}},init:function(a,b,c){this.bindings(b,c)},events:function(){var b=this,c=this.S;c(this.scope).off(".fndtn.accordion").on("click.fndtn.accordion","["+this.attr_name()+"] > dd > a",function(d){var e=c(this).closest("["+b.attr_name()+"]"),f=b.attr_name()+"="+e.attr(b.attr_name()),g=e.data(b.attr_name(!0)+"-init"),h=c("#"+this.href.split("#")[1]),i=a("> dd",e),j=i.children(".content"),k=j.filter("."+g.active_class);return d.preventDefault(),e.attr(b.attr_name())&&(j=j.add("["+f+"] dd > .content"),i=i.add("["+f+"] dd")),g.toggleable&&h.is(k)?(h.parent("dd").toggleClass(g.active_class,!1),h.toggleClass(g.active_class,!1),g.callback(h),h.triggerHandler("toggled",[e]),void e.triggerHandler("toggled",[h])):(g.multi_expand||(j.removeClass(g.active_class),i.removeClass(g.active_class)),h.addClass(g.active_class).parent().addClass(g.active_class),g.callback(h),h.triggerHandler("toggled",[e]),void e.triggerHandler("toggled",[h]))})},off:function(){},reflow:function(){}}}(jQuery,window,window.document),function(a){"use strict";Foundation.libs.alert={name:"alert",version:"5.4.3",settings:{callback:function(){}},init:function(a,b,c){this.bindings(b,c)},events:function(){var b=this,c=this.S;a(this.scope).off(".alert").on("click.fndtn.alert","["+this.attr_name()+"] .close",function(a){var d=c(this).closest("["+b.attr_name()+"]"),e=d.data(b.attr_name(!0)+"-init")||b.settings;a.preventDefault(),Modernizr.csstransitions?(d.addClass("alert-close"),d.on("transitionend webkitTransitionEnd oTransitionEnd",function(){c(this).trigger("close").trigger("close.fndtn.alert").remove(),e.callback()})):d.fadeOut(300,function(){c(this).trigger("close").trigger("close.fndtn.alert").remove(),e.callback()})})},reflow:function(){}}}(jQuery,window,window.document),function(a,b,c,d){"use strict";Foundation.libs.clearing={name:"clearing",version:"5.4.3",settings:{templates:{viewing:'<a href="#" class="clearing-close">&times;</a><div class="visible-img" style="display: none"><div class="clearing-touch-label"></div><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D" alt="" /><p class="clearing-caption"></p><a href="#" class="clearing-main-prev"><span></span></a><a href="#" class="clearing-main-next"><span></span></a></div>'},close_selectors:".clearing-close, div.clearing-blackout",open_selectors:"",skip_selector:"",touch_label:"",init:!1,locked:!1},init:function(a,b,c){var d=this;Foundation.inherit(this,"throttle image_loaded"),this.bindings(b,c),d.S(this.scope).is("["+this.attr_name()+"]")?this.assemble(d.S("li",this.scope)):d.S("["+this.attr_name()+"]",this.scope).each(function(){d.assemble(d.S("li",this))})},events:function(d){var e=this,f=e.S,g=a(".scroll-container");g.length>0&&(this.scope=g),f(this.scope).off(".clearing").on("click.fndtn.clearing","ul["+this.attr_name()+"] li "+this.settings.open_selectors,function(a,b,c){var b=b||f(this),c=c||b,d=b.next("li"),g=b.closest("["+e.attr_name()+"]").data(e.attr_name(!0)+"-init"),h=f(a.target);a.preventDefault(),g||(e.init(),g=b.closest("["+e.attr_name()+"]").data(e.attr_name(!0)+"-init")),c.hasClass("visible")&&b[0]===c[0]&&d.length>0&&e.is_open(b)&&(c=d,h=f("img",c)),e.open(h,b,c),e.update_paddles(c)}).on("click.fndtn.clearing",".clearing-main-next",function(a){e.nav(a,"next")}).on("click.fndtn.clearing",".clearing-main-prev",function(a){e.nav(a,"prev")}).on("click.fndtn.clearing",this.settings.close_selectors,function(a){Foundation.libs.clearing.close(a,this)}),a(c).on("keydown.fndtn.clearing",function(a){e.keydown(a)}),f(b).off(".clearing").on("resize.fndtn.clearing",function(){e.resize()}),this.swipe_events(d)},swipe_events:function(){var a=this,b=a.S;b(this.scope).on("touchstart.fndtn.clearing",".visible-img",function(a){a.touches||(a=a.originalEvent);var c={start_page_x:a.touches[0].pageX,start_page_y:a.touches[0].pageY,start_time:(new Date).getTime(),delta_x:0,is_scrolling:d};b(this).data("swipe-transition",c),a.stopPropagation()}).on("touchmove.fndtn.clearing",".visible-img",function(c){if(c.touches||(c=c.originalEvent),!(c.touches.length>1||c.scale&&1!==c.scale)){var d=b(this).data("swipe-transition");if("undefined"==typeof d&&(d={}),d.delta_x=c.touches[0].pageX-d.start_page_x,Foundation.rtl&&(d.delta_x=-d.delta_x),"undefined"==typeof d.is_scrolling&&(d.is_scrolling=!!(d.is_scrolling||Math.abs(d.delta_x)<Math.abs(c.touches[0].pageY-d.start_page_y))),!d.is_scrolling&&!d.active){c.preventDefault();var e=d.delta_x<0?"next":"prev";d.active=!0,a.nav(c,e)}}}).on("touchend.fndtn.clearing",".visible-img",function(a){b(this).data("swipe-transition",{}),a.stopPropagation()})},assemble:function(b){var c=b.parent();if(!c.parent().hasClass("carousel")){c.after('<div id="foundationClearingHolder"></div>');var d=c.detach(),e="";if(null!=d[0]){e=d[0].outerHTML;var f=this.S("#foundationClearingHolder"),g=c.data(this.attr_name(!0)+"-init"),h={grid:'<div class="carousel">'+e+"</div>",viewing:g.templates.viewing},i='<div class="clearing-assembled"><div>'+h.viewing+h.grid+"</div></div>",j=this.settings.touch_label;Modernizr.touch&&(i=a(i).find(".clearing-touch-label").html(j).end()),f.after(i).remove()}}},open:function(b,d,e){function f(){setTimeout(function(){this.image_loaded(m,function(){1!==m.outerWidth()||o?g.call(this,m):f.call(this)}.bind(this))}.bind(this),100)}function g(b){var c=a(b);c.css("visibility","visible"),i.css("overflow","hidden"),j.addClass("clearing-blackout"),k.addClass("clearing-container"),l.show(),this.fix_height(e).caption(h.S(".clearing-caption",l),h.S("img",e)).center_and_label(b,n).shift(d,e,function(){e.closest("li").siblings().removeClass("visible"),e.closest("li").addClass("visible")}),l.trigger("opened.fndtn.clearing")}var h=this,i=a(c.body),j=e.closest(".clearing-assembled"),k=h.S("div",j).first(),l=h.S(".visible-img",k),m=h.S("img",l).not(b),n=h.S(".clearing-touch-label",k),o=!1;a("body").on("touchmove",function(a){a.preventDefault()}),m.error(function(){o=!0}),this.locked()||(l.trigger("open.fndtn.clearing"),m.attr("src",this.load(b)).css("visibility","hidden"),f.call(this))},close:function(b,d){b.preventDefault();var e,f,g=function(a){return/blackout/.test(a.selector)?a:a.closest(".clearing-blackout")}(a(d)),h=a(c.body);return d===b.target&&g&&(h.css("overflow",""),e=a("div",g).first(),f=a(".visible-img",e),f.trigger("close.fndtn.clearing"),this.settings.prev_index=0,a("ul["+this.attr_name()+"]",g).attr("style","").closest(".clearing-blackout").removeClass("clearing-blackout"),e.removeClass("clearing-container"),f.hide(),f.trigger("closed.fndtn.clearing")),a("body").off("touchmove"),!1},is_open:function(a){return a.parent().prop("style").length>0},keydown:function(b){var c=a(".clearing-blackout ul["+this.attr_name()+"]"),d=this.rtl?37:39,e=this.rtl?39:37,f=27;b.which===d&&this.go(c,"next"),b.which===e&&this.go(c,"prev"),b.which===f&&this.S("a.clearing-close").trigger("click").trigger("click.fndtn.clearing")},nav:function(b,c){var d=a("ul["+this.attr_name()+"]",".clearing-blackout");b.preventDefault(),this.go(d,c)},resize:function(){var b=a("img",".clearing-blackout .visible-img"),c=a(".clearing-touch-label",".clearing-blackout");b.length&&(this.center_and_label(b,c),b.trigger("resized.fndtn.clearing"))},fix_height:function(a){var b=a.parent().children(),c=this;return b.each(function(){var a=c.S(this),b=a.find("img");a.height()>b.outerHeight()&&a.addClass("fix-height")}).closest("ul").width(100*b.length+"%"),this},update_paddles:function(a){a=a.closest("li");var b=a.closest(".carousel").siblings(".visible-img");a.next().length>0?this.S(".clearing-main-next",b).removeClass("disabled"):this.S(".clearing-main-next",b).addClass("disabled"),a.prev().length>0?this.S(".clearing-main-prev",b).removeClass("disabled"):this.S(".clearing-main-prev",b).addClass("disabled")},center_and_label:function(a,b){return this.rtl?(a.css({marginRight:-(a.outerWidth()/2),marginTop:-(a.outerHeight()/2),left:"auto",right:"50%"}),b.length>0&&b.css({marginRight:-(b.outerWidth()/2),marginTop:-(a.outerHeight()/2)-b.outerHeight()-10,left:"auto",right:"50%"})):(a.css({marginLeft:-(a.outerWidth()/2),marginTop:-(a.outerHeight()/2)}),b.length>0&&b.css({marginLeft:-(b.outerWidth()/2),marginTop:-(a.outerHeight()/2)-b.outerHeight()-10})),this},load:function(a){var b;return b="A"===a[0].nodeName?a.attr("href"):a.parent().attr("href"),this.preload(a),b?b:a.attr("src")},preload:function(a){this.img(a.closest("li").next()).img(a.closest("li").prev())},img:function(a){if(a.length){var b=new Image,c=this.S("a",a);b.src=c.length?c.attr("href"):this.S("img",a).attr("src")}return this},caption:function(a,b){var c=b.attr("data-caption");return c?a.html(c).show():a.text("").hide(),this},go:function(a,b){var c=this.S(".visible",a),d=c[b]();this.settings.skip_selector&&0!=d.find(this.settings.skip_selector).length&&(d=d[b]()),d.length&&this.S("img",d).trigger("click",[c,d]).trigger("click.fndtn.clearing",[c,d]).trigger("change.fndtn.clearing")},shift:function(a,b,c){var d,e=b.parent(),f=this.settings.prev_index||b.index(),g=this.direction(e,a,b),h=this.rtl?"right":"left",i=parseInt(e.css("left"),10),j=b.outerWidth(),k={};b.index()===f||/skip/.test(g)?/skip/.test(g)&&(d=b.index()-this.settings.up_count,this.lock(),d>0?(k[h]=-(d*j),e.animate(k,300,this.unlock())):(k[h]=0,e.animate(k,300,this.unlock()))):/left/.test(g)?(this.lock(),k[h]=i+j,e.animate(k,300,this.unlock())):/right/.test(g)&&(this.lock(),k[h]=i-j,e.animate(k,300,this.unlock())),c()},direction:function(a,b,c){var d,e=this.S("li",a),f=e.outerWidth()+e.outerWidth()/4,g=Math.floor(this.S(".clearing-container").outerWidth()/f)-1,h=e.index(c);return this.settings.up_count=g,d=this.adjacent(this.settings.prev_index,h)?h>g&&h>this.settings.prev_index?"right":h>g-1&&h<=this.settings.prev_index?"left":!1:"skip",this.settings.prev_index=h,d},adjacent:function(a,b){for(var c=b+1;c>=b-1;c--)if(c===a)return!0;return!1},lock:function(){this.settings.locked=!0},unlock:function(){this.settings.locked=!1},locked:function(){return this.settings.locked},off:function(){this.S(this.scope).off(".fndtn.clearing"),this.S(b).off(".fndtn.clearing")},reflow:function(){this.init()}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs.dropdown={name:"dropdown",version:"5.4.3",settings:{active_class:"open",mega_class:"mega",align:"bottom",is_hover:!1,opened:function(){},closed:function(){}},init:function(a,b,c){Foundation.inherit(this,"throttle"),this.bindings(b,c)},events:function(){var c=this,d=c.S;d(this.scope).off(".dropdown").on("click.fndtn.dropdown","["+this.attr_name()+"]",function(b){var e=d(this).data(c.attr_name(!0)+"-init")||c.settings;(!e.is_hover||Modernizr.touch)&&(b.preventDefault(),c.toggle(a(this)))}).on("mouseenter.fndtn.dropdown","["+this.attr_name()+"], ["+this.attr_name()+"-content]",function(a){var b,e,f=d(this);clearTimeout(c.timeout),f.data(c.data_attr())?(b=d("#"+f.data(c.data_attr())),e=f):(b=f,e=d("["+c.attr_name()+"='"+b.attr("id")+"']"));var g=e.data(c.attr_name(!0)+"-init")||c.settings;d(a.target).data(c.data_attr())&&g.is_hover&&c.closeall.call(c),g.is_hover&&c.open.apply(c,[b,e])}).on("mouseleave.fndtn.dropdown","["+this.attr_name()+"], ["+this.attr_name()+"-content]",function(){var a=d(this);c.timeout=setTimeout(function(){if(a.data(c.data_attr())){var b=a.data(c.data_attr(!0)+"-init")||c.settings;b.is_hover&&c.close.call(c,d("#"+a.data(c.data_attr())))}else{var e=d("["+c.attr_name()+'="'+d(this).attr("id")+'"]'),b=e.data(c.attr_name(!0)+"-init")||c.settings;b.is_hover&&c.close.call(c,a)}}.bind(this),150)}).on("click.fndtn.dropdown",function(b){var e=d(b.target).closest("["+c.attr_name()+"-content]");if(!(d(b.target).closest("["+c.attr_name()+"]").length>0))return!d(b.target).data("revealId")&&e.length>0&&(d(b.target).is("["+c.attr_name()+"-content]")||a.contains(e.first()[0],b.target))?void b.stopPropagation():void c.close.call(c,d("["+c.attr_name()+"-content]"))}).on("opened.fndtn.dropdown","["+c.attr_name()+"-content]",function(){c.settings.opened.call(this)}).on("closed.fndtn.dropdown","["+c.attr_name()+"-content]",function(){c.settings.closed.call(this)}),d(b).off(".dropdown").on("resize.fndtn.dropdown",c.throttle(function(){c.resize.call(c)},50)),this.resize()},close:function(b){var c=this;b.each(function(){var d=a("["+c.attr_name()+"="+b[0].id+"]")||a("aria-controls="+b[0].id+"]");d.attr("aria-expanded","false"),c.S(this).hasClass(c.settings.active_class)&&(c.S(this).css(Foundation.rtl?"right":"left","-99999px").attr("aria-hidden","true").removeClass(c.settings.active_class).prev("["+c.attr_name()+"]").removeClass(c.settings.active_class).removeData("target"),c.S(this).trigger("closed").trigger("closed.fndtn.dropdown",[b]))})},closeall:function(){var b=this;a.each(b.S("["+this.attr_name()+"-content]"),function(){b.close.call(b,b.S(this))})},open:function(a,b){this.css(a.addClass(this.settings.active_class),b),a.prev("["+this.attr_name()+"]").addClass(this.settings.active_class),a.data("target",b.get(0)).trigger("opened").trigger("opened.fndtn.dropdown",[a,b]),a.attr("aria-hidden","false"),b.attr("aria-expanded","true"),a.focus()},data_attr:function(){return this.namespace.length>0?this.namespace+"-"+this.name:this.name},toggle:function(a){var b=this.S("#"+a.data(this.data_attr()));0!==b.length&&(this.close.call(this,this.S("["+this.attr_name()+"-content]").not(b)),b.hasClass(this.settings.active_class)?(this.close.call(this,b),b.data("target")!==a.get(0)&&this.open.call(this,b,a)):this.open.call(this,b,a))},resize:function(){var a=this.S("["+this.attr_name()+"-content].open"),b=this.S("["+this.attr_name()+"='"+a.attr("id")+"']");a.length&&b.length&&this.css(a,b)},css:function(a,b){var c=Math.max((b.width()-a.width())/2,8),d=b.data(this.attr_name(!0)+"-init")||this.settings;if(this.clear_idx(),this.small()){var e=this.dirs.bottom.call(a,b,d);a.attr("style","").removeClass("drop-left drop-right drop-top").css({position:"absolute",width:"95%","max-width":"none",top:e.top}),a.css(Foundation.rtl?"right":"left",c)}else this.style(a,b,d);return a},style:function(b,c,d){var e=a.extend({position:"absolute"},this.dirs[d.align].call(b,c,d));b.attr("style","").css(e)},dirs:{_base:function(a){var b=this.offsetParent(),c=b.offset(),d=a.offset();return d.top-=c.top,d.left-=c.left,d},top:function(a,b){var c=Foundation.libs.dropdown,d=c.dirs._base.call(this,a);return this.addClass("drop-top"),(a.outerWidth()<this.outerWidth()||c.small()||this.hasClass(b.mega_menu))&&c.adjust_pip(this,a,b,d),Foundation.rtl?{left:d.left-this.outerWidth()+a.outerWidth(),top:d.top-this.outerHeight()}:{left:d.left,top:d.top-this.outerHeight()}},bottom:function(a,b){var c=Foundation.libs.dropdown,d=c.dirs._base.call(this,a);return(a.outerWidth()<this.outerWidth()||c.small()||this.hasClass(b.mega_menu))&&c.adjust_pip(this,a,b,d),c.rtl?{left:d.left-this.outerWidth()+a.outerWidth(),top:d.top+a.outerHeight()}:{left:d.left,top:d.top+a.outerHeight()}},left:function(a){var b=Foundation.libs.dropdown.dirs._base.call(this,a);return this.addClass("drop-left"),{left:b.left-this.outerWidth(),top:b.top}},right:function(a){var b=Foundation.libs.dropdown.dirs._base.call(this,a);return this.addClass("drop-right"),{left:b.left+a.outerWidth(),top:b.top}}},adjust_pip:function(a,b,c,d){var e=Foundation.stylesheet,f=8;a.hasClass(c.mega_class)?f=d.left+b.outerWidth()/2-8:this.small()&&(f+=d.left-8),this.rule_idx=e.cssRules.length;var g=".f-dropdown.open:before",h=".f-dropdown.open:after",i="left: "+f+"px;",j="left: "+(f-1)+"px;";e.insertRule?(e.insertRule([g,"{",i,"}"].join(" "),this.rule_idx),e.insertRule([h,"{",j,"}"].join(" "),this.rule_idx+1)):(e.addRule(g,i,this.rule_idx),e.addRule(h,j,this.rule_idx+1))},clear_idx:function(){var a=Foundation.stylesheet;this.rule_idx&&(a.deleteRule(this.rule_idx),a.deleteRule(this.rule_idx),delete this.rule_idx)},small:function(){return matchMedia(Foundation.media_queries.small).matches&&!matchMedia(Foundation.media_queries.medium).matches},off:function(){this.S(this.scope).off(".fndtn.dropdown"),this.S("html, body").off(".fndtn.dropdown"),this.S(b).off(".fndtn.dropdown"),this.S("[data-dropdown-content]").off(".fndtn.dropdown")},reflow:function(){}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs.equalizer={name:"equalizer",version:"5.4.3",settings:{use_tallest:!0,before_height_change:a.noop,after_height_change:a.noop,equalize_on_stack:!1},init:function(a,b,c){Foundation.inherit(this,"image_loaded"),this.bindings(b,c),this.reflow()},events:function(){this.S(b).off(".equalizer").on("resize.fndtn.equalizer",function(){this.reflow()}.bind(this))},equalize:function(b){var c=!1,d=b.find("["+this.attr_name()+"-watch]:visible"),e=b.data(this.attr_name(!0)+"-init");if(0!==d.length){var f=d.first().offset().top;if(e.before_height_change(),b.trigger("before-height-change").trigger("before-height-change.fndth.equalizer"),d.height("inherit"),d.each(function(){var b=a(this);b.offset().top!==f&&(c=!0)}),e.equalize_on_stack!==!1||!c){var g=d.map(function(){return a(this).outerHeight(!1)}).get();if(e.use_tallest){var h=Math.max.apply(null,g);d.css("height",h)}else{var i=Math.min.apply(null,g);d.css("height",i)}e.after_height_change(),b.trigger("after-height-change").trigger("after-height-change.fndtn.equalizer")}}},reflow:function(){var b=this;this.S("["+this.attr_name()+"]",this.scope).each(function(){var c=a(this);b.image_loaded(b.S("img",this),function(){b.equalize(c)})})}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs.interchange={name:"interchange",version:"5.4.3",cache:{},images_loaded:!1,nodes_loaded:!1,settings:{load_attr:"interchange",named_queries:{"default":"only screen",small:Foundation.media_queries.small,medium:Foundation.media_queries.medium,large:Foundation.media_queries.large,xlarge:Foundation.media_queries.xlarge,xxlarge:Foundation.media_queries.xxlarge,landscape:"only screen and (orientation: landscape)",portrait:"only screen and (orientation: portrait)",retina:"only screen and (-webkit-min-device-pixel-ratio: 2),only screen and (min--moz-device-pixel-ratio: 2),only screen and (-o-min-device-pixel-ratio: 2/1),only screen and (min-device-pixel-ratio: 2),only screen and (min-resolution: 192dpi),only screen and (min-resolution: 2dppx)"},directives:{replace:function(b,c,d){if(/IMG/.test(b[0].nodeName)){var e=b[0].src;
if(new RegExp(c,"i").test(e))return;return b[0].src=c,d(b[0].src)}var f=b.data(this.data_attr+"-last-path"),g=this;if(f!=c)return/\.(gif|jpg|jpeg|tiff|png)([?#].*)?/i.test(c)?(a(b).css("background-image","url("+c+")"),b.data("interchange-last-path",c),d(c)):a.get(c,function(a){b.html(a),b.data(g.data_attr+"-last-path",c),d()})}}},init:function(b,c,d){Foundation.inherit(this,"throttle random_str"),this.data_attr=this.set_data_attr(),a.extend(!0,this.settings,c,d),this.bindings(c,d),this.load("images"),this.load("nodes")},get_media_hash:function(){var a="";for(var b in this.settings.named_queries)a+=matchMedia(this.settings.named_queries[b]).matches.toString();return a},events:function(){var c,d=this;return a(b).off(".interchange").on("resize.fndtn.interchange",d.throttle(function(){var a=d.get_media_hash();a!==c&&d.resize(),c=a},50)),this},resize:function(){var b=this.cache;if(!this.images_loaded||!this.nodes_loaded)return void setTimeout(a.proxy(this.resize,this),50);for(var c in b)if(b.hasOwnProperty(c)){var d=this.results(c,b[c]);d&&this.settings.directives[d.scenario[1]].call(this,d.el,d.scenario[0],function(){if(arguments[0]instanceof Array)var a=arguments[0];else var a=Array.prototype.slice.call(arguments,0);d.el.trigger(d.scenario[1],a)})}},results:function(a,b){var c=b.length;if(c>0)for(var d=this.S("["+this.add_namespace("data-uuid")+'="'+a+'"]');c--;){var e,f=b[c][2];if(e=matchMedia(this.settings.named_queries.hasOwnProperty(f)?this.settings.named_queries[f]:f),e.matches)return{el:d,scenario:b[c]}}return!1},load:function(a,b){return("undefined"==typeof this["cached_"+a]||b)&&this["update_"+a](),this["cached_"+a]},update_images:function(){var a=this.S("img["+this.data_attr+"]"),b=a.length,c=b,d=0,e=this.data_attr;for(this.cache={},this.cached_images=[],this.images_loaded=0===b;c--;){if(d++,a[c]){var f=a[c].getAttribute(e)||"";f.length>0&&this.cached_images.push(a[c])}d===b&&(this.images_loaded=!0,this.enhance("images"))}return this},update_nodes:function(){var a=this.S("["+this.data_attr+"]").not("img"),b=a.length,c=b,d=0,e=this.data_attr;for(this.cached_nodes=[],this.nodes_loaded=0===b;c--;){d++;var f=a[c].getAttribute(e)||"";f.length>0&&this.cached_nodes.push(a[c]),d===b&&(this.nodes_loaded=!0,this.enhance("nodes"))}return this},enhance:function(c){for(var d=this["cached_"+c].length;d--;)this.object(a(this["cached_"+c][d]));return a(b).trigger("resize").trigger("resize.fndtn.interchange")},convert_directive:function(a){var b=this.trim(a);return b.length>0?b:"replace"},parse_scenario:function(a){var b=a[0].match(/(.+),\s*(\w+)\s*$/),c=a[1];if(b)var d=b[1],e=b[2];else var f=a[0].split(/,\s*$/),d=f[0],e="";return[this.trim(d),this.convert_directive(e),this.trim(c)]},object:function(a){var b=this.parse_data_attr(a),c=[],d=b.length;if(d>0)for(;d--;){var e=b[d].split(/\((.*?)(\))$/);if(e.length>1){var f=this.parse_scenario(e);c.push(f)}}return this.store(a,c)},store:function(a,b){var c=this.random_str(),d=a.data(this.add_namespace("uuid",!0));return this.cache[d]?this.cache[d]:(a.attr(this.add_namespace("data-uuid"),c),this.cache[c]=b)},trim:function(b){return"string"==typeof b?a.trim(b):b},set_data_attr:function(a){return a?this.namespace.length>0?this.namespace+"-"+this.settings.load_attr:this.settings.load_attr:this.namespace.length>0?"data-"+this.namespace+"-"+this.settings.load_attr:"data-"+this.settings.load_attr},parse_data_attr:function(a){for(var b=a.attr(this.attr_name()).split(/\[(.*?)\]/),c=b.length,d=[];c--;)b[c].replace(/[\W\d]+/,"").length>4&&d.push(b[c]);return d},reflow:function(){this.load("images",!0),this.load("nodes",!0)}}}(jQuery,window,window.document),function(a,b,c,d){"use strict";Foundation.libs.joyride={name:"joyride",version:"5.4.3",defaults:{expose:!1,modal:!0,keyboard:!0,tip_location:"bottom",nub_position:"auto",scroll_speed:1500,scroll_animation:"linear",timer:0,start_timer_on_click:!0,start_offset:0,next_button:!0,prev_button:!0,tip_animation:"fade",pause_after:[],exposed:[],tip_animation_fade_speed:300,cookie_monster:!1,cookie_name:"joyride",cookie_domain:!1,cookie_expires:365,tip_container:"body",abort_on_close:!0,tip_location_patterns:{top:["bottom"],bottom:[],left:["right","top","bottom"],right:["left","top","bottom"]},post_ride_callback:function(){},post_step_callback:function(){},pre_step_callback:function(){},pre_ride_callback:function(){},post_expose_callback:function(){},template:{link:'<a href="#close" class="joyride-close-tip">&times;</a>',timer:'<div class="joyride-timer-indicator-wrap"><span class="joyride-timer-indicator"></span></div>',tip:'<div class="joyride-tip-guide"><span class="joyride-nub"></span></div>',wrapper:'<div class="joyride-content-wrapper"></div>',button:'<a href="#" class="small button joyride-next-tip"></a>',prev_button:'<a href="#" class="small button joyride-prev-tip"></a>',modal:'<div class="joyride-modal-bg"></div>',expose:'<div class="joyride-expose-wrapper"></div>',expose_cover:'<div class="joyride-expose-cover"></div>'},expose_add_class:""},init:function(b,c,d){Foundation.inherit(this,"throttle random_str"),this.settings=this.settings||a.extend({},this.defaults,d||c),this.bindings(c,d)},go_next:function(){this.settings.$li.next().length<1?this.end():this.settings.timer>0?(clearTimeout(this.settings.automate),this.hide(),this.show(),this.startTimer()):(this.hide(),this.show())},go_prev:function(){this.settings.$li.prev().length<1||(this.settings.timer>0?(clearTimeout(this.settings.automate),this.hide(),this.show(null,!0),this.startTimer()):(this.hide(),this.show(null,!0)))},events:function(){var c=this;a(this.scope).off(".joyride").on("click.fndtn.joyride",".joyride-next-tip, .joyride-modal-bg",function(a){a.preventDefault(),this.go_next()}.bind(this)).on("click.fndtn.joyride",".joyride-prev-tip",function(a){a.preventDefault(),this.go_prev()}.bind(this)).on("click.fndtn.joyride",".joyride-close-tip",function(a){a.preventDefault(),this.end(this.settings.abort_on_close)}.bind(this)).on("keyup.joyride",function(a){if(this.settings.keyboard)switch(a.which){case 39:a.preventDefault(),this.go_next();break;case 37:a.preventDefault(),this.go_prev();break;case 27:a.preventDefault(),this.end(this.settings.abort_on_close)}}.bind(this)),a(b).off(".joyride").on("resize.fndtn.joyride",c.throttle(function(){if(a("["+c.attr_name()+"]").length>0&&c.settings.$next_tip&&c.settings.riding){if(c.settings.exposed.length>0){var b=a(c.settings.exposed);b.each(function(){var b=a(this);c.un_expose(b),c.expose(b)})}c.is_phone()?c.pos_phone():c.pos_default(!1)}},100))},start:function(){var b=this,c=a("["+this.attr_name()+"]",this.scope),d=["timer","scrollSpeed","startOffset","tipAnimationFadeSpeed","cookieExpires"],e=d.length;!c.length>0||(this.settings.init||this.events(),this.settings=c.data(this.attr_name(!0)+"-init"),this.settings.$content_el=c,this.settings.$body=a(this.settings.tip_container),this.settings.body_offset=a(this.settings.tip_container).position(),this.settings.$tip_content=this.settings.$content_el.find("> li"),this.settings.paused=!1,this.settings.attempts=0,this.settings.riding=!0,"function"!=typeof a.cookie&&(this.settings.cookie_monster=!1),(!this.settings.cookie_monster||this.settings.cookie_monster&&!a.cookie(this.settings.cookie_name))&&(this.settings.$tip_content.each(function(c){var f=a(this);this.settings=a.extend({},b.defaults,b.data_options(f));for(var g=e;g--;)b.settings[d[g]]=parseInt(b.settings[d[g]],10);b.create({$li:f,index:c})}),!this.settings.start_timer_on_click&&this.settings.timer>0?(this.show("init"),this.startTimer()):this.show("init")))},resume:function(){this.set_li(),this.show()},tip_template:function(b){var c,d;return b.tip_class=b.tip_class||"",c=a(this.settings.template.tip).addClass(b.tip_class),d=a.trim(a(b.li).html())+this.prev_button_text(b.prev_button_text,b.index)+this.button_text(b.button_text)+this.settings.template.link+this.timer_instance(b.index),c.append(a(this.settings.template.wrapper)),c.first().attr(this.add_namespace("data-index"),b.index),a(".joyride-content-wrapper",c).append(d),c[0]},timer_instance:function(b){var c;return c=0===b&&this.settings.start_timer_on_click&&this.settings.timer>0||0===this.settings.timer?"":a(this.settings.template.timer)[0].outerHTML},button_text:function(b){return this.settings.tip_settings.next_button?(b=a.trim(b)||"Next",b=a(this.settings.template.button).append(b)[0].outerHTML):b="",b},prev_button_text:function(b,c){return this.settings.tip_settings.prev_button?(b=a.trim(b)||"Previous",b=0==c?a(this.settings.template.prev_button).append(b).addClass("disabled")[0].outerHTML:a(this.settings.template.prev_button).append(b)[0].outerHTML):b="",b},create:function(b){this.settings.tip_settings=a.extend({},this.settings,this.data_options(b.$li));var c=b.$li.attr(this.add_namespace("data-button"))||b.$li.attr(this.add_namespace("data-text")),d=b.$li.attr(this.add_namespace("data-button-prev"))||b.$li.attr(this.add_namespace("data-prev-text")),e=b.$li.attr("class"),f=a(this.tip_template({tip_class:e,index:b.index,button_text:c,prev_button_text:d,li:b.$li}));a(this.settings.tip_container).append(f)},show:function(b,c){var e=null;this.settings.$li===d||-1===a.inArray(this.settings.$li.index(),this.settings.pause_after)?(this.settings.paused?this.settings.paused=!1:this.set_li(b,c),this.settings.attempts=0,this.settings.$li.length&&this.settings.$target.length>0?(b&&(this.settings.pre_ride_callback(this.settings.$li.index(),this.settings.$next_tip),this.settings.modal&&this.show_modal()),this.settings.pre_step_callback(this.settings.$li.index(),this.settings.$next_tip),this.settings.modal&&this.settings.expose&&this.expose(),this.settings.tip_settings=a.extend({},this.settings,this.data_options(this.settings.$li)),this.settings.timer=parseInt(this.settings.timer,10),this.settings.tip_settings.tip_location_pattern=this.settings.tip_location_patterns[this.settings.tip_settings.tip_location],/body/i.test(this.settings.$target.selector)||this.scroll_to(),this.is_phone()?this.pos_phone(!0):this.pos_default(!0),e=this.settings.$next_tip.find(".joyride-timer-indicator"),/pop/i.test(this.settings.tip_animation)?(e.width(0),this.settings.timer>0?(this.settings.$next_tip.show(),setTimeout(function(){e.animate({width:e.parent().width()},this.settings.timer,"linear")}.bind(this),this.settings.tip_animation_fade_speed)):this.settings.$next_tip.show()):/fade/i.test(this.settings.tip_animation)&&(e.width(0),this.settings.timer>0?(this.settings.$next_tip.fadeIn(this.settings.tip_animation_fade_speed).show(),setTimeout(function(){e.animate({width:e.parent().width()},this.settings.timer,"linear")}.bind(this),this.settings.tip_animation_fade_speed)):this.settings.$next_tip.fadeIn(this.settings.tip_animation_fade_speed)),this.settings.$current_tip=this.settings.$next_tip):this.settings.$li&&this.settings.$target.length<1?this.show():this.end()):this.settings.paused=!0},is_phone:function(){return matchMedia(Foundation.media_queries.small).matches&&!matchMedia(Foundation.media_queries.medium).matches},hide:function(){this.settings.modal&&this.settings.expose&&this.un_expose(),this.settings.modal||a(".joyride-modal-bg").hide(),this.settings.$current_tip.css("visibility","hidden"),setTimeout(a.proxy(function(){this.hide(),this.css("visibility","visible")},this.settings.$current_tip),0),this.settings.post_step_callback(this.settings.$li.index(),this.settings.$current_tip)},set_li:function(a,b){a?(this.settings.$li=this.settings.$tip_content.eq(this.settings.start_offset),this.set_next_tip(),this.settings.$current_tip=this.settings.$next_tip):(this.settings.$li=b?this.settings.$li.prev():this.settings.$li.next(),this.set_next_tip()),this.set_target()},set_next_tip:function(){this.settings.$next_tip=a(".joyride-tip-guide").eq(this.settings.$li.index()),this.settings.$next_tip.data("closed","")},set_target:function(){var b=this.settings.$li.attr(this.add_namespace("data-class")),d=this.settings.$li.attr(this.add_namespace("data-id")),e=function(){return d?a(c.getElementById(d)):b?a("."+b).first():a("body")};this.settings.$target=e()},scroll_to:function(){var c,d;c=a(b).height()/2,d=Math.ceil(this.settings.$target.offset().top-c+this.settings.$next_tip.outerHeight()),0!=d&&a("html, body").stop().animate({scrollTop:d},this.settings.scroll_speed,"swing")},paused:function(){return-1===a.inArray(this.settings.$li.index()+1,this.settings.pause_after)},restart:function(){this.hide(),this.settings.$li=d,this.show("init")},pos_default:function(a){var b=this.settings.$next_tip.find(".joyride-nub"),c=Math.ceil(b.outerWidth()/2),d=Math.ceil(b.outerHeight()/2),e=a||!1;if(e&&(this.settings.$next_tip.css("visibility","hidden"),this.settings.$next_tip.show()),/body/i.test(this.settings.$target.selector))this.settings.$li.length&&this.pos_modal(b);else{var f=this.settings.tip_settings.tipAdjustmentY?parseInt(this.settings.tip_settings.tipAdjustmentY):0,g=this.settings.tip_settings.tipAdjustmentX?parseInt(this.settings.tip_settings.tipAdjustmentX):0;this.bottom()?(this.settings.$next_tip.css(this.rtl?{top:this.settings.$target.offset().top+d+this.settings.$target.outerHeight()+f,left:this.settings.$target.offset().left+this.settings.$target.outerWidth()-this.settings.$next_tip.outerWidth()+g}:{top:this.settings.$target.offset().top+d+this.settings.$target.outerHeight()+f,left:this.settings.$target.offset().left+g}),this.nub_position(b,this.settings.tip_settings.nub_position,"top")):this.top()?(this.settings.$next_tip.css(this.rtl?{top:this.settings.$target.offset().top-this.settings.$next_tip.outerHeight()-d+f,left:this.settings.$target.offset().left+this.settings.$target.outerWidth()-this.settings.$next_tip.outerWidth()}:{top:this.settings.$target.offset().top-this.settings.$next_tip.outerHeight()-d+f,left:this.settings.$target.offset().left+g}),this.nub_position(b,this.settings.tip_settings.nub_position,"bottom")):this.right()?(this.settings.$next_tip.css({top:this.settings.$target.offset().top+f,left:this.settings.$target.outerWidth()+this.settings.$target.offset().left+c+g}),this.nub_position(b,this.settings.tip_settings.nub_position,"left")):this.left()&&(this.settings.$next_tip.css({top:this.settings.$target.offset().top+f,left:this.settings.$target.offset().left-this.settings.$next_tip.outerWidth()-c+g}),this.nub_position(b,this.settings.tip_settings.nub_position,"right")),!this.visible(this.corners(this.settings.$next_tip))&&this.settings.attempts<this.settings.tip_settings.tip_location_pattern.length&&(b.removeClass("bottom").removeClass("top").removeClass("right").removeClass("left"),this.settings.tip_settings.tip_location=this.settings.tip_settings.tip_location_pattern[this.settings.attempts],this.settings.attempts++,this.pos_default())}e&&(this.settings.$next_tip.hide(),this.settings.$next_tip.css("visibility","visible"))},pos_phone:function(b){var c=this.settings.$next_tip.outerHeight(),d=(this.settings.$next_tip.offset(),this.settings.$target.outerHeight()),e=a(".joyride-nub",this.settings.$next_tip),f=Math.ceil(e.outerHeight()/2),g=b||!1;e.removeClass("bottom").removeClass("top").removeClass("right").removeClass("left"),g&&(this.settings.$next_tip.css("visibility","hidden"),this.settings.$next_tip.show()),/body/i.test(this.settings.$target.selector)?this.settings.$li.length&&this.pos_modal(e):this.top()?(this.settings.$next_tip.offset({top:this.settings.$target.offset().top-c-f}),e.addClass("bottom")):(this.settings.$next_tip.offset({top:this.settings.$target.offset().top+d+f}),e.addClass("top")),g&&(this.settings.$next_tip.hide(),this.settings.$next_tip.css("visibility","visible"))},pos_modal:function(a){this.center(),a.hide(),this.show_modal()},show_modal:function(){if(!this.settings.$next_tip.data("closed")){var b=a(".joyride-modal-bg");b.length<1&&a("body").append(this.settings.template.modal).show(),/pop/i.test(this.settings.tip_animation)?b.show():b.fadeIn(this.settings.tip_animation_fade_speed)}},expose:function(){var c,d,e,f,g,h="expose-"+this.random_str(6);if(arguments.length>0&&arguments[0]instanceof a)e=arguments[0];else{if(!this.settings.$target||/body/i.test(this.settings.$target.selector))return!1;e=this.settings.$target}return e.length<1?(b.console&&console.error("element not valid",e),!1):(c=a(this.settings.template.expose),this.settings.$body.append(c),c.css({top:e.offset().top,left:e.offset().left,width:e.outerWidth(!0),height:e.outerHeight(!0)}),d=a(this.settings.template.expose_cover),f={zIndex:e.css("z-index"),position:e.css("position")},g=null==e.attr("class")?"":e.attr("class"),e.css("z-index",parseInt(c.css("z-index"))+1),"static"==f.position&&e.css("position","relative"),e.data("expose-css",f),e.data("orig-class",g),e.attr("class",g+" "+this.settings.expose_add_class),d.css({top:e.offset().top,left:e.offset().left,width:e.outerWidth(!0),height:e.outerHeight(!0)}),this.settings.modal&&this.show_modal(),this.settings.$body.append(d),c.addClass(h),d.addClass(h),e.data("expose",h),this.settings.post_expose_callback(this.settings.$li.index(),this.settings.$next_tip,e),void this.add_exposed(e))},un_expose:function(){var c,d,e,f,g,h=!1;if(arguments.length>0&&arguments[0]instanceof a)d=arguments[0];else{if(!this.settings.$target||/body/i.test(this.settings.$target.selector))return!1;d=this.settings.$target}return d.length<1?(b.console&&console.error("element not valid",d),!1):(c=d.data("expose"),e=a("."+c),arguments.length>1&&(h=arguments[1]),h===!0?a(".joyride-expose-wrapper,.joyride-expose-cover").remove():e.remove(),f=d.data("expose-css"),"auto"==f.zIndex?d.css("z-index",""):d.css("z-index",f.zIndex),f.position!=d.css("position")&&("static"==f.position?d.css("position",""):d.css("position",f.position)),g=d.data("orig-class"),d.attr("class",g),d.removeData("orig-classes"),d.removeData("expose"),d.removeData("expose-z-index"),void this.remove_exposed(d))},add_exposed:function(b){this.settings.exposed=this.settings.exposed||[],b instanceof a||"object"==typeof b?this.settings.exposed.push(b[0]):"string"==typeof b&&this.settings.exposed.push(b)},remove_exposed:function(b){var c,d;for(b instanceof a?c=b[0]:"string"==typeof b&&(c=b),this.settings.exposed=this.settings.exposed||[],d=this.settings.exposed.length;d--;)if(this.settings.exposed[d]==c)return void this.settings.exposed.splice(d,1)},center:function(){var c=a(b);return this.settings.$next_tip.css({top:(c.height()-this.settings.$next_tip.outerHeight())/2+c.scrollTop(),left:(c.width()-this.settings.$next_tip.outerWidth())/2+c.scrollLeft()}),!0},bottom:function(){return/bottom/i.test(this.settings.tip_settings.tip_location)},top:function(){return/top/i.test(this.settings.tip_settings.tip_location)},right:function(){return/right/i.test(this.settings.tip_settings.tip_location)},left:function(){return/left/i.test(this.settings.tip_settings.tip_location)},corners:function(c){var d=a(b),e=d.height()/2,f=Math.ceil(this.settings.$target.offset().top-e+this.settings.$next_tip.outerHeight()),g=d.width()+d.scrollLeft(),h=d.height()+f,i=d.height()+d.scrollTop(),j=d.scrollTop();return j>f&&(j=0>f?0:f),h>i&&(i=h),[c.offset().top<j,g<c.offset().left+c.outerWidth(),i<c.offset().top+c.outerHeight(),d.scrollLeft()>c.offset().left]},visible:function(a){for(var b=a.length;b--;)if(a[b])return!1;return!0},nub_position:function(a,b,c){a.addClass("auto"===b?c:b)},startTimer:function(){this.settings.$li.length?this.settings.automate=setTimeout(function(){this.hide(),this.show(),this.startTimer()}.bind(this),this.settings.timer):clearTimeout(this.settings.automate)},end:function(b){this.settings.cookie_monster&&a.cookie(this.settings.cookie_name,"ridden",{expires:this.settings.cookie_expires,domain:this.settings.cookie_domain}),this.settings.timer>0&&clearTimeout(this.settings.automate),this.settings.modal&&this.settings.expose&&this.un_expose(),a(this.scope).off("keyup.joyride"),this.settings.$next_tip.data("closed",!0),this.settings.riding=!1,a(".joyride-modal-bg").hide(),this.settings.$current_tip.hide(),("undefined"==typeof b||b===!1)&&(this.settings.post_step_callback(this.settings.$li.index(),this.settings.$current_tip),this.settings.post_ride_callback(this.settings.$li.index(),this.settings.$current_tip)),a(".joyride-tip-guide").remove()},off:function(){a(this.scope).off(".joyride"),a(b).off(".joyride"),a(".joyride-close-tip, .joyride-next-tip, .joyride-modal-bg").off(".joyride"),a(".joyride-tip-guide, .joyride-modal-bg").remove(),clearTimeout(this.settings.automate),this.settings={}},reflow:function(){}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs["magellan-expedition"]={name:"magellan-expedition",version:"5.4.3",settings:{active_class:"active",threshold:0,destination_threshold:20,throttle_delay:30,fixed_top:0},init:function(a,b,c){Foundation.inherit(this,"throttle"),this.bindings(b,c)},events:function(){var c=this,d=c.S,e=c.settings;c.set_expedition_position(),d(c.scope).off(".magellan").on("click.fndtn.magellan","["+c.add_namespace("data-magellan-arrival")+'] a[href^="#"]',function(b){b.preventDefault();var d=a(this).closest("["+c.attr_name()+"]"),e=d.data("magellan-expedition-init"),f=this.hash.split("#").join(""),g=a("a[name='"+f+"']");0===g.length&&(g=a("#"+f));var h=g.offset().top-e.destination_threshold+1;h-=d.outerHeight(),a("html, body").stop().animate({scrollTop:h},700,"swing",function(){history.pushState?history.pushState(null,null,"#"+f):location.hash="#"+f})}).on("scroll.fndtn.magellan",c.throttle(this.check_for_arrivals.bind(this),e.throttle_delay)),a(b).on("resize.fndtn.magellan",c.throttle(this.set_expedition_position.bind(this),e.throttle_delay))},check_for_arrivals:function(){var a=this;a.update_arrivals(),a.update_expedition_positions()},set_expedition_position:function(){var b=this;a("["+this.attr_name()+"=fixed]",b.scope).each(function(){var c,d,e=a(this),f=e.data("magellan-expedition-init"),g=e.attr("styles");e.attr("style",""),c=e.offset().top+f.threshold,d=parseInt(e.data("magellan-fixed-top")),isNaN(d)||(b.settings.fixed_top=d),e.data(b.data_attr("magellan-top-offset"),c),e.attr("style",g)})},update_expedition_positions:function(){var c=this,d=a(b).scrollTop();a("["+this.attr_name()+"=fixed]",c.scope).each(function(){var b=a(this),e=b.data("magellan-expedition-init"),f=b.attr("style"),g=b.data("magellan-top-offset");if(d+c.settings.fixed_top>=g){var h=b.prev("["+c.add_namespace("data-magellan-expedition-clone")+"]");0===h.length&&(h=b.clone(),h.removeAttr(c.attr_name()),h.attr(c.add_namespace("data-magellan-expedition-clone"),""),b.before(h)),b.css({position:"fixed",top:e.fixed_top}).addClass("fixed")}else b.prev("["+c.add_namespace("data-magellan-expedition-clone")+"]").remove(),b.attr("style",f).css("position","").css("top","").removeClass("fixed")})},update_arrivals:function(){var c=this,d=a(b).scrollTop();a("["+this.attr_name()+"]",c.scope).each(function(){var b=a(this),e=b.data(c.attr_name(!0)+"-init"),f=c.offsets(b,d),g=b.find("["+c.add_namespace("data-magellan-arrival")+"]"),h=!1;f.each(function(a,d){if(d.viewport_offset>=d.top_offset){var f=b.find("["+c.add_namespace("data-magellan-arrival")+"]");return f.not(d.arrival).removeClass(e.active_class),d.arrival.addClass(e.active_class),h=!0,!0}}),h||g.removeClass(e.active_class)})},offsets:function(b,c){var d=this,e=b.data(d.attr_name(!0)+"-init"),f=c;return b.find("["+d.add_namespace("data-magellan-arrival")+"]").map(function(){var c=a(this).data(d.data_attr("magellan-arrival")),g=a("["+d.add_namespace("data-magellan-destination")+"="+c+"]");if(g.length>0){var h=Math.floor(g.offset().top-e.destination_threshold-b.outerHeight());return{destination:g,arrival:a(this),top_offset:h,viewport_offset:f}}}).sort(function(a,b){return a.top_offset<b.top_offset?-1:a.top_offset>b.top_offset?1:0})},data_attr:function(a){return this.namespace.length>0?this.namespace+"-"+a:a},off:function(){this.S(this.scope).off(".magellan"),this.S(b).off(".magellan")},reflow:function(){var b=this;a("["+b.add_namespace("data-magellan-expedition-clone")+"]",b.scope).remove()}}}(jQuery,window,window.document),function(a){"use strict";Foundation.libs.offcanvas={name:"offcanvas",version:"5.4.3",settings:{open_method:"move",close_on_click:!1},init:function(a,b,c){this.bindings(b,c)},events:function(){var b=this,c=b.S,d="",e="",f="";"move"===this.settings.open_method?(d="move-",e="right",f="left"):"overlap_single"===this.settings.open_method?(d="offcanvas-overlap-",e="right",f="left"):"overlap"===this.settings.open_method&&(d="offcanvas-overlap"),c(this.scope).off(".offcanvas").on("click.fndtn.offcanvas",".left-off-canvas-toggle",function(f){b.click_toggle_class(f,d+e),"overlap"!==b.settings.open_method&&c(".left-submenu").removeClass(d+e),a(".left-off-canvas-toggle").attr("aria-expanded","true")}).on("click.fndtn.offcanvas",".left-off-canvas-menu a",function(f){var g=b.get_settings(f),h=c(this).parent();!g.close_on_click||h.hasClass("has-submenu")||h.hasClass("back")?c(this).parent().hasClass("has-submenu")?(f.preventDefault(),c(this).siblings(".left-submenu").toggleClass(d+e)):h.hasClass("back")&&(f.preventDefault(),h.parent().removeClass(d+e)):(b.hide.call(b,d+e,b.get_wrapper(f)),h.parent().removeClass(d+e)),a(".left-off-canvas-toggle").attr("aria-expanded","true")}).on("click.fndtn.offcanvas",".right-off-canvas-toggle",function(e){b.click_toggle_class(e,d+f),"overlap"!==b.settings.open_method&&c(".right-submenu").removeClass(d+f),a(".right-off-canvas-toggle").attr("aria-expanded","true")}).on("click.fndtn.offcanvas",".right-off-canvas-menu a",function(e){var g=b.get_settings(e),h=c(this).parent();!g.close_on_click||h.hasClass("has-submenu")||h.hasClass("back")?c(this).parent().hasClass("has-submenu")?(e.preventDefault(),c(this).siblings(".right-submenu").toggleClass(d+f)):h.hasClass("back")&&(e.preventDefault(),h.parent().removeClass(d+f)):(b.hide.call(b,d+f,b.get_wrapper(e)),h.parent().removeClass(d+f)),a(".right-off-canvas-toggle").attr("aria-expanded","true")}).on("click.fndtn.offcanvas",".exit-off-canvas",function(g){b.click_remove_class(g,d+f),c(".right-submenu").removeClass(d+f),e&&(b.click_remove_class(g,d+e),c(".left-submenu").removeClass(d+f)),a(".right-off-canvas-toggle").attr("aria-expanded","true")}).on("click.fndtn.offcanvas",".exit-off-canvas",function(c){b.click_remove_class(c,d+f),a(".left-off-canvas-toggle").attr("aria-expanded","false"),e&&(b.click_remove_class(c,d+e),a(".right-off-canvas-toggle").attr("aria-expanded","false"))})},toggle:function(a,b){b=b||this.get_wrapper(),b.is("."+a)?this.hide(a,b):this.show(a,b)},show:function(a,b){b=b||this.get_wrapper(),b.trigger("open").trigger("open.fndtn.offcanvas"),b.addClass(a)},hide:function(a,b){b=b||this.get_wrapper(),b.trigger("close").trigger("close.fndtn.offcanvas"),b.removeClass(a)},click_toggle_class:function(a,b){a.preventDefault();var c=this.get_wrapper(a);this.toggle(b,c)},click_remove_class:function(a,b){a.preventDefault();var c=this.get_wrapper(a);this.hide(b,c)},get_settings:function(a){var b=this.S(a.target).closest("["+this.attr_name()+"]");return b.data(this.attr_name(!0)+"-init")||this.settings},get_wrapper:function(a){var b=this.S(a?a.target:this.scope).closest(".off-canvas-wrap");return 0===b.length&&(b=this.S(".off-canvas-wrap")),b},reflow:function(){}}}(jQuery,window,window.document),function(a,b,c,d){"use strict";var e=function(){},f=function(e,f){if(e.hasClass(f.slides_container_class))return this;var j,k,l,m,n,o,p=this,q=e,r=0,s=!1;p.slides=function(){return q.children(f.slide_selector)},p.slides().first().addClass(f.active_slide_class),p.update_slide_number=function(b){f.slide_number&&(k.find("span:first").text(parseInt(b)+1),k.find("span:last").text(p.slides().length)),f.bullets&&(l.children().removeClass(f.bullets_active_class),a(l.children().get(b)).addClass(f.bullets_active_class))},p.update_active_link=function(b){var c=a('[data-orbit-link="'+p.slides().eq(b).attr("data-orbit-slide")+'"]');c.siblings().removeClass(f.bullets_active_class),c.addClass(f.bullets_active_class)},p.build_markup=function(){q.wrap('<div class="'+f.container_class+'"></div>'),j=q.parent(),q.addClass(f.slides_container_class),f.stack_on_small&&j.addClass(f.stack_on_small_class),f.navigation_arrows&&(j.append(a('<a href="#"><span></span></a>').addClass(f.prev_class)),j.append(a('<a href="#"><span></span></a>').addClass(f.next_class))),f.timer&&(m=a("<div>").addClass(f.timer_container_class),m.append("<span>"),m.append(a("<div>").addClass(f.timer_progress_class)),m.addClass(f.timer_paused_class),j.append(m)),f.slide_number&&(k=a("<div>").addClass(f.slide_number_class),k.append("<span></span> "+f.slide_number_text+" <span></span>"),j.append(k)),f.bullets&&(l=a("<ol>").addClass(f.bullets_container_class),j.append(l),l.wrap('<div class="orbit-bullets-container"></div>'),p.slides().each(function(b){var c=a("<li>").attr("data-orbit-slide",b).on("click",p.link_bullet);l.append(c)}))},p._goto=function(b,c){if(b===r)return!1;"object"==typeof o&&o.restart();var d=p.slides(),e="next";if(s=!0,r>b&&(e="prev"),b>=d.length){if(!f.circular)return!1;b=0}else if(0>b){if(!f.circular)return!1;b=d.length-1}var g=a(d.get(r)),h=a(d.get(b));g.css("zIndex",2),g.removeClass(f.active_slide_class),h.css("zIndex",4).addClass(f.active_slide_class),q.trigger("before-slide-change.fndtn.orbit"),f.before_slide_change(),p.update_active_link(b);var i=function(){var a=function(){r=b,s=!1,c===!0&&(o=p.create_timer(),o.start()),p.update_slide_number(r),q.trigger("after-slide-change.fndtn.orbit",[{slide_number:r,total_slides:d.length}]),f.after_slide_change(r,d.length)};q.height()!=h.height()&&f.variable_height?q.animate({height:h.height()},250,"linear",a):a()};if(1===d.length)return i(),!1;var j=function(){"next"===e&&n.next(g,h,i),"prev"===e&&n.prev(g,h,i)};h.height()>q.height()&&f.variable_height?q.animate({height:h.height()},250,"linear",j):j()},p.next=function(a){a.stopImmediatePropagation(),a.preventDefault(),p._goto(r+1)},p.prev=function(a){a.stopImmediatePropagation(),a.preventDefault(),p._goto(r-1)},p.link_custom=function(b){b.preventDefault();var c=a(this).attr("data-orbit-link");if("string"==typeof c&&""!=(c=a.trim(c))){var d=j.find("[data-orbit-slide="+c+"]");-1!=d.index()&&p._goto(d.index())}},p.link_bullet=function(){var b=a(this).attr("data-orbit-slide");if("string"==typeof b&&""!=(b=a.trim(b)))if(isNaN(parseInt(b))){var c=j.find("[data-orbit-slide="+b+"]");-1!=c.index()&&p._goto(c.index()+1)}else p._goto(parseInt(b))},p.timer_callback=function(){p._goto(r+1,!0)},p.compute_dimensions=function(){var b=a(p.slides().get(r)),c=b.height();f.variable_height||p.slides().each(function(){a(this).height()>c&&(c=a(this).height())}),q.height(c)},p.create_timer=function(){var a=new g(j.find("."+f.timer_container_class),f,p.timer_callback);return a},p.stop_timer=function(){"object"==typeof o&&o.stop()},p.toggle_timer=function(){var a=j.find("."+f.timer_container_class);a.hasClass(f.timer_paused_class)?("undefined"==typeof o&&(o=p.create_timer()),o.start()):"object"==typeof o&&o.stop()},p.init=function(){p.build_markup(),f.timer&&(o=p.create_timer(),Foundation.utils.image_loaded(this.slides().children("img"),o.start)),n=new i(f,q),"slide"===f.animation&&(n=new h(f,q)),j.on("click","."+f.next_class,p.next),j.on("click","."+f.prev_class,p.prev),f.next_on_click&&j.on("click","."+f.slides_container_class+" [data-orbit-slide]",p.link_bullet),j.on("click",p.toggle_timer),f.swipe&&j.on("touchstart.fndtn.orbit",function(a){a.touches||(a=a.originalEvent);var b={start_page_x:a.touches[0].pageX,start_page_y:a.touches[0].pageY,start_time:(new Date).getTime(),delta_x:0,is_scrolling:d};j.data("swipe-transition",b),a.stopPropagation()}).on("touchmove.fndtn.orbit",function(a){if(a.touches||(a=a.originalEvent),!(a.touches.length>1||a.scale&&1!==a.scale)){var b=j.data("swipe-transition");if("undefined"==typeof b&&(b={}),b.delta_x=a.touches[0].pageX-b.start_page_x,"undefined"==typeof b.is_scrolling&&(b.is_scrolling=!!(b.is_scrolling||Math.abs(b.delta_x)<Math.abs(a.touches[0].pageY-b.start_page_y))),!b.is_scrolling&&!b.active){a.preventDefault();
var c=b.delta_x<0?r+1:r-1;b.active=!0,p._goto(c)}}}).on("touchend.fndtn.orbit",function(a){j.data("swipe-transition",{}),a.stopPropagation()}),j.on("mouseenter.fndtn.orbit",function(){f.timer&&f.pause_on_hover&&p.stop_timer()}).on("mouseleave.fndtn.orbit",function(){f.timer&&f.resume_on_mouseout&&o.start()}),a(c).on("click","[data-orbit-link]",p.link_custom),a(b).on("load resize",p.compute_dimensions),Foundation.utils.image_loaded(this.slides().children("img"),p.compute_dimensions),Foundation.utils.image_loaded(this.slides().children("img"),function(){j.prev("."+f.preloader_class).css("display","none"),p.update_slide_number(0),p.update_active_link(0),q.trigger("ready.fndtn.orbit")})},p.init()},g=function(a,b,c){var d,e,f=this,g=b.timer_speed,h=a.find("."+b.timer_progress_class),i=-1;this.update_progress=function(a){var b=h.clone();b.attr("style",""),b.css("width",a+"%"),h.replaceWith(b),h=b},this.restart=function(){clearTimeout(e),a.addClass(b.timer_paused_class),i=-1,f.update_progress(0)},this.start=function(){return a.hasClass(b.timer_paused_class)?(i=-1===i?g:i,a.removeClass(b.timer_paused_class),d=(new Date).getTime(),h.animate({width:"100%"},i,"linear"),e=setTimeout(function(){f.restart(),c()},i),void a.trigger("timer-started.fndtn.orbit")):!0},this.stop=function(){if(a.hasClass(b.timer_paused_class))return!0;clearTimeout(e),a.addClass(b.timer_paused_class);var c=(new Date).getTime();i-=c-d;var h=100-i/g*100;f.update_progress(h),a.trigger("timer-stopped.fndtn.orbit")}},h=function(b){var c=b.animation_speed,d=1===a("html[dir=rtl]").length,e=d?"marginRight":"marginLeft",f={};f[e]="0%",this.next=function(a,b,d){a.animate({marginLeft:"-100%"},c),b.animate(f,c,function(){a.css(e,"100%"),d()})},this.prev=function(a,b,d){a.animate({marginLeft:"100%"},c),b.css(e,"-100%"),b.animate(f,c,function(){a.css(e,"100%"),d()})}},i=function(b){{var c=b.animation_speed;1===a("html[dir=rtl]").length}this.next=function(a,b,d){b.css({margin:"0%",opacity:"0.01"}),b.animate({opacity:"1"},c,"linear",function(){a.css("margin","100%"),d()})},this.prev=function(a,b,d){b.css({margin:"0%",opacity:"0.01"}),b.animate({opacity:"1"},c,"linear",function(){a.css("margin","100%"),d()})}};Foundation.libs=Foundation.libs||{},Foundation.libs.orbit={name:"orbit",version:"5.4.3",settings:{animation:"slide",timer_speed:1e4,pause_on_hover:!0,resume_on_mouseout:!1,next_on_click:!0,animation_speed:500,stack_on_small:!1,navigation_arrows:!0,slide_number:!0,slide_number_text:"of",container_class:"orbit-container",stack_on_small_class:"orbit-stack-on-small",next_class:"orbit-next",prev_class:"orbit-prev",timer_container_class:"orbit-timer",timer_paused_class:"paused",timer_progress_class:"orbit-progress",slides_container_class:"orbit-slides-container",preloader_class:"preloader",slide_selector:"*",bullets_container_class:"orbit-bullets",bullets_active_class:"active",slide_number_class:"orbit-slide-number",caption_class:"orbit-caption",active_slide_class:"active",orbit_transition_class:"orbit-transitioning",bullets:!0,circular:!0,timer:!0,variable_height:!1,swipe:!0,before_slide_change:e,after_slide_change:e},init:function(a,b,c){this.bindings(b,c)},events:function(a){var b=new f(this.S(a),this.S(a).data("orbit-init"));this.S(a).data(this.name+"-instance",b)},reflow:function(){var a=this;if(a.S(a.scope).is("[data-orbit]")){var b=a.S(a.scope),c=b.data(a.name+"-instance");c.compute_dimensions()}else a.S("[data-orbit]",a.scope).each(function(b,c){var d=a.S(c),e=(a.data_options(d),d.data(a.name+"-instance"));e.compute_dimensions()})}}}(jQuery,window,window.document),function(a,b,c,d){"use strict";function e(a){var b=/fade/i.test(a),c=/pop/i.test(a);return{animate:b||c,pop:c,fade:b}}Foundation.libs.reveal={name:"reveal",version:"5.4.3",locked:!1,settings:{animation:"fadeAndPop",animation_speed:250,close_on_background_click:!0,close_on_esc:!0,dismiss_modal_class:"close-reveal-modal",bg_class:"reveal-modal-bg",root_element:"body",open:function(){},opened:function(){},close:function(){},closed:function(){},bg:a(".reveal-modal-bg"),css:{open:{opacity:0,visibility:"visible",display:"block"},close:{opacity:1,visibility:"hidden",display:"none"}}},init:function(b,c,d){a.extend(!0,this.settings,c,d),this.bindings(c,d)},events:function(){var a=this,b=a.S;return b(this.scope).off(".reveal").on("click.fndtn.reveal","["+this.add_namespace("data-reveal-id")+"]:not([disabled])",function(c){if(c.preventDefault(),!a.locked){var d=b(this),e=d.data(a.data_attr("reveal-ajax"));if(a.locked=!0,"undefined"==typeof e)a.open.call(a,d);else{var f=e===!0?d.attr("href"):e;a.open.call(a,d,{url:f})}}}),b(c).on("click.fndtn.reveal",this.close_targets(),function(c){if(c.preventDefault(),!a.locked){var d=b("["+a.attr_name()+"].open").data(a.attr_name(!0)+"-init"),e=b(c.target)[0]===b("."+d.bg_class)[0];if(e){if(!d.close_on_background_click)return;c.stopPropagation()}a.locked=!0,a.close.call(a,e?b("["+a.attr_name()+"].open"):b(this).closest("["+a.attr_name()+"]"))}}),b("["+a.attr_name()+"]",this.scope).length>0?b(this.scope).on("open.fndtn.reveal",this.settings.open).on("opened.fndtn.reveal",this.settings.opened).on("opened.fndtn.reveal",this.open_video).on("close.fndtn.reveal",this.settings.close).on("closed.fndtn.reveal",this.settings.closed).on("closed.fndtn.reveal",this.close_video):b(this.scope).on("open.fndtn.reveal","["+a.attr_name()+"]",this.settings.open).on("opened.fndtn.reveal","["+a.attr_name()+"]",this.settings.opened).on("opened.fndtn.reveal","["+a.attr_name()+"]",this.open_video).on("close.fndtn.reveal","["+a.attr_name()+"]",this.settings.close).on("closed.fndtn.reveal","["+a.attr_name()+"]",this.settings.closed).on("closed.fndtn.reveal","["+a.attr_name()+"]",this.close_video),!0},key_up_on:function(){var a=this;return a.S("body").off("keyup.fndtn.reveal").on("keyup.fndtn.reveal",function(b){var c=a.S("["+a.attr_name()+"].open"),d=c.data(a.attr_name(!0)+"-init")||a.settings;d&&27===b.which&&d.close_on_esc&&!a.locked&&a.close.call(a,c)}),!0},key_up_off:function(){return this.S("body").off("keyup.fndtn.reveal"),!0},open:function(c,d){var e,f=this;c?"undefined"!=typeof c.selector?e=f.S("#"+c.data(f.data_attr("reveal-id"))).first():(e=f.S(this.scope),d=c):e=f.S(this.scope);var g=e.data(f.attr_name(!0)+"-init");if(g=g||this.settings,e.hasClass("open")&&c.attr("data-reveal-id")==e.attr("id"))return f.close(e);if(!e.hasClass("open")){var h=f.S("["+f.attr_name()+"].open");if("undefined"==typeof e.data("css-top")&&e.data("css-top",parseInt(e.css("top"),10)).data("offset",this.cache_offset(e)),this.key_up_on(e),e.trigger("open").trigger("open.fndtn.reveal"),h.length<1&&this.toggle_bg(e,!0),"string"==typeof d&&(d={url:d}),"undefined"!=typeof d&&d.url){var i="undefined"!=typeof d.success?d.success:null;a.extend(d,{success:function(b,c,d){a.isFunction(i)&&i(b,c,d),e.html(b),f.S(e).foundation("section","reflow"),f.S(e).children().foundation(),h.length>0&&f.hide(h,g.css.close),f.show(e,g.css.open)}}),a.ajax(d)}else h.length>0&&this.hide(h,g.css.close),this.show(e,g.css.open)}f.S(b).trigger("resize")},close:function(a){var a=a&&a.length?a:this.S(this.scope),b=this.S("["+this.attr_name()+"].open"),c=a.data(this.attr_name(!0)+"-init")||this.settings;b.length>0&&(this.locked=!0,this.key_up_off(a),a.trigger("close").trigger("close.fndtn.reveal"),this.toggle_bg(a,!1),this.hide(b,c.css.close,c))},close_targets:function(){var a="."+this.settings.dismiss_modal_class;return this.settings.close_on_background_click?a+", ."+this.settings.bg_class:a},toggle_bg:function(b,c){0===this.S("."+this.settings.bg_class).length&&(this.settings.bg=a("<div />",{"class":this.settings.bg_class}).appendTo("body").hide());var e=this.settings.bg.filter(":visible").length>0;c!=e&&((c==d?e:!c)?this.hide(this.settings.bg):this.show(this.settings.bg))},show:function(c,d){if(d){var f=c.data(this.attr_name(!0)+"-init")||this.settings,g=f.root_element;if(0===c.parent(g).length){var h=c.wrap('<div style="display: none;" />').parent();c.on("closed.fndtn.reveal.wrapped",function(){c.detach().appendTo(h),c.unwrap().unbind("closed.fndtn.reveal.wrapped")}),c.detach().appendTo(g)}var i=e(f.animation);if(i.animate||(this.locked=!1),i.pop){d.top=a(b).scrollTop()-c.data("offset")+"px";var j={top:a(b).scrollTop()+c.data("css-top")+"px",opacity:1};return setTimeout(function(){return c.css(d).animate(j,f.animation_speed,"linear",function(){this.locked=!1,c.trigger("opened").trigger("opened.fndtn.reveal")}.bind(this)).addClass("open")}.bind(this),f.animation_speed/2)}if(i.fade){d.top=a(b).scrollTop()+c.data("css-top")+"px";var j={opacity:1};return setTimeout(function(){return c.css(d).animate(j,f.animation_speed,"linear",function(){this.locked=!1,c.trigger("opened").trigger("opened.fndtn.reveal")}.bind(this)).addClass("open")}.bind(this),f.animation_speed/2)}return c.css(d).show().css({opacity:1}).addClass("open").trigger("opened").trigger("opened.fndtn.reveal")}var f=this.settings;return e(f.animation).fade?c.fadeIn(f.animation_speed/2):(this.locked=!1,c.show())},hide:function(c,d){if(d){var f=c.data(this.attr_name(!0)+"-init");f=f||this.settings;var g=e(f.animation);if(g.animate||(this.locked=!1),g.pop){var h={top:-a(b).scrollTop()-c.data("offset")+"px",opacity:0};return setTimeout(function(){return c.animate(h,f.animation_speed,"linear",function(){this.locked=!1,c.css(d).trigger("closed").trigger("closed.fndtn.reveal")}.bind(this)).removeClass("open")}.bind(this),f.animation_speed/2)}if(g.fade){var h={opacity:0};return setTimeout(function(){return c.animate(h,f.animation_speed,"linear",function(){this.locked=!1,c.css(d).trigger("closed").trigger("closed.fndtn.reveal")}.bind(this)).removeClass("open")}.bind(this),f.animation_speed/2)}return c.hide().css(d).removeClass("open").trigger("closed").trigger("closed.fndtn.reveal")}var f=this.settings;return e(f.animation).fade?c.fadeOut(f.animation_speed/2):c.hide()},close_video:function(b){var c=a(".flex-video",b.target),d=a("iframe",c);d.length>0&&(d.attr("data-src",d[0].src),d.attr("src",d.attr("src")),c.hide())},open_video:function(b){var c=a(".flex-video",b.target),e=c.find("iframe");if(e.length>0){var f=e.attr("data-src");if("string"==typeof f)e[0].src=e.attr("data-src");else{var g=e[0].src;e[0].src=d,e[0].src=g}c.show()}},data_attr:function(a){return this.namespace.length>0?this.namespace+"-"+a:a},cache_offset:function(a){var b=a.show().height()+parseInt(a.css("top"),10);return a.hide(),b},off:function(){a(this.scope).off(".fndtn.reveal")},reflow:function(){}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs.slider={name:"slider",version:"5.4.3",settings:{start:0,end:100,step:1,initial:null,display_selector:"",vertical:!1,on_change:function(){}},cache:{},init:function(a,b,c){Foundation.inherit(this,"throttle"),this.bindings(b,c),this.reflow()},events:function(){var c=this;a(this.scope).off(".slider").on("mousedown.fndtn.slider touchstart.fndtn.slider pointerdown.fndtn.slider","["+c.attr_name()+"]:not(.disabled, [disabled]) .range-slider-handle",function(b){c.cache.active||(b.preventDefault(),c.set_active_slider(a(b.target)))}).on("mousemove.fndtn.slider touchmove.fndtn.slider pointermove.fndtn.slider",function(d){if(c.cache.active)if(d.preventDefault(),a.data(c.cache.active[0],"settings").vertical){var e=0;d.pageY||(e=b.scrollY),c.calculate_position(c.cache.active,(d.pageY||d.originalEvent.clientY||d.originalEvent.touches[0].clientY||d.currentPoint.y)+e)}else c.calculate_position(c.cache.active,d.pageX||d.originalEvent.clientX||d.originalEvent.touches[0].clientX||d.currentPoint.x)}).on("mouseup.fndtn.slider touchend.fndtn.slider pointerup.fndtn.slider",function(){c.remove_active_slider()}).on("change.fndtn.slider",function(){c.settings.on_change()}),c.S(b).on("resize.fndtn.slider",c.throttle(function(){c.reflow()},300))},set_active_slider:function(a){this.cache.active=a},remove_active_slider:function(){this.cache.active=null},calculate_position:function(b,c){var d=this,e=a.data(b[0],"settings"),f=(a.data(b[0],"handle_l"),a.data(b[0],"handle_o"),a.data(b[0],"bar_l")),g=a.data(b[0],"bar_o");requestAnimationFrame(function(){var a;a=Foundation.rtl&&!e.vertical?d.limit_to((g+f-c)/f,0,1):d.limit_to((c-g)/f,0,1),a=e.vertical?1-a:a;var h=d.normalized_value(a,e.start,e.end,e.step);d.set_ui(b,h)})},set_ui:function(b,c){var d=a.data(b[0],"settings"),e=a.data(b[0],"handle_l"),f=a.data(b[0],"bar_l"),g=this.normalized_percentage(c,d.start,d.end),h=g*(f-e)-1,i=100*g;Foundation.rtl&&!d.vertical&&(h=-h),h=d.vertical?-h+f-e+1:h,this.set_translate(b,h,d.vertical),d.vertical?b.siblings(".range-slider-active-segment").css("height",i+"%"):b.siblings(".range-slider-active-segment").css("width",i+"%"),b.parent().attr(this.attr_name(),c).trigger("change").trigger("change.fndtn.slider"),b.parent().children("input[type=hidden]").val(c),b[0].hasAttribute("aria-valuemin")||b.attr({"aria-valuemin":d.start,"aria-valuemax":d.end}),b.attr("aria-valuenow",c)},normalized_percentage:function(a,b,c){return Math.min(1,(a-b)/(c-b))},normalized_value:function(a,b,c,d){var e=c-b,f=a*e,g=(f-f%d)/d,h=f%d,i=h>=.5*d?d:0;return g*d+i+b},set_translate:function(b,c,d){d?a(b).css("-webkit-transform","translateY("+c+"px)").css("-moz-transform","translateY("+c+"px)").css("-ms-transform","translateY("+c+"px)").css("-o-transform","translateY("+c+"px)").css("transform","translateY("+c+"px)"):a(b).css("-webkit-transform","translateX("+c+"px)").css("-moz-transform","translateX("+c+"px)").css("-ms-transform","translateX("+c+"px)").css("-o-transform","translateX("+c+"px)").css("transform","translateX("+c+"px)")},limit_to:function(a,b,c){return Math.min(Math.max(a,b),c)},initialize_settings:function(b){var c=a.extend({},this.settings,this.data_options(a(b).parent()));c.vertical?(a.data(b,"bar_o",a(b).parent().offset().top),a.data(b,"bar_l",a(b).parent().outerHeight()),a.data(b,"handle_o",a(b).offset().top),a.data(b,"handle_l",a(b).outerHeight())):(a.data(b,"bar_o",a(b).parent().offset().left),a.data(b,"bar_l",a(b).parent().outerWidth()),a.data(b,"handle_o",a(b).offset().left),a.data(b,"handle_l",a(b).outerWidth())),a.data(b,"bar",a(b).parent()),a.data(b,"settings",c)},set_initial_position:function(b){var c=a.data(b.children(".range-slider-handle")[0],"settings"),d=c.initial?c.initial:Math.floor(.5*(c.end-c.start)/c.step)*c.step+c.start,e=b.children(".range-slider-handle");this.set_ui(e,d)},set_value:function(b){var c=this;a("["+c.attr_name()+"]",this.scope).each(function(){a(this).attr(c.attr_name(),b)}),a(this.scope).attr(c.attr_name())&&a(this.scope).attr(c.attr_name(),b),c.reflow()},reflow:function(){var b=this;b.S("["+this.attr_name()+"]").each(function(){var c=a(this).children(".range-slider-handle")[0],d=a(this).attr(b.attr_name());b.initialize_settings(c),d?b.set_ui(a(c),parseFloat(d)):b.set_initial_position(a(this))})}}}(jQuery,window,window.document),function(a,b,c,d){"use strict";Foundation.libs.tab={name:"tab",version:"5.4.3",settings:{active_class:"active",callback:function(){},deep_linking:!1,scroll_to_content:!0,is_hover:!1},default_tab_hashes:[],init:function(a,b,c){var d=this,e=this.S;this.bindings(b,c),this.handle_location_hash_change(),e("["+this.attr_name()+"] > .active > a",this.scope).each(function(){d.default_tab_hashes.push(this.hash)})},events:function(){var a=this,d=this.S,e=function(b){var c=d(this).closest("["+a.attr_name()+"]").data(a.attr_name(!0)+"-init");(!c.is_hover||Modernizr.touch)&&(b.preventDefault(),b.stopPropagation(),a.toggle_active_tab(d(this).parent()))};d(this.scope).off(".tab").on("focus.fndtn.tab","["+this.attr_name()+"] > * > a",e).on("click.fndtn.tab","["+this.attr_name()+"] > * > a",e).on("mouseenter.fndtn.tab","["+this.attr_name()+"] > * > a",function(){var b=d(this).closest("["+a.attr_name()+"]").data(a.attr_name(!0)+"-init");b.is_hover&&a.toggle_active_tab(d(this).parent())}),d(b).on("hashchange.fndtn.tab",function(b){b.preventDefault(),a.handle_location_hash_change()}).on("keyup",function(a){9==a.keyword&&console.log(c.querySelector("[data-tab] .tab-title :focus"))})},handle_location_hash_change:function(){var b=this,c=this.S;c("["+this.attr_name()+"]",this.scope).each(function(){var e=c(this).data(b.attr_name(!0)+"-init");if(e.deep_linking){var f;if(f=e.scroll_to_content?b.scope.location.hash:b.scope.location.hash.replace("fndtn-",""),""!=f){var g=c(f);if(g.hasClass("content")&&g.parent().hasClass("tab-content"))b.toggle_active_tab(a("["+b.attr_name()+"] > * > a[href="+f+"]").parent());else{var h=g.closest(".content").attr("id");h!=d&&b.toggle_active_tab(a("["+b.attr_name()+"] > * > a[href=#"+h+"]").parent(),f)}}else for(var i in b.default_tab_hashes)b.toggle_active_tab(a("["+b.attr_name()+"] > * > a[href="+b.default_tab_hashes[i]+"]").parent())}})},toggle_active_tab:function(e,f){var g=this.S,h=e.closest("["+this.attr_name()+"]"),i=e.find("a"),j=e.children("a").first(),k="#"+j.attr("href").split("#")[1],l=g(k),m=e.siblings(),n=h.data(this.attr_name(!0)+"-init"),o=function(b){var d,e=a(this),f=a(this).parents("li").prev().children('[role="tab"]'),g=a(this).parents("li").next().children('[role="tab"]');switch(b.keyCode){case 37:d=f;break;case 39:d=g;break;default:d=!1}d.length&&(e.attr({tabindex:"-1","aria-selected":null}),d.attr({tabindex:"0","aria-selected":!0}).focus()),a('[role="tabpanel"]').attr("aria-hidden","true"),a("#"+a(c.activeElement).attr("href").substring(1)).attr("aria-hidden",null)};g(this).data(this.data_attr("tab-content"))&&(k="#"+g(this).data(this.data_attr("tab-content")).split("#")[1],l=g(k)),n.deep_linking&&(n.scroll_to_content?(b.location.hash=f||k,f==d||f==k?e.parent()[0].scrollIntoView():g(k)[0].scrollIntoView()):b.location.hash=f!=d?"fndtn-"+f.replace("#",""):"fndtn-"+k.replace("#","")),e.addClass(n.active_class).triggerHandler("opened"),i.attr({"aria-selected":"true",tabindex:0}),m.removeClass(n.active_class),m.find("a").attr({"aria-selected":"false",tabindex:-1}),l.siblings().removeClass(n.active_class).attr({"aria-hidden":"true",tabindex:-1}).end().addClass(n.active_class).attr("aria-hidden","false").find(":first-child").attr("tabindex",0),n.callback(e),l.children().attr("tab-index",0),l.triggerHandler("toggled",[e]),h.triggerHandler("toggled",[l]),i.on("keydown",o)},data_attr:function(a){return this.namespace.length>0?this.namespace+"-"+a:a},off:function(){},reflow:function(){}}}(jQuery,window,window.document),function(a,b){"use strict";Foundation.libs.tooltip={name:"tooltip",version:"5.4.3",settings:{additional_inheritable_classes:[],tooltip_class:".tooltip",append_to:"body",touch_close_text:"Tap To Close",disable_for_touch:!1,hover_delay:200,show_on:"all",tip_template:function(a,b){return'<span data-selector="'+a+'" id="'+a+'" class="'+Foundation.libs.tooltip.settings.tooltip_class.substring(1)+'" role="tooltip">'+b+'<span class="nub"></span></span>'}},cache:{},init:function(a,b,c){Foundation.inherit(this,"random_str"),this.bindings(b,c)},should_show:function(b){var c=a.extend({},this.settings,this.data_options(b));return"all"===c.show_on?!0:this.small()&&"small"===c.show_on?!0:this.medium()&&"medium"===c.show_on?!0:this.large()&&"large"===c.show_on?!0:!1},medium:function(){return matchMedia(Foundation.media_queries.medium).matches},large:function(){return matchMedia(Foundation.media_queries.large).matches},events:function(b){var c=this,d=c.S;c.create(this.S(b)),a(this.scope).off(".tooltip").on("mouseenter.fndtn.tooltip mouseleave.fndtn.tooltip touchstart.fndtn.tooltip MSPointerDown.fndtn.tooltip","["+this.attr_name()+"]",function(b){var e=d(this),f=a.extend({},c.settings,c.data_options(e)),g=!1;if(Modernizr.touch&&/touchstart|MSPointerDown/i.test(b.type)&&d(b.target).is("a"))return!1;if(/mouse/i.test(b.type)&&c.ie_touch(b))return!1;if(e.hasClass("open"))Modernizr.touch&&/touchstart|MSPointerDown/i.test(b.type)&&b.preventDefault(),c.hide(e);else{if(f.disable_for_touch&&Modernizr.touch&&/touchstart|MSPointerDown/i.test(b.type))return;!f.disable_for_touch&&Modernizr.touch&&/touchstart|MSPointerDown/i.test(b.type)&&(b.preventDefault(),d(f.tooltip_class+".open").hide(),g=!0),/enter|over/i.test(b.type)?this.timer=setTimeout(function(){c.showTip(e)}.bind(this),c.settings.hover_delay):"mouseout"===b.type||"mouseleave"===b.type?(clearTimeout(this.timer),c.hide(e)):c.showTip(e)}}).on("mouseleave.fndtn.tooltip touchstart.fndtn.tooltip MSPointerDown.fndtn.tooltip","["+this.attr_name()+"].open",function(b){return/mouse/i.test(b.type)&&c.ie_touch(b)?!1:void(("touch"!=a(this).data("tooltip-open-event-type")||"mouseleave"!=b.type)&&("mouse"==a(this).data("tooltip-open-event-type")&&/MSPointerDown|touchstart/i.test(b.type)?c.convert_to_touch(a(this)):c.hide(a(this))))}).on("DOMNodeRemoved DOMAttrModified","["+this.attr_name()+"]:not(a)",function(){c.hide(d(this))})},ie_touch:function(){return!1},showTip:function(a){var b=this.getTip(a);return this.should_show(a,b)?this.show(a):void 0},getTip:function(b){var c=this.selector(b),d=a.extend({},this.settings,this.data_options(b)),e=null;return c&&(e=this.S('span[data-selector="'+c+'"]'+d.tooltip_class)),"object"==typeof e?e:!1},selector:function(a){var b=a.attr("id"),c=a.attr(this.attr_name())||a.attr("data-selector");return(b&&b.length<1||!b)&&"string"!=typeof c&&(c=this.random_str(6),a.attr("data-selector",c).attr("aria-describedby",c)),b&&b.length>0?b:c},create:function(c){var d=this,e=a.extend({},this.settings,this.data_options(c)),f=this.settings.tip_template;"string"==typeof e.tip_template&&b.hasOwnProperty(e.tip_template)&&(f=b[e.tip_template]);var g=a(f(this.selector(c),a("<div></div>").html(c.attr("title")).html())),h=this.inheritable_classes(c);g.addClass(h).appendTo(e.append_to),Modernizr.touch&&(g.append('<span class="tap-to-close">'+e.touch_close_text+"</span>"),g.on("touchstart.fndtn.tooltip MSPointerDown.fndtn.tooltip",function(){d.hide(c)})),c.removeAttr("title").attr("title","")},reposition:function(b,c,d){var e,f,g,h,i;if(c.css("visibility","hidden").show(),e=b.data("width"),f=c.children(".nub"),g=f.outerHeight(),h=f.outerHeight(),c.css(this.small()?{width:"100%"}:{width:e?e:"auto"}),i=function(a,b,c,d,e){return a.css({top:b?b:"auto",bottom:d?d:"auto",left:e?e:"auto",right:c?c:"auto"}).end()},i(c,b.offset().top+b.outerHeight()+10,"auto","auto",b.offset().left),this.small())i(c,b.offset().top+b.outerHeight()+10,"auto","auto",12.5,a(this.scope).width()),c.addClass("tip-override"),i(f,-g,"auto","auto",b.offset().left);else{var j=b.offset().left;Foundation.rtl&&(f.addClass("rtl"),j=b.offset().left+b.outerWidth()-c.outerWidth()),i(c,b.offset().top+b.outerHeight()+10,"auto","auto",j),c.removeClass("tip-override"),d&&d.indexOf("tip-top")>-1?(Foundation.rtl&&f.addClass("rtl"),i(c,b.offset().top-c.outerHeight(),"auto","auto",j).removeClass("tip-override")):d&&d.indexOf("tip-left")>-1?(i(c,b.offset().top+b.outerHeight()/2-c.outerHeight()/2,"auto","auto",b.offset().left-c.outerWidth()-g).removeClass("tip-override"),f.removeClass("rtl")):d&&d.indexOf("tip-right")>-1&&(i(c,b.offset().top+b.outerHeight()/2-c.outerHeight()/2,"auto","auto",b.offset().left+b.outerWidth()+g).removeClass("tip-override"),f.removeClass("rtl"))}c.css("visibility","visible").hide()},small:function(){return matchMedia(Foundation.media_queries.small).matches&&!matchMedia(Foundation.media_queries.medium).matches},inheritable_classes:function(b){var c=a.extend({},this.settings,this.data_options(b)),d=["tip-top","tip-left","tip-bottom","tip-right","radius","round"].concat(c.additional_inheritable_classes),e=b.attr("class"),f=e?a.map(e.split(" "),function(b){return-1!==a.inArray(b,d)?b:void 0}).join(" "):"";return a.trim(f)},convert_to_touch:function(b){var c=this,d=c.getTip(b),e=a.extend({},c.settings,c.data_options(b));0===d.find(".tap-to-close").length&&(d.append('<span class="tap-to-close">'+e.touch_close_text+"</span>"),d.on("click.fndtn.tooltip.tapclose touchstart.fndtn.tooltip.tapclose MSPointerDown.fndtn.tooltip.tapclose",function(){c.hide(b)})),b.data("tooltip-open-event-type","touch")},show:function(a){var b=this.getTip(a);"touch"==a.data("tooltip-open-event-type")&&this.convert_to_touch(a),this.reposition(a,b,a.attr("class")),a.addClass("open"),b.fadeIn(150)},hide:function(a){var b=this.getTip(a);b.fadeOut(150,function(){b.find(".tap-to-close").remove(),b.off("click.fndtn.tooltip.tapclose MSPointerDown.fndtn.tapclose"),a.removeClass("open")})},off:function(){var b=this;this.S(this.scope).off(".fndtn.tooltip"),this.S(this.settings.tooltip_class).each(function(c){a("["+b.attr_name()+"]").eq(c).attr("title",a(this).text())}).remove()},reflow:function(){}}}(jQuery,window,window.document),function(a,b,c){"use strict";Foundation.libs.topbar={name:"topbar",version:"5.4.3",settings:{index:0,sticky_class:"sticky",custom_back_text:!0,back_text:"Back",mobile_show_parent_link:!0,is_hover:!0,scrolltop:!0,sticky_on:"all"},init:function(b,c,d){Foundation.inherit(this,"add_custom_rule register_media throttle");var e=this;e.register_media("topbar","foundation-mq-topbar"),this.bindings(c,d),e.S("["+this.attr_name()+"]",this.scope).each(function(){{var b=a(this),c=b.data(e.attr_name(!0)+"-init");e.S("section, .top-bar-section",this)}b.data("index",0);var d=b.parent();d.hasClass("fixed")||e.is_sticky(b,d,c)?(e.settings.sticky_class=c.sticky_class,e.settings.sticky_topbar=b,b.data("height",d.outerHeight()),b.data("stickyoffset",d.offset().top)):b.data("height",b.outerHeight()),c.assembled||e.assemble(b),c.is_hover?e.S(".has-dropdown",b).addClass("not-click"):e.S(".has-dropdown",b).removeClass("not-click"),e.add_custom_rule(".f-topbar-fixed { padding-top: "+b.data("height")+"px }"),d.hasClass("fixed")&&e.S("body").addClass("f-topbar-fixed")})},is_sticky:function(a,b,c){var d=b.hasClass(c.sticky_class);return d&&"all"===c.sticky_on?!0:d&&this.small()&&"small"===c.sticky_on?matchMedia(Foundation.media_queries.small).matches&&!matchMedia(Foundation.media_queries.medium).matches&&!matchMedia(Foundation.media_queries.large).matches:d&&this.medium()&&"medium"===c.sticky_on?matchMedia(Foundation.media_queries.small).matches&&matchMedia(Foundation.media_queries.medium).matches&&!matchMedia(Foundation.media_queries.large).matches:d&&this.large()&&"large"===c.sticky_on?matchMedia(Foundation.media_queries.small).matches&&matchMedia(Foundation.media_queries.medium).matches&&matchMedia(Foundation.media_queries.large).matches:!1},toggle:function(c){var d,e=this;d=c?e.S(c).closest("["+this.attr_name()+"]"):e.S("["+this.attr_name()+"]");var f=d.data(this.attr_name(!0)+"-init"),g=e.S("section, .top-bar-section",d);e.breakpoint()&&(e.rtl?(g.css({right:"0%"}),a(">.name",g).css({right:"100%"})):(g.css({left:"0%"}),a(">.name",g).css({left:"100%"})),e.S("li.moved",g).removeClass("moved"),d.data("index",0),d.toggleClass("expanded").css("height","")),f.scrolltop?d.hasClass("expanded")?d.parent().hasClass("fixed")&&(f.scrolltop?(d.parent().removeClass("fixed"),d.addClass("fixed"),e.S("body").removeClass("f-topbar-fixed"),b.scrollTo(0,0)):d.parent().removeClass("expanded")):d.hasClass("fixed")&&(d.parent().addClass("fixed"),d.removeClass("fixed"),e.S("body").addClass("f-topbar-fixed")):(e.is_sticky(d,d.parent(),f)&&d.parent().addClass("fixed"),d.parent().hasClass("fixed")&&(d.hasClass("expanded")?(d.addClass("fixed"),d.parent().addClass("expanded"),e.S("body").addClass("f-topbar-fixed")):(d.removeClass("fixed"),d.parent().removeClass("expanded"),e.update_sticky_positioning())))},timer:null,events:function(){var c=this,d=this.S;d(this.scope).off(".topbar").on("click.fndtn.topbar","["+this.attr_name()+"] .toggle-topbar",function(a){a.preventDefault(),c.toggle(this)}).on("click.fndtn.topbar",'.top-bar .top-bar-section li a[href^="#"],['+this.attr_name()+'] .top-bar-section li a[href^="#"]',function(){var b=a(this).closest("li");!c.breakpoint()||b.hasClass("back")||b.hasClass("has-dropdown")||c.toggle()}).on("click.fndtn.topbar","["+this.attr_name()+"] li.has-dropdown",function(b){var e=d(this),f=d(b.target),g=e.closest("["+c.attr_name()+"]"),h=g.data(c.attr_name(!0)+"-init");return f.data("revealId")?void c.toggle():void(c.breakpoint()||(!h.is_hover||Modernizr.touch)&&(b.stopImmediatePropagation(),e.hasClass("hover")?(e.removeClass("hover").find("li").removeClass("hover"),e.parents("li.hover").removeClass("hover")):(e.addClass("hover"),a(e).siblings().removeClass("hover"),"A"===f[0].nodeName&&f.parent().hasClass("has-dropdown")&&b.preventDefault())))}).on("click.fndtn.topbar","["+this.attr_name()+"] .has-dropdown>a",function(a){if(c.breakpoint()){a.preventDefault();var b=d(this),e=b.closest("["+c.attr_name()+"]"),f=e.find("section, .top-bar-section"),g=(b.next(".dropdown").outerHeight(),b.closest("li"));e.data("index",e.data("index")+1),g.addClass("moved"),c.rtl?(f.css({right:-(100*e.data("index"))+"%"}),f.find(">.name").css({right:100*e.data("index")+"%"})):(f.css({left:-(100*e.data("index"))+"%"}),f.find(">.name").css({left:100*e.data("index")+"%"})),e.css("height",b.siblings("ul").outerHeight(!0)+e.data("height"))}}),d(b).off(".topbar").on("resize.fndtn.topbar",c.throttle(function(){c.resize.call(c)},50)).trigger("resize").trigger("resize.fndtn.topbar").load(function(){d(this).trigger("resize.fndtn.topbar")}),d("body").off(".topbar").on("click.fndtn.topbar",function(a){var b=d(a.target).closest("li").closest("li.hover");b.length>0||d("["+c.attr_name()+"] li.hover").removeClass("hover")}),d(this.scope).on("click.fndtn.topbar","["+this.attr_name()+"] .has-dropdown .back",function(a){a.preventDefault();var b=d(this),e=b.closest("["+c.attr_name()+"]"),f=e.find("section, .top-bar-section"),g=(e.data(c.attr_name(!0)+"-init"),b.closest("li.moved")),h=g.parent();e.data("index",e.data("index")-1),c.rtl?(f.css({right:-(100*e.data("index"))+"%"}),f.find(">.name").css({right:100*e.data("index")+"%"})):(f.css({left:-(100*e.data("index"))+"%"}),f.find(">.name").css({left:100*e.data("index")+"%"})),0===e.data("index")?e.css("height",""):e.css("height",h.outerHeight(!0)+e.data("height")),setTimeout(function(){g.removeClass("moved")},300)}),d(this.scope).find(".dropdown a").focus(function(){a(this).parents(".has-dropdown").addClass("hover")}).blur(function(){a(this).parents(".has-dropdown").removeClass("hover")})},resize:function(){var a=this;a.S("["+this.attr_name()+"]").each(function(){var b,d=a.S(this),e=d.data(a.attr_name(!0)+"-init"),f=d.parent("."+a.settings.sticky_class);if(!a.breakpoint()){var g=d.hasClass("expanded");d.css("height","").removeClass("expanded").find("li").removeClass("hover"),g&&a.toggle(d)}a.is_sticky(d,f,e)&&(f.hasClass("fixed")?(f.removeClass("fixed"),b=f.offset().top,a.S(c.body).hasClass("f-topbar-fixed")&&(b-=d.data("height")),d.data("stickyoffset",b),f.addClass("fixed")):(b=f.offset().top,d.data("stickyoffset",b)))})},breakpoint:function(){return!matchMedia(Foundation.media_queries.topbar).matches},small:function(){return matchMedia(Foundation.media_queries.small).matches},medium:function(){return matchMedia(Foundation.media_queries.medium).matches},large:function(){return matchMedia(Foundation.media_queries.large).matches},assemble:function(b){var c=this,d=b.data(this.attr_name(!0)+"-init"),e=c.S("section, .top-bar-section",b);e.detach(),c.S(".has-dropdown>a",e).each(function(){var b,e=c.S(this),f=e.siblings(".dropdown"),g=e.attr("href");f.find(".title.back").length||(b=a(1==d.mobile_show_parent_link&&g?'<li class="title back js-generated"><h5><a href="javascript:void(0)"></a></h5></li><li class="parent-link show-for-small"><a class="parent-link js-generated" href="'+g+'">'+e.html()+"</a></li>":'<li class="title back js-generated"><h5><a href="javascript:void(0)"></a></h5>'),a("h5>a",b).html(1==d.custom_back_text?d.back_text:"&laquo; "+e.html()),f.prepend(b))}),e.appendTo(b),this.sticky(),this.assembled(b)},assembled:function(b){b.data(this.attr_name(!0),a.extend({},b.data(this.attr_name(!0)),{assembled:!0}))},height:function(b){var c=0,d=this;return a("> li",b).each(function(){c+=d.S(this).outerHeight(!0)}),c},sticky:function(){var a=this;this.S(b).on("scroll",function(){a.update_sticky_positioning()
})},update_sticky_positioning:function(){var a="."+this.settings.sticky_class,c=this.S(b),d=this;if(d.settings.sticky_topbar&&d.is_sticky(this.settings.sticky_topbar,this.settings.sticky_topbar.parent(),this.settings)){var e=this.settings.sticky_topbar.data("stickyoffset");d.S(a).hasClass("expanded")||(c.scrollTop()>e?d.S(a).hasClass("fixed")||(d.S(a).addClass("fixed"),d.S("body").addClass("f-topbar-fixed")):c.scrollTop()<=e&&d.S(a).hasClass("fixed")&&(d.S(a).removeClass("fixed"),d.S("body").removeClass("f-topbar-fixed")))}},off:function(){this.S(this.scope).off(".fndtn.topbar"),this.S(b).off(".fndtn.topbar")},reflow:function(){}}}(jQuery,window,window.document);