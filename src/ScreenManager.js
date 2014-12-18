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

