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