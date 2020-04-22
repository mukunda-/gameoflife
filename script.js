// Life simulator
// https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life
// (C) 2020 Mukunda Johnson
///////////////////////////////////////////////////////////////////////////////
"use strict";
///////////////////////////////////////////////////////////////////////////////
// Canvas element to draw everything on.
let displayCanvas   = null;
//-----------------------------------------------------------------------------
// 2D context from the canvas element above.
let displayContext  = null;
//-----------------------------------------------------------------------------
// This map holds the state of all cells. It has no set boundaries, indexed
//  with a string of "x/y", e.g. "-5/7". 1 = cell is turned on, or "alive".
//                                                 0 or undefined is "off".
let cellMap         = {};
//-----------------------------------------------------------------------------
// This holds the animation data for the cells. A dirty cell is one that is
//  being drawn during frame updates. This is `undefined` for cells that are
//  inactive (static on the screen). A number 0-1 represents the color they
//  are 1 = white, 0.5 = gray, 0 = black. According to the map above, this
//  will shift towards the desired shade. Once it reaches there, it clears
//            the value in the set so it doesn't receive any more updates.
let cellsDirty      = {};
//-----------------------------------------------------------------------------
// This is the time from the previous update, used to measure how much time
//                               has elasped between frames being processed.
let lastUpdateTime  = 0;
//-----------------------------------------------------------------------------
// A basic class that handles painting things onto the map. Mouse input is
//                    passed into here. See the definitions somewhere below.
let Painter         = {};
//-----------------------------------------------------------------------------
// Running counter for frame timing. When this is <= 0, a map update must be
//  processed, and it's reset with the frame period.
let timeToNextFrame = 0;
//-----------------------------------------------------------------------------
// Milliseconds per map update.
let framePeriod     = 250;
//-----------------------------------------------------------------------------
// Rate that the cells fade in or out in seconds.
let cellFadeRate    = 1.0;
//-----------------------------------------------------------------------------
// True if frame updates are suspended.
let gamePaused      = false;
//-----------------------------------------------------------------------------
// The size of the cells on the screen in pixels.
const CELL_SIZE = 10;

//-----------------------------------------------------------------------------
// Returns the current system time in milliseconds. Used for timing everything.
function getTime() {
    return new Date().getTime();
}

//-----------------------------------------------------------------------------
// Called when the browser resizes, to resize the canvas to the new window
//                                        dimensions and redraw everything.
function resizeDisplayToWindow() {
    displayCanvas.width  = window.innerWidth;
    displayCanvas.height = window.innerHeight;
    drawGrid();
    drawAllCells();
}

//-----------------------------------------------------------------------------
// We call the main canvas the "display". This creates it and inserts it into
//  the dom.
function setupDisplay() {
    displayCanvas = document.createElement( 'canvas' );
    displayCanvas.id             = "display";
    displayCanvas.style.cursor   = "crosshair";

    // Should change this to be less free-function linking.
    displayCanvas.addEventListener( "mousedown", onMouseDown );
    displayCanvas.addEventListener( "mouseup", onMouseUp );
    displayCanvas.addEventListener( "mousemove", onMouseMove );

    // Cache this for everything that needs it.
    displayContext = displayCanvas.getContext("2d");

    // #board is an empty div at the top of the body, set to fill the entire
    //  region.
    let board = document.getElementById( "board" );
    board.appendChild( displayCanvas );
    
    // Hook window resizing to call our refresh function.
    window.addEventListener( "resize", () => {
        resizeDisplayToWindow();
    });

    // Initial grid drawing and such.
    resizeDisplayToWindow();
}

//-----------------------------------------------------------------------------
// Draws the gridlines on the display canvas. Only needs to be done when the
//               canvas is erased; otherwise, nothing draws over these lines.
function drawGrid() {
    
    // A nice light gray.
    let ctx         = displayContext;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = "#ddd";

    // Vertical lines.
    for( let x = 0, end = displayCanvas.width / CELL_SIZE; x < end; x++ ) {
        ctx.beginPath();
        ctx.moveTo( CELL_SIZE * x + 0.5, 0.5 );
        ctx.lineTo( CELL_SIZE * x + 0.5, displayCanvas.height - 0.5 );
        ctx.stroke();
    }

    // Horizontal lines.
    for( let y = 0, end = displayCanvas.height / CELL_SIZE; y < end; y++ ) {
        ctx.beginPath();
        ctx.moveTo( 0.5, CELL_SIZE * y + 0.5 );
        ctx.lineTo( displayCanvas.width - 0.5, CELL_SIZE * y + 0.5 );
        ctx.stroke();
    }
}

//-----------------------------------------------------------------------------
// Draws a cell on the screen. `key` is the index in the map formatted as "x/y".
//  This can be called on keys that don't exist, and it will treat them as
//  empty.
function drawCell( key, tp ) {
    let [x, y] = key.split( "/" ).map( a => parseInt(a) );
    if( x < -CELL_SIZE || y < -CELL_SIZE
                     || x > displayCanvas.width || y > displayCanvas.height ) {
        // This cell is off screen; ignore it.
        return;
    }

    let c = cellsDirty[key];
    if( cellMap[key] ) {
        // The cell map is set for this entry: it is filled.
        if( c === undefined ) {
            // If the 'dirty data' isn't found, this switches to instantly
            //  black.
            c = 0;
        } else {
            // Otherwise, we slide towards black/zero.
            // Note that it's kind of grangey that we're doing animation
            //  login in the drawing loop. This should only be called once
            //  per frame though.
            c -= tp;
            if( c <= 0 ) {
                // Once we reach there, delete the dirty entry so we stop
                //  updating this cell.
                c = 0;
                delete cellsDirty[key];
            } else {
                // Otherwise, we do another animation update next frame.
                cellsDirty[key] = c;
            }
        }
    } else {
        // Same as above but inversed for cells that are off.
        if( c === undefined ) {
            c = 1;
        } else {
            c += tp;
            if( c >= 1 ) {
                c = 1;
                delete cellsDirty[key];
            } else {
                cellsDirty[key] = c;
            }
        }
    }

    // Component intensity.
    let comp = Math.floor( c * 255 );
    // Is there a better way than setting the fillStyle and having it
    //  parse a string...?
    displayContext.fillStyle = `rgba( ${comp}, ${comp}, ${comp}, 1.0 )`;

    // The +1 and -1 are to avoid drawing on the gridlines.
    displayContext.fillRect( x * CELL_SIZE + 1, y * CELL_SIZE + 1
                                              , CELL_SIZE - 1, CELL_SIZE - 1 );
}

//-----------------------------------------------------------------------------
// Draw all cells that are dirty. `timePassed` is how much animation progress
//                                  each cell should be given, in milliseconds.
function drawDirtyCells( timePassed ) {
    // Rate of animation.
    let tp = timePassed * cellFadeRate / 1000;
    
    for( const key in cellsDirty ) {
        drawCell( key, tp );
    }
}

//-----------------------------------------------------------------------------
// Draw all cells on the screen, used after there was some sort of refresh
//  that invalidated most of everything. `forceAll` is for when the map data
//  is changed completely, and there may be old cells on the screen that need
//  to be cleaned up/drawn over.
// If `forceAll` is false, that's meant for a blank canvas (such as when the
//              user resizes the window and the canvas is filled with white).
function drawAllCells( forceAll ) {
    if( forceAll ) {
        for( let y = 0; y < displayCanvas.height / CELL_SIZE; y++ ) {
            for( let x = 0; x < displayCanvas.width / CELL_SIZE; x++ ) {
                const key = x + '/' + y;
                drawCell( key, 0 );
            }
        }
    } else {
        for( const key in cellMap ) {
            drawCell( key, 0 );
        }
    }
}

//-----------------------------------------------------------------------------
// Set the value of a cell. `x` and `y` have no boundaries, and point to a cell
//  that will be set to `on`. This function handles extra things like starting
//                             the animations for the cells to fade in and out.
function setCell( x, y, on ) {
    let key = x + '/' + y;
    if( !on ) {
        if( !cellMap[key] ) return;
        delete cellMap[key];
        if( cellsDirty[key] === undefined )
            cellsDirty[key] = 0;
    } else {
        if( cellMap[key] ) return;
        cellMap[key] = 1;
        if( cellsDirty[key] === undefined )
            cellsDirty[key] = 1;
    }
}

//-----------------------------------------------------------------------------
// Returns the value of a cell, `true` if the cell is set, `false` otherwise.
//                                          `x` and `y` are cell coordinates.
function getCell( x, y ) {
    x = Math.floor(x);
    y = Math.floor(y);
    return ((cellMap[ x + '/' + y ] || 0) & 1) ? true : false;
}

//-----------------------------------------------------------------------------
// Called when the mouse has activity, applies the selected paint
//     ("on" or "off") to the map at the specified pixel coordinates.
Painter.apply = function( x, y ) {
    if( !Painter.active ) return;
    setCell( Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE),
                                                               Painter.color );
}

//-----------------------------------------------------------------------------
// Called on mouse down to draw and allow dragging.
Painter.start = function ( x, y ) {
    Painter.color = !getCell( x / CELL_SIZE, y / CELL_SIZE );
    Painter.active = true;
    Painter.apply( x, y );
}

//-----------------------------------------------------------------------------
// Called on mouse up to stop drawing while dragging.
Painter.stop = function() {
    Painter.active = false;
}

//-----------------------------------------------------------------------------
// Simulate life for the cell at the specified coordinate. This is the bulk of
//  the game update and applies the game of life algorithm.
function runCellLife( x, y ) {
    let neighborCount = ( getCell( x - 1, y     ) ? 1 : 0 )
                      + ( getCell( x - 1, y - 1 ) ? 1 : 0 )
                      + ( getCell( x    , y - 1 ) ? 1 : 0 )
                      + ( getCell( x + 1, y - 1 ) ? 1 : 0 )
                      + ( getCell( x + 1, y     ) ? 1 : 0 )
                      + ( getCell( x + 1, y + 1 ) ? 1 : 0 )
                      + ( getCell( x    , y + 1 ) ? 1 : 0 )
                      + ( getCell( x - 1, y + 1 ) ? 1 : 0 );

    let key = x + '/' + y;
    if( (cellMap[key] || 0) & 1 ) {
        if( neighborCount < 2 ) {
            // Less than two filled cells nearby, this cell will die.
            // (We do nothing, but the upper bit will remain 0 and
            //  will be shifted into the lower bit).
            // If this cell isn't flagged for dirty yet, do that, and start
            //                                        with a fresh animation.
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 0;
        } else if( neighborCount < 4 ) {
            // 2-3 neighbor cells means the cell will live.
            // Setting to 3 maintains the lowest bit and then sets
            //                             the next state also to 1.
            cellMap[key] = 3;
        } else {
            // More than 3 neighbors nearby means this cell dies from
            //  overpopulation.
            // The lowest bit will be cleared when we're done (see above).
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 0;
        }
    } else {
        if( neighborCount == 3 ) {
            // If there are exactly 3 neighbors nearby, this cell will be
            // repopulated.
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 1;
            cellMap[key] = 2;
            // bit1 = 1, bit0 remains 0, and the bit will be shifted over after
            //  all of our cells update.
        }
    }

}

//-----------------------------------------------------------------------------
// Run the game of life. Update all cells on the map with a pass of the
//  algorithm.
function runGame() {
    // Controlled by the pause button.
    if( gamePaused ) return;

    // First we update all cells and all surrounding cells next to them that
    //  might also be affected (this may add additional cell entries into the
    //  map).
    for( const key in cellMap ) {
        let [x, y] = key.split( "/" ).map( a => parseInt(a) );
        for( let ty = y - 1; ty <= y + 1; ty++ ) {
            for( let tx = x - 1; tx <= x + 1; tx++ ) {
                runCellLife( tx, ty );
            }
        }
    }

    // After all updates are complete, we shift all of the cell data over one
    //  bit. We need the state to be static during all of the update calls, so
    //              the second bit is used to store the next state post-update.
    for( const key in cellMap ) {
        cellMap[key] >>= 1;
        if( cellMap[key] == 0 ) {
            // If shifting clears the cell, delete it from the map so we save
            //                                          on future update time.
            delete cellMap[key];
        }
    }
}

//-----------------------------------------------------------------------------
// Fills the whole screen with randomly filled cells, activated by the Rando
//  button.
function paintNoise() {
    for( let y = 0; y < displayCanvas.height / CELL_SIZE; y++ ) {
        for( let x = 0; x < displayCanvas.width / CELL_SIZE; x++ ) {
            setCell( x, y, Math.random() >= 0.5 );
        }
    }
}

//-----------------------------------------------------------------------------
// Called for each animation frame.
function onFrame() {
    // Refresh the window forever. Call this first, so in the event of some
    //                    exception we will continue next frame if possible.
    window.requestAnimationFrame( onFrame );

    // Measure the time since the last frame.
    let newTime    = getTime();
    let timeDelta  = newTime - lastUpdateTime;
    lastUpdateTime = newTime;

    timeToNextFrame -= timeDelta;
    
    // Run an update if the update timer ticks.
    if( timeToNextFrame <= 0 ) {
        timeToNextFrame += framePeriod;

        // Process at most 1 frame per render frame. If timeToNextFrame is
        //  still negative here, then the browser has fallen behind in
        //                    processing, so we throttle and slow down.
        timeToNextFrame = Math.max( timeToNextFrame, 0 );
        runGame();
    }

    // A normal rendering pass. This updates all cells that are busy on the
    //  screen (busy = fading in or out).
    drawDirtyCells( timeDelta );
}

//-----------------------------------------------------------------------------
// EVENTS
//-----------------------------------------------------------------------------
// Called when the mouse is pressed down on the display canvas.
function onMouseDown( e ) {
    Painter.start( e.clientX, e.clientY );
}

//-----------------------------------------------------------------------------
// Called when the mouse is released on the display canvas.
function onMouseUp( e ) {
    Painter.stop();
}

//-----------------------------------------------------------------------------
// Called when the mouse moves on the display canvas.
function onMouseMove( e ) {
    Painter.apply( e.clientX, e.clientY );
}

//-----------------------------------------------------------------------------
// Called when the Pause/Play button is pressed.
function onPause() {
    gamePaused = !gamePaused;

    // I don't really like that we're hardcoding "pause" in two places, here
    //  and the HTML.
    const caption = gamePaused ? "▶️ Play" : "⏸ Pause";
    document.getElementById( "pauseButton" ).innerText = caption;
}

//-----------------------------------------------------------------------------
// Called when the Erase button is pressed.
function onErase() {

    // Quick and easy destroy everything.
   // cellMap    = {};
    //cellsDirty = {};
    //drawAllCells( true );

    // The 'fast' method above was changed in favor of seeing things fade out.
    // And who knows, maybe this is even faster because we don't have to
    //                                         blindly redraw all cells.
    for( const key in cellMap ) {
        let [x, y] = key.split( "/" ).map( a => parseInt(a) );
        setCell( x, y, false );
    }
}

//-----------------------------------------------------------------------------
// Called by the Rando button, draws noise on the map.
function onRandom() {
    paintNoise();
}

//-----------------------------------------------------------------------------
// "ready" handler; initialization goes here.
document.addEventListener( "DOMContentLoaded", () => {
    lastUpdateTime = getTime();
    setupDisplay();
    paintNoise();
    window.requestAnimationFrame( onFrame );
});

///////////////////////////////////////////////////////////////////////////////