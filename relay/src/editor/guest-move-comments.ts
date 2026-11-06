import type {CommentThread,FileUpload} from './comment-types';
import type {BlockActivityInfo} from '../lib/block-activity';
/** Stage destination data first, so a storage limit cannot lose the source. */
export function stageGuestComments(sourceId:string,targetId:string,ids:Record<string,string>){
  const key=(id:string)=>`relay-guest-comments-v1:${id}`,sourceRaw=localStorage.getItem(key(sourceId)),targetRaw=localStorage.getItem(key(targetId));
  const empty=()=>({threads:[] as CommentThread[],files:{} as Record<string,FileUpload>});
  const source=sourceRaw?JSON.parse(sourceRaw) as ReturnType<typeof empty>:empty(),target=targetRaw?JSON.parse(targetRaw) as ReturnType<typeof empty>:empty();
  const moved=source.threads.filter(thread=>ids[thread.blockId]),threadIds=new Set(moved.map(thread=>thread.id));
  const next={threads:[...target.threads.filter(thread=>!threadIds.has(thread.id)),...moved.map(thread=>({...thread,blockId:ids[thread.blockId]}))],files:{...target.files}};
  for(const thread of moved)for(const message of thread.messages)for(const file of message.files)if(source.files[file.id])next.files[file.id]=source.files[file.id];
  const activityKey=(id:string)=>`relay-guest-block-activity-v1:${id}`,activityRaw=localStorage.getItem(activityKey(targetId));
  const sourceActivity=JSON.parse(localStorage.getItem(activityKey(sourceId))??'{}') as Record<string,BlockActivityInfo>,targetActivity=JSON.parse(activityRaw??'{}') as Record<string,BlockActivityInfo>;
  const remainingActivity={...sourceActivity};for(const [oldId,newId] of Object.entries(ids))if(sourceActivity[oldId]){targetActivity[newId]=sourceActivity[oldId];delete remainingActivity[oldId];}
  const restore=(name:string,value:string|null)=>{if(value===null)localStorage.removeItem(name);else localStorage.setItem(name,value);};
  const rollback=()=>{restore(key(targetId),targetRaw);restore(activityKey(targetId),activityRaw);};
  try{localStorage.setItem(key(targetId),JSON.stringify(next));localStorage.setItem(activityKey(targetId),JSON.stringify(targetActivity));}catch(error){rollback();throw error;}
  return{commit(){localStorage.setItem(key(sourceId),JSON.stringify({...source,threads:source.threads.filter(thread=>!threadIds.has(thread.id))}));localStorage.setItem(activityKey(sourceId),JSON.stringify(remainingActivity));},rollback};
}
