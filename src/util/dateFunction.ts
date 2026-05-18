
export function toDateForSQL(date:Date):string{
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString()}`
}

export function toIsoStringLocalDate(date:Date){
    let res = date.toLocaleString('sv-SE')
    return res.replace(' ','T')
}