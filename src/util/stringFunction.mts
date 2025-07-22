export function replaceSymbols(description: string): string {
        description = description.replace(/<[^>]*>/g, ''); 
        description = description.replace(/[\n\b\&nbsp\&amp]/g, '');  
    return description;   
}