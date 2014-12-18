/**
 * ScreenManager - 
 * @version v1.0.0
 * @link 
 * @license MIT
**/
function (root, factory) {
  'use strict';
  // Set up ScreenManager appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['lodash', 'jquery'], function(_, $) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global ScreenManager.
      root.screens = factory(root, {}, _, $);
    });
  } else {
    // Finally, as a browser global.
    root.screens = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, container, _, $) {
  'use strict';
  /**
 * Runner handles the async loop and execute callbacks
 * @constructor
**/
function Runner() {
  this.run = _.bind(Runner.prototype.run, this);
  this.isRunning = false;
  this.frame = 0;
  this.callbacks = [];
  this.beforeunloadMethod = null;
}

Runner.prototype.constructor = Runner;

/**
 * start the async loop i
 *
**/
Runner.prototype.start = function start() {
  if (!this.isRunning) {
    this.isRunning = true;
    if (!this.beforeunloadMethod) {
      window.addEventListener('beforeunload', (this.beforeunloadMethod = _.bind(this.stop, this)), false);
    }
    this.loop();
  }
};

Runner.prototype.stop = function stop() {
  if (this.isRunning) {
    this.isRunning = false;
    if (typeof this.frame === 'number') {
      cancelAnimationFrame(this.frame);
      this.frame = null;
      if (this.beforeunloadMethod) {
        window.removeEventListener('beforeunload', this.beforeunloadMethod, false);
        this.beforeunload = null;
      }
    }
  }
};


Runner.prototype.add = function (callback, context, options) {
  options = options || {};
  if (typeof callback === 'function') {
    this.callbacks.push({
      'callback': callback,
      'context': context,
      'once': options.once || false
    });
  }
};

Runner.prototype.addOnce = function (callback, context) {
  this.add(callback, context, { 'once': true });
};

Runner.prototype.remove = function (callback, context) {
  var
    finder = _.identity,
    countRemoved = 0,
    valuesToRemove = [];
  if (callback && context) {
    finder = function (item) { return callback === item.callback && context === item.context; };
  } else if (callback) {
    finder = function (item) { return callback === item.callback; };
  } else {
    finder = function (item) { return context === item.context; };
  }
  valuesToRemove = _.filter(this.callbacks, finder);
  for (var index in valuesToRemove) {
    countRemoved += this.callbacks.splice(this.callbacks.indexOf(valuesToRemove[index]), 1).length;
  }
  return countRemoved;
};

Runner.prototype.loop = function loop() {
  this.frame = requestAnimationFrame(this.run);
};

Runner.prototype.run = function run(totaltime) {
  var item = {};
  var callbacks = this.callbacks.slice();
  container.time = totaltime;
  for (var index in callbacks) {
    item = callbacks[index];
    if (typeof item.callback === 'function') {
      item.context ? item.callback.call(item.context, totaltime) : item.callback(totaltime);
    }
    if (item.once) this.remove(item.callback, item.context);
  }
  if (this.isRunning) this.loop();
};

container.runner = new Runner();
function Screen(parent, id) {
  _.extend(this, BackboneEvents);
  this.id = id;
  this.parent = parent;
  this.$el = $(this.el = document.getElementById(id));
  this.isPopin = this.$el.hasClass('popin');
  this.animation = null;
  parent.screens.push(this);
}

Screen.prototype.constructor = Screen;

Screen.prototype.dispose = function dispose() {
  this.id = this.el = this.$el = this.parent = this.isPopin = null;
};

Screen.prototype.show = function show() {
  if (this.animation && this.animation.isRunning) this.animation.stop();
  this.animation = getInAnimation(this.el)
    .on('stop', function (event) { if (this.animation === event.target) this.animation = null; }, this)
    .start();
};

Screen.prototype.hide = function hide() {
  if (this.animation && this.animation.isRunning) this.animation.stop();
  (this.animation = getOutAnimation(this.el))
    .on('stop', function (event) { if (this.animation === event.target) this.animation = null; }, this)
    .start();
};

Screen.prototype.isVisible = function isVisible() {
  return this.$el.is(':visible') && !(this.animation && this.animation.isRunning);
};

Screen.prototype.reloadAfterError = _.identity;
var instances, singleton = {};

var ANIMATION_DURATION = 400;

function getInAnimation(relatedElement, interpolator) {
  return (interpolator || new LinearInterpolator(ANIMATION_DURATION, 0, 1))
    .on('start', function (event) {
      relatedElement.style.opacity = '0';
      relatedElement.style.display = 'block';
    })
    .on('step', function (event) {
      relatedElement.style.opacity = event.value;
    })
    .on('stop', function (event) {
      relatedElement.style.opacity = '1';
      relatedElement.style.display = 'block';
    });
};

function getOutAnimation(relatedElement, interpolator) {
  return (interpolator || new LinearInterpolator(ANIMATION_DURATION, 1, 0))
    .on('start', function (event) {
      relatedElement.style.opacity = '1';
      relatedElement.style.display = 'block';
    })
    .on('step', function (event) {
      relatedElement.style.opacity = event.value;
    })
    .on('stop', function (event) {
      relatedElement.style.opacity = '0';
      relatedElement.style.display = 'none';
    });
};

function ScreenManager() {
  _.extend(this, BackboneEvents);
  this.screens = [];
  container.screens = {};
}

ScreenManager.prototype.constructor = ScreenManager;

ScreenManager.prototype.dispose = function () {
  this.off();
  container.runner.stop();
  _.forEach(this.screens, function (screen) {
    if (screen) {
      container.screens[screen.id] = null;
      screen.dispose();
    }
  });
  if (this.viewport) {
    this.viewport.dispose();
  }
  this.viewport = this.screens = container.runner = null;
};

ScreenManager.prototype.initialize = function (timeline) {
  container.runner.start();
  this.viewport = new Viewport('game-viewport');
  if (!window.isMobile) this.viewport.keepRatio(640 / 1024);
  if (timeline && timeline.length) {
    _.forEach(timeline, function (screenDescription, index) {
      try {
        timeline[index] = container.screens[screenDescription.screenId] = new Game[screenDescription.type](instance, screenDescription.screenId);
    } catch (err) {
      throw err;
    }
    }, this);
    this.screens.concat(timeline);
  }
  this.trigger('load', { 'type': 'load', 'target': this });
  // Show directly without animations
  this.goTo(_.first(this.screens), { noanimations: true });
};

ScreenManager.prototype.reset = function () {
  return this.initialize();
};

ScreenManager.prototype.getDimensionAdaptedToViewport = function getDimensionAdaptedToViewport(size) {
  var viewportSize = instance.viewport.size;
  var finalPoint = new Point(viewportSize.x, size.y * (viewportSize.x / size.x));
  if (finalPoint.y > viewportSize.y) {
    finalPoint.setXY(size.x *(viewportSize.y / size.y), viewportSize.y);
  }
  return finalPoint;
};

ScreenManager.prototype.goTo = function (screen, options) {
  var
    screenIn, screenOut, animation, screenInNoAnimations = false, screenOutIsScreenAndInIsPopin,
    screenInProperty = 'Screen', screenOutProperty = 'Screen';
  options = options || {};
  if (screen instanceof container.Level && !screen.isFetched()) {
    screen.once('load', function () { ScreenManager.get().goTo(screen, options); });
    screen.fetch();
    return;
  }
  if (screen.isPopin) {
    screenInProperty = 'Popin';
  }
  if (this.isPopinOver()) {
    screenOutProperty = 'Popin';
  }
  screenOut = this['current' + screenOutProperty];
  screenIn = screen;

  screenInNoAnimations = screenIn === this.currentScreen || screenIn === this.lastScreen && this.currentScreen === null;
  screenOutIsScreenAndInIsPopin = screenIn.isPopin && screenOut && !screenOut.isPopin;// || screenOut && screenOut.isPopin && screenIn.isPopin;
  // change attribution for lastX if screens are the same type
  this['last' + screenOutProperty] = screenOut;
  this['current' + screenInProperty] = screenIn;
  if (screenOutProperty !== screenInProperty) this['current' + screenOutProperty] = null;

  // trigger screen events and start animations
  if (screenOut && screenOut.el) {
    screenOut.trigger('before:stop', { type: 'before:stop', target: screenOut, origin: this });
    if (options.noanimations || screenOutIsScreenAndInIsPopin) {
      screenOut.trigger('stop', { type: 'stop', target: screenOut, origin: this });
      if (!screenOutIsScreenAndInIsPopin) screenOut.$el.hide();
    } else {
      animation = getOutAnimation(screenOut.el);
      animation.on('stop', function () { screenOut.trigger('stop', { type: 'stop', target: screenOut, origin: this }); }, this);
      animation.start();
    }
  }
  if (screenIn && screenIn.el) {
    screenIn.trigger('before:start', { type: 'before:start', target: screenIn, origin: this });
    if (options.noanimations || screenInNoAnimations) {
      // no animations or popin is closing
      if (screenInNoAnimations) {
        screenIn.trigger('restart', { type: 'restart', target: screenIn, origin: this });
      }
      screenIn.trigger('start', { type: 'start', target: screenIn, origin: this });
      screenIn.$el.show();
    } else {
      animation = getInAnimation(screenIn.el);
      animation.on('stop', function () { screenIn.trigger('start', { type: 'start', target: screenIn, origin: this }); }, this);
      animation.start();
    }
  }
  this.trigger('change:screen', this);

  return screenIn;
};

ScreenManager.prototype.closePopin = function (screenOut) {
  this.goTo(this.currentScreen || this.lastScreen);
};

ScreenManager.prototype.isPopinOver = function () {
  return !!this.currentPopin;
};

ScreenManager.prototype.isActiveScreen = function (screen) {
  return this.isPopinOver() ? this.currentPopin === screen : this.currentScreen === screen;
};

ScreenManager.prototype.getNextScreen = function () {
  var index = _.indexOf(this.screens, this.popin || this.currentScreen);
  return (index > -1 && this.screens.length > index + 1 ? this.screens[index + 1] : null)
};
ScreenManager.prototype.hasNextScreen = function () {
  return _.indexOf(this.screens, this.popin || this.currentScreen) < this.screens.length - 1;
};

ScreenManager.prototype.getScreenById = function (screenId) {
  return container.screens[screenId] || null;
};

ScreenManager.get = function () {
  return (instance || (instance = new ScreenManager()));
};

ScreenManager.dispose = function () {
  if (instance) {
    instance.dispose();
    instance = null;
  }
};

container.createElement = function createElement(options) {
  var element = document.createElement(options.tagName || 'div');
  var keys = Object.keys(options.attributes || {}), index = -1, len = keys.length;
  while (++index < len) {
    element.setAttribute(keys[index], options.attributes[keys[index]]);
  }
  if (options.textContent) element.textContent = options.textContent;
  return element;
};


function Timer(duration) {
  _.extend(this, BackboneEvents);
  this.duration = duration;
  this.stepModulo = 10;
  this.stepCount = 0;
  this.beginAt = Number.MAX_VALUE;
}

Timer.prototype.constructor = Timer;

Timer.prototype.dispose = function () {};

Timer.prototype.step = function (totaltime) {
  this.stepCount += 1;
  if (this.stepCount % this.stepModulo === 0) {
    this.trigger('tick', this.createEvent('tick'));
  }
  if (this.isComplete()) {
    this.trigger('complete', this.createEvent('complete'));
    this.stop();
  }
};

Timer.prototype.start = function start() {
  if (!this.isRunning) {
    this.beginAt = container.time;
    this.stepCount = 0;
    container.runner.add(this.step, this);
    this.isRunning = true;
    this.trigger('start', this.createEvent('start'));
  }
};
Timer.prototype.stop = function stop() {
  if (this.isRunning) {
    container.runner.remove(this.step, this);
    this.isRunning = false;
    this.trigger('stop', this.createEvent('stop'));
  }
};
Timer.prototype.restart = function restart() {
  if (this.isRunning) {
    this.beginAt = container.time;
  } else {
    this.start();
  }
};

Timer.prototype.createEvent = function createEvent(type) {
  return { 'type': type, 'delta': this.getDelta(), 'duration': this.duration, 'beginAt': this.beginAt, 'target': this };
};

Timer.prototype.getDelta = function getDelta() {
  return container.time - this.beginAt;
};

Timer.prototype.isComplete = function isComplete() {
  return this.getDelta() >= this.duration;
};
function Viewport(id) {
  _.extend(this, BackboneEvents);
  this.id = id;
  this.el = (this.$el = $('#' + id))[0];
  this.screen = new Point();
  this.size   = new Point();
  this.ratio  = new Point(1, 1);
  this.$resizeElement = isMobile ? $(window) : this.$el;
  this.updateSize = _.debounce(_.bind(this.updateSize, this), 50);
  this.updateSize({ silent: true });
};

Viewport.prototype.constructor = Viewport;

Viewport.prototype.dispose = function dispose() {
  this.off().$el.off('resize', this.updateSize);
  this.updateSize = this.$el = this.el = this.id = this.size = this.ratio = null;
};

Viewport.prototype.updateSize = function (event) {
  this.$resizeElement.off('resize', this.updateSize);
  this.screen.setXY(this.$resizeElement.width(), this.$resizeElement.height());
  if (isMobile) {
    this.size.setXY(this.ratio.scl(this.screen));
  } else {
    this.size.setXY(this.ratio.scl(this.screen.x, this.screen.x));
  }
  this.$resizeElement
    .css('height', this.size.y)
    .css('width', this.size.x)
    .find('.screen:not(.popin)')
      .css('width', this.size.x)
      .css('height', this.size.y);
  if (!event.silent) this.trigger('resize', { size: this.size.clone(), screen: this.screen.clone(), origin: this });
  this.$resizeElement.on('resize', this.updateSize);
};

Viewport.prototype.keepRatio = function (ratio) {
  this.ratio.setXY(1, ratio);
  this.updateSize({ silent: true });
};
function TextDrawer(element, text, millisecondsByChar) {
  _.extend(this, BackboneEvents);
  this.set(element, text, millisecondsByChar);
  this.offset = 0;
  this.lastTime = 0;
  this.isRunning = false;
}

TextDrawer.prototype.constructor = TextDrawer;

TextDrawer.prototype.set = function (element, text, millisecondsByChar) {
  this.el = element;
  this.textTimeline = (text || []).slice();
  this.millisecondsByChar = millisecondsByChar || 17;
};

TextDrawer.prototype.start = function start() {
  if (!this.isRunning) {
    this.lastTime = container.time;
    this.offset = 0;
    container.runner.add(this.run, this);
    this.isRunning = true;
    this.trigger('start', this.createEvent('start'));
  }
};

TextDrawer.prototype.stop = function stop() {
  if (this.isRunning) {
    container.runner.remove(this.run, this);
    this.isRunning = false;
    this.trigger('stop', this.createEvent('stop'));
  }
};

TextDrawer.prototype.run = function run() {
  var delta = container.time - this.lastTime;

  if (!this.currentTagDescription) {
    this.currentTagDescription = this.textTimeline.shift();
    this.offset = 0;
    this.text = this.currentTagDescription.textContent || '';
    this.currentTagDescription.textContent = null;
    if (!this.currentTagDescription.tagName) this.currentTagDescription.tagName = 'span';
    this.currentDrawingElement = container.createElement(this.currentTagDescription);
    this.el.appendChild(this.currentDrawingElement);
  }

  this.offset += Math.ceil(delta / this.millisecondsByChar);
  if (this.offset > this.text.length) this.offset = this.text.length;
  if (this.offset > 0) {
    this.currentDrawingElement.textContent = this.text.substr(0, this.offset);
  }
  if (this.offset === this.text.length) {
    if (!this.textTimeline.length) {
      this.trigger('complete', this.createEvent('complete'));
      this.stop();
    } else {
      this.text = this.currentTagDescription = this.currentDrawingElement = null;
    }
  }

  this.lastTime = container.time;
};

TextDrawer.prototype.createEvent = function createEvent(type) {
  return { 'type': type, 'target': this, 'text': this.text, 'offset': this.offset, 'element': this.el };
};

/**
 * Represent a point in a 2D space
 * @constructor
 * @extends {object}
 * @param {number=} x
 * @param {number=} y
**/
function Point(x, y) {
  if (x instanceof Array) {
    y = x[1];
    x = x[0];
  } else if (typeof x === 'object' && _.isNumber(x.x) && _.isNumber(x.y)) {
    y = x.y;
    x = x.x;
  }
  /**
   * The x-coordinate of the shape
   * @type {number}
  **/
  this.x = x || 0;
  /**
   * The y-coordinate of the shape
   * @type {number}
  **/
  this.y = y || 0;
};

Point.prototype.constructor = Point;
Point.prototype.dispose = function dispose() {};
Point.prototype.clone = function clone() {
  return new Point(this);
};
/** @inheritsDoc **/
Point.prototype.toString = function toString() {
  return ('{ x: ' + this.x + ', y: ' + this.y + ' }');
};
/**
 *
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.add = function add(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  return new Point(this.x + x, this.y + y);
};
/**
 *
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.sub = function sub(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  return new Point(this.x - x, this.y - y);
};
/**
 *
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.scl = function scl(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  return new Point(this.x * x, this.y * y);
};
/**
 *
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.div = function div(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  return new Point(this.x / x, this.y / y);
};
/**
 * Set the x, y value of this instance
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.setXY = function setXY(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  this.x = x;
  this.y = y;
};
/**
 * calc the distance squared between this point and x, y coordinate
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.dst2 = function dst2(x, y) {
  if (x instanceof Point) {
    y = x.y;
    x = x.x;
  }
  return (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y);
};
/**
 * calc the distance between this point and x, y coordinate
 * @param {!(number|Point)} x
 * @param {?number} y
**/
Point.prototype.dst = function dst(x, y) {
  return Math.sqrt(this.dst2(x, y));
};

Point.prototype._useMathMethod = function _useMathMethod(name) {
  return new Point(Math[name](this.x), Math[name](this.y));
};

["floor", "ceil", "abs"].forEach(function (methodName) {
  Point.prototype[methodName] = function () { return this._useMathMethod(methodName); };
});
function LinearInterpolator(duration, from, to) {
  _.extend(this, BackboneEvents);
  this.value = 0;
  this.isRunning = false;
  this.autoLoop = false;
  this.run = _.bind(this.run, this);
  this.set(duration, from, to);
}

LinearInterpolator.prototype.constructor = LinearInterpolator;

LinearInterpolator.prototype.set = function set(duration, from, to) {
  this.duration = duration;
  this.from = from;
  this.to = to;
  this.side = this.to > this.from ? 1 : -1;
  this.step = Math.abs(this.to - this.from) / (duration / (50 / 3));
};

LinearInterpolator.prototype.start = function start() {
  if (this.isRunning) return;
  this.value = this.from;
  this.trigger('start', this.createEvent('start'));
  container.runner.add(this.run, this);
  this.isRunning = true;
};

LinearInterpolator.prototype.restart = function restart() {
  if (this.isRunning) {
    this.value = this.from;
    this.trigger('restart', this.createEvent('restart'));
  } else {
    this.start();
  }
};

LinearInterpolator.prototype.stop = function stop() {
  if (!this.isRunning) return;
  this.trigger('stop', this.createEvent('stop'));
  container.runner.remove(this.run, this);
  this.isRunning = false;
};

LinearInterpolator.prototype.run = function run(totaltime) {
  if (this.isComplete()) {
    if (!this.autoLoop && !this.autoReverse) {
      this.value = this.to;
      this.trigger('complete', this.createEvent('complete'));
      this.stop();
    } else if (this.autoLoop) {
      this.value = this.from + this.step - (Math.abs(this.to - this.value) * this.side);
    } else if (this.autoReverse) {
      this.reverse();
    }
  } else {
    this.value += this.step * this.side;
    this.trigger('step', this.createEvent('step'));
  }
};

LinearInterpolator.prototype.reverse = function reverse() {
  var from = this.from;
  this.side = -this.side;
  this.from = this.to;
  this.to = from;
};

LinearInterpolator.prototype.createEvent = function createEvent(type) {
  return { 'type': type, 'from': this.from, 'to': this.to, 'value': this.value, 'delta': this.step * this.side, 'duration': this.duration, 'target': this };
};

LinearInterpolator.prototype.isComplete = function isComplete() {
  return this.side === 1 && this.value + this.step > this.to || this.side === -1 && this.value - this.step < this.to;
};

/**
 * Clone the instance of animation with constructor attributes
 * The clone will not running
 * @returns {LinearInterpolator}
**/
LinearInterpolator.prototype.clone = function () {
  var clone = new LinearInterpolator(this.duration, this.from, this.to);
  if (this.run !== LinearInterpolator.prototype.run) clone.run = this.run;
  return clone;
};
  return container;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlJ1bm5lci5qcyIsIlNjcmVlbi5qcyIsIlNjcmVlbk1hbmFnZXIuanMiLCJUaW1lci5qcyIsIlZpZXdwb3J0LmpzIiwiYW5pbWF0aW9ucy9UZXh0RHJhd2VyLmpzIiwiZ2VvbWV0cnkvUG9pbnQuanMiLCJpbnRlcnBvbGF0b3JzL0xpbmVhckludGVycG9sYXRvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJTY3JlZW5NYW5hZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSdW5uZXIgaGFuZGxlcyB0aGUgYXN5bmMgbG9vcCBhbmQgZXhlY3V0ZSBjYWxsYmFja3NcbiAqIEBjb25zdHJ1Y3RvclxuKiovXG5mdW5jdGlvbiBSdW5uZXIoKSB7XG4gIHRoaXMucnVuID0gXy5iaW5kKFJ1bm5lci5wcm90b3R5cGUucnVuLCB0aGlzKTtcbiAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgdGhpcy5mcmFtZSA9IDA7XG4gIHRoaXMuY2FsbGJhY2tzID0gW107XG4gIHRoaXMuYmVmb3JldW5sb2FkTWV0aG9kID0gbnVsbDtcbn1cblxuUnVubmVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFJ1bm5lcjtcblxuLyoqXG4gKiBzdGFydCB0aGUgYXN5bmMgbG9vcCBpXG4gKlxuKiovXG5SdW5uZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gc3RhcnQoKSB7XG4gIGlmICghdGhpcy5pc1J1bm5pbmcpIHtcbiAgICB0aGlzLmlzUnVubmluZyA9IHRydWU7XG4gICAgaWYgKCF0aGlzLmJlZm9yZXVubG9hZE1ldGhvZCkge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsICh0aGlzLmJlZm9yZXVubG9hZE1ldGhvZCA9IF8uYmluZCh0aGlzLnN0b3AsIHRoaXMpKSwgZmFsc2UpO1xuICAgIH1cbiAgICB0aGlzLmxvb3AoKTtcbiAgfVxufTtcblxuUnVubmVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gc3RvcCgpIHtcbiAgaWYgKHRoaXMuaXNSdW5uaW5nKSB7XG4gICAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHRoaXMuZnJhbWUgPT09ICdudW1iZXInKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmZyYW1lKTtcbiAgICAgIHRoaXMuZnJhbWUgPSBudWxsO1xuICAgICAgaWYgKHRoaXMuYmVmb3JldW5sb2FkTWV0aG9kKSB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCB0aGlzLmJlZm9yZXVubG9hZE1ldGhvZCwgZmFsc2UpO1xuICAgICAgICB0aGlzLmJlZm9yZXVubG9hZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuXG5cblJ1bm5lci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBjb250ZXh0LCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5jYWxsYmFja3MucHVzaCh7XG4gICAgICAnY2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjb250ZXh0JzogY29udGV4dCxcbiAgICAgICdvbmNlJzogb3B0aW9ucy5vbmNlIHx8wqBmYWxzZVxuICAgIH0pO1xuICB9XG59O1xuXG5SdW5uZXIucHJvdG90eXBlLmFkZE9uY2UgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgdGhpcy5hZGQoY2FsbGJhY2ssIGNvbnRleHQsIHsgJ29uY2UnOiB0cnVlIH0pO1xufTtcblxuUnVubmVyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgdmFyXG4gICAgZmluZGVyID0gXy5pZGVudGl0eSxcbiAgICBjb3VudFJlbW92ZWQgPSAwLFxuICAgIHZhbHVlc1RvUmVtb3ZlID0gW107XG4gIGlmIChjYWxsYmFjayAmJiBjb250ZXh0KSB7XG4gICAgZmluZGVyID0gZnVuY3Rpb24gKGl0ZW0pIHsgcmV0dXJuIGNhbGxiYWNrID09PSBpdGVtLmNhbGxiYWNrICYmIGNvbnRleHQgPT09IGl0ZW0uY29udGV4dDsgfTtcbiAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgIGZpbmRlciA9IGZ1bmN0aW9uIChpdGVtKSB7IHJldHVybiBjYWxsYmFjayA9PT0gaXRlbS5jYWxsYmFjazsgfTtcbiAgfSBlbHNlIHtcbiAgICBmaW5kZXIgPSBmdW5jdGlvbiAoaXRlbSkgeyByZXR1cm4gY29udGV4dCA9PT0gaXRlbS5jb250ZXh0OyB9O1xuICB9XG4gIHZhbHVlc1RvUmVtb3ZlID0gXy5maWx0ZXIodGhpcy5jYWxsYmFja3MsIGZpbmRlcik7XG4gIGZvciAodmFyIGluZGV4IGluIHZhbHVlc1RvUmVtb3ZlKSB7XG4gICAgY291bnRSZW1vdmVkICs9IHRoaXMuY2FsbGJhY2tzLnNwbGljZSh0aGlzLmNhbGxiYWNrcy5pbmRleE9mKHZhbHVlc1RvUmVtb3ZlW2luZGV4XSksIDEpLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gY291bnRSZW1vdmVkO1xufTtcblxuUnVubmVyLnByb3RvdHlwZS5sb29wID0gZnVuY3Rpb24gbG9vcCgpIHtcbiAgdGhpcy5mcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJ1bik7XG59O1xuXG5SdW5uZXIucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uIHJ1bih0b3RhbHRpbWUpIHtcbiAgdmFyIGl0ZW0gPSB7fTtcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzLnNsaWNlKCk7XG4gIGNvbnRhaW5lci50aW1lID0gdG90YWx0aW1lO1xuICBmb3IgKHZhciBpbmRleCBpbiBjYWxsYmFja3MpIHtcbiAgICBpdGVtID0gY2FsbGJhY2tzW2luZGV4XTtcbiAgICBpZiAodHlwZW9mIGl0ZW0uY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGl0ZW0uY29udGV4dCA/IGl0ZW0uY2FsbGJhY2suY2FsbChpdGVtLmNvbnRleHQsIHRvdGFsdGltZSkgOiBpdGVtLmNhbGxiYWNrKHRvdGFsdGltZSk7XG4gICAgfVxuICAgIGlmIChpdGVtLm9uY2UpIHRoaXMucmVtb3ZlKGl0ZW0uY2FsbGJhY2ssIGl0ZW0uY29udGV4dCk7XG4gIH1cbiAgaWYgKHRoaXMuaXNSdW5uaW5nKSB0aGlzLmxvb3AoKTtcbn07XG5cbmNvbnRhaW5lci5ydW5uZXIgPSBuZXcgUnVubmVyKCk7IiwiZnVuY3Rpb24gU2NyZWVuKHBhcmVudCwgaWQpIHtcbiAgXy5leHRlbmQodGhpcywgQmFja2JvbmVFdmVudHMpO1xuICB0aGlzLmlkID0gaWQ7XG4gIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICB0aGlzLiRlbCA9ICQodGhpcy5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKSk7XG4gIHRoaXMuaXNQb3BpbiA9IHRoaXMuJGVsLmhhc0NsYXNzKCdwb3BpbicpO1xuICB0aGlzLmFuaW1hdGlvbiA9IG51bGw7XG4gIHBhcmVudC5zY3JlZW5zLnB1c2godGhpcyk7XG59XG5cblNjcmVlbi5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTY3JlZW47XG5cblNjcmVlbi5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gIHRoaXMuaWQgPSB0aGlzLmVsID0gdGhpcy4kZWwgPSB0aGlzLnBhcmVudCA9IHRoaXMuaXNQb3BpbiA9IG51bGw7XG59O1xuXG5TY3JlZW4ucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KCkge1xuICBpZiAodGhpcy5hbmltYXRpb24gJiYgdGhpcy5hbmltYXRpb24uaXNSdW5uaW5nKSB0aGlzLmFuaW1hdGlvbi5zdG9wKCk7XG4gIHRoaXMuYW5pbWF0aW9uID0gZ2V0SW5BbmltYXRpb24odGhpcy5lbClcbiAgICAub24oJ3N0b3AnLCBmdW5jdGlvbiAoZXZlbnQpIHsgaWYgKHRoaXMuYW5pbWF0aW9uID09PSBldmVudC50YXJnZXQpIHRoaXMuYW5pbWF0aW9uID0gbnVsbDsgfSwgdGhpcylcbiAgICAuc3RhcnQoKTtcbn07XG5cblNjcmVlbi5wcm90b3R5cGUuaGlkZSA9IGZ1bmN0aW9uIGhpZGUoKSB7XG4gIGlmICh0aGlzLmFuaW1hdGlvbiAmJiB0aGlzLmFuaW1hdGlvbi5pc1J1bm5pbmcpIHRoaXMuYW5pbWF0aW9uLnN0b3AoKTtcbiAgKHRoaXMuYW5pbWF0aW9uID0gZ2V0T3V0QW5pbWF0aW9uKHRoaXMuZWwpKVxuICAgIC5vbignc3RvcCcsIGZ1bmN0aW9uIChldmVudCkgeyBpZiAodGhpcy5hbmltYXRpb24gPT09IGV2ZW50LnRhcmdldCkgdGhpcy5hbmltYXRpb24gPSBudWxsOyB9LCB0aGlzKVxuICAgIC5zdGFydCgpO1xufTtcblxuU2NyZWVuLnByb3RvdHlwZS5pc1Zpc2libGUgPSBmdW5jdGlvbiBpc1Zpc2libGUoKSB7XG4gIHJldHVybiB0aGlzLiRlbC5pcygnOnZpc2libGUnKSAmJiAhKHRoaXMuYW5pbWF0aW9uICYmIHRoaXMuYW5pbWF0aW9uLmlzUnVubmluZyk7XG59O1xuXG5TY3JlZW4ucHJvdG90eXBlLnJlbG9hZEFmdGVyRXJyb3IgPSBfLmlkZW50aXR5OyIsInZhciBpbnN0YW5jZXMsIHNpbmdsZXRvbiA9IHt9O1xuXG52YXIgQU5JTUFUSU9OX0RVUkFUSU9OID0gNDAwO1xuXG5mdW5jdGlvbiBnZXRJbkFuaW1hdGlvbihyZWxhdGVkRWxlbWVudCwgaW50ZXJwb2xhdG9yKSB7XG4gIHJldHVybiAoaW50ZXJwb2xhdG9yIHx8IG5ldyBMaW5lYXJJbnRlcnBvbGF0b3IoQU5JTUFUSU9OX0RVUkFUSU9OLCAwLCAxKSlcbiAgICAub24oJ3N0YXJ0JywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICByZWxhdGVkRWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgcmVsYXRlZEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgfSlcbiAgICAub24oJ3N0ZXAnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHJlbGF0ZWRFbGVtZW50LnN0eWxlLm9wYWNpdHkgPSBldmVudC52YWx1ZTtcbiAgICB9KVxuICAgIC5vbignc3RvcCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgcmVsYXRlZEVsZW1lbnQuc3R5bGUub3BhY2l0eSA9ICcxJztcbiAgICAgIHJlbGF0ZWRFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH0pO1xufTtcblxuZnVuY3Rpb24gZ2V0T3V0QW5pbWF0aW9uKHJlbGF0ZWRFbGVtZW50LCBpbnRlcnBvbGF0b3IpIHtcbiAgcmV0dXJuIChpbnRlcnBvbGF0b3IgfHwgbmV3IExpbmVhckludGVycG9sYXRvcihBTklNQVRJT05fRFVSQVRJT04sIDEsIDApKVxuICAgIC5vbignc3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHJlbGF0ZWRFbGVtZW50LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG4gICAgICByZWxhdGVkRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9KVxuICAgIC5vbignc3RlcCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgcmVsYXRlZEVsZW1lbnQuc3R5bGUub3BhY2l0eSA9IGV2ZW50LnZhbHVlO1xuICAgIH0pXG4gICAgLm9uKCdzdG9wJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICByZWxhdGVkRWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgcmVsYXRlZEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9KTtcbn07XG5cbmZ1bmN0aW9uIFNjcmVlbk1hbmFnZXIoKSB7XG4gIF8uZXh0ZW5kKHRoaXMsIEJhY2tib25lRXZlbnRzKTtcbiAgdGhpcy5zY3JlZW5zID0gW107XG4gIGNvbnRhaW5lci5zY3JlZW5zID0ge307XG59XG5cblNjcmVlbk1hbmFnZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU2NyZWVuTWFuYWdlcjtcblxuU2NyZWVuTWFuYWdlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5vZmYoKTtcbiAgY29udGFpbmVyLnJ1bm5lci5zdG9wKCk7XG4gIF8uZm9yRWFjaCh0aGlzLnNjcmVlbnMsIGZ1bmN0aW9uIChzY3JlZW4pIHtcbiAgICBpZiAoc2NyZWVuKSB7XG4gICAgICBjb250YWluZXIuc2NyZWVuc1tzY3JlZW4uaWRdID0gbnVsbDtcbiAgICAgIHNjcmVlbi5kaXNwb3NlKCk7XG4gICAgfVxuICB9KTtcbiAgaWYgKHRoaXMudmlld3BvcnQpIHtcbiAgICB0aGlzLnZpZXdwb3J0LmRpc3Bvc2UoKTtcbiAgfVxuICB0aGlzLnZpZXdwb3J0ID0gdGhpcy5zY3JlZW5zID0gY29udGFpbmVyLnJ1bm5lciA9IG51bGw7XG59O1xuXG5TY3JlZW5NYW5hZ2VyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKHRpbWVsaW5lKSB7XG4gIGNvbnRhaW5lci5ydW5uZXIuc3RhcnQoKTtcbiAgdGhpcy52aWV3cG9ydCA9IG5ldyBWaWV3cG9ydCgnZ2FtZS12aWV3cG9ydCcpO1xuICBpZiAoIXdpbmRvdy5pc01vYmlsZSkgdGhpcy52aWV3cG9ydC5rZWVwUmF0aW8oNjQwIC8gMTAyNCk7XG4gIGlmICh0aW1lbGluZSAmJiB0aW1lbGluZS5sZW5ndGgpIHtcbiAgICBfLmZvckVhY2godGltZWxpbmUsIGZ1bmN0aW9uIChzY3JlZW5EZXNjcmlwdGlvbiwgaW5kZXgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRpbWVsaW5lW2luZGV4XSA9IGNvbnRhaW5lci5zY3JlZW5zW3NjcmVlbkRlc2NyaXB0aW9uLnNjcmVlbklkXSA9IG5ldyBHYW1lW3NjcmVlbkRlc2NyaXB0aW9uLnR5cGVdKGluc3RhbmNlLCBzY3JlZW5EZXNjcmlwdGlvbi5zY3JlZW5JZCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIH0sIHRoaXMpO1xuICAgIHRoaXMuc2NyZWVucy5jb25jYXQodGltZWxpbmUpO1xuICB9XG4gIHRoaXMudHJpZ2dlcignbG9hZCcsIHsgJ3R5cGUnOiAnbG9hZCcsICd0YXJnZXQnOiB0aGlzIH0pO1xuICAvLyBTaG93IGRpcmVjdGx5IHdpdGhvdXQgYW5pbWF0aW9uc1xuICB0aGlzLmdvVG8oXy5maXJzdCh0aGlzLnNjcmVlbnMpLCB7IG5vYW5pbWF0aW9uczogdHJ1ZSB9KTtcbn07XG5cblNjcmVlbk1hbmFnZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5pbml0aWFsaXplKCk7XG59O1xuXG5TY3JlZW5NYW5hZ2VyLnByb3RvdHlwZS5nZXREaW1lbnNpb25BZGFwdGVkVG9WaWV3cG9ydCA9IGZ1bmN0aW9uIGdldERpbWVuc2lvbkFkYXB0ZWRUb1ZpZXdwb3J0KHNpemUpIHtcbiAgdmFyIHZpZXdwb3J0U2l6ZSA9IGluc3RhbmNlLnZpZXdwb3J0LnNpemU7XG4gIHZhciBmaW5hbFBvaW50ID0gbmV3IFBvaW50KHZpZXdwb3J0U2l6ZS54LCBzaXplLnkgKiAodmlld3BvcnRTaXplLnggLyBzaXplLngpKTtcbiAgaWYgKGZpbmFsUG9pbnQueSA+IHZpZXdwb3J0U2l6ZS55KSB7XG4gICAgZmluYWxQb2ludC5zZXRYWShzaXplLnggKih2aWV3cG9ydFNpemUueSAvIHNpemUueSksIHZpZXdwb3J0U2l6ZS55KTtcbiAgfVxuICByZXR1cm4gZmluYWxQb2ludDtcbn07XG5cblNjcmVlbk1hbmFnZXIucHJvdG90eXBlLmdvVG8gPSBmdW5jdGlvbiAoc2NyZWVuLCBvcHRpb25zKSB7XG4gIHZhclxuICAgIHNjcmVlbkluLCBzY3JlZW5PdXQsIGFuaW1hdGlvbiwgc2NyZWVuSW5Ob0FuaW1hdGlvbnMgPSBmYWxzZSwgc2NyZWVuT3V0SXNTY3JlZW5BbmRJbklzUG9waW4sXG4gICAgc2NyZWVuSW5Qcm9wZXJ0eSA9ICdTY3JlZW4nLCBzY3JlZW5PdXRQcm9wZXJ0eSA9ICdTY3JlZW4nO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKHNjcmVlbiBpbnN0YW5jZW9mIGNvbnRhaW5lci5MZXZlbCAmJiAhc2NyZWVuLmlzRmV0Y2hlZCgpKSB7XG4gICAgc2NyZWVuLm9uY2UoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7IFNjcmVlbk1hbmFnZXIuZ2V0KCkuZ29UbyhzY3JlZW4sIG9wdGlvbnMpOyB9KTtcbiAgICBzY3JlZW4uZmV0Y2goKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHNjcmVlbi5pc1BvcGluKSB7XG4gICAgc2NyZWVuSW5Qcm9wZXJ0eSA9ICdQb3Bpbic7XG4gIH1cbiAgaWYgKHRoaXMuaXNQb3Bpbk92ZXIoKSkge1xuICAgIHNjcmVlbk91dFByb3BlcnR5ID0gJ1BvcGluJztcbiAgfVxuICBzY3JlZW5PdXQgPSB0aGlzWydjdXJyZW50JyArIHNjcmVlbk91dFByb3BlcnR5XTtcbiAgc2NyZWVuSW4gPSBzY3JlZW47XG5cbiAgc2NyZWVuSW5Ob0FuaW1hdGlvbnMgPSBzY3JlZW5JbiA9PT0gdGhpcy5jdXJyZW50U2NyZWVuIHx8IHNjcmVlbkluID09PSB0aGlzLmxhc3RTY3JlZW4gJiYgdGhpcy5jdXJyZW50U2NyZWVuID09PSBudWxsO1xuICBzY3JlZW5PdXRJc1NjcmVlbkFuZEluSXNQb3BpbiA9IHNjcmVlbkluLmlzUG9waW4gJiYgc2NyZWVuT3V0ICYmICFzY3JlZW5PdXQuaXNQb3BpbjsvLyB8fCBzY3JlZW5PdXQgJiYgc2NyZWVuT3V0LmlzUG9waW4gJiYgc2NyZWVuSW4uaXNQb3BpbjtcbiAgLy8gY2hhbmdlIGF0dHJpYnV0aW9uIGZvciBsYXN0WCBpZiBzY3JlZW5zIGFyZSB0aGUgc2FtZSB0eXBlXG4gIHRoaXNbJ2xhc3QnICsgc2NyZWVuT3V0UHJvcGVydHldID0gc2NyZWVuT3V0O1xuICB0aGlzWydjdXJyZW50JyArIHNjcmVlbkluUHJvcGVydHldID0gc2NyZWVuSW47XG4gIGlmIChzY3JlZW5PdXRQcm9wZXJ0eSAhPT0gc2NyZWVuSW5Qcm9wZXJ0eSkgdGhpc1snY3VycmVudCcgKyBzY3JlZW5PdXRQcm9wZXJ0eV0gPSBudWxsO1xuXG4gIC8vIHRyaWdnZXIgc2NyZWVuIGV2ZW50cyBhbmQgc3RhcnQgYW5pbWF0aW9uc1xuICBpZiAoc2NyZWVuT3V0ICYmIHNjcmVlbk91dC5lbCkge1xuICAgIHNjcmVlbk91dC50cmlnZ2VyKCdiZWZvcmU6c3RvcCcsIHsgdHlwZTogJ2JlZm9yZTpzdG9wJywgdGFyZ2V0OiBzY3JlZW5PdXQsIG9yaWdpbjogdGhpcyB9KTtcbiAgICBpZiAob3B0aW9ucy5ub2FuaW1hdGlvbnMgfHwgc2NyZWVuT3V0SXNTY3JlZW5BbmRJbklzUG9waW4pIHtcbiAgICAgIHNjcmVlbk91dC50cmlnZ2VyKCdzdG9wJywgeyB0eXBlOiAnc3RvcCcsIHRhcmdldDogc2NyZWVuT3V0LCBvcmlnaW46IHRoaXMgfSk7XG4gICAgICBpZiAoIXNjcmVlbk91dElzU2NyZWVuQW5kSW5Jc1BvcGluKSBzY3JlZW5PdXQuJGVsLmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYW5pbWF0aW9uID0gZ2V0T3V0QW5pbWF0aW9uKHNjcmVlbk91dC5lbCk7XG4gICAgICBhbmltYXRpb24ub24oJ3N0b3AnLCBmdW5jdGlvbiAoKSB7IHNjcmVlbk91dC50cmlnZ2VyKCdzdG9wJywgeyB0eXBlOiAnc3RvcCcsIHRhcmdldDogc2NyZWVuT3V0LCBvcmlnaW46IHRoaXMgfSk7IH0sIHRoaXMpO1xuICAgICAgYW5pbWF0aW9uLnN0YXJ0KCk7XG4gICAgfVxuICB9XG4gIGlmIChzY3JlZW5JbiAmJiBzY3JlZW5Jbi5lbCkge1xuICAgIHNjcmVlbkluLnRyaWdnZXIoJ2JlZm9yZTpzdGFydCcsIHsgdHlwZTogJ2JlZm9yZTpzdGFydCcsIHRhcmdldDogc2NyZWVuSW4sIG9yaWdpbjogdGhpcyB9KTtcbiAgICBpZiAob3B0aW9ucy5ub2FuaW1hdGlvbnMgfHwgc2NyZWVuSW5Ob0FuaW1hdGlvbnMpIHtcbiAgICAgIC8vIG5vIGFuaW1hdGlvbnMgb3IgcG9waW4gaXMgY2xvc2luZ1xuICAgICAgaWYgKHNjcmVlbkluTm9BbmltYXRpb25zKSB7XG4gICAgICAgIHNjcmVlbkluLnRyaWdnZXIoJ3Jlc3RhcnQnLCB7IHR5cGU6ICdyZXN0YXJ0JywgdGFyZ2V0OiBzY3JlZW5Jbiwgb3JpZ2luOiB0aGlzIH0pO1xuICAgICAgfVxuICAgICAgc2NyZWVuSW4udHJpZ2dlcignc3RhcnQnLCB7IHR5cGU6ICdzdGFydCcsIHRhcmdldDogc2NyZWVuSW4sIG9yaWdpbjogdGhpcyB9KTtcbiAgICAgIHNjcmVlbkluLiRlbC5zaG93KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFuaW1hdGlvbiA9IGdldEluQW5pbWF0aW9uKHNjcmVlbkluLmVsKTtcbiAgICAgIGFuaW1hdGlvbi5vbignc3RvcCcsIGZ1bmN0aW9uICgpIHsgc2NyZWVuSW4udHJpZ2dlcignc3RhcnQnLCB7IHR5cGU6ICdzdGFydCcsIHRhcmdldDogc2NyZWVuSW4sIG9yaWdpbjogdGhpcyB9KTsgfSwgdGhpcyk7XG4gICAgICBhbmltYXRpb24uc3RhcnQoKTtcbiAgICB9XG4gIH1cbiAgdGhpcy50cmlnZ2VyKCdjaGFuZ2U6c2NyZWVuJywgdGhpcyk7XG5cbiAgcmV0dXJuIHNjcmVlbkluO1xufTtcblxuU2NyZWVuTWFuYWdlci5wcm90b3R5cGUuY2xvc2VQb3BpbiA9IGZ1bmN0aW9uIChzY3JlZW5PdXQpIHtcbiAgdGhpcy5nb1RvKHRoaXMuY3VycmVudFNjcmVlbiB8fCB0aGlzLmxhc3RTY3JlZW4pO1xufTtcblxuU2NyZWVuTWFuYWdlci5wcm90b3R5cGUuaXNQb3Bpbk92ZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAhIXRoaXMuY3VycmVudFBvcGluO1xufTtcblxuU2NyZWVuTWFuYWdlci5wcm90b3R5cGUuaXNBY3RpdmVTY3JlZW4gPSBmdW5jdGlvbiAoc2NyZWVuKSB7XG4gIHJldHVybiB0aGlzLmlzUG9waW5PdmVyKCkgPyB0aGlzLmN1cnJlbnRQb3BpbiA9PT0gc2NyZWVuIDogdGhpcy5jdXJyZW50U2NyZWVuID09PSBzY3JlZW47XG59O1xuXG5TY3JlZW5NYW5hZ2VyLnByb3RvdHlwZS5nZXROZXh0U2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICB2YXIgaW5kZXggPSBfLmluZGV4T2YodGhpcy5zY3JlZW5zLCB0aGlzLnBvcGluIHx8IHRoaXMuY3VycmVudFNjcmVlbik7XG4gIHJldHVybiAoaW5kZXggPiAtMSAmJiB0aGlzLnNjcmVlbnMubGVuZ3RoID4gaW5kZXggKyAxID8gdGhpcy5zY3JlZW5zW2luZGV4ICsgMV0gOiBudWxsKVxufTtcblNjcmVlbk1hbmFnZXIucHJvdG90eXBlLmhhc05leHRTY3JlZW4gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBfLmluZGV4T2YodGhpcy5zY3JlZW5zLCB0aGlzLnBvcGluIHx8IHRoaXMuY3VycmVudFNjcmVlbikgPCB0aGlzLnNjcmVlbnMubGVuZ3RoIC0gMTtcbn07XG5cblNjcmVlbk1hbmFnZXIucHJvdG90eXBlLmdldFNjcmVlbkJ5SWQgPSBmdW5jdGlvbiAoc2NyZWVuSWQpIHtcbiAgcmV0dXJuIGNvbnRhaW5lci5zY3JlZW5zW3NjcmVlbklkXSB8fCBudWxsO1xufTtcblxuU2NyZWVuTWFuYWdlci5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAoaW5zdGFuY2UgfHwgKGluc3RhbmNlID0gbmV3IFNjcmVlbk1hbmFnZXIoKSkpO1xufTtcblxuU2NyZWVuTWFuYWdlci5kaXNwb3NlID0gZnVuY3Rpb24gKCkge1xuICBpZiAoaW5zdGFuY2UpIHtcbiAgICBpbnN0YW5jZS5kaXNwb3NlKCk7XG4gICAgaW5zdGFuY2UgPSBudWxsO1xuICB9XG59O1xuXG5jb250YWluZXIuY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQob3B0aW9ucykge1xuICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQob3B0aW9ucy50YWdOYW1lIHx8ICdkaXYnKTtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvcHRpb25zLmF0dHJpYnV0ZXMgfHwge30pLCBpbmRleCA9IC0xLCBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKCsraW5kZXggPCBsZW4pIHtcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShrZXlzW2luZGV4XSwgb3B0aW9ucy5hdHRyaWJ1dGVzW2tleXNbaW5kZXhdXSk7XG4gIH1cbiAgaWYgKG9wdGlvbnMudGV4dENvbnRlbnQpIGVsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb25zLnRleHRDb250ZW50O1xuICByZXR1cm4gZWxlbWVudDtcbn07XG5cbiIsImZ1bmN0aW9uIFRpbWVyKGR1cmF0aW9uKSB7XG4gIF8uZXh0ZW5kKHRoaXMsIEJhY2tib25lRXZlbnRzKTtcbiAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICB0aGlzLnN0ZXBNb2R1bG8gPSAxMDtcbiAgdGhpcy5zdGVwQ291bnQgPSAwO1xuICB0aGlzLmJlZ2luQXQgPSBOdW1iZXIuTUFYX1ZBTFVFO1xufVxuXG5UaW1lci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBUaW1lcjtcblxuVGltZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiAoKSB7fTtcblxuVGltZXIucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbiAodG90YWx0aW1lKSB7XG4gIHRoaXMuc3RlcENvdW50ICs9IDE7XG4gIGlmICh0aGlzLnN0ZXBDb3VudCAlIHRoaXMuc3RlcE1vZHVsbyA9PT0gMCkge1xuICAgIHRoaXMudHJpZ2dlcigndGljaycsIHRoaXMuY3JlYXRlRXZlbnQoJ3RpY2snKSk7XG4gIH1cbiAgaWYgKHRoaXMuaXNDb21wbGV0ZSgpKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdjb21wbGV0ZScsIHRoaXMuY3JlYXRlRXZlbnQoJ2NvbXBsZXRlJykpO1xuICAgIHRoaXMuc3RvcCgpO1xuICB9XG59O1xuXG5UaW1lci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiBzdGFydCgpIHtcbiAgaWYgKCF0aGlzLmlzUnVubmluZykge1xuICAgIHRoaXMuYmVnaW5BdCA9IGNvbnRhaW5lci50aW1lO1xuICAgIHRoaXMuc3RlcENvdW50ID0gMDtcbiAgICBjb250YWluZXIucnVubmVyLmFkZCh0aGlzLnN0ZXAsIHRoaXMpO1xuICAgIHRoaXMuaXNSdW5uaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3N0YXJ0JywgdGhpcy5jcmVhdGVFdmVudCgnc3RhcnQnKSk7XG4gIH1cbn07XG5UaW1lci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIHN0b3AoKSB7XG4gIGlmICh0aGlzLmlzUnVubmluZykge1xuICAgIGNvbnRhaW5lci5ydW5uZXIucmVtb3ZlKHRoaXMuc3RlcCwgdGhpcyk7XG4gICAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3N0b3AnLCB0aGlzLmNyZWF0ZUV2ZW50KCdzdG9wJykpO1xuICB9XG59O1xuVGltZXIucHJvdG90eXBlLnJlc3RhcnQgPSBmdW5jdGlvbiByZXN0YXJ0KCkge1xuICBpZiAodGhpcy5pc1J1bm5pbmcpIHtcbiAgICB0aGlzLmJlZ2luQXQgPSBjb250YWluZXIudGltZTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXJ0KCk7XG4gIH1cbn07XG5cblRpbWVyLnByb3RvdHlwZS5jcmVhdGVFdmVudCA9IGZ1bmN0aW9uIGNyZWF0ZUV2ZW50KHR5cGUpIHtcbiAgcmV0dXJuIHsgJ3R5cGUnOiB0eXBlLCAnZGVsdGEnOiB0aGlzLmdldERlbHRhKCksICdkdXJhdGlvbic6IHRoaXMuZHVyYXRpb24sICdiZWdpbkF0JzogdGhpcy5iZWdpbkF0LCAndGFyZ2V0JzogdGhpcyB9O1xufTtcblxuVGltZXIucHJvdG90eXBlLmdldERlbHRhID0gZnVuY3Rpb24gZ2V0RGVsdGEoKSB7XG4gIHJldHVybiBjb250YWluZXIudGltZSAtIHRoaXMuYmVnaW5BdDtcbn07XG5cblRpbWVyLnByb3RvdHlwZS5pc0NvbXBsZXRlID0gZnVuY3Rpb24gaXNDb21wbGV0ZSgpIHtcbiAgcmV0dXJuIHRoaXMuZ2V0RGVsdGEoKSA+PSB0aGlzLmR1cmF0aW9uO1xufTsiLCJmdW5jdGlvbiBWaWV3cG9ydChpZCkge1xuICBfLmV4dGVuZCh0aGlzLCBCYWNrYm9uZUV2ZW50cyk7XG4gIHRoaXMuaWQgPSBpZDtcbiAgdGhpcy5lbCA9ICh0aGlzLiRlbCA9ICQoJyMnICsgaWQpKVswXTtcbiAgdGhpcy5zY3JlZW4gPSBuZXcgUG9pbnQoKTtcbiAgdGhpcy5zaXplICAgPSBuZXcgUG9pbnQoKTtcbiAgdGhpcy5yYXRpbyAgPSBuZXcgUG9pbnQoMSwgMSk7XG4gIHRoaXMuJHJlc2l6ZUVsZW1lbnQgPSBpc01vYmlsZSA/ICQod2luZG93KSA6IHRoaXMuJGVsO1xuICB0aGlzLnVwZGF0ZVNpemUgPSBfLmRlYm91bmNlKF8uYmluZCh0aGlzLnVwZGF0ZVNpemUsIHRoaXMpLCA1MCk7XG4gIHRoaXMudXBkYXRlU2l6ZSh7IHNpbGVudDogdHJ1ZSB9KTtcbn07XG5cblZpZXdwb3J0LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFZpZXdwb3J0O1xuXG5WaWV3cG9ydC5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gIHRoaXMub2ZmKCkuJGVsLm9mZigncmVzaXplJywgdGhpcy51cGRhdGVTaXplKTtcbiAgdGhpcy51cGRhdGVTaXplID0gdGhpcy4kZWwgPSB0aGlzLmVsID0gdGhpcy5pZCA9IHRoaXMuc2l6ZSA9IHRoaXMucmF0aW8gPSBudWxsO1xufTtcblxuVmlld3BvcnQucHJvdG90eXBlLnVwZGF0ZVNpemUgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgdGhpcy4kcmVzaXplRWxlbWVudC5vZmYoJ3Jlc2l6ZScsIHRoaXMudXBkYXRlU2l6ZSk7XG4gIHRoaXMuc2NyZWVuLnNldFhZKHRoaXMuJHJlc2l6ZUVsZW1lbnQud2lkdGgoKSwgdGhpcy4kcmVzaXplRWxlbWVudC5oZWlnaHQoKSk7XG4gIGlmIChpc01vYmlsZSkge1xuICAgIHRoaXMuc2l6ZS5zZXRYWSh0aGlzLnJhdGlvLnNjbCh0aGlzLnNjcmVlbikpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc2l6ZS5zZXRYWSh0aGlzLnJhdGlvLnNjbCh0aGlzLnNjcmVlbi54LCB0aGlzLnNjcmVlbi54KSk7XG4gIH1cbiAgdGhpcy4kcmVzaXplRWxlbWVudFxuICAgIC5jc3MoJ2hlaWdodCcsIHRoaXMuc2l6ZS55KVxuICAgIC5jc3MoJ3dpZHRoJywgdGhpcy5zaXplLngpXG4gICAgLmZpbmQoJy5zY3JlZW46bm90KC5wb3BpbiknKVxuICAgICAgLmNzcygnd2lkdGgnLCB0aGlzLnNpemUueClcbiAgICAgIC5jc3MoJ2hlaWdodCcsIHRoaXMuc2l6ZS55KTtcbiAgaWYgKCFldmVudC5zaWxlbnQpIHRoaXMudHJpZ2dlcigncmVzaXplJywgeyBzaXplOiB0aGlzLnNpemUuY2xvbmUoKSwgc2NyZWVuOiB0aGlzLnNjcmVlbi5jbG9uZSgpLCBvcmlnaW46IHRoaXMgfSk7XG4gIHRoaXMuJHJlc2l6ZUVsZW1lbnQub24oJ3Jlc2l6ZScsIHRoaXMudXBkYXRlU2l6ZSk7XG59O1xuXG5WaWV3cG9ydC5wcm90b3R5cGUua2VlcFJhdGlvID0gZnVuY3Rpb24gKHJhdGlvKSB7XG4gIHRoaXMucmF0aW8uc2V0WFkoMSwgcmF0aW8pO1xuICB0aGlzLnVwZGF0ZVNpemUoeyBzaWxlbnQ6IHRydWUgfSk7XG59OyIsImZ1bmN0aW9uIFRleHREcmF3ZXIoZWxlbWVudCwgdGV4dCwgbWlsbGlzZWNvbmRzQnlDaGFyKSB7XG4gIF8uZXh0ZW5kKHRoaXMsIEJhY2tib25lRXZlbnRzKTtcbiAgdGhpcy5zZXQoZWxlbWVudCwgdGV4dCwgbWlsbGlzZWNvbmRzQnlDaGFyKTtcbiAgdGhpcy5vZmZzZXQgPSAwO1xuICB0aGlzLmxhc3RUaW1lID0gMDtcbiAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbn1cblxuVGV4dERyYXdlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBUZXh0RHJhd2VyO1xuXG5UZXh0RHJhd2VyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoZWxlbWVudCwgdGV4dCwgbWlsbGlzZWNvbmRzQnlDaGFyKSB7XG4gIHRoaXMuZWwgPSBlbGVtZW50O1xuICB0aGlzLnRleHRUaW1lbGluZSA9ICh0ZXh0IHx8IFtdKS5zbGljZSgpO1xuICB0aGlzLm1pbGxpc2Vjb25kc0J5Q2hhciA9IG1pbGxpc2Vjb25kc0J5Q2hhciB8fCAxNztcbn07XG5cblRleHREcmF3ZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gc3RhcnQoKSB7XG4gIGlmICghdGhpcy5pc1J1bm5pbmcpIHtcbiAgICB0aGlzLmxhc3RUaW1lID0gY29udGFpbmVyLnRpbWU7XG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgIGNvbnRhaW5lci5ydW5uZXIuYWRkKHRoaXMucnVuLCB0aGlzKTtcbiAgICB0aGlzLmlzUnVubmluZyA9IHRydWU7XG4gICAgdGhpcy50cmlnZ2VyKCdzdGFydCcsIHRoaXMuY3JlYXRlRXZlbnQoJ3N0YXJ0JykpO1xuICB9XG59O1xuXG5UZXh0RHJhd2VyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gc3RvcCgpIHtcbiAgaWYgKHRoaXMuaXNSdW5uaW5nKSB7XG4gICAgY29udGFpbmVyLnJ1bm5lci5yZW1vdmUodGhpcy5ydW4sIHRoaXMpO1xuICAgIHRoaXMuaXNSdW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdzdG9wJywgdGhpcy5jcmVhdGVFdmVudCgnc3RvcCcpKTtcbiAgfVxufTtcblxuVGV4dERyYXdlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gcnVuKCkge1xuICB2YXIgZGVsdGEgPSBjb250YWluZXIudGltZSAtIHRoaXMubGFzdFRpbWU7XG5cbiAgaWYgKCF0aGlzLmN1cnJlbnRUYWdEZXNjcmlwdGlvbikge1xuICAgIHRoaXMuY3VycmVudFRhZ0Rlc2NyaXB0aW9uID0gdGhpcy50ZXh0VGltZWxpbmUuc2hpZnQoKTtcbiAgICB0aGlzLm9mZnNldCA9IDA7XG4gICAgdGhpcy50ZXh0ID0gdGhpcy5jdXJyZW50VGFnRGVzY3JpcHRpb24udGV4dENvbnRlbnQgfHwgJyc7XG4gICAgdGhpcy5jdXJyZW50VGFnRGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBudWxsO1xuICAgIGlmICghdGhpcy5jdXJyZW50VGFnRGVzY3JpcHRpb24udGFnTmFtZSkgdGhpcy5jdXJyZW50VGFnRGVzY3JpcHRpb24udGFnTmFtZSA9ICdzcGFuJztcbiAgICB0aGlzLmN1cnJlbnREcmF3aW5nRWxlbWVudCA9IGNvbnRhaW5lci5jcmVhdGVFbGVtZW50KHRoaXMuY3VycmVudFRhZ0Rlc2NyaXB0aW9uKTtcbiAgICB0aGlzLmVsLmFwcGVuZENoaWxkKHRoaXMuY3VycmVudERyYXdpbmdFbGVtZW50KTtcbiAgfVxuXG4gIHRoaXMub2Zmc2V0ICs9IE1hdGguY2VpbChkZWx0YSAvIHRoaXMubWlsbGlzZWNvbmRzQnlDaGFyKTtcbiAgaWYgKHRoaXMub2Zmc2V0ID4gdGhpcy50ZXh0Lmxlbmd0aCkgdGhpcy5vZmZzZXQgPSB0aGlzLnRleHQubGVuZ3RoO1xuICBpZiAodGhpcy5vZmZzZXQgPiAwKSB7XG4gICAgdGhpcy5jdXJyZW50RHJhd2luZ0VsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLnRleHQuc3Vic3RyKDAsIHRoaXMub2Zmc2V0KTtcbiAgfVxuICBpZiAodGhpcy5vZmZzZXQgPT09IHRoaXMudGV4dC5sZW5ndGgpIHtcbiAgICBpZiAoIXRoaXMudGV4dFRpbWVsaW5lLmxlbmd0aCkge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb21wbGV0ZScsIHRoaXMuY3JlYXRlRXZlbnQoJ2NvbXBsZXRlJykpO1xuICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGV4dCA9IHRoaXMuY3VycmVudFRhZ0Rlc2NyaXB0aW9uID0gdGhpcy5jdXJyZW50RHJhd2luZ0VsZW1lbnQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRoaXMubGFzdFRpbWUgPSBjb250YWluZXIudGltZTtcbn07XG5cblRleHREcmF3ZXIucHJvdG90eXBlLmNyZWF0ZUV2ZW50ID0gZnVuY3Rpb24gY3JlYXRlRXZlbnQodHlwZSkge1xuICByZXR1cm4geyAndHlwZSc6IHR5cGUsICd0YXJnZXQnOiB0aGlzLCAndGV4dCc6IHRoaXMudGV4dCwgJ29mZnNldCc6IHRoaXMub2Zmc2V0LCAnZWxlbWVudCc6IHRoaXMuZWwgfTtcbn07XG4iLCIvKipcbiAqIFJlcHJlc2VudCBhIHBvaW50IGluIGEgMkQgc3BhY2VcbiAqIEBjb25zdHJ1Y3RvclxuICogQGV4dGVuZHMge29iamVjdH1cbiAqIEBwYXJhbSB7bnVtYmVyPX0geFxuICogQHBhcmFtIHtudW1iZXI9fSB5XG4qKi9cbmZ1bmN0aW9uIFBvaW50KHgsIHkpIHtcbiAgaWYgKHggaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIHkgPSB4WzFdO1xuICAgIHggPSB4WzBdO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiBfLmlzTnVtYmVyKHgueCkgJiYgXy5pc051bWJlcih4LnkpKSB7XG4gICAgeSA9IHgueTtcbiAgICB4ID0geC54O1xuICB9XG4gIC8qKlxuICAgKiBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSBzaGFwZVxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAqKi9cbiAgdGhpcy54ID0geCB8fCAwO1xuICAvKipcbiAgICogVGhlIHktY29vcmRpbmF0ZSBvZiB0aGUgc2hhcGVcbiAgICogQHR5cGUge251bWJlcn1cbiAgKiovXG4gIHRoaXMueSA9IHkgfHwgMDtcbn07XG5cblBvaW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFBvaW50O1xuUG9pbnQucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiBkaXNwb3NlKCkge307XG5Qb2ludC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiBjbG9uZSgpIHtcbiAgcmV0dXJuIG5ldyBQb2ludCh0aGlzKTtcbn07XG4vKiogQGluaGVyaXRzRG9jICoqL1xuUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gIHJldHVybiAoJ3sgeDogJyArIHRoaXMueCArICcsIHk6ICcgKyB0aGlzLnkgKyAnIH0nKTtcbn07XG4vKipcbiAqXG4gKiBAcGFyYW0geyEobnVtYmVyfFBvaW50KX0geFxuICogQHBhcmFtIHs/bnVtYmVyfSB5XG4qKi9cblBvaW50LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiBhZGQoeCwgeSkge1xuICBpZiAoeCBpbnN0YW5jZW9mIFBvaW50KSB7XG4gICAgeSA9IHgueTtcbiAgICB4ID0geC54O1xuICB9XG4gIHJldHVybiBuZXcgUG9pbnQodGhpcy54ICsgeCwgdGhpcy55ICsgeSk7XG59O1xuLyoqXG4gKlxuICogQHBhcmFtIHshKG51bWJlcnxQb2ludCl9IHhcbiAqIEBwYXJhbSB7P251bWJlcn0geVxuKiovXG5Qb2ludC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24gc3ViKHgsIHkpIHtcbiAgaWYgKHggaW5zdGFuY2VvZiBQb2ludCkge1xuICAgIHkgPSB4Lnk7XG4gICAgeCA9IHgueDtcbiAgfVxuICByZXR1cm4gbmV3IFBvaW50KHRoaXMueCAtIHgsIHRoaXMueSAtIHkpO1xufTtcbi8qKlxuICpcbiAqIEBwYXJhbSB7IShudW1iZXJ8UG9pbnQpfSB4XG4gKiBAcGFyYW0gez9udW1iZXJ9IHlcbioqL1xuUG9pbnQucHJvdG90eXBlLnNjbCA9IGZ1bmN0aW9uIHNjbCh4LCB5KSB7XG4gIGlmICh4IGluc3RhbmNlb2YgUG9pbnQpIHtcbiAgICB5ID0geC55O1xuICAgIHggPSB4Lng7XG4gIH1cbiAgcmV0dXJuIG5ldyBQb2ludCh0aGlzLnggKiB4LCB0aGlzLnkgKiB5KTtcbn07XG4vKipcbiAqXG4gKiBAcGFyYW0geyEobnVtYmVyfFBvaW50KX0geFxuICogQHBhcmFtIHs/bnVtYmVyfSB5XG4qKi9cblBvaW50LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbiBkaXYoeCwgeSkge1xuICBpZiAoeCBpbnN0YW5jZW9mIFBvaW50KSB7XG4gICAgeSA9IHgueTtcbiAgICB4ID0geC54O1xuICB9XG4gIHJldHVybiBuZXcgUG9pbnQodGhpcy54IC8geCwgdGhpcy55IC8geSk7XG59O1xuLyoqXG4gKiBTZXQgdGhlIHgsIHkgdmFsdWUgb2YgdGhpcyBpbnN0YW5jZVxuICogQHBhcmFtIHshKG51bWJlcnxQb2ludCl9IHhcbiAqIEBwYXJhbSB7P251bWJlcn0geVxuKiovXG5Qb2ludC5wcm90b3R5cGUuc2V0WFkgPSBmdW5jdGlvbiBzZXRYWSh4LCB5KSB7XG4gIGlmICh4IGluc3RhbmNlb2YgUG9pbnQpIHtcbiAgICB5ID0geC55O1xuICAgIHggPSB4Lng7XG4gIH1cbiAgdGhpcy54ID0geDtcbiAgdGhpcy55ID0geTtcbn07XG4vKipcbiAqIGNhbGMgdGhlIGRpc3RhbmNlIHNxdWFyZWQgYmV0d2VlbiB0aGlzIHBvaW50IGFuZCB4LCB5IGNvb3JkaW5hdGVcbiAqIEBwYXJhbSB7IShudW1iZXJ8UG9pbnQpfSB4XG4gKiBAcGFyYW0gez9udW1iZXJ9IHlcbioqL1xuUG9pbnQucHJvdG90eXBlLmRzdDIgPSBmdW5jdGlvbiBkc3QyKHgsIHkpIHtcbiAgaWYgKHggaW5zdGFuY2VvZiBQb2ludCkge1xuICAgIHkgPSB4Lnk7XG4gICAgeCA9IHgueDtcbiAgfVxuICByZXR1cm4gKHggLSB0aGlzLngpICogKHggLSB0aGlzLngpICsgKHkgLSB0aGlzLnkpICogKHkgLSB0aGlzLnkpO1xufTtcbi8qKlxuICogY2FsYyB0aGUgZGlzdGFuY2UgYmV0d2VlbiB0aGlzIHBvaW50IGFuZCB4LCB5IGNvb3JkaW5hdGVcbiAqIEBwYXJhbSB7IShudW1iZXJ8UG9pbnQpfSB4XG4gKiBAcGFyYW0gez9udW1iZXJ9IHlcbioqL1xuUG9pbnQucHJvdG90eXBlLmRzdCA9IGZ1bmN0aW9uIGRzdCh4LCB5KSB7XG4gIHJldHVybiBNYXRoLnNxcnQodGhpcy5kc3QyKHgsIHkpKTtcbn07XG5cblBvaW50LnByb3RvdHlwZS5fdXNlTWF0aE1ldGhvZCA9IGZ1bmN0aW9uIF91c2VNYXRoTWV0aG9kKG5hbWUpIHtcbiAgcmV0dXJuIG5ldyBQb2ludChNYXRoW25hbWVdKHRoaXMueCksIE1hdGhbbmFtZV0odGhpcy55KSk7XG59O1xuXG5bXCJmbG9vclwiLCBcImNlaWxcIiwgXCJhYnNcIl0uZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kTmFtZSkge1xuICBQb2ludC5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzLl91c2VNYXRoTWV0aG9kKG1ldGhvZE5hbWUpOyB9O1xufSk7IiwiZnVuY3Rpb24gTGluZWFySW50ZXJwb2xhdG9yKGR1cmF0aW9uLCBmcm9tLCB0bykge1xuICBfLmV4dGVuZCh0aGlzLCBCYWNrYm9uZUV2ZW50cyk7XG4gIHRoaXMudmFsdWUgPSAwO1xuICB0aGlzLmlzUnVubmluZyA9IGZhbHNlO1xuICB0aGlzLmF1dG9Mb29wID0gZmFsc2U7XG4gIHRoaXMucnVuID0gXy5iaW5kKHRoaXMucnVuLCB0aGlzKTtcbiAgdGhpcy5zZXQoZHVyYXRpb24sIGZyb20sIHRvKTtcbn1cblxuTGluZWFySW50ZXJwb2xhdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IExpbmVhckludGVycG9sYXRvcjtcblxuTGluZWFySW50ZXJwb2xhdG9yLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBzZXQoZHVyYXRpb24sIGZyb20sIHRvKSB7XG4gIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgdGhpcy5mcm9tID0gZnJvbTtcbiAgdGhpcy50byA9IHRvO1xuICB0aGlzLnNpZGUgPSB0aGlzLnRvID4gdGhpcy5mcm9tID8gMSA6IC0xO1xuICB0aGlzLnN0ZXAgPSBNYXRoLmFicyh0aGlzLnRvIC0gdGhpcy5mcm9tKSAvIChkdXJhdGlvbiAvICg1MCAvIDMpKTtcbn07XG5cbkxpbmVhckludGVycG9sYXRvci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiBzdGFydCgpIHtcbiAgaWYgKHRoaXMuaXNSdW5uaW5nKSByZXR1cm47XG4gIHRoaXMudmFsdWUgPSB0aGlzLmZyb207XG4gIHRoaXMudHJpZ2dlcignc3RhcnQnLCB0aGlzLmNyZWF0ZUV2ZW50KCdzdGFydCcpKTtcbiAgY29udGFpbmVyLnJ1bm5lci5hZGQodGhpcy5ydW4sIHRoaXMpO1xuICB0aGlzLmlzUnVubmluZyA9IHRydWU7XG59O1xuXG5MaW5lYXJJbnRlcnBvbGF0b3IucHJvdG90eXBlLnJlc3RhcnQgPSBmdW5jdGlvbiByZXN0YXJ0KCkge1xuICBpZiAodGhpcy5pc1J1bm5pbmcpIHtcbiAgICB0aGlzLnZhbHVlID0gdGhpcy5mcm9tO1xuICAgIHRoaXMudHJpZ2dlcigncmVzdGFydCcsIHRoaXMuY3JlYXRlRXZlbnQoJ3Jlc3RhcnQnKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5zdGFydCgpO1xuICB9XG59O1xuXG5MaW5lYXJJbnRlcnBvbGF0b3IucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiBzdG9wKCkge1xuICBpZiAoIXRoaXMuaXNSdW5uaW5nKSByZXR1cm47XG4gIHRoaXMudHJpZ2dlcignc3RvcCcsIHRoaXMuY3JlYXRlRXZlbnQoJ3N0b3AnKSk7XG4gIGNvbnRhaW5lci5ydW5uZXIucmVtb3ZlKHRoaXMucnVuLCB0aGlzKTtcbiAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbn07XG5cbkxpbmVhckludGVycG9sYXRvci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gcnVuKHRvdGFsdGltZSkge1xuICBpZiAodGhpcy5pc0NvbXBsZXRlKCkpIHtcbiAgICBpZiAoIXRoaXMuYXV0b0xvb3AgJiYgIXRoaXMuYXV0b1JldmVyc2UpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB0aGlzLnRvO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb21wbGV0ZScsIHRoaXMuY3JlYXRlRXZlbnQoJ2NvbXBsZXRlJykpO1xuICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmF1dG9Mb29wKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdGhpcy5mcm9tICsgdGhpcy5zdGVwIC0gKE1hdGguYWJzKHRoaXMudG8gLSB0aGlzLnZhbHVlKSAqIHRoaXMuc2lkZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmF1dG9SZXZlcnNlKSB7XG4gICAgICB0aGlzLnJldmVyc2UoKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy52YWx1ZSArPSB0aGlzLnN0ZXAgKiB0aGlzLnNpZGU7XG4gICAgdGhpcy50cmlnZ2VyKCdzdGVwJywgdGhpcy5jcmVhdGVFdmVudCgnc3RlcCcpKTtcbiAgfVxufTtcblxuTGluZWFySW50ZXJwb2xhdG9yLnByb3RvdHlwZS5yZXZlcnNlID0gZnVuY3Rpb24gcmV2ZXJzZSgpIHtcbiAgdmFyIGZyb20gPSB0aGlzLmZyb207XG4gIHRoaXMuc2lkZSA9IC10aGlzLnNpZGU7XG4gIHRoaXMuZnJvbSA9IHRoaXMudG87XG4gIHRoaXMudG8gPSBmcm9tO1xufTtcblxuTGluZWFySW50ZXJwb2xhdG9yLnByb3RvdHlwZS5jcmVhdGVFdmVudCA9IGZ1bmN0aW9uIGNyZWF0ZUV2ZW50KHR5cGUpIHtcbiAgcmV0dXJuIHsgJ3R5cGUnOiB0eXBlLCAnZnJvbSc6IHRoaXMuZnJvbSwgJ3RvJzogdGhpcy50bywgJ3ZhbHVlJzogdGhpcy52YWx1ZSwgJ2RlbHRhJzogdGhpcy5zdGVwICogdGhpcy5zaWRlLCAnZHVyYXRpb24nOiB0aGlzLmR1cmF0aW9uLCAndGFyZ2V0JzogdGhpcyB9O1xufTtcblxuTGluZWFySW50ZXJwb2xhdG9yLnByb3RvdHlwZS5pc0NvbXBsZXRlID0gZnVuY3Rpb24gaXNDb21wbGV0ZSgpIHtcbiAgcmV0dXJuIHRoaXMuc2lkZSA9PT0gMSAmJiB0aGlzLnZhbHVlICsgdGhpcy5zdGVwID4gdGhpcy50byB8fCB0aGlzLnNpZGUgPT09IC0xICYmIHRoaXMudmFsdWUgLSB0aGlzLnN0ZXAgPCB0aGlzLnRvO1xufTtcblxuLyoqXG4gKiBDbG9uZSB0aGUgaW5zdGFuY2Ugb2YgYW5pbWF0aW9uIHdpdGggY29uc3RydWN0b3IgYXR0cmlidXRlc1xuICogVGhlIGNsb25lIHdpbGwgbm90IHJ1bm5pbmdcbiAqIEByZXR1cm5zIHtMaW5lYXJJbnRlcnBvbGF0b3J9XG4qKi9cbkxpbmVhckludGVycG9sYXRvci5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjbG9uZSA9IG5ldyBMaW5lYXJJbnRlcnBvbGF0b3IodGhpcy5kdXJhdGlvbiwgdGhpcy5mcm9tLCB0aGlzLnRvKTtcbiAgaWYgKHRoaXMucnVuICE9PSBMaW5lYXJJbnRlcnBvbGF0b3IucHJvdG90eXBlLnJ1bikgY2xvbmUucnVuID0gdGhpcy5ydW47XG4gIHJldHVybiBjbG9uZTtcbn07Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9