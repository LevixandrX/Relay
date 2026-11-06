import {stopBlockToolEvent} from './node-view-events';
import { Node, mergeAttributes } from "@tiptap/core";
import {ReactNodeViewRenderer} from '@tiptap/react';
import {CalloutView} from './CalloutView';
import type {CommentContext} from './comment-types';
import type {EditorResources} from '../domain/blocks/rich-content';
export const BlockCallout = Node.create<{getResources:()=>EditorResources|undefined;getComments:()=>CommentContext|undefined}>({
  name: "callout", group: "block", content: "block+", defining: true,
  addOptions(){return{getResources:()=>undefined,getComments:()=>undefined};},
  addAttributes() { return { emoji: { default: "💡" },iconName:{default:null},iconAssetId:{default:null},iconColor:{default:null},iconSrc:{default:null} }; },
  parseHTML() { return [{ tag: 'div[data-type="callout"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout", "data-emoji": HTMLAttributes.emoji, class: "relay-block-callout" }), 0];
  },
  addNodeView(){return ReactNodeViewRenderer(CalloutView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});},
});
