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
  this.from = from || 0;
  this.to = to || 1;
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