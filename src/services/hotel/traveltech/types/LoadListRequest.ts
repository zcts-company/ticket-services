export type LoadListRequest = {
        lang:"ru"|"en",
        createdFrom:string,
        createdTo:string,
        pageSize:number,
        pageNumber: number
}