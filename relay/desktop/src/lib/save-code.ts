import {invoke,isTauri} from '@tauri-apps/api/core';
async function saveCode(name:string,text:string):Promise<'saved'|'cancelled'>{return await invoke<boolean>('save_code',{name,text})?'saved':'cancelled';}
export const nativeSaveCode=isTauri()?saveCode:undefined;
