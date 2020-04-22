"use strict";
///////////////////////////////////////////////////////////////////////////////
let displayCanvas  = null;
let displayContext = null;
const cellMap    = {};
const cellsDirty = {};

const CELL_SIZE = 10;

//-----------------------------------------------------------------------------
function resizeDisplayToWindow() {
    displayCanvas.width  = window.innerWidth;
    displayCanvas.height = window.innerHeight;
    drawGrid();
}

//-----------------------------------------------------------------------------
function setupDisplay() {
    displayCanvas = document.createElement( 'canvas' );
    displayCanvas.id             = "display";
    displayCanvas.style.position = "fixed";
    displayCanvas.style.left     = "0px";
    displayCanvas.style.top      = "0px";
    displayCanvas.style.cursor   = "crosshair";
    displayCanvas.addEventListener( "click", onClick );

    displayContext = displayCanvas.getContext("2d");

    let body = document.querySelector( "body" );
    body.appendChild( displayCanvas );

    resizeDisplayToWindow();
}

//-----------------------------------------------------------------------------
window.addEventListener( "resize", () => {
    resizeDisplayToWindow();
    //ctx.width = window.innerWidth;
    //c/tx.height = window.innerHeight;
});

function nmod( a, m ) {
    if( a < 0 ) a = m + (a % m);
    return a % m;
}

//-----------------------------------------------------------------------------
function drawGrid() {
    let ctx = displayCanvas.getContext("2d");//displayContext;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#999";

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

function drawCells() {
    for( const key in cellsDirty ) {
        let [x, y] = key.split( "/" ).map( parseInt );
        x -= camera[0];
        y -= camera[1];
        if( x < -CELL_WIDTH || y < -CELL_HEIGHT || x > displayCanvas.width || y > displayCanvas.height ) {
            
        }
    }
}

function toggleCell( x, y ) {
    let key = x + '/' + y;
    if( cellMap[key] ) {
        delete cellMap[key];
        cellsDirty[key] = true;
    } else {
        cellMap[key] = 1;
        cellsDirty[key] = true;
    }
}

//-----------------------------------------------------------------------------
function onFrame() {
    window.requestAnimationFrame( onFrame );

}

function onClick( e ) {
    console.log( e.clientX, e.clientY );
}

//-----------------------------------------------------------------------------
document.addEventListener( "DOMContentLoaded", () => {
    setupDisplay();
    window.requestAnimationFrame( onFrame );
});

///////////////////////////////////////////////////////////////////////////////