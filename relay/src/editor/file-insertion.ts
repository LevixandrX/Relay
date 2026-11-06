import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {MAX_ASSET_BYTES,mediaKind,type EditorResources} from '../domain/blocks/rich-content';
import {uploadAsset} from './asset-upload';
const pendingUploads=new WeakMap<object,Set<string>>();
export const isAssetUploading=(editor:object,id:string)=>pendingUploads.get(editor)?.has(id)??false;
export const FileInsertion=Extension.create<{getResources:()=>EditorResources|undefined}>({
  name:'fileInsertion',addOptions(){return{getResources:()=>undefined};},
  addProseMirrorPlugins(){const editor=this.editor,getResources=this.options.getResources;
    const insert=(files:File[],at?:number)=>{
      const resources=getResources();if(!resources||!editor.isEditable||!files.length)return false;
      const pending=files.slice(0,10).map(file=>({file,id:`blk_${crypto.randomUUID()}`}));
      const active=pendingUploads.get(editor)??new Set<string>();pendingUploads.set(editor,active);pending.forEach(p=>active.add(p.id));
      editor.commands.insertContentAt(at??editor.state.selection,pending.map(({file,id})=>({type:mediaKind(file.type),attrs:{blockId:id,name:file.name,uploading:true}})));
      void(async()=>{for(const {file,id} of pending){let attributes:Record<string,unknown>;
        try{if(file.size>MAX_ASSET_BYTES)throw new Error('file_limit');const asset=await uploadAsset(resources,file);attributes={assetId:asset.id,name:asset.name,type:asset.type,size:asset.size,uploading:false,uploadError:false};}
        catch{attributes={uploading:false,uploadError:true};}
        active.delete(id);if(editor.isDestroyed)return;
        let pos:number|null=null;editor.state.doc.descendants((node,at)=>{if(node.attrs.blockId===id){pos=at;return false;}});
        if(pos!==null){const node=editor.state.doc.nodeAt(pos)!;editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,...attributes}).setMeta('addToHistory',false));}
      }})();return true;
    };
    return[new Plugin({key:new PluginKey('fileInsertion'),props:{
      handlePaste:(_view,event)=>insert(Array.from(event.clipboardData?.files??[])),
      handleDrop:(view,event)=>{const files=Array.from(event.dataTransfer?.files??[]);if(!files.length)return false;const point=view.posAtCoords({left:event.clientX,top:event.clientY});return insert(files,point?.pos);},
    }})];
  },
});
