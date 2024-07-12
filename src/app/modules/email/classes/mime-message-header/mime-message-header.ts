// regular expressions
const parameterRegex = /\s(\w+)=("([^"]*)"|([\w\d-]+))/gi;
const headerRegex = /([\w-]+):\s(.*)/gi;

export class MimeMessageHeader{
  constructor(
    public readonly name: string,
    public readonly value: string,
    ){ }
    
  private _parameters : MimeMessageHeaderParameter[] | undefined = undefined;
  public get parameters(): MimeMessageHeaderParameter[]{
    if(!this._parameters){
      var regex = new RegExp(parameterRegex);
      let params: MimeMessageHeaderParameter[] = []
      let result = regex.exec(this.value);
      while(result){
        params.push(new MimeMessageHeaderParameter(result[1], result[3] ?? result[4]));
        result = regex.exec(this.value);
      }  
      this._parameters = params;
    }      
    return this._parameters;
  }
}

export class MimeMessageHeaderParameter{
  constructor(
    public readonly attribute: string,
    public readonly value: string,
  ){}
}

/**
* Function to parse the header fields of a MIME-part
* @param rawMimeMessageHeaderContent 
* @returns 
*/
export function parseMimeMessageHeaders(rawMimeMessageHeaderContent: string) : MimeMessageHeader[]{
  let headers: MimeMessageHeader[] = [];
  let currentHeaderKey: string | undefined = undefined;
  let currentHeaderValue: string | undefined = undefined;

  for(let line of rawMimeMessageHeaderContent.split('\r\n')){
      let header = new RegExp(headerRegex);
      let result = header.exec(line);
      if(result != null){
          if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
              headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue)); 
          }
          currentHeaderKey = result[1];
          currentHeaderValue = result[2];
      }
      else if(line === ''){
          if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
              headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue)); 
          }
          currentHeaderKey = undefined;
          currentHeaderValue = undefined;
      }
      else if(currentHeaderValue !== undefined){
          currentHeaderValue = `${currentHeaderValue}\r\n${line}`
      }
  }
  if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
      headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue));
  }
  return headers;
}

/**
 * Find a header parameter attribute
 * @param parameters header parameters
 * @param attribute the attribute to search
 * @returns 
 */
export function findMimeHeaderParameter(parameters: MimeMessageHeaderParameter[], attribute: string) : MimeMessageHeaderParameter | undefined{
  return parameters.find(p => p.attribute.toLowerCase() === attribute);
}

/**
 * find a header by name
 * @param headers all headers 
 * @param name name of the header
 * @returns 
 */
export function findMimeHeader(headers: MimeMessageHeader[], name: string) : MimeMessageHeader | undefined{
  return headers.find(h => h.name.toLowerCase() === name);
}