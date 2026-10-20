'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
test('live preview uses requested 1320x2868 user preset at a native 440x956 CSS viewport',()=>{const {previewLayout,PREVIEW_PRESET}=require('../public/app.js');assert.deepEqual(PREVIEW_PRESET,{diagonalInches:6.9,pixelWidth:1320,pixelHeight:2868,pixelRatio:3,cssWidth:440,cssHeight:956});const p=previewLayout('https://maibenz-wedding.netlify.app/',220,478);assert.deepEqual(p,{width:440,height:956,scale:0.5});});
