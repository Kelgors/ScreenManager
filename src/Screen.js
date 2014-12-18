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