// regular expressions
const parameterRegex = /\s(\w+)=("([^"]*)"|([\w\d-]+))/gi;
export const headerRegex = /([\w-]+):\s(.*)/gi;

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
