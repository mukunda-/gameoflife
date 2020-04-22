// Game of Life simulator
// https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life
// (C) 2020 Mukunda Johnson
//-----------------------------------------------------------------------------

"use strict";
///////////////////////////////////////////////////////////////////////////////
let displayCanvas  = null;
let displayContext = null;
let cellMap        = {};
let cellsDirty     = {};
let lastTime       = 0;
let painter        = {};
let timeToNextFrame = 0;
let framePeriod    = 255; // milliseconds per frame
let fadeRate       = 1;
let gamePaused     = false;

const CELL_SIZE = 10;

//-----------------------------------------------------------------------------
function getTime() {
    return new Date().getTime();
}

//-----------------------------------------------------------------------------
function resizeDisplayToWindow() {
    displayCanvas.width  = window.innerWidth;
    displayCanvas.height = window.innerHeight;
    drawGrid();
    drawAllCells();
}

//-----------------------------------------------------------------------------
function setupDisplay() {
    displayCanvas = document.createElement( 'canvas' );
    displayCanvas.id             = "display";
    displayCanvas.style.cursor   = "crosshair";
    displayCanvas.addEventListener( "mousedown", onMouseDown );
    displayCanvas.addEventListener( "mouseup", onMouseUp );
    displayCanvas.addEventListener( "mousemove", onMouseMove );

    displayContext = displayCanvas.getContext("2d");

    let board = document.getElementById( "board" );
    board.appendChild( displayCanvas );

    resizeDisplayToWindow();
}

//-----------------------------------------------------------------------------
window.addEventListener( "resize", () => {
    resizeDisplayToWindow();
});

//-----------------------------------------------------------------------------
function nmod( a, m ) {
    if( a < 0 ) a = m + (a % m);
    return a % m;
}

//-----------------------------------------------------------------------------
function drawGrid() {
    let ctx = displayContext;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ddd";

    for( let x = 0, end = displayCanvas.width / CELL_SIZE; x < end; x++ ) {
        ctx.beginPath();
        ctx.moveTo( CELL_SIZE * x + 0.5, 0.5 );
        ctx.lineTo( CELL_SIZE * x + 0.5, displayCanvas.height - 0.5 );
        ctx.stroke();
    }

    for( let y = 0, end = displayCanvas.height / CELL_SIZE; y < end; y++ ) {
        ctx.beginPath();
        ctx.moveTo( 0.5, CELL_SIZE * y + 0.5 );
        ctx.lineTo( displayCanvas.width - 0.5, CELL_SIZE * y + 0.5 );
        ctx.stroke();
    }
}

//-----------------------------------------------------------------------------
function drawCell( key, tp ) {
    let [x, y] = key.split( "/" ).map( a => parseInt(a) );
    if( x < -CELL_SIZE || y < -CELL_SIZE
                     || x > displayCanvas.width || y > displayCanvas.height ) {
        // off screen.
        return;
    }
    let c = cellsDirty[key];
    if( cellMap[key] ) {
        if( c === undefined ) {
            c = 0;
        } else {
            c -= tp;
            if( c <= 0 ) {
                c = 0;
                delete cellsDirty[key];
            } else {
                cellsDirty[key] = c;
            }
        }
    } else {
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

    // subtracting 1 for the grid.
    let comp = Math.floor( c * 255 );
    displayContext.fillStyle = `rgba( ${comp}, ${comp}, ${comp}, 1.0 )`;
    displayContext.fillRect( x * CELL_SIZE + 1, y * CELL_SIZE + 1
                                              , CELL_SIZE - 1, CELL_SIZE - 1 );
}

//-----------------------------------------------------------------------------
function drawDirtyCells( timePassed ) {
    let tp = timePassed * fadeRate / 1000; // rate of animation.
    
    let ctx = displayContext;
    for( const key in cellsDirty ) {
        drawCell( key, tp );
    }
}

//-----------------------------------------------------------------------------
function drawAllCells( forceAll ) {
    if( forceAll ) {
        for( let y = 0; y < displayContext.height / CELL_SIZE; y++ ) {
            for( let x = 0; x < displayContext.width / CELL_SIZE; x++ ) {
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
function getCell( x, y ) {
    x = Math.floor(x);
    y = Math.floor(y);
    return ((cellMap[ x + '/' + y ] || 0) & 1) ? true : false;
}

//-----------------------------------------------------------------------------
painter.apply = function( x, y ) {
    if( !painter.active ) return;
    setCell( Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE),
                                                               painter.color );
}

//-----------------------------------------------------------------------------
painter.start = function ( x, y ) {
    painter.color = !getCell( x / CELL_SIZE, y / CELL_SIZE );
    painter.active = true;
    painter.apply( x, y );
}

//-----------------------------------------------------------------------------
painter.stop = function() {
    painter.active = false;
}

//-----------------------------------------------------------------------------
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
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 0;
            // This will die.
        } else if( neighborCount < 4 ) {
            // This will live.
            cellMap[key] = 3;
        } else {
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 0;
            // Dies from overpopulation.
        }
    } else {
        if( neighborCount == 3 ) {
            if( cellsDirty[key] === undefined ) cellsDirty[key] = 1;
            cellMap[key] = 2;
        }
    }

}
//-----------------------------------------------------------------------------
// Run the game of life. Update all cells on the map with a pass of the
//  algorithm.
function runGame() {
    if( gamePaused ) return;
    for( const key in cellMap ) {
        let [x, y] = key.split( "/" ).map( a => parseInt(a) );
        for( let ty = y - 1; ty <= y + 1; ty++ ) {
            for( let tx = x - 1; tx <= x + 1; tx++ ) {
                runCellLife( tx, ty );
            }
        }
    }

    for( const key in cellMap ) {
        cellMap[key] >>= 1;
        if( cellMap[key] == 0 ) {
            delete cellMap[key];
        }
    }
}

//-----------------------------------------------------------------------------
function paintNoise() {
    for( let y = 0; y < displayCanvas.height / CELL_SIZE; y++ ) {
        for( let x = 0; x < displayCanvas.width / CELL_SIZE; x++ ) {
            setCell( x, y, Math.random() >= 0.5 );
        }
    }
}

//-----------------------------------------------------------------------------
function onFrame() {
    window.requestAnimationFrame( onFrame );
    let newTime = getTime();
    let timeDelta = newTime - lastTime;
    lastTime = newTime;

    timeToNextFrame -= timeDelta;
    let timeout = 10;
    while( timeToNextFrame <= 0 ) {
        timeToNextFrame += framePeriod;
        runGame();
        timeout--;
        if( timeout === 0 ) {
            timeToNextFrame = 0;
            break;
        }
    }

    drawDirtyCells( timeDelta );
}
/*
//-----------------------------------------------------------------------------
const DisplayEventHandlers = {
    mousemove: (e) => {

    },

    mousedown: (e) =>
    mouseup: (e) => {
    },
*/
    
function onMouseDown( e ) {
    painter.start( e.clientX, e.clientY );
}

//-----------------------------------------------------------------------------
function onMouseUp( e ) {
    painter.stop();
}

//-----------------------------------------------------------------------------
function onMouseMove( e ) {
    painter.apply( e.clientX, e.clientY );
}

//-----------------------------------------------------------------------------
function onPause() {
    gamePaused = !gamePaused;
    const caption = gamePaused ? "▶️ Play" : "⏸ Pause";
    document.getElementById( "pauseButton" ).innerText = caption;
}

//-----------------------------------------------------------------------------
function onErase() {
    cellMap = {};
    cellsDirty = {};
    drawAllCells( true );
}

//-----------------------------------------------------------------------------
function onRandom() {
    paintNoise();
}

//-----------------------------------------------------------------------------
document.addEventListener( "DOMContentLoaded", () => {
    lastTime = getTime();
    setupDisplay();
    paintNoise();
    window.requestAnimationFrame( onFrame );
});

///////////////////////////////////////////////////////////////////////////////