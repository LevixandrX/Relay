import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {IntlProvider} from 'use-intl';
import messages from '../messages/en.json';
import {DocRenderer} from '../src/editor/DocRenderer';
import type {Doc} from '../src/domain/blocks/schema';
const doc:Doc={type:'doc',content:[
  {type:'heading',attrs:{level:4,blockId:'blk_public-h4'},content:[{type:'text',text:'Small heading'}]},
  {type:'toggle',attrs:{open:false,level:2},content:[{type:'toggleTitle',content:[{type:'text',text:'Section'}]},{type:'toggleContent',content:[{type:'paragraph',content:[{type:'text',text:'Retained body'}]}]}]},
  {type:'equation',attrs:{latex:'\\frac{a}{b}'}},
  {type:'paragraph',content:[{type:'text',text:'Marked',marks:[{type:'underline'},{type:'strike'}]},{type:'hardBreak'},{type:'inlineEquation',attrs:{latex:'x^2'}}]},
  {type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',attrs:{colspan:2},content:[{type:'paragraph',content:[{type:'text',text:'Table header'}]}]}]}]},
  {type:'image',attrs:{assetId:'asset_public-file01',name:'picture.png',caption:'A caption'}},
  {type:'orderedList',attrs:{start:3,listStyle:'upper-roman'},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'A list item'}]}]}]},
  {type:'tableOfContents'},
  {type:'codeBlock',attrs:{wrap:true,caption:'Code caption'},content:[{type:'text',text:'let x = 1;'}]},
  {type:'callout',attrs:{emoji:'',iconName:'rocket',iconColor:'#6aabe4'},content:[{type:'paragraph',content:[{type:'text',text:'System icon'}]}]},
  {type:'callout',attrs:{emoji:'',iconAssetId:'asset_callout-image01'},content:[{type:'paragraph',content:[{type:'text',text:'Uploaded icon'}]}]},
  {type:'callout',attrs:{emoji:'',iconSrc:'https://example.org/icon.png'},content:[{type:'paragraph',content:[{type:'text',text:'Linked icon'}]}]},
  {type:'callout',attrs:{emoji:''},content:[{type:'paragraph',content:[{type:'text',text:'No icon'}]}]},
  {type:'paragraph',content:[{type:'text',text:'Colored text',marks:[{type:'textStyle',attrs:{color:'#6aabe4',backgroundColor:'#111111'}}]}]},
]};
const html=renderToStaticMarkup(<IntlProvider locale="en" timeZone="Europe/Moscow" messages={messages}><DocRenderer doc={doc} publicId="published"/></IntlProvider>);
for(const text of ['<h4','Small heading','<summary','Retained body','katex','<u>','<s>','<br','colSpan="2"','/api/v1/public/published/assets/asset_public-file01','A caption','upper-roman','href="#blk_public-h4"'])assert.ok(html.toLowerCase().includes(text.toLowerCase()),text);
assert.ok(!html.includes('<details class="rich-public-toggle" open='));
for(const text of ['data-wrap="true"','Code caption','color:#6aabe4','background-color:#111111'])assert.ok(html.includes(text));
assert.ok(html.includes('/api/v1/public/published/assets/asset_callout-image01'));
assert.equal((html.match(/class="relay-callout-emoji"/g)||[]).length,3);
assert.ok(!html.includes('💡'));
assert.ok(html.includes('lucide-rocket'));assert.ok(html.includes('https://example.org/icon.png'));
console.log('23 public rendering checks passed: rich blocks, wrapping, inline colors, system/uploaded/removed callout icons');
