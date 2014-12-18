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