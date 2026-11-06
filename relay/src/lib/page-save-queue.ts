/** Serialize writes to each page against its last acknowledged server version. */
export class PageSaveQueue {
  private tails=new Map<string,Promise<unknown>>();
  private versions=new Map<string,string>();
  seed(id:string,version:string){if(!this.tails.has(id))this.versions.set(id,version);}
  save<T extends {updatedAt:string}>(id:string,base:string,write:(version:string)=>Promise<T>):Promise<T>{
    const next=(this.tails.get(id)??Promise.resolve()).catch(()=>undefined).then(async()=>{
      const result=await write(this.versions.get(id)??base);this.versions.set(id,result.updatedAt);return result;
    });
    this.tails.set(id,next);
    void next.then(()=>{if(this.tails.get(id)===next)this.tails.delete(id);},()=>{if(this.tails.get(id)===next)this.tails.delete(id);});
    return next;
  }
}
