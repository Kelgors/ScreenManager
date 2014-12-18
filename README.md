# ScreenManager

ScreenManager was originaly designed for a simple html5 game. At the beginning of the project, our team decided that Backbone will be too much for this simple game and also make each pages on its own route.
Soon after we make the project and write some code, the mockup come with several popin and the best way to animate transition is to do it entirly in Javascript.
I create this project to handle popin/screen transition into a parent element (simple div or body) and positionning/resizing elements relatively to the background scaling.

## Screen

A screen is a element that representing a gathering of views and you can transit between them via the ScreenManager.
You can have a Screen (not a popin) and another screen over it (must be a popin).
The ScreenManager is available into this.parent of a Screen instance.

## Viewport

The viewport represent a container that mastering the size of what is displayed into the screen.

### TODO

- single transitionning method
- add more interpolators
- add Runnable class which extend Callbacks of Runner, Timer, Interpolator, ... (method: start, stop, restart, run|event:  start,stop,restart,complete)
