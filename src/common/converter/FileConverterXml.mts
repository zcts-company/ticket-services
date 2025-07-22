import { json2xml } from "xml-js";
import  xml2js, { parseStringPromise }  from "xml2js";

export class FileConverterXml {

    private version;
    private builder;

    constructor(){
        this.builder = new xml2js.Builder();
        this.version = '<?xml version="1.0" encoding="utf-8">'          
    }


    jsonToXmlOld(object:Object){
        const result = `${this.version}${json2xml(JSON.stringify(object),{compact:true})}</xml>`
            return result;
        }

    jsonToXml(object:Object){
        const result = this.builder.buildObject(this.normalizeNumericKeys(object))
            return result;
        }

    async xmlToJson(string:string): Promise<Object>{
                return await parseStringPromise(string, {
        explicitArray: false,
        trim: true,
        });
    }

    private normalizeNumericKeys(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.normalizeNumericKeys(item));
        }

        if (obj !== null && typeof obj === "object") {
            const newObj: any = {};
            for (const key in obj) {
                const value = obj[key];
                const normalizedKey = /^[0-9]+$/.test(key) ? `key_${key}` : key;
                newObj[normalizedKey] = this.normalizeNumericKeys(value);
            }
            return newObj;
        }

        return obj;
    }
}
