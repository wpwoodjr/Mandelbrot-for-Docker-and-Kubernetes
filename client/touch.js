/*
  Class to create a touch interface
  Bill Wood (with a small assist from ChatGPT), March 2023
*/

const TOUCH_NONE = 0;       // no touches active => TOUCHING
const TOUCH_TOUCHING = 1;   // interim state => TAP, DRAG, or PINCH
const TOUCH_TAP = 2;        // single tapping => DOUBLE_TAP or ERROR
const TOUCH_DOUBLE_TAP = 3; // double tapping => DRAG, PINCH, or NONE
const TOUCH_DRAG = 4;       // dragging => NONE
const TOUCH_PINCH = 5;      // pinching => END_PINCH or NONE
const TOUCH_END_PINCH = 6;  // pinch finished => NONE, DRAG, or PINCH
const TOUCH_ERROR = 7;       // error occurred, onTouchEnd was called and waiting for all touches to end => NONE

class Touch {
    constructor(id, options) {
        this.id = id;
        this.element = document.getElementById(id);
        options = options || {};
        this.FPS = options.FPS || 60;
        this.onInit = options.onInit || null;
        this.onTouchStart = options.onTouchStart || null;
        this.onTouchEnd = options.onTouchEnd || null;
        this.onDragStart = options.onDragStart || null;
        this.onDragMove = options.onDragMove || null;
        this.onDragEnd = options.onDragEnd || null;
        this.onSingleTap = options.onSingleTap || null;
        this.onDoubleTap = options.onDoubleTap || null;
        this.onPinchStart = options.onPinchStart || null;
        this.onPinchMove = options.onPinchMove || null;
        this.onPinchEnd = options.onPinchEnd || null;
        this.data = options.data || {};

        // Variables to store touch positions and state
        this.startTime = NaN;
        this.startTouches = [];
        this.endTouches = [];
        this.singleTapTimeout = null;
        this.state = TOUCH_NONE;
        this.element.addEventListener("touchstart", (event) => this.handleTouchStart(event), {passive: false});
        this.element.addEventListener("touchmove", (event) => this.handleTouchMove(event), {passive: false});
        this.element.addEventListener("touchend", (event) => this.handleTouchEnd(event), {passive: false});
        this.element.addEventListener("touchcancel", (event) => this.handleTouchCancel(event), {passive: false});
    }

    handleTouchStart(event) {

        if (this.onInit) {
            this.onInit();
            this.onInit = null;
        }

        if (this.state === TOUCH_ERROR) {
            return;
        // bail out if there are touches outside of element or too many touches in element
        } else if (event.targetTouches.length !== event.touches.length || event.targetTouches.length > 2) {
            console.log("touchStart bail out!");
            this.handleTouchCancel();
            return;
        }

        console.log("touchStart:", this.state, event.targetTouches.length);
        // don't preventDefault b/c double-tap and two finger right-click depend on it
        // event.preventDefault();///??? maybe prevent default will work in ios too
        this.startTouches = this.copyTouches(event.targetTouches);
        switch (this.state) {
            case TOUCH_NONE:
                console.log("onTouchStart():", event.targetTouches.length);
                if (this.onTouchStart) {
                    this.onTouchStart();
                }
                this.state = TOUCH_TOUCHING;
                break;

            case TOUCH_TOUCHING:
                break;

            case TOUCH_TAP:
                if (this.onDoubleTap) {
                    this.tapEnd();
                    this.state = TOUCH_DOUBLE_TAP;
                } else {
                    // not an error but need to cancel b/c ios will always respond to double tap even if it turns into a drag
                    this.handleTouchCancel();
                }
                break;

            case TOUCH_DOUBLE_TAP:
                break;

            case TOUCH_DRAG:
                this.dragEnd();
                this.state = TOUCH_TOUCHING;
                break;

            case TOUCH_PINCH:
                console.warn("touch start event and state === PINCH");
                break;

            case TOUCH_END_PINCH:
                break;

            case TOUCH_ERROR:
                break;
        }
    }

    // Handle touch move event
    handleTouchMove(event) {

        if (this.state === TOUCH_ERROR) {
            return;
        // bail out if there are touches outside of element
        } else if (event.targetTouches.length !== event.touches.length) {
            console.log("touchMove bail out!");
            this.handleTouchCancel();
            return;
        }

        event.preventDefault();
        switch (this.state) {
            case TOUCH_NONE:
                console.warn("touch move event and state === NONE");
                break;

            case TOUCH_DOUBLE_TAP:   // waiting for second tap touch end, but move happened instead
            case TOUCH_END_PINCH:    // pinch ended with one touch left, now dragging or pinching again
            case TOUCH_TOUCHING:     // one or two touches detected, now dragging or pinching
                // check for start of one touch drag
                if (event.targetTouches.length === 1) {
                    console.log("start drag");
                    this.state = TOUCH_DRAG;
                    if (this.onDragStart) {
                        this.onDragStart();
                    }
                    this.endTouches = this.copyTouches(event.targetTouches);
                    this.startTime = Date.now();
                    if (this.onDragMove) {
                        this.onDragMove(this.startTouches[0].clientX, this.startTouches[0].clientY,
                            this.endTouches[0].clientX, this.endTouches[0].clientY);
                    }

                // check if there are two touches for pinch gesture
                } else if (event.targetTouches.length === 2) {
                    console.log("start pinch");
                    this.state = TOUCH_PINCH;
                    if (this.onPinchStart) {
                        this.onPinchStart();
                    };
                    this.endTouches = this.copyTouches(event.targetTouches);
                    this.startTime = Date.now();
                    if (this.onPinchMove) {
                        this.onPinchMove(
                            [this.startTouches[0].clientX, this.startTouches[0].clientY,
                                this.startTouches[1].clientX, this.startTouches[1].clientY],
                            [this.endTouches[0].clientX, this.endTouches[0].clientY,
                                this.endTouches[1].clientX, this.endTouches[1].clientY]);
                    }
                }
                break;

            case TOUCH_TAP:
                console.warn("touch move event and state === TAP");///???call tapend?
                break;

            case TOUCH_DRAG:
                if (this.onDragMove) {
                    const elapsed = Date.now() - this.startTime;
                    if (elapsed >= 1000/this.FPS) {
                        this.startTime = Date.now();
                        this.endTouches = this.copyTouches(event.targetTouches);
                        this.onDragMove(this.startTouches[0].clientX, this.startTouches[0].clientY,
                            this.endTouches[0].clientX, this.endTouches[0].clientY);
                    }
                }
                break;

            case TOUCH_PINCH:
                // check length because Firefox doesn't always call handleTouchEnd before here
                if (event.targetTouches.length === 2 && this.onPinchMove) {
                    const elapsed = Date.now() - this.startTime;
                    if (elapsed >= 1000/this.FPS) {
                        this.startTime = Date.now();
                        this.endTouches = this.copyTouches(event.targetTouches);
                        this.onPinchMove(
                            [this.startTouches[0].clientX, this.startTouches[0].clientY,
                                this.startTouches[1].clientX, this.startTouches[1].clientY],
                            [this.endTouches[0].clientX, this.endTouches[0].clientY,
                                this.endTouches[1].clientX, this.endTouches[1].clientY]);
                    }
                }
                break;

            case TOUCH_ERROR:
                break;
        }
    }

    // Handle touch end event
    handleTouchEnd(event) {

        console.log("touchEnd:", this.state, this.startTouches.length, event.targetTouches.length);
        let doOnTouchEnd = false;
        switch (this.state) {
            case TOUCH_NONE:
                console.warn("touch end event and state === NONE");
                break;

            case TOUCH_TOUCHING:
                // check for multi-touch tap
                if (this.startTouches.length > 1) {
                    this.handleTouchCancel();
                } else {
                    // Set timeout for a single tap gesture
                    const clientX = event.changedTouches[0].clientX;
                    const clientY = event.changedTouches[0].clientY;
                    this.singleTapTimeout = setTimeout(() => {
                        this.tapEnd();
                        if (this.onSingleTap) {
                            this.onSingleTap(clientX, clientY);
                        }
                        if (this.onTouchEnd) {
                            console.log("onTouchEnd() from single tap");
                            this.onTouchEnd();
                        }
                        this.state = TOUCH_NONE;
                    }, 350);
                    this.state = TOUCH_TAP;
                }
                break;

            case TOUCH_TAP:
                console.warn("touch end event and state === TAP");///???
                break;

            case TOUCH_DOUBLE_TAP:
                // only gets here if onDoubleTap exists
                // prevent emulated mouse dblclick (doesn't work in ios)
                event.preventDefault();
                this.onDoubleTap(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
                doOnTouchEnd = true;
                break;

            case TOUCH_DRAG:
                this.dragEnd();
                doOnTouchEnd = true;
                break;

            case TOUCH_PINCH:
                this.pinchEnd();
                // still dragging?
                if (event.targetTouches.length === 1) {
                    // console.log("start drag from pinch");
                    this.startTouches = this.copyTouches(event.targetTouches);
                    this.endTouches = this.copyTouches(event.targetTouches);
                    this.state = TOUCH_END_PINCH;
                } else {
                    doOnTouchEnd = true;
                }
                break;

            case TOUCH_END_PINCH:
                doOnTouchEnd = true;
                break;

            case TOUCH_ERROR:
                if (event.targetTouches.length === 0) {
                    this.state = TOUCH_NONE;
                }
                break;
        }

        if (doOnTouchEnd && this.onTouchEnd) {
            console.log("onTouchEnd() from handleTouchEnd");
            this.onTouchEnd();
            this.state = TOUCH_NONE;
        }
    }
 
    // Handle touch cancel event
    handleTouchCancel(event) {
        console.log("touch canceled from", (new Error()).stack.split("\n")[2].trim().split(" ")[1], this.state);
        if (this.state === TOUCH_DRAG) {
            this.dragEnd();
        } else if (this.state === TOUCH_PINCH) {
            this.pinchEnd();
        } else if (this.state === TOUCH_TAP) {
            this.tapEnd();
        }

        if (this.onTouchEnd && this.state !== TOUCH_NONE && this.state !== TOUCH_ERROR) {
            console.log("onTouchEnd() from handleTouchCancel");
            this.onTouchEnd();
        }

        // if event is present then handleTouchCancel was called from the browser
        if (event && event.targetTouches.length === 0) {
            this.state = TOUCH_NONE;
        } else if (this.state !== TOUCH_NONE) {
            // wait for touches to end
            this.state = TOUCH_ERROR;
        }
    }

    dragEnd() {
        if (this.onDragEnd) {
            this.onDragEnd(this.startTouches[0].clientX, this.startTouches[0].clientY,
                this.endTouches[0].clientX, this.endTouches[0].clientY);
        }
    }

    pinchEnd() {
        if (this.onPinchEnd) {
            this.onPinchEnd(
                [this.startTouches[0].clientX, this.startTouches[0].clientY,
                    this.startTouches[1].clientX, this.startTouches[1].clientY],
                [this.endTouches[0].clientX, this.endTouches[0].clientY,
                this.endTouches[1].clientX, this.endTouches[1].clientY]);
        }
    }

    tapEnd() {
        if (this.singleTapTimeout) {
            clearTimeout(this.singleTapTimeout);
            this.singleTapTimeout = null;
        }
    }

    // Firefox requires that we copy what we need
    copyTouches(touches) {
        let r = [];
        for (let t of touches) {
            r.push({
                identifier: t.identifier,
                clientX: t.clientX,
                clientY: t.clientY
            });
        }
        return r;
    }
}
