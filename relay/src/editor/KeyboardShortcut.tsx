import {ArrowBigUp,ArrowDown,ArrowUp,ArrowLeft,ArrowRight,CornerDownLeft,Command} from 'lucide-react';
const icons={Shift:ArrowBigUp,ArrowUp,ArrowDown,ArrowLeft,ArrowRight,Enter:CornerDownLeft,Meta:Command};
const labels:Record<string,string>={Control:'Ctrl',Escape:'Esc',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right'};
export function KeyboardShortcut({keys}:{keys:string[]}){
  const label=keys.map(key=>key==='Control'?'Control':labels[key]??key).join('+');
  return <span className="editor-keyboard-shortcut" role="img" data-editor-tooltip={label} aria-label={label}>{keys.map((key,index)=>{const Icon=icons[key as keyof typeof icons];return <span className="editor-shortcut-key" key={`${index}-${key}`}>{index?<span className="editor-shortcut-plus" aria-hidden>+</span>:null}<kbd aria-hidden>{Icon?<Icon/>:labels[key]??key}</kbd></span>;})}</span>;
}
