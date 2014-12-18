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