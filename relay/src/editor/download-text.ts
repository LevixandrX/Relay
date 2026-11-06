export type TextSaver=(name:string,text:string)=>Promise<'saved'|'cancelled'>;
const extensions:Record<string,string>={javascript:'js',typescript:'ts',python:'py',plaintext:'txt',bash:'sh',shell:'sh',xml:'html',cpp:'cpp',csharp:'cs',markdown:'md',ruby:'rb',rust:'rs',kotlin:'kt',objectivec:'m',makefile:'mk'};
export const codeFilename=(language:unknown)=>'code.'+(extensions[String(language)]??(String(language||'txt').replace(/[^a-z0-9]/gi,'').slice(0,16)||'txt'));
export async function downloadText(name:string,text:string,save?:TextSaver):Promise<'saved'|'cancelled'|'started'>{
  if(save)return save(name,text);
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return 'started';
}
