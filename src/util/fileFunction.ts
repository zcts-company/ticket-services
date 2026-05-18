export function nameOfFile(key:string, updated:Date, checkUpdate:boolean) {
        
    let dateStr:string = ''
    let timeStr:string = ''

    if(checkUpdate){
        dateStr = updated.toLocaleDateString().replace(new RegExp('[./]', 'g'),"_")
        timeStr = updated.toLocaleTimeString().replace(new RegExp(':', 'g'),"_")
    }
    
    return checkUpdate ? `${key}D${dateStr}T${timeStr}` : `${key}` 
}