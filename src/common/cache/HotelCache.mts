
export class HotelCache {

    private cache:Map<string,any>;
    private providerName:string;

    constructor(providerName:string){
        this.cache = new Map()
        this.providerName = providerName;
    }

    getCache(){
        return new Map(this.cache);
    }

    addToCache(key:string,object:any){
        this.cache.set(key,object)
    }

    fillCache(map:Map<string,any>){
        this.cache = map;
    }

    getItem(id:string){
        return this.cache.get(id)
    }

    clearCache(){
        this.cache.clear();
    }

    getProviderName(){
        return this.providerName;
    }

}