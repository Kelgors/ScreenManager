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
