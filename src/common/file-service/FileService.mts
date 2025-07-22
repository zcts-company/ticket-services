import fs from "fs-extra"


export class FileService {

    constructor(){

    }

    async pathExsist(path:string){
        return await fs.pathExists(path)
    }

    async writeFile(path:string,data:string){
        await fs.outputFile(path,data)
    }

    async createDirectory(path:string){
        await fs.ensureDir(path);
    }

    async readFile(path:string){
       return await fs.readFile(path)
    }

    async readDiretory(path:string){
        return await fs.readdir(path);
    }

}